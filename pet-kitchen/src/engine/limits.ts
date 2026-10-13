/**
 * 防沉迷（PRD §8：每日闯关上限 + 可用时段）。
 *
 * 家长在「家长模式 → 游玩限制」里设置；孩子点关卡时由 `utils/gate.enterGuard()` 拦截，
 * `App.tsx` 还会对战斗页再做一层兜底（防止绕过入口直接导航）。
 *
 * 这里只放**纯函数**（不碰 store / DOM），冒烟可以对边界逐条断言。
 */
import type { AppState } from '../types'

/** 每日闯关上限的预设档位；0 = 不限 */
export const DAILY_LIMIT_PRESETS = [0, 3, 5, 8]

/** 'HH:MM' → 当天第几分钟；空值或非法格式返回 null（视作「没填」） */
export function parseHM(hm: string): number | null {
  const m = /^(\d{1,2}):(\d{1,2})$/.exec((hm ?? '').trim())
  if (!m) return null
  const h = Number(m[1])
  const mi = Number(m[2])
  if (h > 23 || mi > 59) return null
  return h * 60 + mi
}

/** 时间戳 → 'HH:MM'（本地时区） */
export function hmOf(ts: number): string {
  const d = new Date(ts)
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

/** 把 y/m/d/h/m 拼成本地时间戳（冒烟造边界时刻用） */
export function atClock(y: number, mo: number, d: number, h: number, mi: number): number {
  return new Date(y, mo - 1, d, h, mi, 0, 0).getTime()
}

/**
 * 当前时刻是否在可用时段内。**含起点、不含终点**（「8:00–20:00 可玩」= 20:00 整就不行了）。
 *
 * - 两端都没填 / 填了但非法 → 不限，恒 true
 * - 只填一端 → 只管填了的那一侧（只填起点 = 「起点之后随便玩」）
 * - from < to → 普通区间；from > to → **跨零点**（如 20:00~07:00）
 * - 两端相同 → 视作不限（否则整天被锁死，家长很难自己发现是填错了）
 */
export function inWindow(ts: number, from: string, to: string): boolean {
  const f = parseHM(from)
  const t = parseHM(to)
  if (f == null && t == null) return true
  if (f != null && t != null && f === t) return true

  const d = new Date(ts)
  const now = d.getHours() * 60 + d.getMinutes()

  if (f != null && t != null) {
    return f < t ? now >= f && now < t : now >= f || now < t
  }
  if (f != null) return now >= f
  if (t != null) return now < t
  return true
}

export interface LimitState {
  /** 是否禁止开始新的一场 */
  blocked: boolean
  /** 给孩子看的拦截原因（blocked 时非空） */
  reason: string
  /** 今日已开始的场次（= todayBattles） */
  used: number
  /** 每日上限，0 = 不限 */
  limit: number
  /** 撞到每日上限 */
  overCount: boolean
  /** 不在可用时段内 */
  outsideWindow: boolean
}

/**
 * 家长端 / 首页展示用的一句话摘要，例如「每天 5 场 · 08:00–20:00 可玩」。
 */
export function limitSummary(limit: number, from: string, to: string): string {
  const parts: string[] = [limit > 0 ? `每天 ${limit} 场` : '场次不限']
  if (parseHM(from) != null || parseHM(to) != null) {
    parts.push(`${(from ?? '').trim() || '…'}–${(to ?? '').trim() || '…'} 可玩`)
  }
  return parts.join(' · ')
}

/**
 * 判定当前是否该拦下这一场。
 *
 * 时段优先于场次：时间没到就没什么好商量的，提示也更直白。
 * 老存档的 `settings` 可能没有这三个字段（persist 浅合并不会补），所以一律 `??` 兜底。
 */
export function limitOf(
  s: Pick<AppState, 'settings' | 'todayBattles'>,
  ts: number = Date.now(),
): LimitState {
  const raw = s.settings as Partial<AppState['settings']> | undefined
  const limit = Math.max(0, Math.floor(raw?.dailyBattleLimit ?? 0))
  const from = raw?.allowFrom ?? ''
  const to = raw?.allowTo ?? ''
  const used = Math.max(0, s.todayBattles ?? 0)

  const overCount = limit > 0 && used >= limit
  const outsideWindow = !inWindow(ts, from, to)

  const reason = outsideWindow
    ? `现在是休息时间，${from.trim() || '…'}–${to.trim() || '…'} 才能玩哦 ⏰`
    : overCount
      ? `今天已经玩够 ${limit} 场啦，明天再来吧 🐾`
      : ''

  return { blocked: outsideWindow || overCount, reason, used, limit, overCount, outsideWindow }
}
