// 题目生成器：听音选拼音 / 看字选拼音 / 拼音组合（声母+韵母）
import { CHAR_BANK, SoundItem, LEVELS, LevelDef, INITIALS, FINALS, ZHENGTI } from './data/pinyin'
import { WrongItem } from './store'

export type QKind = 'listen' | 'char' | 'blend'

export interface Question {
  kind: QKind
  q: string        // char: 汉字; blend: "b + a"
  audioZh: string  // 发音汉字
  answer: string   // 正确选项
  options: string[]
  from: string
}

// ---------- 声调工具 ----------
const TONE_MAP: Record<string, string> = {
  a: 'āáǎà', o: 'ōóǒò', e: 'ēéěè', i: 'īíǐì', u: 'ūúǔù', ü: 'ǖǘǚǜ',
}
const STRIP_MAP: Record<string, string> = {}
for (const [base, marks] of Object.entries(TONE_MAP)) {
  for (const m of marks) STRIP_MAP[m] = base
}

/** 去掉声调符号 */
export function stripTone(py: string): string {
  return py.split('').map((c) => STRIP_MAP[c] ?? c).join('')
}

/** 按标调规则给拼音加声调（1-4 声） */
export function setTone(py: string, tone: number): string {
  const base = stripTone(py)
  if (tone < 1 || tone > 4) return base
  let idx = -1
  if (base.includes('a')) idx = base.indexOf('a')
  else if (base.includes('o')) idx = base.indexOf('o')
  else if (base.includes('e')) idx = base.indexOf('e')
  else if (base.includes('iu')) idx = base.indexOf('iu') + 1
  else if (base.includes('ui')) idx = base.indexOf('ui')
  else {
    const m = base.match(/[iuü]/)
    if (m) idx = base.indexOf(m[0])
  }
  if (idx < 0) return base
  const marks = TONE_MAP[base[idx]]
  if (!marks) return base
  return base.slice(0, idx) + marks[tone - 1] + base.slice(idx + 1)
}

/** 某拼音的四种声调变体 */
function toneVariants(py: string): string[] {
  const base = stripTone(py)
  return [1, 2, 3, 4].map((t) => setTone(base, t)).filter((p) => p !== py)
}

// ---------- 工具 ----------
export function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

function shufflePick<T>(arr: T[], n: number, exclude: (x: T) => boolean): T[] {
  return shuffle(arr.filter((x) => !exclude(x))).slice(0, n)
}

/** 生成若干个选项（1 正确 + N-1 干扰项，默认 4 个），返回打乱结果 */
function buildOptions(answer: string, pool: string[], extraMake: () => string[], count = 4): string[] {
  const set = new Set<string>([answer])
  const add = (p: string) => { if (p && p !== answer && !set.has(p)) set.add(p) }
  for (const cand of shuffle(pool)) {
    if (set.size >= count) break
    add(cand)
  }
  for (const mk of extraMake()) {
    if (set.size >= count) break
    add(mk)
  }
  return shuffle([...set])
}

// ---------- 三种题目的生成 ----------

/** 听音选拼音：播放汉字发音，选出正确拼音 */
export function genListen(item: SoundItem, pool: SoundItem[], from: string, optCount = 4): Question {
  const poolPy = pool.map((p) => p.py)
  const options = buildOptions(item.py, poolPy, () => [
    ...toneVariants(item.py),
    ...shufflePick(poolPy, optCount, (p) => stripTone(p) === stripTone(item.py)),
  ], optCount)
  return { kind: 'listen', q: '🔊', audioZh: item.zh, answer: item.py, options, from }
}

/** 看字选拼音：看汉字选拼音 */
export function genChar(item: SoundItem, pool: SoundItem[], from: string, optCount = 4): Question {
  const poolPy = pool.map((p) => p.py)
  const options = buildOptions(item.py, poolPy, () => [
    ...toneVariants(item.py),
    ...shufflePick(poolPy, optCount, (p) => stripTone(p) === stripTone(item.py)),
  ], optCount)
  return { kind: 'char', q: item.zh, audioZh: item.zh, answer: item.py, options, from }
}

/** 拼音组合：看声母+韵母，选正确的合成音节（干扰项取自真实音节库） */
export function genBlend(item: { initial: string; final: string; py: string; zh: string }, syllPool: string[], from: string, optCount = 4): Question {
  const related = syllPool.filter((p) => p !== item.py && (p.startsWith(item.initial) || p.endsWith(stripTone(item.final))))
  const options = buildOptions(
    item.py,
    related.length >= optCount - 1 ? related : syllPool,
    () => [...toneVariants(item.py), ...shufflePick(syllPool, optCount, () => false)],
    optCount,
  )
  return { kind: 'blend', q: `${item.initial} + ${item.final}`, audioZh: item.zh, answer: item.py, options, from }
}

/** 综合挑战：混合听音 / 看字 / 拼装三种题型，选项更多更难 */
export function genMixed(
  words: SoundItem[],
  blends: { initial: string; final: string; py: string; zh: string }[],
  syllPool: string[],
  from = '综合挑战',
): Question[] {
  const qs: Question[] = []
  for (const w of shuffle(words).slice(0, 8)) {
    qs.push(Math.random() < 0.5 ? genListen(w, words, from, 6) : genChar(w, words, from, 6))
  }
  if (blends.length) {
    for (const b of shuffle(blends).slice(0, 4)) qs.push(genBlend(b, syllPool, from, 6))
  }
  return shuffle(qs).slice(0, 12)
}

// ---------- 音节拆分与已学判断（今日任务范围出题用） ----------
const INIT_SORTED = [...INITIALS.map((s) => s.py)].sort((a, b) => b.length - a.length)
const FINAL_SET = new Set(FINALS.map((f) => f.py))
const ZT_SET = new Set(ZHENGTI.map((z) => z.py))

/** 把去掉声调的拼音拆成 [声母?, 韵母]；整体认读/韵母自成音节时声母为 null；拆不开返回 null */
export function splitSyllable(py: string): [string | null, string] | null {
  if (ZT_SET.has(py)) return [null, py]
  for (const init of INIT_SORTED) {
    if (py.startsWith(init) && FINAL_SET.has(py.slice(init.length))) {
      return [init, py.slice(init.length)]
    }
  }
  if (FINAL_SET.has(py)) return [null, py]
  return null
}

/** 某拼音是否全部由已学字母构成（练习小游戏按当天范围出题用） */
export function isPinyinLearned(py: string, learned: Set<string>): boolean {
  const sp = splitSyllable(stripTone(py))
  if (!sp) return false
  const [init, fin] = sp
  return (!init || learned.has(init)) && learned.has(fin)
}

// ---------- 题库池 ----------

/** 截至某关已学过的全部音节（含声调） */
export function learnedSyllables(levelId: number): string[] {
  const words = LEVELS.filter((l) => l.id <= levelId).flatMap((l) => l.words)
  const seen = new Set(words.map((w) => w.py))
  if (levelId >= 13) CHAR_BANK.forEach((c) => seen.add(c.py))
  return [...seen]
}

/** 学习进度内可用的汉字池 */
export function learnedCharPool(levelId: number): SoundItem[] {
  const words = LEVELS.filter((l) => l.id <= levelId).flatMap((l) => l.words)
  if (levelId >= 13) return words.concat(CHAR_BANK)
  return words.length >= 6 ? words : words.concat(CHAR_BANK.filter((c) => c.py.length <= 3).slice(0, 10))
}

// ---------- 关卡 / 单元测试题目序列 ----------

export function genLevelQuestions(level: LevelDef): Question[] {
  const from = `关卡${level.id}·${level.name}`
  const charPool = learnedCharPool(level.id)
  const syllPool = learnedSyllables(level.id)
  const listenPool = level.words.length >= 4 ? level.words : level.words.concat(charPool.slice(0, 12))
  const qs: Question[] = []

  for (const w of shuffle(level.words).slice(0, 2)) qs.push(genListen(w, listenPool, from))
  if (level.blends.length) {
    for (const b of shuffle(level.blends).slice(0, 2)) qs.push(genBlend(b, syllPool, from))
  }
  const need = Math.max(3, 8 - qs.length)
  for (const c of shuffle(charPool).slice(0, need)) qs.push(genChar(c, charPool, from))

  return shuffle(qs).slice(0, 8)
}

export function genTestQuestions(unit: number): Question[] {
  const levels = LEVELS.filter((l) => l.unit === unit)
  const maxId = Math.max(...levels.map((l) => l.id))
  const from = `第${unit}单元测试`
  const charPool = learnedCharPool(maxId)
  const syllPool = learnedSyllables(maxId)
  const qs: Question[] = []

  for (const w of shuffle(levels.flatMap((l) => l.words)).slice(0, 4)) {
    qs.push(genListen(w, levels.flatMap((l) => l.words), from))
  }
  for (const b of shuffle(levels.flatMap((l) => l.blends)).slice(0, 2)) {
    qs.push(genBlend(b, syllPool, from))
  }
  for (const c of shuffle(charPool).slice(0, 6)) qs.push(genChar(c, charPool, from))
  return shuffle(qs).slice(0, 10)
}

// ---------- 错题本 ----------

export function questionToWrong(q: Question, picked: string): WrongItem {
  return { kind: q.kind, q: q.q, audioZh: q.audioZh, answer: q.answer, picked, from: q.from, time: Date.now() }
}

export function wrongToQuestion(w: WrongItem): Question {
  const bankPy = CHAR_BANK.map((c) => c.py)
  const options = buildOptions(
    w.answer,
    [w.picked, ...toneVariants(w.answer)],
    () => shufflePick(bankPy, 4, () => false),
  )
  return { kind: w.kind, q: w.q, audioZh: w.audioZh, answer: w.answer, options, from: w.from }
}
