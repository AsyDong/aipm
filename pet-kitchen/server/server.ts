// ============ 萌宠打卡 后端服务（零依赖，Node 22+） ============
//
// 接口：
//   GET  /health                     存活检查
//   POST /api/gen                    出题（复用前端同款引擎，行为与本地一致）
//   POST /api/variants               举一反三变式
//   POST /api/grade                  判分（答案唯一的题本地判，永不调模型）
//   POST /api/claim                  首次设置孩子登录码（6 位数字，设备绑定的起点）
//   POST /api/login                  验证 编号+登录码（换设备时用）
//   POST /api/sync                   客户端数据入库（op 幂等，重试不会写重）
//   GET  /api/state                  跨设备拉取（实体快照 + 最近账本，配合客户端合并）
//   GET  /api/report                 成长报告（按孩子 + 天数查快照）
//
// op → SQL 的分发在 server/ops.ts；本文件只管 HTTP、鉴权、PG 连接。
// 支持的 op：
//   事件流（只能靠 op_id 去重）      attempt / ledger
//   实体快照（按业务主键 upsert）    child / pet / task_template / daily_task / prize / redeem
//
// 失败语义：单条 op 出错不再拖垮整批 —— 见 /api/sync 里的逐条上报。
//
// 鉴权：sync / state 要求孩子编号 + 登录码（x-child-pin 头，scrypt 哈希存 children.pin_hash，
// 见 server/auth.ts）；report 仍走共享 SYNC_TOKEN（只在服务端脚本里用，不进前端）。
//
// 数据库：腾讯云 CloudBase PostgreSQL（走 exec-pgsql，参数化 SQL，API Key 鉴权）
// 环境变量：PORT / TCB_ENV_ID / TCB_API_KEY / SYNC_TOKEN（可选，仅 report 校验）

import http from 'node:http'
import {
  MATH_LEVELS, levelById, buildLevelQuestions, variantsOf, buildQuestion, type LevelDef,
} from '../src/engine/questions'
import { gradeLocally, needsModel, normalizeNumeric } from '../src/engine/grading'
import { QUESTIONS_PER_LEVEL } from '../src/engine/rules'
import { PgError, applyOp, OPS_PER_REQUEST, type Op } from './ops'
import { PIN_PATTERN, hashPin, verifyPin, lockRemaining, recordFail, clearFails } from './auth'

const PORT = Number(process.env.PORT || 8787)
const ENV_ID = process.env.TCB_ENV_ID || ''
const API_KEY = process.env.TCB_API_KEY || ''
const SYNC_TOKEN = process.env.SYNC_TOKEN || ''
const PG_BASE = `https://${ENV_ID}.api.tcloudbasegateway.com`

// ---------- PG 访问 ----------

let pgOk = true
let pgLastError = ''

async function pg(sql: string, parameters: unknown[] = []): Promise<Record<string, unknown>[]> {
  let res: Response
  try {
    res = await fetch(`${PG_BASE}/v1/rdb/exec-pgsql`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${API_KEY}` },
      body: JSON.stringify({ sql, parameters, role: 'cloudbase_postgres' }),
    })
  } catch (e) {
    // 连不上网关：基础设施问题 → 客户端保留数据重推
    pgOk = false
    pgLastError = `PG 不可达: ${(e as Error).message}`
    throw new PgError(pgLastError, true)
  }
  const body: unknown = await res.json().catch(() => null)
  if (!res.ok) {
    // 5xx / 429 = 网关或数据库本身的问题（重推可能就好了）
    // 4xx      = 这条 SQL 本身被拒（类型 / 约束 / 列名，重推一万次也一样）
    const transient = res.status >= 500 || res.status === 429
    pgLastError = `PG ${res.status}: ${JSON.stringify(body).slice(0, 300)}`
    // 只有基础设施故障才判「数据库不健康」—— SQL 写错不该让 /health 变红
    if (transient) pgOk = false
    throw new PgError(pgLastError, transient)
  }
  pgOk = true
  return Array.isArray(body) ? body : []
}

// ---------- 基础设施 ----------

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type,x-sync-token',
}

function send(res: http.ServerResponse, code: number, obj: unknown): void {
  const body = JSON.stringify(obj)
  res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8', ...CORS })
  res.end(body)
}

function readBody(req: http.IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let size = 0
    const chunks: Buffer[] = []
    req.on('data', (c: Buffer) => {
      size += c.length
      if (size > 2 * 1024 * 1024) { reject(new Error('body too large')); req.destroy() }
      else chunks.push(c)
    })
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')))
    req.on('error', reject)
  })
}

// ---------- 出题 / 判分 ----------

function genQuestions(req: {
  subject?: string; levelId?: string; count?: number; inject?: unknown[]; attr?: number
}) {
  const level: LevelDef = levelById(req.levelId ?? '') ?? MATH_LEVELS[0]
  const inject = Array.isArray(req.inject) ? (req.inject as import('../src/types').QSpec[]) : []
  const n = Math.min(Math.max(req.count ?? QUESTIONS_PER_LEVEL, 1), 20)
  return buildLevelQuestions(level, inject, n)
}

// ---------- 孩子登录码（设备绑定） ----------

/** /api/sync 与 /api/state 的唯一凭证：孩子编号 + 登录码（x-child-pin 头）。 */

function pinOf(req: http.IncomingMessage): string {
  return String(req.headers['x-child-pin'] ?? '')
}

/** 校验 childId + pin 是否匹配。对 → 清失败计数；错 → 记一次并返回 401 语义 */
async function authChild(childId: string, pin: string): Promise<boolean> {
  const lock = lockRemaining(childId)
  if (lock > 0) return false
  const [row] = await pg(`SELECT pin_hash FROM children WHERE id=$1`, [childId])
  if (!row || !verifyPin(pin, row.pin_hash as string | null)) {
    recordFail(childId)
    return false
  }
  clearFails(childId)
  return true
}

function unauthorized(res: http.ServerResponse, childId: string): void {
  const lock = lockRemaining(childId)
  send(res, 401, { error: lock > 0 ? `尝试过多，请 ${lock} 秒后再试` : '需要登录（孩子编号 + 登录码）' })
}

// ---------- HTTP 路由 ----------

const server = http.createServer(async (req, res) => {
  if (req.method === 'OPTIONS') {
    res.writeHead(204, CORS)
    res.end()
    return
  }
  const url = (req.url ?? '').split('?')[0]
  try {
    if (req.method === 'GET' && url === '/health') {
      // 实探一次数据库：pgOk 缓存值初始为 true，凭据无效（401）时不会自己变红
      let live = true
      try {
        await pg('SELECT 1')
      } catch {
        live = false
      }
      send(res, 200, { ok: true, pgOk: live, pgLastError, env: ENV_ID, uptime: process.uptime() })
      return
    }

    if (req.method === 'POST' && url === '/api/gen') {
      const body = JSON.parse(await readBody(req))
      const questions = genQuestions(body)
      send(res, 200, { questions, source: 'local' })
      return
    }

    if (req.method === 'POST' && url === '/api/variants') {
      const body = JSON.parse(await readBody(req))
      const count = Math.min(Math.max(body.count ?? 3, 1), 6)
      const questions = variantsOf(body.seed.spec).slice(0, count)
      if (questions.length < count && questions.length > 0) {
        while (questions.length < count) questions.push(buildQuestion(body.seed.spec))
      }
      send(res, 200, { questions, source: 'local' })
      return
    }

    if (req.method === 'POST' && url === '/api/grade') {
      const body = JSON.parse(await readBody(req))
      const q = body.question
      if (!q || typeof q.answer !== 'number') { send(res, 400, { error: 'bad question' }); return }
      if (needsModel(q)) {
        // 开放答案：接大模型的位置（先返回未支持，前端可自行兜底）
        send(res, 200, { correct: false, by: 'model', feedback: '开放题型批改接入中' })
        return
      }
      send(res, 200, gradeLocally(q, String(body.input ?? '')))
      return
    }

    // 首次设置登录码（claim）：children 行不存在则先建（name 先占位，child op 会带上真名）。
    // 原子性靠 WHERE pin_hash IS NULL：并发 claim 只有一个能成。
    if (req.method === 'POST' && url === '/api/claim') {
      const body = JSON.parse(await readBody(req)) as { childId?: string; pin?: string }
      const childId = String(body.childId ?? '')
      const pin = String(body.pin ?? '')
      if (!childId || !PIN_PATTERN.test(pin)) { send(res, 400, { error: '参数不对（需要 childId 和 6 位数字码）' }); return }
      const lock = lockRemaining(childId)
      if (lock > 0) { send(res, 429, { error: `尝试过多，请 ${lock} 秒后再试` }); return }
      await pg(
        `INSERT INTO children (id, name) VALUES ($1, '宝贝') ON CONFLICT (id) DO NOTHING`, [childId],
      )
      const rows = await pg(
        `UPDATE children SET pin_hash=$2 WHERE id=$1 AND pin_hash IS NULL RETURNING id`, [childId, hashPin(pin)],
      )
      if (rows.length === 0) { send(res, 409, { error: '这个孩子已设置过登录码，请直接登录' }); return }
      send(res, 200, { ok: true })
      return
    }

    // 登录：换设备 / 重新绑定时验证 编号+码。成功后客户端把编号+码存本地，之后每次请求都带。
    if (req.method === 'POST' && url === '/api/login') {
      const body = JSON.parse(await readBody(req)) as { childId?: string; pin?: string }
      const childId = String(body.childId ?? '')
      const pin = String(body.pin ?? '')
      if (!childId || !PIN_PATTERN.test(pin)) { send(res, 400, { error: '参数不对' }); return }
      const ok = await authChild(childId, pin)
      if (!ok) { unauthorized(res, childId); return }
      send(res, 200, { ok: true })
      return
    }

    if (req.method === 'POST' && url === '/api/sync') {
      const body = JSON.parse(await readBody(req)) as { childId?: string; ops?: Op[] }
      const childId = String(body.childId ?? 'default')
      if (!(await authChild(childId, pinOf(req)))) { unauthorized(res, childId); return }
      const ops = Array.isArray(body.ops) ? body.ops.slice(0, OPS_PER_REQUEST) : []

      let applied = 0
      const failedIds: string[] = []
      const errors: string[] = []

      // 逐条处理 + 逐条上报失败。
      // 一条坏数据不该让整批 200 条一起失败 —— 上一版就是这样：客户端只看到「这批 500」，
      // 那条坏 op 永远卡在队头，它后面的数据全推不上去，而且没有任何线索能定位到它。
      for (const op of ops) {
        try {
          await applyOp(pg, childId, op)
          applied++
        } catch (e) {
          const err = e as PgError
          // 基础设施故障：整批退回 → 客户端保留全部数据，下次重推
          if (err.transient) throw err
          failedIds.push(String(op.opId ?? op.kind ?? '?'))
          if (errors.length < 3) errors.push(`${op.kind}: ${err.message.slice(0, 160)}`)
        }
      }

      // 一条都没成、且不止一条 —— 更像是基础设施问题被误判成了数据问题。
      // 宁可整批重推（op 幂等，不会写重），也不要一口气丢掉客户端攒了很久的数据。
      if (ops.length > 1 && failedIds.length === ops.length) {
        throw new PgError(
          `整批 ${ops.length} 条全部失败，按基础设施问题处理：${errors[0] ?? '原因未记录'}`,
          true,
        )
      }

      const rows = await pg(
        `INSERT INTO sync_state (child_id, last_sync_at, server_version)
         VALUES ($1, now(), 1)
         ON CONFLICT (child_id) DO UPDATE SET last_sync_at=now(), server_version=sync_state.server_version+1
         RETURNING server_version`,
        [childId],
      )
      send(res, 200, {
        applied,
        failed: failedIds.length,
        failedIds,
        errors,
        total: ops.length,
        serverVersion: rows[0]?.server_version ?? 1,
      })
      return
    }

    if (req.method === 'GET' && url === '/api/report') {
      if (SYNC_TOKEN && req.headers['x-sync-token'] !== SYNC_TOKEN) {
        send(res, 403, { error: 'forbidden' })
        return
      }
      const q = new URLSearchParams((req.url ?? '').split('?')[1] ?? '')
      const childId = q.get('childId') ?? 'default'
      const days = Math.min(Math.max(Number(q.get('days') ?? 30), 1), 365)
      const snapshots = await pg(
        `SELECT day, satiety, fed, is_full, body, streak, tasks_done, tasks_total, battles,
                correct_rate, points_earned, food_earned
         FROM daily_snapshots WHERE child_id=$1 AND day >= current_date - $2::int ORDER BY day`,
        [childId, days],
      )
      const weak = await pg(
        `SELECT subject, question_text, wrong_count FROM wrong_items
         WHERE child_id=$1 AND NOT mastered ORDER BY wrong_count DESC LIMIT 20`,
        [childId],
      )
      send(res, 200, {
        childId, days,
        snapshots: snapshots.map((s) => ({ ...s, full: s.is_full, is_full: undefined })),
        weakSkills: weak,
      })
      return
    }

    // 跨设备拉取：客户端把本地排空（队列清零）后来拉全量实体，按「服务端为准」合并。
    // 只拉实体快照与账本；题目/答题记录等事件流是 AppendOp，不回放。
    // day 由客户端传入（游戏日按 UTC+8，服务端时区未必一致，不能拿服务端 current_date 拼）。
    if (req.method === 'GET' && url === '/api/state') {
      const q = new URLSearchParams((req.url ?? '').split('?')[1] ?? '')
      const childId = q.get('childId') ?? 'default'
      if (!(await authChild(childId, pinOf(req)))) { unauthorized(res, childId); return }
      const day = q.get('day') ?? ''
      const [child] = await pg(
        `SELECT name, grade, textbook_ver AS "textbookVer" FROM children WHERE id=$1`, [childId],
      )
      const [pet] = await pg(
        `SELECT species, name, stage, exp, satiety, fed_today AS "fedToday", attrs
         FROM pets WHERE child_id=$1`, [childId],
      )
      const templates = await pg(
        `SELECT id, name, type, subject, food_value AS "foodValue", active, enabled,
                icon, note, kind, weekdays, once_day AS "onceDay"
         FROM task_templates WHERE child_id=$1`, [childId],
      )
      const daily = await pg(
        `SELECT d.id, d.day, d.template_id AS "templateId", d.status, d.media_key AS "mediaKey",
                d.note, d.at,
                t.name AS "tplName", t.icon AS "tplIcon", t.type AS "tplType",
                t.note AS "tplNote", t.kind AS "tplKind", t.food_value AS "tplFood"
         FROM daily_tasks d LEFT JOIN task_templates t ON t.id = d.template_id
         WHERE d.child_id=$1 AND d.day >= COALESCE($2::date, current_date - 7)
         ORDER BY d.day`, [childId, day || null],
      )
      const prizes = await pg(
        `SELECT id, name, points, note, active FROM prizes WHERE child_id=$1`, [childId],
      )
      const redeems = await pg(
        `SELECT id, prize_id AS "prizeId", prize_name AS "prizeName", points, status AS "state",
                created_at AS "at", decided_at AS "decidedAt"
         FROM redeems WHERE child_id=$1 ORDER BY created_at DESC LIMIT 200`, [childId],
      )
      // 账本按时间倒序取最近 400 条（food/point 各约 200）——首行的 balance 就是当前余额，
      // 客户端拿它对齐钱包，不必回放全部流水重算。
      const ledgers = await pg(
        `SELECT op_id AS "opId", kind, delta, balance, source, note, at
         FROM ledgers WHERE child_id=$1 ORDER BY at DESC LIMIT 400`, [childId],
      )
      // 闯关进度（best_stars 服务端取 GREATEST，天然不回退）；星级/通关/次数足够重建进度，
      // bestCorrect/total 服务端没存，置 0 不影响解锁与星显。
      const levels = await pg(
        `SELECT level_id AS "levelId", best_stars AS "bestStars", cleared, play_count AS "playCount"
         FROM level_records WHERE child_id=$1`, [childId],
      )
      // 连续打卡天数：快照里最后一天的 streak 就是当前值（跨天结算时写入）
      const [lastSnap] = await pg(
        `SELECT day, streak FROM daily_snapshots WHERE child_id=$1 ORDER BY day DESC LIMIT 1`, [childId],
      )
      send(res, 200, {
        childId, child: child ?? null, pet: pet ?? null, templates, daily, prizes, redeems, ledgers,
        levels, lastStreak: lastSnap ?? null,
      })
      return
    }

    send(res, 404, { error: 'not found' })
  } catch (e) {
    send(res, 500, { error: (e as Error).message })
  }
})

server.listen(PORT, () => {
  console.log(`[pet-checkin] listening on :${PORT}  env=${ENV_ID || '(unset)'}  pgKey=${API_KEY ? 'set' : 'MISSING'}`)
})
