import type { QSpec, Question, Subject } from '../types'
import { rnd, shuffle } from '../utils/id'
import {
  CHAR_BANK, EN_UNITS, EN_ZH, FC_BY_NO, FC_NO_BY_WORD, FC_UNITS, finalParts, PINYIN_BANKS, PINYIN_UNITS, POEMS,
  type CharItem, type EnWord, type PinyinBankItem,
} from '../data/courses'

// ============ 数学题库：学而思一年级速算体系（程序化生成，Q25） ============

export interface LevelDef {
  id: string
  subject: Subject
  index: number
  name: string
  skill: string
  boss?: boolean
  /** PvE Boss 关（Q23） */
  kinds: string[]
  unlockAttr: number
}

export const MATH_LEVELS: LevelDef[] = [
  { id: 'm1', subject: 'math', index: 1, name: '10以内加法', skill: '数的组成', kinds: ['add10'], unlockAttr: 0 },
  { id: 'm2', subject: 'math', index: 2, name: '10以内减法', skill: '想加算减', kinds: ['sub10'], unlockAttr: 3 },
  { id: 'm3', subject: 'math', index: 3, name: '凑十法', skill: '凑十法', kinds: ['cou10'], unlockAttr: 6 },
  { id: 'm4', subject: 'math', index: 4, name: '破十法', skill: '破十法', kinds: ['po10'], unlockAttr: 9 },
  { id: 'm5', subject: 'math', index: 5, name: '平十法', skill: '平十法', kinds: ['ping10'], unlockAttr: 12 },
  { id: 'mb1', subject: 'math', index: 6, name: '速算大挑战·壹', skill: '综合', kinds: ['mix'], unlockAttr: 15, boss: true },
  { id: 'm6', subject: 'math', index: 7, name: '20以内进位加', skill: '进位加法', kinds: ['carry20'], unlockAttr: 18 },
  { id: 'm7', subject: 'math', index: 8, name: '20以内退位减', skill: '退位减法', kinds: ['back20'], unlockAttr: 21 },
  { id: 'm8', subject: 'math', index: 9, name: '整十数加减', skill: '整十数', kinds: ['ten100'], unlockAttr: 24 },
  { id: 'm9', subject: 'math', index: 10, name: '100以内加减', skill: '两位数', kinds: ['noCarry100'], unlockAttr: 27 },
  { id: 'm10', subject: 'math', index: 11, name: '连加连减', skill: '连加连减', kinds: ['chain'], unlockAttr: 30 },
  { id: 'mb2', subject: 'math', index: 12, name: '速算大挑战·终', skill: '综合', kinds: ['mix'], unlockAttr: 33, boss: true },
]

/** Boss 解锁：需其之前 5 关全部 ≥2 星 */
export function bossRequires(level: LevelDef): string[] {
  if (!level.boss) return []
  const list = LEVELS_BY_SUBJECT[level.subject]
  const idx = list.findIndex((l) => l.id === level.id)
  return list.slice(Math.max(0, idx - 5), idx)
    .filter((l) => !l.boss)
    .map((l) => l.id)
}

// ============ 语文关卡（一年级上册：拼音 / 识字 错开重排 + 古诗课文） ============
// 拼音按 PINYIN_UNITS 每 ~5 个一关累积推进；识字关穿插其间，只考「已学音拼得出来」的字。
// 题型：py_unit 看拼音选字（学音）/ py_rep 认字读音（学音）/ char_py 看字标音（识字）/
//      py_word 看音识字（识字）/ py_blend 声韵拼读（识字），素材取自 src/data/courses.ts

export const CHINESE_LEVELS: LevelDef[] = [
  { id: 'c1', subject: 'chinese', index: 1, name: '单韵母', skill: 'a o e i u ü', kinds: ['py_unit:u1', 'py_rep:u1'], unlockAttr: 0 },
  { id: 'c2', subject: 'chinese', index: 2, name: '声母一', skill: 'b p m f d', kinds: ['py_unit:u2', 'py_rep:u2'], unlockAttr: 2 },
  { id: 'c3', subject: 'chinese', index: 3, name: '识字一', skill: '已学音拼读', kinds: ['char_py:u2', 'py_word:u2', 'py_blend:u2'], unlockAttr: 4 },
  { id: 'c4', subject: 'chinese', index: 4, name: '声母二', skill: 't n l g k', kinds: ['py_unit:u3', 'py_rep:u3'], unlockAttr: 6 },
  { id: 'c5', subject: 'chinese', index: 5, name: '识字二', skill: '已学音拼读', kinds: ['char_py:u3', 'py_word:u3', 'py_blend:u3'], unlockAttr: 8 },
  { id: 'c6', subject: 'chinese', index: 6, name: '声母三', skill: 'h j q x', kinds: ['py_unit:u4', 'py_rep:u4'], unlockAttr: 10 },
  { id: 'c7', subject: 'chinese', index: 7, name: '声母四', skill: 'zh ch sh r z', kinds: ['py_unit:u5', 'py_rep:u5'], unlockAttr: 12 },
  { id: 'c8', subject: 'chinese', index: 8, name: '识字三', skill: '已学音拼读', kinds: ['char_py:u5', 'py_word:u5', 'py_blend:u5'], unlockAttr: 14 },
  { id: 'c9', subject: 'chinese', index: 9, name: '声母五', skill: 'c s y w', kinds: ['py_unit:u6', 'py_rep:u6'], unlockAttr: 16 },
  { id: 'c10', subject: 'chinese', index: 10, name: '拼读练习一', skill: '声母+韵母', kinds: ['py_blend:u6', 'py_word:u6'], unlockAttr: 18 },
  { id: 'c11', subject: 'chinese', index: 11, name: '复韵母一', skill: 'ai ei ui ao ou', kinds: ['py_unit:u7', 'py_rep:u7'], unlockAttr: 20 },
  { id: 'c12', subject: 'chinese', index: 12, name: '识字四', skill: '已学音拼读', kinds: ['char_py:u7', 'py_word:u7', 'py_blend:u7'], unlockAttr: 22 },
  { id: 'c13', subject: 'chinese', index: 13, name: '复韵母二', skill: 'iu ie üe er', kinds: ['py_unit:u8', 'py_rep:u8'], unlockAttr: 24 },
  { id: 'c14', subject: 'chinese', index: 14, name: '鼻韵母一', skill: 'an en in un ün', kinds: ['py_unit:u9', 'py_rep:u9'], unlockAttr: 26 },
  { id: 'c15', subject: 'chinese', index: 15, name: '识字五', skill: '已学音拼读', kinds: ['char_py:u9', 'py_word:u9', 'py_blend:u9'], unlockAttr: 28 },
  { id: 'c16', subject: 'chinese', index: 16, name: '鼻韵母二', skill: 'ang eng ing ong', kinds: ['py_unit:u10', 'py_rep:u10'], unlockAttr: 30 },
  { id: 'cb1', subject: 'chinese', index: 17, name: '拼音小状元', skill: '拼读综合', kinds: ['py_unit:u10', 'py_rep:u10', 'py_blend:u10', 'py_word:u10'], unlockAttr: 32, boss: true },
  { id: 'c17', subject: 'chinese', index: 18, name: '整体认读一', skill: 'zhi chi shi ri zi ci', kinds: ['py_unit:u11', 'py_rep:u11'], unlockAttr: 34 },
  { id: 'c18', subject: 'chinese', index: 19, name: '整体认读二', skill: 'si yi wu yu ye yue', kinds: ['py_unit:u12', 'py_rep:u12'], unlockAttr: 36 },
  { id: 'c19', subject: 'chinese', index: 20, name: '识字六', skill: '已学音拼读', kinds: ['char_py:u12', 'py_word:u12', 'py_blend:u12'], unlockAttr: 38 },
  { id: 'c20', subject: 'chinese', index: 21, name: '整体认读三', skill: 'yuan yin yun ying', kinds: ['py_unit:u13', 'py_rep:u13'], unlockAttr: 40 },
  { id: 'c21', subject: 'chinese', index: 22, name: '古诗对句', skill: '必背古诗文', kinds: ['poem_next'], unlockAttr: 42 },
  { id: 'cb2', subject: 'chinese', index: 23, name: '语文大挑战', skill: '综合', kinds: ['py_word:u13', 'char_py:u13', 'py_blend:u13', 'poem_next'], unlockAttr: 44, boss: true },
]

// ============ 英语关卡（一年级上册 6 个单元 + 句型，docs/courses/1-1-english.md） ============

export const ENGLISH_LEVELS: LevelDef[] = [
  { id: 'e1', subject: 'english', index: 1, name: 'My Family', skill: '家人词汇', kinds: ['en_pic:family', 'en_wp:family', 'en_meaning:family'], unlockAttr: 0 },
  { id: 'e2', subject: 'english', index: 2, name: 'How Are You?', skill: '感受与情绪', kinds: ['en_pic:feeling', 'en_wp:feeling', 'en_meaning:feeling'], unlockAttr: 3 },
  { id: 'e3', subject: 'english', index: 3, name: 'School Things', skill: '文具与数字', kinds: ['en_pic:school', 'en_wp:school', 'en_meaning:school'], unlockAttr: 6 },
  { id: 'e4', subject: 'english', index: 4, name: 'I Can…', skill: '能力与动作', kinds: ['en_pic:ability', 'en_wp:ability', 'en_meaning:ability'], unlockAttr: 9 },
  { id: 'e5', subject: 'english', index: 5, name: 'Animals', skill: '动物词汇', kinds: ['en_pic:animal', 'en_wp:animal', 'en_meaning:animal'], unlockAttr: 12 },
  { id: 'e6', subject: 'english', index: 6, name: 'Colours', skill: '颜色词汇', kinds: ['en_pic:colour', 'en_wp:colour', 'en_meaning:colour'], unlockAttr: 15 },
  { id: 'eb1', subject: 'english', index: 7, name: '期中挑战', skill: 'U1–U3 综合', kinds: ['en_word:family', 'en_meaning:family', 'en_word:feeling', 'en_meaning:feeling', 'en_word:school', 'en_meaning:school'], unlockAttr: 18, boss: true },
  { id: 'e7', subject: 'english', index: 8, name: '句型闯关', skill: '核心句型', kinds: ['en_sentence:family', 'en_sentence:feeling', 'en_sentence:school', 'en_sentence:ability', 'en_sentence:animal', 'en_sentence:colour'], unlockAttr: 21 },
  { id: 'eb2', subject: 'english', index: 9, name: '期末大挑战', skill: '综合', kinds: ['en_word:animal', 'en_meaning:colour', 'en_sentence:family', 'en_sentence:ability', 'en_word:family', 'en_sentence:animal'], unlockAttr: 24, boss: true },
]

// ============ 闪卡速记关卡（任务「闪卡速记」专用，不进闯关地图） ============
// 预备级电子闪卡 PDF 切的 115 张卡，按 FC_UNITS 一单元一关；进度记在 levels（fc-uN）。

export const FC_LEVELS: LevelDef[] = FC_UNITS.map((u, i) => ({
  id: `fc-${u.id}`,
  subject: 'english',
  index: i + 1,
  name: `闪卡速记·${u.name}`,
  skill: '看图认词',
  kinds: [`fc_pic:${u.id}`, `fc_wp:${u.id}`],
  unlockAttr: 0,
}))

/** 全科目关卡注册表 */
export const LEVELS_BY_SUBJECT: Record<Subject, LevelDef[]> = {
  math: MATH_LEVELS,
  chinese: CHINESE_LEVELS,
  english: ENGLISH_LEVELS,
}

export function levelById(id: string): LevelDef | undefined {
  for (const list of [...Object.values(LEVELS_BY_SUBJECT), FC_LEVELS]) {
    const hit = list.find((l) => l.id === id)
    if (hit) return hit
  }
  return undefined
}

const ri = (min: number, max: number) => min + rnd(max - min + 1)

// ============ 语文 / 英语题库（docs/courses 教材内容，四选一认读题） ============
//
// 内容题与数学题共用 spec 回放链路（错题本 / 服务端 jsonb / 举一反三）：
// 答案与干扰项全部进 spec，任何一端用同一 spec 都能重建出同构的题。
// kind 采用「题型：素材组」的写法（如 py_pick_char:single），genSpec 据此取材。

export type ContentKind =
  | 'py_pick_char' // 看拼音选汉字（按韵母组取材，老关卡回放用）
  | 'py_unit' // 看拼音选汉字（按学习单元取材）
  | 'py_rep' // 认读音节：代表字选读音
  | 'char_py' // 看汉字选读音（unit 组 = 已学字池，char 组 = 全字库）
  | 'py_word' // 看音节选汉字（识字）
  | 'py_blend' // 声母+韵母拼一拼选汉字
  | 'poem_next' // 古诗课文对句
  | 'en_word' // 看英文选中文
  | 'en_meaning' // 看中文选英文
  | 'en_pic' // 看词选图
  | 'en_wp' // 看图选词
  | 'en_sentence' // 句型填空
  | 'fc_pic' // 闪卡速记：看图选词（spec.a = 卡片编号）
  | 'fc_wp' // 闪卡速记：看词选图

const CONTENT_KINDS = new Set<string>([
  'py_pick_char', 'py_unit', 'py_rep', 'char_py', 'py_word', 'py_blend',
  'poem_next', 'en_word', 'en_meaning', 'en_pic', 'en_wp', 'en_sentence',
  'fc_pic', 'fc_wp',
])

const MIX_PY: PinyinBankItem[] = [
  ...PINYIN_BANKS.single, ...PINYIN_BANKS.compound, ...PINYIN_BANKS.nasal,
  ...PINYIN_BANKS.zhengti, ...PINYIN_BANKS.initial,
]

function bankOf(group: string): PinyinBankItem[] {
  return group === 'mixpy' ? MIX_PY : PINYIN_BANKS[group as keyof typeof PINYIN_BANKS] ?? MIX_PY
}

// ---------- 拼音单元 / 已学音把关 ----------

const UNIT_BY_ID = new Map(PINYIN_UNITS.map((u) => [u.id, u]))

/** 学到 unitId 为止（含）累计出现的所有拼音 */
function learnedOf(unitId: string): Set<string> {
  const upto = PINYIN_UNITS.findIndex((u) => u.id === unitId)
  const units = upto < 0 ? PINYIN_UNITS : PINYIN_UNITS.slice(0, upto + 1)
  return new Set(units.flatMap((u) => u.items.map((i) => i.py)))
}

/** 已学音能拼出来的字：声母已学、韵母各部分已学（零声母/整体认读只看韵母部分） */
export function charPool(unitId: string): CharItem[] {
  const learned = learnedOf(unitId)
  return CHAR_BANK.filter(
    (c) => (c.initial === '' || learned.has(c.initial)) && finalParts(c.final).every((p) => learned.has(p)),
  )
}

/** 从池子里挑 n 个不等于答案、互不重复的干扰项 */
function pickDistractors<T>(pool: T[], exclude: T, key: (x: T) => string, n = 3): T[] {
  return shuffle(pool.filter((x) => key(x) !== key(exclude))).slice(0, n)
}

function genContentSpec(kind: string): QSpec {
  const [base, group] = kind.split(':')
  switch (base) {
    case 'py_pick_char': {
      const bank = group === 'char' ? CHAR_BANK : bankOf(group)
      const item = bank[rnd(bank.length)]
      // 按音节排除干扰项：石和十同音，问「shí」时不能同时出现两个正确答案
      const opts = pickDistractors(bank, item, (s) => s.py)
      return { kind: base, a: 0, b: 0, prompt: item.py, ans: item.zh, opts: opts.map((o) => o.zh) }
    }
    case 'py_unit': {
      const unit = UNIT_BY_ID.get(group) ?? PINYIN_UNITS[0]
      const item = unit.items[rnd(unit.items.length)]
      const opts = pickDistractors(unit.items, item, (s) => s.zh)
      return { kind: base, a: 0, b: 0, prompt: item.py, ans: item.zh, opts: opts.map((o) => o.zh) }
    }
    case 'py_rep': {
      const unit = UNIT_BY_ID.get(group) ?? PINYIN_UNITS[0]
      const item = unit.items[rnd(unit.items.length)]
      const opts = pickDistractors(unit.items, item, (s) => s.py)
      return { kind: base, a: 0, b: 0, prompt: item.zh, ans: item.py, opts: opts.map((o) => o.py) }
    }
    case 'py_word': {
      const pool = charPool(group)
      const item = pool[rnd(pool.length)]
      const opts = pickDistractors(pool, item, (s) => s.py)
      return { kind: base, a: 0, b: 0, prompt: item.py, ans: item.zh, opts: opts.map((o) => o.zh) }
    }
    case 'py_blend': {
      const pool = charPool(group).filter((c) => c.initial !== '')
      const item = pool[rnd(pool.length)]
      const opts = pickDistractors(pool, item, (s) => s.py)
      return {
        kind: base, a: 0, b: 0,
        prompt: `${item.initial}|${item.py.slice(item.initial.length)}`,
        ans: item.zh, opts: opts.map((o) => o.zh),
      }
    }
    case 'char_py': {
      const pool = group.startsWith('u') ? charPool(group) : CHAR_BANK
      const item = pool[rnd(pool.length)]
      const opts = pickDistractors(pool, item, (s) => s.py)
      return { kind: base, a: 0, b: 0, prompt: item.zh, ans: item.py, opts: opts.map((o) => o.py) }
    }
    case 'poem_next': {
      const poem = POEMS[rnd(POEMS.length)]
      const i = rnd(poem.lines.length - 2) // 保证有下一句
      const opts = pickDistractors(POEMS.flatMap((p) => p.lines), poem.lines[i + 1], (l) => l)
      return {
        kind: base, a: 0, b: 0,
        prompt: `${poem.title}|${poem.lines[i]}`,
        ans: poem.lines[i + 1], opts: opts.map((o) => o),
      }
    }
    case 'en_word': {
      const unit = EN_UNITS[group] ?? EN_UNITS.family
      const w: EnWord = unit.words[rnd(unit.words.length)]
      const opts = pickDistractors(unit.words, w, (x) => x.en)
      return { kind: base, a: 0, b: 0, prompt: w.en, ans: w.zh, opts: opts.map((o) => o.zh) }
    }
    // 图词题：答案与干扰项都是单词（渲染层映射成图片），spec 回放链路与文字题一致
    case 'en_pic':
    case 'en_wp': {
      const unit = EN_UNITS[group] ?? EN_UNITS.family
      const w: EnWord = unit.words[rnd(unit.words.length)]
      const opts = pickDistractors(unit.words, w, (x) => x.en)
      return { kind: base, a: 0, b: 0, prompt: w.en, ans: w.en, opts: opts.map((o) => o.en) }
    }
    case 'en_meaning': {
      const unit = EN_UNITS[group] ?? EN_UNITS.family
      const w: EnWord = unit.words[rnd(unit.words.length)]
      const opts = pickDistractors(unit.words, w, (x) => x.en)
      return { kind: base, a: 0, b: 0, prompt: w.zh, ans: w.en, opts: opts.map((o) => o.en) }
    }
    // 闪卡速记：spec.a 存卡片编号（图按编号取），prompt/ans/opts 存单词文本
    case 'fc_pic':
    case 'fc_wp': {
      const unit = FC_UNITS.find((u) => u.id === group) ?? FC_UNITS[0]
      const w = unit.words[rnd(unit.words.length)]
      const opts = pickDistractors(unit.words, w, (x) => x.en)
      return { kind: base, a: w.no, b: 0, prompt: w.en, ans: w.en, opts: opts.map((o) => o.en) }
    }
    default: {
      // en_sentence
      const unit = EN_UNITS[group] ?? EN_UNITS.family
      const sent = unit.sentences?.[rnd(unit.sentences.length)] ?? { before: 'Hello', after: '!', answer: 'Hi', distractors: ['Bye'] }
      return { kind: 'en_sentence', a: 0, b: 0, prompt: `${sent.before}|${sent.after}`, ans: sent.answer, opts: sent.distractors.slice(0, 3) }
    }
  }
}

/** 带调拼音 → 朗读用近似音（TTS 对带调字母支持不稳，先抹掉声调符号） */
function plainPy(py: string): string {
  const map: Record<string, string> = {
    'ā': 'a', 'á': 'a', 'ǎ': 'a', 'à': 'a',
    'ē': 'e', 'é': 'e', 'ě': 'e', 'è': 'e',
    'ī': 'i', 'í': 'i', 'ǐ': 'i', 'ì': 'i',
    'ō': 'o', 'ó': 'o', 'ǒ': 'o', 'ò': 'o',
    'ū': 'u', 'ú': 'u', 'ǔ': 'u', 'ù': 'u',
    'ǖ': 'ü', 'ǘ': 'ü', 'ǚ': 'ü', 'ǜ': 'ü',
  }
  return py.replace(/./g, (c) => map[c] ?? c)
}

const CONTENT_SKILL: Record<string, string> = {
  py_pick_char: '拼音认读',
  py_unit: '拼音认读',
  py_rep: '拼音认读',
  py_word: '拼音识字',
  py_blend: '声韵拼读',
  char_py: '识字标音',
  poem_next: '古诗课文',
  en_word: '英语词汇',
  en_meaning: '英语词汇',
  en_pic: '英语词汇',
  en_wp: '英语词汇',
  en_sentence: '英语句型',
  fc_pic: '闪卡速记',
  fc_wp: '闪卡速记',
}

/** 由 spec 重建内容题（顺序重新洗牌没关系，正确性由 ans 决定） */
function buildContentQuestion(spec: QSpec): Question {
  const ans = spec.ans ?? ''
  const options = shuffle([ans, ...(spec.opts ?? []).filter((o) => o && o !== ans)])
  const base = {
    answer: Math.max(0, options.indexOf(ans)),
    options,
    answerType: 'choice' as const,
    skill: CONTENT_SKILL[spec.kind] ?? '认读',
    spec,
  }
  const zhHint = '先想一想再选，选错了没关系'
  switch (spec.kind) {
    case 'py_pick_char':
    case 'py_unit':
    case 'py_word': {
      const py = spec.prompt ?? ''
      return {
        ...base,
        text: `哪个字读「${py}」？`,
        speech: `想一想，哪个字读${plainPy(py)}`,
        hint: '先自己拼一拼，再从下面选',
        explain: `「${py}」对应的字是「${ans}」`,
      }
    }
    case 'py_rep':
    case 'char_py': {
      const zh = spec.prompt ?? ''
      return {
        ...base,
        text: `「${zh}」的读音是？`,
        speech: zh,
        hint: zhHint,
        explain: `「${zh}」读作「${ans}」`,
      }
    }
    case 'py_blend': {
      const [ini, fin] = (spec.prompt ?? '|').split('|')
      return {
        ...base,
        text: `把 ${ini} 和 ${fin} 拼起来，是哪个字？`,
        speech: `声母${ini}，韵母${plainPy(fin ?? '')}，拼一拼，是哪个字`,
        hint: `前音轻短后音重，两音相连猛一碰：${ini}——${plainPy(fin ?? '')}`,
        explain: `${ini} + ${fin} 拼出「${ans}」`,
      }
    }
    case 'poem_next': {
      const [title, line] = (spec.prompt ?? '|').split('|')
      return {
        ...base,
        text: `《${title}》「${line}」的下一句是？`,
        speech: `《${title}》，${line}，的下一句是`,
        hint: '一句一句往下背，回忆课文顺序',
        explain: `《${title}》的下一句是「${ans}」`,
      }
    }
    case 'en_word': {
      const en = spec.prompt ?? ''
      return {
        ...base,
        speechLang: 'en-US',
        text: `${en} 是什么意思？`,
        speech: en,
        hint: '听听发音，再想想意思',
        explain: `${en} = ${ans}`,
      }
    }
    case 'en_pic': {
      const en = spec.prompt ?? ''
      return {
        ...base,
        speechLang: 'en-US',
        pictureOptions: true,
        text: `${en} 是哪幅图？`,
        speech: en,
        hint: '听听发音，想想它的意思，找到那张图',
        explain: `${en} = ${EN_ZH[en] ?? ans}`,
      }
    }
    case 'en_wp': {
      const en = spec.prompt ?? ''
      return {
        ...base,
        promptImg: en,
        text: '这幅图是哪个单词？',
        speech: '看图想一想，选出对应的单词',
        hint: '看图回想：这个用英语怎么说？',
        explain: `图里是${EN_ZH[en] ?? ''}，英语说 ${ans}`,
      }
    }
    case 'en_meaning': {
      const zh = spec.prompt ?? ''
      return {
        ...base,
        text: `「${zh}」的英文是？`,
        speech: `选出${zh}的英文`,
        hint: zhHint,
        explain: `${zh} = ${ans}`,
      }
    }
    case 'fc_pic': {
      const w = FC_BY_NO.get(spec.a)
      return {
        ...base,
        promptImg: String(spec.a),
        text: '这幅图用英语怎么说？',
        speech: `看图想一想，${w?.zh ?? ''}用英语怎么说`,
        hint: '看图回想：这个用英语怎么说？',
        explain: `图里是${w?.zh ?? ''}，英语说 ${ans}`,
      }
    }
    case 'fc_wp': {
      const en = spec.prompt ?? ''
      const zh = FC_BY_NO.get(FC_NO_BY_WORD[en] ?? -1)?.zh
      return {
        ...base,
        speechLang: 'en-US',
        pictureOptions: true,
        text: `${en} 是哪幅图？`,
        speech: en,
        hint: '听听发音，想想它的意思，找到那张图',
        explain: `${en} = ${zh ?? ans}`,
      }
    }
    default: {
      const [before, after] = (spec.prompt ?? '|').split('|')
      return {
        ...base,
        text: `补全句子：${before} ___ ${after}`,
        speech: `把句子补充完整`,
        hint: '把单词放进去读一读，通顺吗？',
        explain: `${before}${ans}${after}`,
      }
    }
  }
}

function genSpec(kind: string): QSpec {
  if (CONTENT_KINDS.has(kind.split(':')[0] ?? '')) return genContentSpec(kind)
  switch (kind) {
    case 'add10': {
      const a = ri(1, 9)
      return { kind, a, b: ri(1, 10 - a), op: '+' }
    }
    case 'sub10': {
      const a = ri(2, 10)
      return { kind, a, b: ri(1, a), op: '-' }
    }
    case 'cou10': {
      // 凑十法：9/8/7/6 加几，和为 11~18
      const a = ri(6, 9)
      const minB = 11 - a
      return { kind, a, b: ri(minB, 9), op: '+' }
    }
    case 'po10': {
      // 破十法：十几减几，个位不够减
      const a = ri(11, 18)
      const unit = a % 10
      return { kind, a, b: ri(unit + 1, 9), op: '-' }
    }
    case 'ping10': {
      // 平十法：先减到 10，再减剩下的
      const a = ri(13, 18)
      const unit = a % 10
      return { kind, a, b: ri(unit + 1, Math.min(9, unit + 5)), op: '-' }
    }
    case 'carry20': {
      const b = ri(3, 9)
      const lo = Math.max(3, 11 - b)
      const hi = Math.min(19, 20 - b)
      return { kind, a: ri(lo, hi), b, op: '+' }
    }
    case 'back20': {
      // a 取 12~18：a=19 时个位是 9，没有比它大的个位数可减，凑不出真正的退位题
      const a = ri(12, 18)
      const unit = a % 10
      return { kind, a, b: ri(unit + 1, 9), op: '-' }
    }
    case 'ten100': {
      const a = ri(1, 8) * 10
      const b = ri(1, 9 - a / 10) * 10
      return rnd(2) === 0
        ? { kind, a, b, op: '+' }
        : { kind, a: a + b, b: a, op: '-' }
    }
    case 'noCarry100': {
      if (rnd(2) === 0) {
        const a = ri(11, 79)
        const b = ri(11, Math.min(88, 99 - a))
        if ((a % 10) + (b % 10) <= 9) return { kind, a, b, op: '+' }
        return { kind, a: a + b, b: a, op: '-' }
      }
      const a = ri(30, 99)
      const b = ri(11, a - 10)
      return { kind, a, b, op: '-' }
    }
    case 'chain': {
      if (rnd(2) === 0) {
        return { kind, a: ri(1, 9), b: ri(1, 9), c: ri(1, 20 - 2), op: 'add3' }
      }
      const a = ri(15, 40)
      const b = ri(1, 9)
      return { kind, a, b, c: ri(1, a - b - 1), op: 'sub3' }
    }
    default: {
      const pool = ['add10', 'sub10', 'cou10', 'po10', 'carry20', 'back20', 'ten100', 'noCarry100']
      return genSpec(pool[rnd(pool.length)])
    }
  }
}

function calc(spec: QSpec): number {
  if (spec.op === '+') return spec.a + spec.b
  if (spec.op === '-') return spec.a - spec.b
  if (spec.op === 'add3') return spec.a + spec.b + (spec.c ?? 0)
  return spec.a - spec.b - (spec.c ?? 0)
}

function render(spec: QSpec): { text: string; speech: string } {
  const cn = ['零', '一', '二', '三', '四', '五', '六', '七', '八', '九']
  const say = (n: number) =>
    n < 10
      ? cn[n]
      : n < 20
        ? `十${n % 10 ? cn[n % 10] : ''}`
        : `${cn[Math.floor(n / 10)]}十${n % 10 ? cn[n % 10] : ''}`
  if (spec.op === '+') {
    return { text: `${spec.a} + ${spec.b} = ?`, speech: `${say(spec.a)}加${say(spec.b)}等于几` }
  }
  if (spec.op === '-') {
    return { text: `${spec.a} − ${spec.b} = ?`, speech: `${say(spec.a)}减${say(spec.b)}等于几` }
  }
  if (spec.op === 'add3') {
    return {
      text: `${spec.a} + ${spec.b} + ${spec.c} = ?`,
      speech: `${say(spec.a)}加${say(spec.b)}加${say(spec.c ?? 0)}等于几`,
    }
  }
  return {
    text: `${spec.a} − ${spec.b} − ${spec.c} = ?`,
    speech: `${say(spec.a)}减${say(spec.b)}减${say(spec.c ?? 0)}等于几`,
  }
}

function explainOf(spec: QSpec, ans: number): string {
  const { a, b, c, op } = spec
  switch (spec.kind) {
    case 'cou10': {
      const need = 10 - a
      return `凑十法：${a} 差 ${need} 就满十，把 ${b} 分成 ${need} 和 ${b - need}；${a}+${need}=10，10+${b - need}=${ans}`
    }
    case 'po10': {
      const unit = a % 10
      return `破十法：把 ${a} 分成 10 和 ${unit}；10−${b}=${10 - b}，${10 - b}+${unit}=${ans}`
    }
    case 'ping10': {
      const unit = a % 10
      return `平十法：先减到十，${a}−${unit}=10；再减剩下的 ${b - unit}，10−${b - unit}=${ans}`
    }
    case 'carry20':
      return `进位加：个位 ${a % 10}+${b}=${(a % 10) + b}，满十进一，结果是 ${ans}`
    case 'back20': {
      const unit = a % 10
      return `退位减：个位 ${unit} 不够减 ${b}，从十位借一当十，${10 + unit}−${b}=${10 + unit - b}，结果是 ${ans}`
    }
    case 'ten100':
      return op === '+'
        ? `整十数相加：${Math.floor(a / 10)} 个十加 ${Math.floor(b / 10)} 个十 = ${ans / 10} 个十`
        : `整十数相减：${Math.floor(a / 10)} 个十减 ${Math.floor(b / 10)} 个十 = ${ans / 10} 个十`
    case 'noCarry100':
      return op === '+'
        ? `两位数相加：先算个位 ${a % 10}+${b % 10}=${(a % 10) + (b % 10)}，再算十位，结果是 ${ans}`
        : `两位数相减：先算个位 ${a % 10}−${b % 10}=${(a % 10) - (b % 10)}，再算十位，结果是 ${ans}`
    case 'chain':
      return op === 'add3'
        ? `连加：${a}+${b}=${a + b}，${a + b}+${c}=${ans}`
        : `连减：${a}−${b}=${a - b}，${a - b}−${c}=${ans}`
    case 'sub10':
      return `想加算减：${ans}+${b}=${a}，所以 ${a}−${b}=${ans}`
    default:
      return `正确答案是 ${ans}`
  }
}

/**
 * 提示：只给「怎么想」，不泄露答案。
 * 约束（smoke 自动校验）：提示里出现、而题干里没有的数字，不得等于最终答案。
 */
function hintOf(spec: QSpec): string {
  const { a, b, op } = spec
  switch (spec.kind) {
    case 'add10':
      return `数的组成：从 ${a} 开始，往后数 ${b} 个`
    case 'sub10':
      return `想加算减：想一想，几加 ${b} 等于 ${a}？`
    case 'cou10': {
      const need = 10 - a
      return `凑十法：${a} 差 ${need} 就凑成 10，把 ${b} 分成 ${need} 和剩下的，先凑十，再加上剩下的`
    }
    case 'po10':
      return `破十法：把 ${a} 分成 10 和 ${a % 10}，先用 10 减 ${b}，再加上那个个位数`
    case 'ping10':
      return `平十法：先把 ${a} 减到 10（减掉 ${a % 10}），再减剩下的部分`
    case 'carry20':
      return `进位加：个位 ${a % 10} 加 ${b} 满十了，先凑十，个位留下多出来的数，十位别忘了进 1`
    case 'back20':
      return `退位减：个位 ${a % 10} 不够减 ${b}，从十位借 1 当 10，先用 10 减 ${b}`
    case 'ten100':
      return op === '+'
        ? `整十数相加：${a / 10} 个十 加 ${b / 10} 个十，一共几个十？`
        : `整十数相减：${a / 10} 个十 减 ${b / 10} 个十，还剩几个十？`
    case 'noCarry100':
      return op === '+' ? '两位数相加：先算个位，再算十位' : '两位数相减：先算个位，再算十位'
    case 'chain':
      return op === 'add3'
        ? `连加：一步一步来，先算 ${a} + ${b}`
        : `连减：一步一步来，先算 ${a} − ${b}`
    default:
      return '一步一步算，别着急'
  }
}

const SKILL_LABEL: Record<string, string> = {
  add10: '10以内加法',
  sub10: '10以内减法',
  cou10: '凑十法',
  po10: '破十法',
  ping10: '平十法',
  carry20: '20以内进位加',
  back20: '20以内退位减',
  ten100: '整十数加减',
  noCarry100: '100以内加减',
  chain: '连加连减',
  mix: '综合速算',
}

/** 题目唯一键：错题本 / 重做追踪都用它判等（fc_pic 等内容题 text 恒定，不能拿 text 当身份） */
export function specKey(s: QSpec): string {
  return `${s.kind}|${s.a}|${s.b}|${s.c ?? ''}|${s.op ?? ''}|${s.prompt ?? ''}`
}

export function buildQuestion(spec: QSpec): Question {
  if (CONTENT_KINDS.has(spec.kind)) return buildContentQuestion(spec)
  const ans = calc(spec)
  const { text, speech } = render(spec)
  return {
    text,
    speech,
    answer: ans,
    skill: SKILL_LABEL[spec.kind] ?? '速算',
    hint: hintOf(spec),
    explain: explainOf(spec, ans),
    spec,
  }
}

export function questionOfKind(kind: string): Question {
  return buildQuestion(genSpec(kind))
}

/** 内容题变式用的默认素材组 */
const CONTENT_VARIANT_KIND: Record<string, string> = {
  py_pick_char: 'py_pick_char:mixpy',
  py_unit: 'py_unit:u6',
  py_rep: 'py_rep:u6',
  char_py: 'char_py:char',
  py_word: 'py_word:u6',
  py_blend: 'py_blend:u6',
  poem_next: 'poem_next',
  en_word: 'en_word:family',
  en_meaning: 'en_meaning:family',
  en_pic: 'en_pic:family',
  en_wp: 'en_wp:family',
  en_sentence: 'en_sentence:family',
  // fc_pic / fc_wp 不配默认组：spec.kind 自带 ：uN，举一反三就该在原单元出（回表反而错单元）
}

/** 举一反三：3 道变式题（数学换数字/逆运算，内容题换素材再出一道） */
export function variantsOf(spec: QSpec): Question[] {
  const out: Question[] = []
  if (CONTENT_KINDS.has(spec.kind)) {
    const kind = CONTENT_VARIANT_KIND[spec.kind] ?? spec.kind
    out.push(buildQuestion(genSpec(kind)), buildQuestion(genSpec(kind)), buildQuestion(genSpec(kind)))
    return out
  }
  if (spec.op === '+' || spec.op === '-') {
    const sum = spec.op === '+' ? spec.a + spec.b : spec.a
    const other = spec.op === '+' ? spec.a : spec.b
    out.push(
      buildQuestion({
        kind: spec.kind,
        a: sum,
        b: other,
        op: spec.op === '+' ? '-' : '+',
      }),
    )
  }
  out.push(buildQuestion(genSpec(spec.kind)))
  out.push(buildQuestion(genSpec(spec.kind)))
  return out.slice(0, 3)
}

/** 生成本关题目（含未掌握错题注入，线框 P08）。按 spec 去重：同一 spec 只出一次 */
export function buildLevelQuestions(level: LevelDef, inject: QSpec[], n: number): Question[] {
  const qs: Question[] = inject.slice(0, n).map(buildQuestion)
  const seen = new Set(qs.map((q) => JSON.stringify(q.spec)))
  let guard = 0
  while (qs.length < n && guard < 400) {
    const kind = level.kinds[rnd(level.kinds.length)]
    const spec = genSpec(kind)
    const key = JSON.stringify(spec)
    if (!seen.has(key)) {
      seen.add(key)
      qs.push(buildQuestion(spec))
    }
    guard += 1
  }
  return shuffle(qs)
}
