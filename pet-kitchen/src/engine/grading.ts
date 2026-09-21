// ============ 判分路由 ============
//
// 核心原则：答案唯一的题永远在本地判。
// 大模型会算错 7+8，而且错得理直气壮；程序化生成的题答案 100% 确定，
// 本地判分既零成本又零延迟，比模型可靠得多。
//
// 所以模型不是用来「替换」本地判分的，而是用来「兜住本地判不了的那部分」
// ——开放答案（看图说话、造句、手写汉字）才需要它。

import type { Question } from '../types'
import type { GradeResult } from './provider/contract'

/** 全角数字 → 半角，去空白，去前导 0；非纯数字（或过长）返回 null */
export function normalizeNumeric(raw: string): string | null {
  const half = String(raw ?? '').replace(/[\uFF10-\uFF19]/g, (d) =>
    String.fromCharCode(d.charCodeAt(0) - 0xfee0),
  )
  const t = half.replace(/\s/g, '')
  if (!/^\d{1,4}$/.test(t)) return null
  return String(Number(t))
}

/**
 * 本地判分——「第一道也是最便宜的一道关」。
 * choice 题（语文英语认读题）比对选项文本；open（开放答案）返回 false 交给 needsModel。
 */
export function gradeLocally(q: Question, input: string): GradeResult {
  if (q.answerType === 'choice') {
    const right = q.options?.[q.answer]
    return { correct: !!right && input === right, by: 'local' }
  }
  if (needsModel(q)) return { correct: false, by: 'local' }
  const n = normalizeNumeric(input)
  if (n === null) return { correct: false, by: 'local' }
  return { correct: Number(n) === q.answer, by: 'local' }
}

/** 本地判分器判不了吗？判不了（开放答案）才需要模型介入；choice 题本地就能判 */
export function needsModel(q: Question): boolean {
  return q.answerType === 'open'
}
