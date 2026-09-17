// ============ 同步 op → SQL（从 server.ts 抽出） ============
//
// 这个文件**刻意不依赖任何 node 内置模块**：既能被 server.ts 调用，也能被 smoke.ts
// 用一个假的 pg 直接跑断言 —— 表名、列名、参数顺序是最容易写错、又最难在本地发现的地方，
// 必须能在冒烟里锁住（不用连真数据库）。

export class PgError extends Error {
  /**
   * true  = 基础设施问题（网关 5xx / 429 / 连不上 / 超时）：换一次可能就好了，
   *         调用方应当保留数据、原样重推。
   * false = 这条 SQL 本身被数据库拒绝（类型 / 约束 / 缺列）：重推一万次也一样，
   *         调用方应当丢弃并记账，否则它会永久堵住队头，后面的数据全推不上去。
   */
  readonly transient: boolean

  constructor(message: string, transient: boolean) {
    super(message)
    this.name = 'PgError'
    this.transient = transient
  }
}

export type PgFn = (sql: string, parameters?: unknown[]) => Promise<Record<string, unknown>[]>

export interface Op {
  opId?: string
  kind?: string
  data?: Record<string, unknown>
}

/** 单条同步请求最多处理多少 op（防止一次请求把服务器拖死） */
export const OPS_PER_REQUEST = 200

// ---------- 字段规范化 ----------
//
// 目的不是「好看」，而是**把必然会被数据库拒绝的数据挡在 SQL 之前**：
// 一旦让库抛错，客户端只知道「这批 500 了」，定位成本极高。
// 在这里先夹紧 / 先报错，错误信息里能直接看出是哪条 op 的哪个字段。

function str(v: unknown): string | null {
  if (v === undefined || v === null) return null
  const s = String(v)
  return s === '' ? null : s
}

/** 必填字符串：缺失即判为坏数据（非 transient，客户端会丢弃并记账） */
function req(v: unknown, field: string): string {
  const s = str(v)
  if (!s) throw new PgError(`op 缺少必填字段 ${field}`, false)
  return s
}

function int(v: unknown): number | null {
  if (v === undefined || v === null || v === '') return null
  const n = Number(v)
  return Number.isFinite(n) ? Math.round(n) : null
}

function intOr(v: unknown, fallback: number): number {
  return int(v) ?? fallback
}

/** 时间统一转 ISO 字符串（时间戳列直接吃它）。解析不了就报错，别丢给数据库。 */
function iso(v: unknown): string | null {
  if (v === undefined || v === null || v === '') return null
  const t = typeof v === 'number' ? v : Date.parse(String(v))
  if (!Number.isFinite(t)) {
    throw new PgError(`时间格式无法解析：${String(v).slice(0, 40)}`, false)
  }
  return new Date(t).toISOString()
}

/** date 列必须是 YYYY-MM-DD */
function day(v: unknown, field: string): string {
  const s = req(v, field)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    throw new PgError(`字段 ${field} 不是 YYYY-MM-DD 格式：${s}`, false)
  }
  return s
}

/** task_templates.food_value 有 CHECK (BETWEEN 1 AND 3)，越界会被库拒绝 → 在此夹紧 */
function foodValue(v: unknown): number {
  return Math.min(3, Math.max(1, intOr(v, 1)))
}

/** boolean 列，缺省取 fallback（注意不是 `!!v`：显式传 false 要能生效） */
function bool(v: unknown, fallback: boolean): boolean {
  return v === undefined || v === null ? fallback : v !== false
}

const REDEEM_STATUSES = ['pending', 'approved', 'rejected', 'timeout', 'delivered'] as const

/** redeems.status 有 CHECK 约束；不在集合里就明确报错，而不是让库抛一个难懂的错 */
function redeemStatus(v: unknown): string {
  const s = str(v) ?? 'pending'
  if (!(REDEEM_STATUSES as readonly string[]).includes(s)) {
    throw new PgError(`兑换状态 ${s} 不在允许集合（${REDEEM_STATUSES.join('/')}）内`, false)
  }
  return s
}

// ---------- op 分发 ----------
//
// 幂等策略分两类，这是刻意的：
//
// | 类别 | op | 幂等手段 | 需要 op_id | 需要到达顺序 |
// |---|---|---|---|---|
// | 事件流（只增不改） | attempt / ledger | op_id 唯一约束去重 | ✅ | — |
// | 实体快照（一行一实体） | child / pet / task_template / daily_task / prize / redeem | 业务主键 upsert | ❌ | — |
//
// 实体 op「不需要顺序」正是 pets 外键必须去掉的原因，见
// db/20260916120000_relax_pets_fk_redeem_status.sql。
//
// childId 由客户端 sync 模块自管，是这些表的 child_id / children.id 唯一来源。

export async function applyOp(pg: PgFn, childId: string, op: Op): Promise<void> {
  const d = op.data ?? {}

  switch (op.kind) {
    // ================= 事件流：只能靠 op_id 去重 =================

    case 'attempt': {
      const opId = req(op.opId, 'opId')
      await pg(
        `INSERT INTO attempts (op_id, child_id, day, subject, level_id, question_text, input, correct, first_try, duration_ms, hints_used)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) ON CONFLICT (op_id) DO NOTHING`,
        [opId, childId, day(d.day, 'day'), req(d.subject, 'subject'), str(d.levelId),
         req(d.questionText, 'questionText'), str(d.input), d.correct === true,
         bool(d.firstTry, true), int(d.durationMs), intOr(d.hintsUsed, 0)],
      )
      return
    }

    case 'ledger': {
      const opId = req(op.opId, 'opId')
      const kind = str(d.kind) ?? ''
      if (kind !== 'food' && kind !== 'point') {
        throw new PgError(`ledgers.kind 只允许 food / point，收到「${kind}」`, false)
      }
      await pg(
        `INSERT INTO ledgers (op_id, child_id, kind, delta, balance, source, note, at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8) ON CONFLICT (op_id) DO NOTHING`,
        [opId, childId, kind, intOr(d.delta, 0), int(d.balance), req(d.source, 'source'),
         str(d.note), iso(d.at) ?? new Date().toISOString()],
      )
      return
    }

    case 'snapshot':
      await pg(
        `INSERT INTO daily_snapshots (child_id, day, satiety, fed, is_full, body, streak, tasks_done, tasks_total, battles, correct_rate, points_earned, food_earned)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
         ON CONFLICT (child_id, day) DO UPDATE SET
           satiety=EXCLUDED.satiety, fed=EXCLUDED.fed, is_full=EXCLUDED.is_full, body=EXCLUDED.body,
           streak=EXCLUDED.streak, tasks_done=EXCLUDED.tasks_done, tasks_total=EXCLUDED.tasks_total,
           battles=EXCLUDED.battles, correct_rate=EXCLUDED.correct_rate,
           points_earned=EXCLUDED.points_earned, food_earned=EXCLUDED.food_earned, synced_at=now()`,
        [childId, day(d.day, 'day'), intOr(d.satiety, 0), intOr(d.fed, 0), d.full === true,
         str(d.body) ?? 'normal', intOr(d.streak, 0), intOr(d.tasksDone, 0), intOr(d.tasksTotal, 0),
         intOr(d.battles, 0), intOr(d.correctRate, 0), intOr(d.pointsEarned, 0), intOr(d.foodEarned, 0)],
      )
      return

    case 'level_record':
      await pg(
        `INSERT INTO level_records (child_id, level_id, best_stars, cleared, play_count)
         VALUES ($1,$2,$3,$4,$5)
         ON CONFLICT (child_id, level_id) DO UPDATE SET
           best_stars=GREATEST(level_records.best_stars, EXCLUDED.best_stars),
           cleared=level_records.cleared OR EXCLUDED.cleared,
           play_count=EXCLUDED.play_count, updated_at=now()`,
        [childId, req(d.levelId, 'levelId'), intOr(d.bestStars, 0), d.cleared === true,
         intOr(d.playCount, 1)],
      )
      return

    case 'wrong_item':
      await pg(
        `INSERT INTO wrong_items (child_id, subject, question_text, spec, wrong_count, right_streak, mastered, next_review_day)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
         ON CONFLICT (child_id, question_text) DO UPDATE SET
           wrong_count=EXCLUDED.wrong_count, right_streak=EXCLUDED.right_streak, mastered=EXCLUDED.mastered,
           next_review_day=EXCLUDED.next_review_day, updated_at=now()`,
        [childId, req(d.subject, 'subject'), req(d.questionText, 'questionText'),
         d.spec ? JSON.stringify(d.spec) : null, intOr(d.wrongCount, 1), intOr(d.rightStreak, 0),
         d.mastered === true, str(d.nextReviewDay)],
      )
      return

    // ================= 实体快照：按业务主键 upsert，天然幂等 =================

    // 孩子档案。id 直接用 childId —— 客户端 sync 模块自管的那个值，两边必须一致，
    // 所以不接受 op 里再带一个 id（带错反而会造出两行）。
    case 'child':
      await pg(
        `INSERT INTO children (id, name, grade, textbook_ver)
         VALUES ($1,$2,$3,$4)
         ON CONFLICT (id) DO UPDATE SET
           name=EXCLUDED.name, grade=EXCLUDED.grade, textbook_ver=EXCLUDED.textbook_ver`,
        [childId, str(d.name) ?? '宝贝', str(d.grade) ?? 'g1', str(d.textbookVer)],
      )
      return

    // 宠物档案：一个孩子一只（child_id 既是主键也是关联键）。
    // attrs 是 jsonb，与 wrong_items.spec 同样以 JSON 字符串送过去。
    case 'pet':
      await pg(
        `INSERT INTO pets (child_id, species, name, stage, exp, satiety, fed_today, body, attrs, updated_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9, now())
         ON CONFLICT (child_id) DO UPDATE SET
           species=EXCLUDED.species, name=EXCLUDED.name, stage=EXCLUDED.stage, exp=EXCLUDED.exp,
           satiety=EXCLUDED.satiety, fed_today=EXCLUDED.fed_today, body=EXCLUDED.body,
           attrs=EXCLUDED.attrs, updated_at=now()`,
        [childId, req(d.species, 'species'), str(d.name), intOr(d.stage, 1), intOr(d.exp, 0),
         intOr(d.satiety, 60), intOr(d.fedToday, 0), str(d.body) ?? 'normal',
         JSON.stringify(d.attrs ?? {})],
      )
      return

    // 任务模板。active=false 表示「家长已删除或已停用」——软删，不物理删行，
    // 否则历史 daily_tasks 的 template_id 会指向不存在的模板。
    case 'task_template':
      await pg(
        `INSERT INTO task_templates (id, child_id, name, type, subject, food_value, active)
         VALUES ($1,$2,$3,$4,$5,$6,$7)
         ON CONFLICT (id) DO UPDATE SET
           name=EXCLUDED.name, type=EXCLUDED.type, subject=EXCLUDED.subject,
           food_value=EXCLUDED.food_value, active=EXCLUDED.active`,
        [req(d.id, 'id'), childId, req(d.name, 'name'), str(d.type) ?? 'subjective',
         str(d.subject) ?? 'math', foodValue(d.foodValue), bool(d.active, true)],
      )
      return

    // 每日任务实例。名字 / 图标 / 食物值不落库 —— 它们是模板的冗余副本，
    // 需要时按 template_id JOIN 回 task_templates 即可，存两份反而会不一致。
    case 'daily_task':
      await pg(
        `INSERT INTO daily_tasks (id, child_id, day, template_id, status, media_key, note, at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
         ON CONFLICT (id) DO UPDATE SET
           status=EXCLUDED.status, media_key=EXCLUDED.media_key,
           note=EXCLUDED.note, at=EXCLUDED.at`,
        [req(d.id, 'id'), childId, day(d.day, 'day'), str(d.templateId) ?? '',
         str(d.status) ?? 'todo', str(d.mediaKey), str(d.note), iso(d.at)],
      )
      return

    // 现实奖品
    case 'prize':
      await pg(
        `INSERT INTO prizes (id, child_id, name, points, note, active)
         VALUES ($1,$2,$3,$4,$5,$6)
         ON CONFLICT (id) DO UPDATE SET
           name=EXCLUDED.name, points=EXCLUDED.points, note=EXCLUDED.note, active=EXCLUDED.active`,
        [req(d.id, 'id'), childId, req(d.name, 'name'), intOr(d.points, 0), str(d.note),
         bool(d.active, true)],
      )
      return

    // 兑换单。审批只改 status / decided_at，其余字段（奖品名、积分数、申请时间）
    // 是「当时的事实」，后续模板被改名也不该回溯篡改。
    case 'redeem':
      await pg(
        `INSERT INTO redeems (id, child_id, prize_id, prize_name, points, status, created_at, decided_at)
         VALUES ($1,$2,$3,$4,$5,$6, COALESCE($7::timestamptz, now()), $8::timestamptz)
         ON CONFLICT (id) DO UPDATE SET
           status=EXCLUDED.status, decided_at=EXCLUDED.decided_at`,
        [req(d.id, 'id'), childId, str(d.prizeId) ?? '', str(d.prizeName) ?? '',
         intOr(d.points, 0), redeemStatus(d.status), iso(d.createdAt), iso(d.decidedAt)],
      )
      return

    default:
      throw new PgError(`未知的 op 类型：${String(op.kind)}`, false)
  }
}
