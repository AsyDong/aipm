// ============================================================================
// 最小 HTTP 服务 —— 本地端到端验证用（**不是生产代码**）。
//
// 对齐 server/server.ts 的全部接口，把有外部依赖的两块换成「确定性模拟」：
//   · 出题 / 变式 / 批改 —— 复用真实 engine（questions.ts / grading.ts），
//     数据形状是真的，能验证 QSpec 序列化与判分结果过得了 JSON。
//   · 跟读评分 /api/score —— 本地按词确定性打分，**不调用讯飞、不需要密钥**，
//     让「录音 → 打分 → 读不好的词回灌错题本」这条链路在离线状态下也能跑通。
//   · 同步 /api/sync · /api/state · /api/claim · /api/login —— 内存态，
//     够验证「攒队列 → 批量推 → 幂等去重 → 拉回合并」的往返契约。
//
// 用法：另开一个终端 `npm run mock-api`（默认 8787）。
// 配合 .env.local 里的 VITE_API_BASE_URL=http://127.0.0.1:8787，
// 即可在完全离线的情况下验证四条链路：远端出题 / 远端批改 / 跟读评分 / 跨设备同步。
// ============================================================================

import { createServer, type IncomingMessage, type ServerResponse } from 'node:http'
import { MATH_LEVELS, buildLevelQuestions, variantsOf } from '../src/engine/questions'
import { gradeLocally, needsModel } from '../src/engine/grading'
import type { GenRequest, GradeRequest } from '../src/engine/provider/contract'
import type { Question } from '../src/types'

const PORT = Number(process.env.PORT ?? 8787)

function readJson(req: IncomingMessage): Promise<Record<string, unknown>> {
  return new Promise((resolve, reject) => {
    let raw = ''
    req.on('data', (c) => {
      raw += c
    })
    req.on('end', () => {
      try {
        resolve(raw ? (JSON.parse(raw) as Record<string, unknown>) : {})
      } catch (e) {
        reject(e)
      }
    })
    req.on('error', reject)
  })
}

/**
 * 跨域头。本地开发时页面在 5173/5180、服务在 8787，属于跨源，必须放开。
 * 注意 x-sync-token / x-child-pin 是同步接口的自定义头，不列进 Allow-Headers
 * 浏览器预检会直接失败。生产部署建议用 nginx 把 /api 反代到同域（更安全）。
 */
function cors(res: ServerResponse): void {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-sync-token, x-child-pin')
}

function json(res: ServerResponse, obj: unknown, code = 200): void {
  const body = JSON.stringify(obj)
  cors(res)
  res.writeHead(code, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
  })
  res.end(body)
}

// ---- 跟读评分：确定性模拟 ---------------------------------------------------
//
// 同一个词永远同一个分（FNV-1a 哈希），方便反复测试时对照：
// 某些词稳定落在 85 分以下 → 会触发 lowWords → rd_word 回灌错题本，链路可复现。
function hashStr(s: string): number {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

/** 72~100：低位数模拟「没读到位」，覆盖到 <85 的薄弱词，便于验证回灌 */
function mockWordScore(word: string): number {
  return 72 + (hashStr(word.toLowerCase()) % 29)
}

function mockScore(text: string): {
  total: number
  words: { word: string; score: number; dp_message: number }[]
  dimensions: Record<string, number>
  is_rejected: boolean
  except_info: number
} {
  const tokens = text.trim().split(/\s+/).filter(Boolean)
  const words = tokens.map((w) => {
    // 去掉首尾标点再打分，但 word 原样回传，保证能按同下标对齐
    const clean = w.replace(/^[^A-Za-z]+|[^A-Za-z]+$/g, '') || w
    const score = mockWordScore(clean)
    // 1/12 的概率模拟漏读（dp=16）：故意留一条让「漏读优先」的分支也能被测到
    const missed = tokens.length > 2 && hashStr(clean) % 12 === 0
    return { word: w, score: missed ? 0 : score, dp_message: missed ? 16 : 0 }
  })
  const scored = words.filter((w) => w.dp_message === 0)
  const total = scored.length
    ? Math.round(scored.reduce((a, w) => a + w.score, 0) / scored.length)
    : 0
  const dim = (base: number) => Math.max(0, Math.min(100, total + base))
  return {
    total,
    words,
    dimensions: { pronunciation: dim(-2), fluency: dim(2), integrity: dim(0), rhythm: dim(-4) },
    is_rejected: false,
    except_info: 0,
  }
}

// ---- 同步：内存态 -----------------------------------------------------------
//
// 只保留「幂等去重 + 版本号递增」这两个契约点：重推同一 opId 不会重复计数，
// serverVersion 单调递增（前端只在意它变大）。
const seenOps = new Set<string>()
let serverVersion = 0

const server = createServer(async (req, res) => {
  try {
    const url = (req.url ?? '').split('?')[0]

    if (req.method === 'OPTIONS') {
      cors(res)
      res.writeHead(204)
      res.end()
      return
    }

    // ---- 探活与评测自检 ----
    if (req.method === 'GET' && url === '/health') {
      json(res, { ok: true, pgOk: true, env: 'mock', uptime: process.uptime() })
      return
    }

    if (req.method === 'GET' && url === '/api/score/health') {
      json(res, {
        ok: true,
        provider: 'mock',
        config_found: true,
        credentials_ready: true,
        hint: '本地模拟评测（按词确定性打分，不调用讯飞、不产生计费）',
      })
      return
    }

    if (req.method !== 'POST' && !(req.method === 'GET' && url === '/api/state')) {
      json(res, { error: 'not found' }, 404)
      return
    }

    const body = req.method === 'POST' ? await readJson(req) : {}

    // ---- 跟读评分（模拟）----
    if (url === '/api/score') {
      const text = String(body.text ?? '').trim()
      const category = String(body.category ?? 'read_sentence')
      if (!text) { json(res, 400, { ok: false, error: '缺少 text（参考文本）' }); return }
      if (!body.audio) { json(res, 400, { ok: false, error: '缺少 audio（录音数据）' }); return }
      if (/[[\]]/.test(text)) {
        json(res, 400, { ok: false, error: '参考文本里不能出现中括号 [ ]（讯飞用它做试卷标签）' })
        return
      }
      const r = mockScore(text)
      console.log(`[score:mock] category=${category} text=${JSON.stringify(text)} total=${r.total}`)
      json(res, { ok: true, provider: 'mock', ...r, except_msg: '' })
      return
    }

    // ---- 出题（复用真实 engine）----
    if (url === '/api/gen') {
      const g = body as unknown as GenRequest
      const level = MATH_LEVELS.find((l) => l.id === g.levelId) ?? MATH_LEVELS[0]
      const questions = buildLevelQuestions(level, g.inject ?? [], g.count)
      // 真实后端这里应先查题库：命中返回 source:'cache'（零模型成本），
      // 未命中再调模型生成，返回 source:'llm'。
      console.log(`[gen:mock] levelId=${g.levelId} count=${g.count} inject=${(g.inject ?? []).length} -> ${questions.length} 题`)
      json(res, { questions, source: 'cache' })
      return
    }

    if (url === '/api/variants') {
      const { seed, count } = body as unknown as { seed: Question; count: number }
      console.log(`[variants:mock] seed=${seed?.spec?.kind} count=${count}`)
      json(res, { questions: variantsOf(seed.spec).slice(0, count), source: 'cache' })
      return
    }

    // ---- 批改（复用真实判分器）----
    if (url === '/api/grade') {
      const { question, input } = body as unknown as GradeRequest
      // 关键：服务端也必须先用本地判分器。答案唯一的题不进模型，这是成本闸门
      if (needsModel(question)) {
        console.log(`[grade:mock] kind=${question?.spec?.kind} 开放题 -> deferred`)
        json(res, { correct: false, by: 'remote', deferred: true, feedback: '开放题批改待实现' })
        return
      }
      const r = gradeLocally(question, input)
      console.log(`[grade:mock] kind=${question?.spec?.kind} input=${JSON.stringify(input)} -> ${r.correct ? '对' : '错'}`)
      json(res, r)
      return
    }

    // ---- 设备绑定 / 登录（内存态，任何码都放行）----
    if (url === '/api/claim' || url === '/api/login') {
      const childId = String(body.childId ?? '')
      if (!childId) { json(res, 400, { error: '缺少 childId' }); return }
      console.log(`[auth:mock] ${url} childId=${childId}`)
      json(res, { ok: true })
      return
    }

    // ---- 同步（幂等 + 版本号）----
    if (url === '/api/sync') {
      const ops = Array.isArray(body.ops) ? (body.ops as { opId?: string }[]) : []
      let applied = 0
      for (const op of ops) {
        const id = String(op.opId ?? '')
        if (!id || seenOps.has(id)) continue // 幂等：重推不重复计数
        seenOps.add(id)
        applied++
      }
      serverVersion++
      console.log(`[sync:mock] childId=${String(body.childId ?? '')} ops=${ops.length} applied=${applied} v=${serverVersion}`)
      json(res, { ok: true, applied, failed: 0, errors: [], serverVersion })
      return
    }

    // ---- 拉取远端状态（返回空集合即「服务端还没有这台设备的数据」）----
    if (req.method === 'GET' && url === '/api/state') {
      json(res, {
        childId: new URL(req.url ?? '', 'http://x').searchParams.get('childId') ?? '',
        child: null,
        pet: null,
        templates: [],
        daily: [],
        prizes: [],
        redeems: [],
        ledgers: [],
        levels: [],
        lastStreak: null,
      })
      return
    }

    json(res, { error: 'unknown endpoint' }, 404)
  } catch (e) {
    json(res, { error: e instanceof Error ? e.message : String(e) }, 500)
  }
})

server.listen(PORT, () => {
  console.log(
    `mock api ready on http://127.0.0.1:${PORT}\n`
    + '  GET  /health | /api/score/health | /api/state\n'
    + '  POST /api/score | /api/gen | /api/variants | /api/grade | /api/claim | /api/login | /api/sync',
  )
})
