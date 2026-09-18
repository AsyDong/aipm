/** 一「天」= 当天 00:00 ~ 24:00（每天 0 点为分界线） */
export const DAY_START_HOUR = 0

const pad = (n: number) => String(n).padStart(2, '0')

export function toDay(ts: number): string {
  const d = new Date(ts - DAY_START_HOUR * 3600_000)
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

export function nowDay(ts: number = Date.now()): string {
  return toDay(ts)
}

/** 游戏日起点时间戳（该日 00:00） */
export function dayStart(day: string): number {
  const [y, m, d] = day.split('-').map(Number)
  return new Date(y, m - 1, d, DAY_START_HOUR, 0, 0, 0).getTime()
}

export function addDays(day: string, n: number): string {
  return toDay(dayStart(day) + n * 86400_000)
}

export function diffDays(a: string, b: string): number {
  return Math.round((dayStart(b) - dayStart(a)) / 86400_000)
}

/** 列出 (from, to] 的游戏日，最多 max 个 */
export function daysBetween(from: string, to: string, max = 14): string[] {
  const n = diffDays(from, to)
  if (n <= 0) return []
  const span = Math.min(n, max)
  return Array.from({ length: span }, (_, i) => addDays(from, i + 1))
}

export function fmtDate(ts: number): string {
  const d = new Date(ts)
  return `${d.getMonth() + 1}月${d.getDate()}日 ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export function dayLabel(day: string): string {
  const [_, m, d] = day.split('-').map(Number)
  return `${m}月${d}日`
}

/** 本周（周一为起点）内的游戏日列表 */
export function weekDays(): string[] {
  const now = new Date(Date.now() - DAY_START_HOUR * 3600_000)
  const dow = (now.getDay() + 6) % 7
  const monday = addDays(toDay(Date.now()), -dow)
  return Array.from({ length: 7 }, (_, i) => addDays(monday, i))
}

export function monthDays(): string[] {
  const now = new Date(Date.now() - DAY_START_HOUR * 3600_000)
  const y = now.getFullYear()
  const m = now.getMonth()
  const last = new Date(y, m + 1, 0).getDate()
  return Array.from({ length: last }, (_, i) => `${y}-${pad(m + 1)}-${pad(i + 1)}`)
}
