// ============ 数据同步（前端 localStorage → 服务器 /api/sync） ============
//
// 三条铁律：
//
// 1) **绝不阻塞孩子玩。** 断网、后端挂了、令牌错了，都只是「先攒着」——
//    队列落在 localStorage 里，下次回前台、下次启动继续推。孩子的闯关和打卡
//    一个都不能因为同步失败而卡住。
//
// 2) **幂等靠 opId。** 服务端 attempts / ledgers 以 op_id 唯一约束入库，
//    重复推送不会写重。所以「网络超时」这种情况可以放心重试，不用怕写两份。
//
// 3) **队列独立于主存档。** 不进 zustand persist —— 同步是「传输层」的事，
//    混进主状态会污染存档、还要连带做版本迁移。childId 也由本模块自管，
//    将来服务端 children 表用同一个值即可对上。
//
// 与出题/判分的 provider 层是**两个独立的关注点**，刻意不合并：
// provider 决定「题从哪儿来」，sync 决定「成绩去哪儿」。

import { uid } from '../utils/id'

const STORAGE_KEY = 'pet-checkin-sync-v1'
/** 队列上限：超出丢最老的。localStorage 有 5MB 配额，2000 条 op 约几百 KB，安全 */
const QUEUE_LIMIT = 2000
/** 写入后的静默期：连续作答时不要每答一题就打一次网络 */
const DEBOUNCE_MS = 5000

/** 只增不改的流水：服务端靠 `op_id` 唯一约束去重，重推安全 */
export type AppendOpKind = 'attempt' | 'ledger'

/**
 * 一行一实体的快照：服务端按业务主键 upsert（level_records 还会取 GREATEST 防回退）。
 * 天然幂等 —— 推一次和推十次结果一样，因此不需要 opId、也不要求到达顺序。
 */
export type UpsertOpKind =
  | 'snapshot' | 'level_record' | 'wrong_item'
  | 'child' | 'pet' | 'task_template' | 'daily_task' | 'prize' | 'redeem'

export type SyncOpKind = AppendOpKind | UpsertOpKind

export interface SyncOp {
  /** 幂等键：服务端据此去重 */
  opId: string
  kind: SyncOpKind
  data: Record<string, unknown>
  /** 本地产生时间 */
  at: number
}

export interface SyncConfig {
  /** 后端地址，留空 = 纯本地模式（同步整体关闭，零开销） */
  apiBaseUrl: string
  /** 对应服务端 SYNC_TOKEN，走 x-sync-token 头 */
  token: string
  timeoutMs: number
  batchSize: number
}

export interface SyncStats {
  enabled: boolean
  childId: string
  /** 还在本地排队、没推上去的条数 */
  queued: number
  /** 本次会话成功推送的条数 */
  pushed: number
  /** 因队列超限被丢弃的条数 */
  dropped: number
  /** 被服务端判定为坏数据、主动丢弃的条数 */
  rejected: number
  /** 令牌被拒（403），同步已暂停 */
  forbidden: boolean
  lastError: string
  lastSyncAt: number
  serverVersion: number
}

export interface FlushResult {
  ok: boolean
  pushed: number
  remaining: number
  serverVersion: number
  error?: string
  forbidden?: boolean
}

const DEFAULTS: SyncConfig = {
  apiBaseUrl: '',
  token: '',
  // 一批最多 200 条 op，服务端逐条走 CloudBase 网关（每条一次公网往返，实测整批 40s+）。
  // 8s 会把每批都掐死在半路 → 队列永远排不空，越积越多（2026-09-19 实测 328 条积压的根因）
  timeoutMs: 60000,
  batchSize: 200,
}

/** 落盘的部分：只有 childId 和队列，计数器属于会话级遥测，不持久化 */
interface Persisted {
  childId: string
  queue: SyncOp[]
}

function storage(): Storage | null {
  try {
    return typeof localStorage !== 'undefined' ? localStorage : null
  } catch {
    return null
  }
}

function load(): Persisted {
  const empty: Persisted = { childId: uid('c'), queue: [] }
  const s = storage()
  if (!s) return empty
  try {
    const raw = s.getItem(STORAGE_KEY)
    if (!raw) return empty
    const parsed = JSON.parse(raw) as Partial<Persisted>
    return {
      childId: typeof parsed.childId === 'string' && parsed.childId ? parsed.childId : empty.childId,
      queue: Array.isArray(parsed.queue) ? parsed.queue.filter(isValidOp) : [],
    }
  } catch {
    // 存档损坏不该让孩子玩不了 —— 直接当新设备处理
    return empty
  }
}

function isValidOp(o: unknown): o is SyncOp {
  const op = o as Partial<SyncOp> | null
  return !!op && typeof op.opId === 'string' && typeof op.kind === 'string' && !!op.data
}

let config: SyncConfig = { ...DEFAULTS }
let state: Persisted = load()
let inFlight: Promise<FlushResult> | null = null
let debounceTimer: ReturnType<typeof setTimeout> | null = null

const counters = {
  pushed: 0,
  dropped: 0,
  rejected: 0,
  forbidden: false,
  lastError: '',
  lastSyncAt: 0,
  serverVersion: 0,
}

function save(): void {
  const s = storage()
  if (!s) return
  try {
    s.setItem(STORAGE_KEY, JSON.stringify(state))
  } catch {
    // 配额满了也不该崩：丢一半最老的记录再试一次，还失败就放弃本次落盘
    try {
      state.queue = state.queue.slice(-Math.floor(QUEUE_LIMIT / 2))
      s.setItem(STORAGE_KEY, JSON.stringify(state))
    } catch {
      /* 放弃落盘，内存里仍可用 */
    }
  }
}

export function configureSync(next: Partial<SyncConfig>): void {
  const tokenChanged = next.token !== undefined && next.token !== config.token
  config = { ...config, ...next }
  // 换了令牌就该给同步一个重新证明自己的机会
  if (tokenChanged) counters.forbidden = false
}

export function syncConfig(): SyncConfig {
  return { ...config }
}

export function syncStats(): SyncStats {
  return {
    enabled: enabled(),
    childId: state.childId,
    queued: state.queue.length,
    ...counters,
  }
}

/** 纯本地模式：没配后端地址或没配令牌，同步整体关闭 */
export function enabled(): boolean {
  return !!config.apiBaseUrl && !!config.token
}

export function pendingCount(): number {
  return state.queue.length
}

export function childId(): string {
  return state.childId
}

/**
 * 记一条待同步操作。
 *
 * 未启用同步时**直接返回**：纯本地模式下一行都不写、一个定时器都不挂，
 * 行为与接线之前完全一致。
 */
export function enqueueOp(kind: SyncOpKind, data: Record<string, unknown>): void {
  if (!enabled()) return
  state.queue.push({ opId: uid('op'), kind, data, at: Date.now() })
  if (state.queue.length > QUEUE_LIMIT) {
    const overflow = state.queue.length - QUEUE_LIMIT
    state.queue.splice(0, overflow)
    counters.dropped += overflow
  }
  save()
  schedule()
}

function schedule(): void {
  if (debounceTimer !== null) return
  const t = setTimeout(() => {
    debounceTimer = null
    void flushSync()
  }, DEBOUNCE_MS) as unknown as { unref?: () => void }
  // Node 环境（冒烟测试）下别让定时器吊住进程
  if (typeof t.unref === 'function') t.unref()
  debounceTimer = t as unknown as ReturnType<typeof setTimeout>
}

/**
 * 推一批。多次调用会复用同一个在途请求（单飞），避免并发把同一批推两遍。
 */
export function flushSync(): Promise<FlushResult> {
  if (inFlight) return inFlight

  if (!enabled()) {
    return Promise.resolve({
      ok: false, pushed: 0, remaining: state.queue.length,
      serverVersion: counters.serverVersion, error: '同步未启用',
    })
  }
  if (counters.forbidden) {
    return Promise.resolve({
      ok: false, pushed: 0, remaining: state.queue.length,
      serverVersion: counters.serverVersion, error: counters.lastError, forbidden: true,
    })
  }
  if (state.queue.length === 0) {
    return Promise.resolve({
      ok: true, pushed: 0, remaining: 0, serverVersion: counters.serverVersion,
    })
  }

  inFlight = pushOnce().finally(() => {
    inFlight = null
  })
  return inFlight
}

async function pushOnce(): Promise<FlushResult> {
  const batch = state.queue.slice(0, config.batchSize)
  const sent = new Set(batch.map((o) => o.opId))

  const ctrl = new AbortController()
  const abortTimer = setTimeout(() => ctrl.abort(), config.timeoutMs)

  const drain = (): void => {
    // 按 opId 过滤而不是清空数组：推送期间可能又入队了新的 op
    state.queue = state.queue.filter((o) => !sent.has(o.opId))
    save()
  }

  try {
    const res = await fetch(`${config.apiBaseUrl}/api/sync`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-sync-token': config.token },
      body: JSON.stringify({
        childId: state.childId,
        ops: batch.map(({ opId, kind, data }) => ({ opId, kind, data })),
      }),
      signal: ctrl.signal,
    })

    if (res.status === 403) {
      // 令牌不对：再推一万次也是 403，停下来等人修，别把队列刷爆
      counters.forbidden = true
      counters.lastError = '同步令牌被拒（403），已暂停同步'
      return {
        ok: false, pushed: 0, remaining: state.queue.length,
        serverVersion: counters.serverVersion, error: counters.lastError, forbidden: true,
      }
    }

    if (res.status >= 400 && res.status < 500) {
      // 400 类是「这批数据本身服务端不认」（列名/类型对不上）。
      // 留着它只会永久堵住队头，后面的数据全都推不上去 —— 只能丢弃并记账。
      counters.rejected += batch.length
      counters.lastError = `服务端拒绝这批数据（${res.status}），已丢弃 ${batch.length} 条`
      drain()
      return {
        ok: false, pushed: 0, remaining: state.queue.length,
        serverVersion: counters.serverVersion, error: counters.lastError,
      }
    }

    if (!res.ok) throw new Error(`HTTP ${res.status}`)

    const body = (await res.json()) as {
      applied?: number
      /** 服务端逐条处理后判定为「坏数据」、已被丢弃的条数 */
      failed?: number
      errors?: string[]
      serverVersion?: number
    }

    // 整批出队：服务端是逐条处理并逐条上报的，这批 op 无论成功还是被判为坏数据，
    // 都已经有结论了。若只对成功的那部分出队，一条坏数据会永久堵住队头。
    drain()

    const failed = body.failed ?? 0
    counters.pushed += Math.max(0, batch.length - failed)
    counters.rejected += failed
    counters.forbidden = false
    counters.lastError = failed > 0
      ? `服务端拒绝了 ${failed} 条：${(body.errors ?? []).join(' ｜ ') || '原因未记录'}`
      : ''
    counters.lastSyncAt = Date.now()
    if (typeof body.serverVersion === 'number') counters.serverVersion = body.serverVersion

    return {
      ok: true, pushed: batch.length - failed, remaining: state.queue.length,
      serverVersion: counters.serverVersion,
      error: failed > 0 ? counters.lastError : undefined,
    }
  } catch (e) {
    // 网络不可达 / 超时 / 5xx：留着下次再推。opId 幂等，重推是安全的。
    counters.lastError = e instanceof Error ? e.message : String(e)
    return {
      ok: false, pushed: 0, remaining: state.queue.length,
      serverVersion: counters.serverVersion, error: counters.lastError,
    }
  } finally {
    clearTimeout(abortTimer)
  }
}

// ============ 拉取（跨设备传播的另一半） ============
//
// 推是「本地 → 服务端」，拉是反过来。合并策略刻意简单：
// **客户端只在队列清空（本地改动全部推完）时才拉**，拉到什么就信什么 ——
// 队列清空意味着本地和服务端一致，服务端上任何不一样的内容都来自另一台设备且更新。
// 这换来零时间戳、零 LWW、零冲突标记：队列没空就先推，推完自然能拉。
//
// 不回放事件流（attempt / snapshot / level_record / wrong_item）：那是统计与审计数据，
// 报表在服务端看；拉它们只会把另一台设备的练习记录复制一份。

/** 服务端 /api/state 的行结构（列名已在 SQL 里别名为驼峰） */
export interface RemoteState {
  childId: string
  child: { name: string; grade: string; textbookVer: string | null } | null
  pet: {
    species: string; name: string | null; stage: number; exp: number
    satiety: number; fedToday: number; attrs: Record<string, number>
  } | null
  templates: {
    id: string; name: string; type: string; foodValue: number
    active: boolean; enabled: boolean
    icon: string | null; note: string | null; kind: string | null
    weekdays: number[] | null; onceDay: string | null
  }[]
  daily: {
    id: string; day: string; templateId: string | null; status: string
    mediaKey: string | null; note: string | null; at: string | null
    tplName: string | null; tplIcon: string | null; tplType: string | null
    tplNote: string | null; tplKind: string | null; tplFood: number | null
  }[]
  prizes: { id: string; name: string; points: number; note: string | null; active: boolean }[]
  redeems: {
    id: string; prizeId: string; prizeName: string; points: number
    state: string; at: string; decidedAt: string | null
  }[]
  ledgers: {
    opId: string; kind: string; delta: number; balance: number | null
    source: string; note: string | null; at: string
  }[]
  levels: { levelId: string; bestStars: number; cleared: boolean; playCount: number | null }[]
  lastStreak: { day: string; streak: number } | null
}

/** GET /api/state。传输层只管取回，合并语义在 useStore.pullRemote 里。失败返回 null（孩子照玩）。 */
export async function pullState(id: string): Promise<RemoteState | null> {
  if (!enabled()) return null
  const ctrl = new AbortController()
  const abortTimer = setTimeout(() => ctrl.abort(), config.timeoutMs)
  try {
    const res = await fetch(
      `${config.apiBaseUrl}/api/state?childId=${encodeURIComponent(id)}`,
      { headers: { 'x-sync-token': config.token }, signal: ctrl.signal },
    )
    if (!res.ok) return null
    return (await res.json()) as RemoteState
  } catch {
    return null
  } finally {
    clearTimeout(abortTimer)
  }
}
/** 清空队列与计数（冒烟测试用）。childId 保留 —— 换设备才是换孩子。 */
export function resetSync(): void {
  state.queue = []
  counters.pushed = 0
  counters.dropped = 0
  counters.rejected = 0
  counters.forbidden = false
  counters.lastError = ''
  counters.lastSyncAt = 0
  counters.serverVersion = 0
  if (debounceTimer !== null) {
    clearTimeout(debounceTimer)
    debounceTimer = null
  }
  save()
}

/** 丢弃本地队列（家长端「清空待同步数据」用；identity 保留） */
export function dropQueue(): number {
  const n = state.queue.length
  state.queue = []
  save()
  return n
}
