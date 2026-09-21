// ============ provider 路由 + 降级 ============
//
// 页面只调这里的三个函数，永远不直接摸具体实现。
// 切换后端、加缓存、换模型，都只影响这个目录。

import type { Question } from '../../types'
import { gradeLocally, needsModel } from '../grading'
import {
  countDegraded, countLocal, countRemote, providerConfig,
} from './config'
import { localProvider } from './local'
import { remoteProvider } from './remote'
import type {
  GenRequest, GenResult, GradeResult, MaybeAsync, QuestionProvider,
} from './contract'

export * from './contract'
export {
  configureProvider, providerConfig, providerStats, resetProviderConfig, resetProviderStats,
} from './config'
export type { ProviderStats } from './config'
export { localProvider } from './local'
export { ProviderError, remoteProvider } from './remote'

/** 当前生效的实现：配了后端地址且开启远端优先才走 remote */
export function activeProvider(): QuestionProvider {
  const { apiBaseUrl, preferRemote } = providerConfig()
  return preferRemote && apiBaseUrl ? remoteProvider : localProvider
}

/**
 * 远端失败 → 回落本地。
 * 孩子那边不能因为后端挂了就玩不了；代价只是标记一个 degraded，
 * 家长端可以据此提示「当前离线」。
 */
function withFallback(
  run: () => Promise<GenResult>,
  fallback: () => GenResult,
): Promise<GenResult> {
  return run().then(
    (r) => {
      countRemote()
      return r
    },
    (e: unknown) => {
      countDegraded(e)
      return { ...fallback(), degraded: true }
    },
  )
}

export function generateQuestions(req: GenRequest): MaybeAsync<GenResult> {
  if (activeProvider().name === 'local') {
    countLocal()
    return localProvider.generate(req)
  }
  return withFallback(
    () => remoteProvider.generate(req),
    () => localProvider.generate(req),
  )
}

export function generateVariants(seed: Question, count: number): MaybeAsync<GenResult> {
  if (activeProvider().name === 'local') {
    countLocal()
    return localProvider.variants(seed, count)
  }
  return withFallback(
    () => remoteProvider.variants(seed, count),
    () => localProvider.variants(seed, count),
  )
}

/**
 * 判分路由——成本控制最关键的一个函数。
 * 答案唯一的题在本地就判完了，根本不产生 API 费用；
 * 只有开放答案的题（语文英语）才会落到模型批改。
 */
export function gradeAnswer(q: Question, input: string): MaybeAsync<GradeResult> {
  if (!needsModel(q)) return gradeLocally(q, input)
  if (activeProvider().name === 'local') {
    return { correct: false, by: 'local', deferred: true }
  }
  return gradeRemotely(q, input)
}

async function gradeRemotely(q: Question, input: string): Promise<GradeResult> {
  try {
    const r = await remoteProvider.grade({ question: q, input })
    countRemote()
    return r
  } catch (e) {
    // 断网时开放题判不了：标记 deferred 让页面把题放回队尾，断网不该算孩子错
    countDegraded(e)
    return { correct: false, by: 'local', deferred: true }
  }
}
