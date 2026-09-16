import type { QSpec, Question, Subject } from '../types'
import { rnd, shuffle } from '../utils/id'

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
  const idx = MATH_LEVELS.findIndex((l) => l.id === level.id)
  return MATH_LEVELS.slice(Math.max(0, idx - 5), idx)
    .filter((l) => !l.boss)
    .map((l) => l.id)
}

const ri = (min: number, max: number) => min + rnd(max - min + 1)

function genSpec(kind: string): QSpec {
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

export function buildQuestion(spec: QSpec): Question {
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

/** 举一反三：3 道变式题（换数字 / 逆运算 / 再换一组） */
export function variantsOf(spec: QSpec): Question[] {
  const out: Question[] = []
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

/** 生成本关题目（含未掌握错题注入，线框 P08） */
export function buildLevelQuestions(level: LevelDef, inject: QSpec[], n: number): Question[] {
  const qs: Question[] = inject.slice(0, n).map(buildQuestion)
  const seen = new Set(qs.map((q) => q.text))
  let guard = 0
  while (qs.length < n && guard < 200) {
    const kind = level.kinds[rnd(level.kinds.length)]
    const q = buildQuestion(genSpec(kind))
    if (!seen.has(q.text)) {
      seen.add(q.text)
      qs.push(q)
    }
    guard += 1
  }
  return shuffle(qs)
}
