// ============ 萌宠打卡 后端服务（零依赖，Node 22+） ============
//
// 接口：
//   GET  /health                     存活检查
//   POST /api/gen                    出题（复用前端同款引擎，行为与本地一致）
//   POST /api/variants               举一反三变式
//   POST /api/grade                  判分（答案唯一的题本地判，永不调模型）
//   POST /api/sync                   客户端数据入库（op 幂等，重试不会写重）
//   GET  /api/report                 成长报告（按孩子 + 天数查快照）
//
// 数据库：腾讯云 CloudBase PostgreSQL（走 exec-pgsql，参数化 SQL，API Key 鉴权）
// 环境变量：PORT / TCB_ENV_ID / TCB_API_KEY / SYNC_TOKEN（可选，sync+report 校验）

import http from 'node:http'
import {
  MATH_LEVELS, buildLevelQuestions, variantsOf, buildQuestion, type LevelDef,
} from '../src/engine/questions'
import { gradeLocally, needsModel, normalizeNumeric } from '../src/engine/grading'
import { QUESTIONS_PER_LEVEL } from '../src/engine/rules'

const PORT = Number(process.env.PORT || 8787)
const ENV_ID = process.env.TCB_ENV_ID || ''
const API_KEY = process.env.TCB_API_KEY || ''
const SYNC_TOKEN = process.env.SYNC_TOKEN || ''
const PG_BASE = `https://${ENV_ID}.api.tcloudbasegateway.com`

// ---------- PG 访问 ----------

let pgOk = true
let pgLastError = ''

async function pg(sql: string, parameters: unknown[] = []): Promise<Record<string, unknown>[]> {
  const res = await fetch(`${PG_BASE}/v1/rdb/exec-pgsql`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${API_KEY}` },
    body: JSON.stringify({ sql, parameters, role: 'cloudbase_postgres' }),
  })
  const body: unknown = await res.json().catch(() => null)
  if (!res.ok) {
    pgOk = false
    pgLastError = `PG ${res.status}: ${JSON.stringify(body).slice(0, 200)}`
    throw new Error(pgLastError)
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
  const level: LevelDef = MATH_LEVELS.find((l) => l.id === req.levelId) ?? MATH_LEVELS[0]
  const inject = Array.isArray(req.inject) ? (req.inject as import('../src/types').QSpec[]) : []
  const n = Math.min(Math.max(req.count ?? QUESTIONS_PER_LEVEL, 1), 20)
  return buildLevelQuestions(level, inject, n)
}

// ---------- 同步 ----------

interface Op { opId?: string; kind?: string; data?: Record<string, unknown> }

async function applyOp(childId: string, op: Op): Promise<'applied' | 'skipped'> {
  const d = op.data ?? {}
  const opId = String(op.opId ?? '')
  if (!opId) throw new Error('op missing opId')
  switch (op.kind) {
    case 'attempt':
      await pg(
        `INSERT INTO attempts (op_id, child_id, day, subject, level_id, question_text, input, correct, first_try, duration_ms, hints_used)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) ON CONFLICT (op_id) DO NOTHING`,
        [opId, childId, d.day, d.subject, d.levelId ?? null, d.questionText, d.input ?? null,
         !!d.correct, d.firstTry !== false, d.durationMs ?? null, d.hintsUsed ?? 0],
      )
      return 'applied'
    case 'ledger':
      await pg(
        `INSERT INTO ledgers (op_id, child_id, kind, delta, balance, source, note, at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8) ON CONFLICT (op_id) DO NOTHING`,
        [opId, childId, d.kind, d.delta, d.balance ?? null, d.source, d.note ?? null,
         d.at ? new Date(d.at as string) : new Date()],
      )
      return 'applied'
    case 'snapshot':
      await pg(
        `INSERT INTO daily_snapshots (child_id, day, satiety, fed, is_full, body, streak, tasks_done, tasks_total, battles, correct_rate, points_earned, food_earned)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
         ON CONFLICT (child_id, day) DO UPDATE SET
           satiety=EXCLUDED.satiety, fed=EXCLUDED.fed, is_full=EXCLUDED.is_full, body=EXCLUDED.body,
           streak=EXCLUDED.streak, tasks_done=EXCLUDED.tasks_done, tasks_total=EXCLUDED.tasks_total,
           battles=EXCLUDED.battles, correct_rate=EXCLUDED.correct_rate,
           points_earned=EXCLUDED.points_earned, food_earned=EXCLUDED.food_earned, synced_at=now()`,
        [childId, d.day, d.satiety ?? 0, d.fed ?? 0, !!d.full, d.body ?? 'normal', d.streak ?? 0,
         d.tasksDone ?? 0, d.tasksTotal ?? 0, d.battles ?? 0, d.correctRate ?? 0,
         d.pointsEarned ?? 0, d.foodEarned ?? 0],
      )
      return 'applied'
    case 'level_record':
      await pg(
        `INSERT INTO level_records (child_id, level_id, best_stars, cleared, play_count)
         VALUES ($1,$2,$3,$4,$5)
         ON CONFLICT (child_id, level_id) DO UPDATE SET
           best_stars=GREATEST(level_records.best_stars, EXCLUDED.best_stars),
           cleared=level_records.cleared OR EXCLUDED.cleared,
           play_count=EXCLUDED.play_count, updated_at=now()`,
        [childId, d.levelId, d.bestStars ?? 0, !!d.cleared, d.playCount ?? 1],
      )
      return 'applied'
    case 'wrong_item':
      await pg(
        `INSERT INTO wrong_items (child_id, subject, question_text, spec, wrong_count, right_streak, mastered, next_review_day)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
         ON CONFLICT (child_id, question_text) DO UPDATE SET
           wrong_count=EXCLUDED.wrong_count, right_streak=EXCLUDED.right_streak, mastered=EXCLUDED.mastered,
           next_review_day=EXCLUDED.next_review_day, updated_at=now()`,
        [childId, d.subject, d.questionText, d.spec ? JSON.stringify(d.spec) : null,
         d.wrongCount ?? 1, d.rightStreak ?? 0, !!d.mastered, d.nextReviewDay ?? null],
      )
      return 'applied'
    default:
      throw new Error(`unknown op kind: ${op.kind}`)
  }
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
      send(res, 200, { ok: true, pgOk, pgLastError, env: ENV_ID, uptime: process.uptime() })
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

    if (req.method === 'POST' && url === '/api/sync') {
      if (SYNC_TOKEN && req.headers['x-sync-token'] !== SYNC_TOKEN) {
        send(res, 403, { error: 'forbidden' })
        return
      }
      const body = JSON.parse(await readBody(req)) as { childId?: string; ops?: Op[] }
      const childId = String(body.childId ?? 'default')
      const ops = Array.isArray(body.ops) ? body.ops.slice(0, 200) : []
      let applied = 0
      for (const op of ops) {
        if (await applyOp(childId, op) === 'applied') applied++
      }
      const rows = await pg(
        `INSERT INTO sync_state (child_id, last_sync_at, server_version)
         VALUES ($1, now(), 1)
         ON CONFLICT (child_id) DO UPDATE SET last_sync_at=now(), server_version=sync_state.server_version+1
         RETURNING server_version`,
        [childId],
      )
      send(res, 200, { applied, total: ops.length, serverVersion: rows[0]?.server_version ?? 1 })
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

    send(res, 404, { error: 'not found' })
  } catch (e) {
    send(res, 500, { error: (e as Error).message })
  }
})

server.listen(PORT, () => {
  console.log(`[pet-checkin] listening on :${PORT}  env=${ENV_ID || '(unset)'}  pgKey=${API_KEY ? 'set' : 'MISSING'}`)
})
