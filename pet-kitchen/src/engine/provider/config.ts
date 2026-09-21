// ============ provider 运行时配置与调用统计 ============
//
// 刻意做成「运行时可改」而不是读环境变量常量：
// 冒烟测试能直接 configureProvider 切到远端再切回来，不用重新打包。

import type { ProviderConfig } from './contract'

const DEFAULTS: ProviderConfig = {
  apiBaseUrl: '',
  preferRemote: false,
  timeoutMs: 8000,
}

let current: ProviderConfig = { ...DEFAULTS }

export function configureProvider(next: Partial<ProviderConfig>): void {
  current = { ...current, ...next }
}

export function providerConfig(): ProviderConfig {
  return current
}

export function resetProviderConfig(): void {
  current = { ...DEFAULTS }
}

/** 调用统计：题库命中率与降级次数，家长端「我的」页将来可展示 */
export interface ProviderStats {
  /** 真正打到后端的次数 */
  remoteCalls: number
  /** 本地出的次数（含降级后的兜底） */
  localCalls: number
  /** 远端失败回落本地的次数 */
  degraded: number
  lastError: string
}

const stats: ProviderStats = { remoteCalls: 0, localCalls: 0, degraded: 0, lastError: '' }

export function providerStats(): ProviderStats {
  return { ...stats }
}

export function resetProviderStats(): void {
  stats.remoteCalls = 0
  stats.localCalls = 0
  stats.degraded = 0
  stats.lastError = ''
}

export function countRemote(): void {
  stats.remoteCalls += 1
}

export function countLocal(): void {
  stats.localCalls += 1
}

export function countDegraded(err: unknown): void {
  stats.degraded += 1
  stats.localCalls += 1
  stats.lastError = err instanceof Error ? err.message : String(err)
}
