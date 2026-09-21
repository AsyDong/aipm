// ============ 出题 / 批改 契约层 ============
//
// 前端只依赖这里的接口，不依赖任何具体实现。
// 现在跑的是 local（同步、零成本）；将来接上后端只需把 provider 换成 remote，
// 页面代码一行不用改。

import type { Question, Subject } from '../../types'

/**
 * 题目来源，用于成本审计与题库命中率统计。
 * local 本地生成 / cache 题库命中（没调模型）/ llm 模型新生成
 */
export type QuestionSource = 'local' | 'cache' | 'llm'

/**
 * 同步实现直接返回值，远端实现返回 Promise。
 * 页面据此决定要不要显示「出题中」——本地出题是瞬时的，不该闪一下 loading。
 */
export type MaybeAsync<T> = T | Promise<T>

export function isThenable<T>(v: MaybeAsync<T>): v is Promise<T> {
  return typeof (v as Promise<T>)?.then === 'function'
}

export interface GenRequest {
  subject: Subject
  /** 关卡 id */
  levelId: string
  /** 要几道题 */
  count: number
  /**
   * 未掌握的错题规格，需要穿插进本关。
   * 传 spec 而不是传题面，是为了让服务端能按规则重建题目、也能从中派生变式。
   */
  inject?: Question['spec'][]
  /** 孩子当前属性值，供自适应难度使用 */
  attr?: number
}

export interface GenResult {
  questions: Question[]
  source: QuestionSource
  /** 远端不可用、已回落本地时为 true（家长端可据此提示"当前离线"） */
  degraded?: boolean
}

export interface GradeRequest {
  question: Question
  /** 孩子填的原始内容，未做任何清洗 */
  input: string
}

export interface GradeResult {
  correct: boolean
  /** 谁判的：local 精确比对 / remote 模型批改 */
  by: 'local' | 'remote'
  /** 模型批改时给孩子的评语 */
  feedback?: string
  /**
   * 暂时判不了（例如开放题需要联网但断网了）。
   * 页面应当把题放回队尾重做，而不是算错——断网不该让孩子背锅。
   */
  deferred?: boolean
}

/** 统一视角：允许同步也允许异步，页面要用 isThenable 区分 */
export interface QuestionProvider {
  readonly name: 'local' | 'remote'
  generate(req: GenRequest): MaybeAsync<GenResult>
  /** 举一反三变式 */
  variants(seed: Question, count: number): MaybeAsync<GenResult>
  /** 只有本地判分器判不了的题（开放答案）才会调到这里 */
  grade(req: GradeRequest): MaybeAsync<GradeResult>
}

/**
 * 本地实现：一定同步返回。
 * 单独声明精确类型，是为了让页面能在渲染期直接出题、完全不闪 loading。
 * 若只用 QuestionProvider，返回类型被 MaybeAsync 抹平，就享受不到这个好处。
 */
export interface SyncQuestionProvider {
  readonly name: 'local'
  generate(req: GenRequest): GenResult
  variants(seed: Question, count: number): GenResult
  grade(req: GradeRequest): GradeResult
}

/** 远端实现：一定走网络，一定异步 */
export interface AsyncQuestionProvider {
  readonly name: 'remote'
  generate(req: GenRequest): Promise<GenResult>
  variants(seed: Question, count: number): Promise<GenResult>
  grade(req: GradeRequest): Promise<GradeResult>
}

export interface ProviderConfig {
  /** 后端地址，空字符串 = 纯本地模式 */
  apiBaseUrl: string
  /** 是否优先走远端 */
  preferRemote: boolean
  /** 远端超时（毫秒），超时即降级 */
  timeoutMs: number
}
