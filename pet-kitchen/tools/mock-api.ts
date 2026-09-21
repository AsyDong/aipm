// ============================================================================
// 最小 HTTP 服务 —— 仅用于验证前端 remote provider 的契约能真正跑通。
//
// 这不是生产代码。它刻意复用了真实的 engine（questions.ts / grading.ts），
// 所以往返的数据形状是真实的：能验证 QSpec 序列化、题目字段、判分结果
// 都能过得了 JSON 这一关。
//
// P1 的正式后端会替换掉它，实现真正的题库沉淀与模型调用。
// 运行：npm run mock-api
// ============================================================================

import { createServer, type IncomingMessage, type ServerResponse } from 'node:http'
import { MATH_LEVELS, buildLevelQuestions, buildQuestion, variantsOf } from '../src/engine/questions'
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
 * 生产部署建议用 nginx 把 /api 反代到同域，就不需要这些头了（也更安全）。
 */
function cors(res: ServerResponse): void {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
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

createServer(async (req, res) => {
  try {
    const url = req.url ?? ''

    if (req.method === 'OPTIONS') {
      cors(res)
      res.writeHead(204)
      res.end()
      return
    }

    if (req.method !== 'POST' || !url.startsWith('/api/')) {
      json(res, { error: 'not found' }, 404)
      return
    }
    const body = await readJson(req)

    if (url === '/api/gen') {
      const g = body as unknown as GenRequest
      const level = MATH_LEVELS.find((l) => l.id === g.levelId) ?? MATH_LEVELS[0]
      const questions = buildLevelQuestions(level, g.inject ?? [], g.count)
      // 真实后端这里应先查题库：命中返回 source:'cache'（零模型成本），
      // 未命中再调模型生成，返回 source:'llm'。
      json(res, { questions, source: 'cache' })
      return
    }

    if (url === '/api/variants') {
      const { seed, count } = body as unknown as { seed: Question; count: number }
      json(res, { questions: variantsOf(seed.spec).slice(0, count), source: 'cache' })
      return
    }

    if (url === '/api/grade') {
      const { question, input } = body as unknown as GradeRequest
      // 关键：服务端也必须先用本地判分器。答案唯一的题不进模型，这是成本闸门
      if (needsModel(question)) {
        json(res, { correct: false, by: 'remote', deferred: true, feedback: '开放题批改待实现' })
        return
      }
      json(res, gradeLocally(question, input))
      return
    }

    json(res, { error: 'unknown endpoint' }, 404)
  } catch (e) {
    json(res, { error: e instanceof Error ? e.message : String(e) }, 500)
  }
}).listen(PORT, () => {
  console.log(`mock api ready on http://127.0.0.1:${PORT}  (gen / variants / grade)`)
})
