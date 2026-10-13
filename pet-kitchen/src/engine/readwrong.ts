/*
 * FE-08 跟读纠音「举一反三」—— 把跟读关读不好的词回灌到统一错题本。
 *
 * 为什么单独一个模块：跟读的词是「读音素材」，而错题本（P10）与综合关只认 `QSpec`。
 * 这里做一次转换，把「读不好的英文词」变成错题本能吃的题：
 *
 *     读不好的词（sister）→ QSpec(kind='rd_word') →「sister 是什么意思？看英文选中文」
 *
 * 与 en_word 共用题面 / 判分链路（见 questions.ts 的 buildContentQuestion），
 * 于是错题本的「练一练 / 举一反三 / 遗忘曲线 / 连续答对 3 次算掌握」全套零改动可用；
 * 单独开 kind 只是为了让跟读关能反查出「这批错题是读出来的」，开练时优先重读。
 *
 * **只收录课本词汇表里查得到释义的词**（见 READ_ZH）——
 * 顺带把 this / is / my 这类虚词挡在门外：它们读不准也没必要单独练。
 */

import { READ_UNITS, type ReadItem } from '../data/readtext'
import { normWord, lowWords, type AlignedWord } from './follow'
import { buildQuestion, specKey } from './questions'
import { shuffle } from '../utils/id'
import type { QSpec, Question, WrongItem } from '../types'

/** 跟读纠音的题型 kind（questions.ts 的 CONTENT_KINDS 已注册） */
export const READ_WRONG_KIND = 'rd_word'

/**
 * 单词 → 中文释义（课本跟读词库）。
 * 同一个词可能出现在多个单元（hungry 在 u1 / u2 都算），取第一次出现的释义。
 */
const READ_ZH: Record<string, string> = {}
for (const u of READ_UNITS) {
  for (const w of u.words) {
    const k = normWord(w.en)
    if (k && !(k in READ_ZH)) READ_ZH[k] = w.cn
  }
}

/** 干扰项池：全部课本词的中文释义（去重） */
const ZH_POOL = Array.from(new Set(Object.values(READ_ZH)))

/** 课本里有没有这个词（读不准也值得单独练的实词） */
export function isReadWord(word: string): boolean {
  return !!READ_ZH[normWord(word)]
}

/**
 * 读不好的词 → 错题本用的 QSpec。
 * 查不到释义（虚词 / 非课本词）返回 null —— 调用方直接跳过即可。
 */
export function wrongSpecOf(rawWord: string): QSpec | null {
  const word = normWord(rawWord)
  const zh = READ_ZH[word]
  if (!word || !zh) return null
  // 干扰项必须是「别的词的中文」，且与答案不相同 —— 否则选项会因为去重少一个
  const opts = shuffle(ZH_POOL.filter((z) => z && z !== zh)).slice(0, 3)
  if (opts.length < 3) return null
  return { kind: READ_WRONG_KIND, a: 0, b: 0, prompt: word, ans: zh, opts }
}

/** 同上，直接给错题本 / 结算用的 Question 对象 */
export function wrongQuestionOf(rawWord: string): Question | null {
  const spec = wrongSpecOf(rawWord)
  return spec ? buildQuestion(spec) : null
}

/**
 * 从一次跟读评分结果里挑出「该回灌的词」。
 *
 * 判定沿用提示栏那套（漏读或 < 85 分，见 follow.lowWords），但有两点不同：
 *   ① 不限定 3 个 —— 提示栏只给孩子看最该练的 3 个，入库要收全（上限 keep 个，默认 3）；
 *   ② 只收课本实词 —— 逐词对齐会把 this / is / my 也标出来，那些不值得单独练。
 * 同一关里同一个词只收一次（孩子反复读错同一词，靠错题本的 wrongCount 累计）。
 */
export function weakWordsOf(tokens: string[], rows: AlignedWord[], keep = 3): string[] {
  const out: string[] = []
  const seen = new Set<string>()
  for (const l of lowWords(tokens, rows, 99)) {
    const w = normWord(l.word)
    if (!w || seen.has(w) || !READ_ZH[w]) continue
    seen.add(w)
    out.push(w)
    if (out.length >= keep) break
  }
  return out
}

/**
 * 结算时用的错题列表：把本次攒下的词转成 Question。
 * 由 P18FollowRead 交给主应用 `finishBattle(..., wrongQs)`，
 * 后面「入库 / 去重 / 遗忘曲线 / 同步 op」全走主应用既有那一条链路。
 */
export function wrongQuestionsOf(words: Iterable<string>): Question[] {
  const out: Question[] = []
  const seen = new Set<string>()
  for (const w of words) {
    const q = wrongQuestionOf(w)
    if (!q) continue
    const k = specKey(q.spec)
    if (seen.has(k)) continue
    seen.add(k)
    out.push(q)
  }
  return out
}

/**
 * 反向：从错题本里取「该在跟读关重练」的词，转成跟读素材。
 *
 * 只取到复习日的（nextReviewDay <= today）未掌握项，最久没复习的排前面；
 * 一关最多注入 limit 条（默认 2，与主应用 WRONG_INJECT 的口径一致），
 * 免得复习词把新内容挤没了。
 */
export function reviewItemsOf(wrong: WrongItem[], today: string, limit = 2): ReadItem[] {
  return wrong
    .filter((w) => !w.mastered && w.spec.kind === READ_WRONG_KIND && w.nextReviewDay <= today)
    .sort((a, b) => (a.nextReviewDay === b.nextReviewDay ? a.createdAt - b.createdAt : a.nextReviewDay < b.nextReviewDay ? -1 : 1))
    .slice(0, limit)
    .map((w) => ({ en: w.spec.prompt ?? '', cn: w.spec.ans ?? '', category: 'read_word' as const }))
    .filter((it) => isReadWord(it.en) && !!it.cn)
}
