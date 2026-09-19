// ============ 远端实现（轻量服务器上的普通 Node 服务） ============
//
// 接口约定：
//   POST /api/gen      { subject, levelId, count, inject?, attr? } -> GenResult
//   POST /api/variants { seed, count }                            -> GenResult
//   POST /api/grade    { question, input }                        -> GradeResult
//
// 服务端返回的 source 应为 'cache'（命中题库）或 'llm'（模型新生成），
// 前端据此统计命中率——命中率越高，模型调用越少，账单越好看。

import type {
  AsyncQuestionProvider, GenResult, GradeResult,
} from './contract'
import { providerConfig } from './config'

export class ProviderError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ProviderError'
  }
}

async function postOnce<T>(path: string, body: unknown, timeoutMs: number): Promise<T> {
  const { apiBaseUrl } = providerConfig()
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), timeoutMs)
  try {
    const res = await fetch(`${apiBaseUrl}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: ctrl.signal,
    })
    if (!res.ok) throw new ProviderError(`${path} 返回 ${res.status}`)
    return (await res.json()) as T
  } catch (e) {
    if (e instanceof ProviderError) throw e
    // abort / 网络不可达 / JSON 解析失败：统一成 ProviderError，交给上层降级
    throw new ProviderError(e instanceof Error ? e.message : String(e))
  } finally {
    clearTimeout(timer)
  }
}

/**
 * 重试策略：服务重启窗口 / 弱网抖动（ERR_CONNECTION_CLOSED、Failed to fetch）
 * 是瞬时故障，间隔 400ms / 1s 重试两次，孩子基本无感；
 * HTTP 4xx 是确定性失败（请求本身有问题），重试没有意义，立即抛出走降级。
 */
const RETRY_DELAYS_MS = [0, 400, 1000]
const TRANSIENT = /Failed to fetch|NetworkError|ERR_|aborted|timeout|返回 50[234]/

async function post<T>(path: string, body: unknown): Promise<T> {
  const { apiBaseUrl, timeoutMs } = providerConfig()
  if (!apiBaseUrl) throw new ProviderError('未配置后端地址')

  let lastErr: unknown
  for (const delay of RETRY_DELAYS_MS) {
    if (delay > 0) await new Promise((r) => setTimeout(r, delay))
    try {
      return await postOnce<T>(path, body, timeoutMs)
    } catch (e) {
      lastErr = e
      const msg = e instanceof Error ? e.message : String(e)
      if (!(e instanceof ProviderError) || !TRANSIENT.test(msg)) throw e
    }
  }
  throw lastErr instanceof ProviderError ? lastErr : new ProviderError(String(lastErr))
}

export const remoteProvider: AsyncQuestionProvider = {
  name: 'remote',

  generate: (req) => post<GenResult>('/api/gen', req),

  variants: (seed, count) => post<GenResult>('/api/variants', { seed, count }),

  grade: (req) => post<GradeResult>('/api/grade', req),
}
