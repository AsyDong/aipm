import { useEffect, useRef, useState } from 'react'
import type { Question } from '../types'
import { activeProvider, generateQuestions, isThenable, localProvider } from '../engine/provider'
import type { GenRequest, GenResult, QuestionSource } from '../engine/provider'

export interface QState {
  questions: Question[]
  loading: boolean
  /** 题目来源，用于统计题库命中率 */
  source: QuestionSource
  /** 远端不可用已回落本地 */
  degraded: boolean
  error?: boolean
}

const EMPTY: QState = { questions: [], loading: true, source: 'local', degraded: false }

function fromResult(r: GenResult): QState {
  return { questions: r.questions, loading: false, source: r.source, degraded: !!r.degraded }
}

export const emptyQState = EMPTY

/**
 * 出题 hook —— 页面与 provider 之间唯一的连接点。
 *
 * 两种实现的返回时机不同，页面体验也应该不同：
 * - 本地实现同步返回：在渲染期就把题出好，不闪 loading
 * - 远端实现返回 Promise：给 loading 态，页面显示「出题中」
 *
 * 注意：开发模式下 React StrictMode 会重复执行 effect，远端路径在控制台
 * 可能看到两次请求，这是 dev-only 行为；生产构建只执行一次。
 *
 * @param key 请求的稳定摘要（如 `m1|错题指纹`）。req 每次渲染都是新对象，
 *            不能当依赖，所以由调用方把它摘要成一个字符串。
 */
export function useGeneratedQuestions(req: GenRequest, key: string): QState {
  const isLocal = activeProvider().name === 'local'

  const [state, setState] = useState<QState>(() =>
    isLocal ? fromResult(localProvider.generate(req)) : EMPTY,
  )

  const keyRef = useRef(key)

  useEffect(() => {
    const isFirst = keyRef.current === key
    keyRef.current = key
    // 首次挂载时本地实现已经在渲染期出好题了，不要重复出（否则题会变一套）
    if (isLocal && isFirst) return

    let alive = true
    const r = generateQuestions(req)
    if (isThenable(r)) {
      setState(EMPTY)
      r.then(
        (res) => {
          if (alive) setState(fromResult(res))
        },
        () => {
          if (alive) setState({ ...EMPTY, loading: false, error: true })
        },
      )
    } else {
      setState(fromResult(r))
    }
    return () => {
      alive = false
    }
    // req 是每次渲染的新对象，不进依赖；key 是它的稳定摘要
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, isLocal])

  return state
}
