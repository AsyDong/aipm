// ============ 孩子登录码（设备绑定） ============
//
// 6 位数字码，家长在家长区设置；换设备时输入「孩子编号 + 登录码」找回数据。
// 存 scrypt 哈希，格式的 `s1:<salt>:<hash>`，留版本号方便将来换算法。
// brute-force 防护：同 60 秒内失败 5 次 → 锁 1 分钟（内存态，重启清零，够用）。

import crypto from 'node:crypto'
import assert from 'node:assert'

export const PIN_PATTERN = /^\d{6}$/
const FAIL_LIMIT = 5
const LOCK_MS = 60_000

export function hashPin(pin: string): string {
  const salt = crypto.randomBytes(16)
  const hash = crypto.scryptSync(pin, salt, 32)
  return `s1:${salt.toString('hex')}:${hash.toString('hex')}`
}

export function verifyPin(pin: string, stored: string | null | undefined): boolean {
  if (!stored) return false
  const [ver, saltHex, hashHex] = stored.split(':')
  if (ver !== 's1' || !saltHex || !hashHex) return false
  const hash = crypto.scryptSync(pin, Buffer.from(saltHex, 'hex'), 32)
  const expect = Buffer.from(hashHex, 'hex')
  return hash.length === expect.length && crypto.timingSafeEqual(hash, expect)
}

const fails = new Map<string, { n: number; until: number }>()

/** 爆破防护：返回 null = 放行；返回剩余秒数 = 锁定中 */
export function lockRemaining(childId: string): number {
  const f = fails.get(childId)
  if (!f || f.until <= Date.now()) return 0
  return Math.ceil((f.until - Date.now()) / 1000)
}

export function recordFail(childId: string): void {
  // 防内存膨胀：够了（真按 childId 打爆破的规模，服务早就该报警了）
  if (fails.size > 1000) fails.clear()
  const f = fails.get(childId) ?? { n: 0, until: 0 }
  f.n += 1
  f.until = f.n >= FAIL_LIMIT ? Date.now() + LOCK_MS : 0
  if (f.n >= FAIL_LIMIT) f.n = 0
  fails.set(childId, f)
}

export function clearFails(childId: string): void {
  fails.delete(childId)
}

// ---------- 自检：npx tsx server/auth.ts ----------
if (process.argv[1] && process.argv[1].endsWith('auth.ts')) {
  const h = hashPin('123456')
  assert(verifyPin('123456', h), '正确密码通过')
  assert(!verifyPin('654321', h), '错误密码拒绝')
  assert(!verifyPin('123456', null), '未设置拒绝')
  assert(!verifyPin('123456', 'bogus'), '坏格式拒绝')
  assert(!PIN_PATTERN.test('12345') && !PIN_PATTERN.test('12345a') && PIN_PATTERN.test('012345'), 'PIN 格式')
  const id = 't1'
  for (let i = 0; i < 4; i++) recordFail(id)
  assert(lockRemaining(id) === 0, '4 次不锁')
  recordFail(id)
  assert(lockRemaining(id) > 0, '5 次锁定')
  clearFails(id)
  assert(lockRemaining(id) === 0, '清零放行')
  console.log('auth.ts 自检通过 ✅')
}
