// ============ 拼音题 → 主应用 Question 的纯转换 ============
//
// 「全融入主应用」的关键一步：拼音世界的题目只有转成主应用的 Question/QSpec，
// 才能进统一错题本（遗忘曲线、举一反三、跨科复习）。
//
// 这里刻意**不依赖任何 store**（纯函数），方便冒烟测试直接跑；
// 依赖 useStore 的结算入口在 bridge.ts。

import type { Question as AppQuestion, QSpec } from '../types'
import type { Question as PyQuestion } from './quiz'

const KIND_OF: Record<PyQuestion['kind'], string> = {
  listen: 'pyw_listen',
  char: 'pyw_char',
  blend: 'pyw_blend',
}

/** 拼音题 → 主应用题规格（错题本 / 服务端 jsonb 回放都靠它） */
export function specOf(q: PyQuestion): QSpec {
  const prompt = q.kind === 'blend'
    ? q.q.replace(' + ', '|')
    : q.kind === 'listen' ? q.audioZh : q.q
  return {
    kind: KIND_OF[q.kind],
    a: 0,
    b: 0,
    prompt,
    ans: q.answer,
    opts: q.options.filter((o) => o !== q.answer),
  }
}

/** 拼音题 → 主应用 Question（只有 spec / text / skill / explain 会被错题链路用到） */
export function toAppQuestion(q: PyQuestion): AppQuestion {
  const spec = specOf(q)
  const [ini, fin] = q.kind === 'blend' ? q.q.split(' + ') : ['', '']
  const view = {
    listen: {
      text: `听一听「${q.audioZh}」，选出正确的拼音`,
      speech: q.audioZh,
      hint: '先听清楚，再想想是哪个拼音',
      explain: `「${q.audioZh}」读作「${q.answer}」`,
    },
    char: {
      text: `「${q.q}」的拼音是？`,
      speech: q.q,
      hint: '先想一想再选，选错了没关系',
      explain: `「${q.q}」读作「${q.answer}」`,
    },
    blend: {
      text: `把 ${ini} 和 ${fin} 拼起来，是哪个音节？`,
      speech: `声母${ini}，韵母${fin}，拼一拼，是哪个音节`,
      hint: `前音轻短后音重，两音相连猛一碰：${ini}——${fin}`,
      explain: `${ini} + ${fin} 拼出「${q.answer}」`,
    },
  }[q.kind]

  return {
    text: view.text,
    speech: view.speech,
    answer: 0,
    skill: '拼音认读',
    hint: view.hint,
    explain: view.explain,
    spec,
    answerType: 'choice',
    options: [q.answer, ...(spec.opts ?? [])],
  }
}
