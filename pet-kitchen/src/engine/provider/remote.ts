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

async function post<T>(path: string, body: unknown): Promise<T> {
  const { apiBaseUrl, timeoutMs } = providerConfig()
  if (!apiBaseUrl) throw new ProviderError('未配置后端地址')

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

export const remoteProvider: AsyncQuestionProvider = {
  name: 'remote',

  generate: (req) => post<GenResult>('/api/gen', req),

  variants: (seed, count) => post<GenResult>('/api/variants', { seed, count }),

  grade: (req) => post<GradeResult>('/api/grade', req),
}
