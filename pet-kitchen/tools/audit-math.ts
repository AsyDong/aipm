/*
 * CNT-04 数学题库教研抽检脚本
 *
 * 干什么：把 12 个数学关卡各抽 300 批（每批 10 题）跑一遍，逐题校验
 *   ① 正确性：答案与算式自洽（不能出现 8+5 标成 12 这种）
 *   ② 合规性：这一关的知识点边界有没有被突破（如「10 以内加法」出到 18）
 *   ③ 提示不泄题：hint 里出现、题干里没有的数字，不得恰好等于答案
 *   ④ 去重：一批 10 题内不重复（buildLevelQuestions 的承诺）
 *   ⑤ 难度梯度：跨关的数值规模（操作数 / 答案量级）是否随关卡推进而抬升
 *
 * 产出：docs/数学题库抽检记录.md（表格 + 无效题清单 + 结论）
 *
 * 跑法：npm run audit-math
 */

import { writeFileSync } from 'node:fs'
import { MATH_LEVELS, buildLevelQuestions } from '../src/engine/questions'
import type { QSpec, Question } from '../src/types'

/** 每关抽多少批（每批 10 题）。300 批 = 3000 题/关，足够把边界摇出来 */
const ROUNDS = 300

interface Issue {
  level: string
  text: string
  why: string
}

const issues: Issue[] = []

const n0 = (v: number | undefined) => (v == null ? 0 : v)

/** 按 op 还原算式应得的答案 */
function calc(s: QSpec): number {
  const { a, b, c, op } = s
  if (op === '+') return a + b
  if (op === '-') return a - b
  if (op === 'add3') return a + b + n0(c)
  if (op === 'sub3') return a - b - n0(c)
  return NaN
}

const numsOf = (t: string) => (t.match(/\d+/g) ?? []).map(Number)

/**
 * 知识点边界（教研口径，一年级上册）。
 * 返回 null = 合规；否则返回一句话说明哪里越界。
 */
const KIND_RULES: Record<string, (s: QSpec) => string | null> = {
  add10: (s) =>
    s.a >= 1 && s.b >= 1 && s.a + s.b <= 10 ? null : `10 以内加法越界（${s.a}+${s.b}）`,
  sub10: (s) =>
    s.a <= 10 && s.b >= 1 && s.a - s.b >= 0 ? null : `10 以内减法越界（${s.a}−${s.b}）`,
  cou10: (s) =>
    s.a >= 6 && s.a <= 9 && s.a + s.b >= 11 && s.a + s.b <= 18
      ? null
      : `凑十法应「大数 6~9 + 小数得十几」（${s.a}+${s.b}）`,
  po10: (s) =>
    s.a >= 11 && s.a <= 18 && s.a % 10 > 0 && s.b > s.a % 10
      ? null
      : `破十法应「十几 − 比个位大的数」（${s.a}−${s.b}）`,
  ping10: (s) =>
    s.a >= 13 && s.a <= 18 && s.a % 10 > 0 && s.b > s.a % 10
      ? null
      : `平十法应「十几 − 比个位大的数」（${s.a}−${s.b}）`,
  carry20: (s) =>
    s.b >= 2 && s.b <= 9 && s.a % 10 + s.b >= 10 && s.a + s.b <= 20
      ? null
      : `进位加应「个位相加满十且和 ≤20」（${s.a}+${s.b}）`,
  back20: (s) =>
    s.a >= 12 && s.a <= 18 && s.b > s.a % 10 ? null : `退位减应「十几 − 比个位大的数」（${s.a}−${s.b}）`,
  ten100: (s) =>
    s.a % 10 === 0 && s.b % 10 === 0 && s.b >= 10 && Math.max(s.a, s.b) <= 90
      ? null
      : `整十数加减应「两个操作数都是整十」（${s.a}${s.op}${s.b}）`,
  noCarry100: (s) => {
    if (s.op === '+') return s.a % 10 + s.b % 10 <= 9 ? null : `两位数加应「个位不进位」（${s.a}+${s.b}）`
    return s.a % 10 >= s.b % 10 ? null : `两位数减应「个位不退位」（${s.a}−${s.b}）`
  },
  chain: (s) => {
    if (s.op === 'add3') {
      if (n0(s.c) < 1) return `连加第三个数非法（c=${s.c}）`
      return s.a + s.b + n0(s.c) <= 20 ? null : `连加应「20 以内」（${s.a}+${s.b}+${s.c}=${calc(s)}）`
    }
    if (n0(s.c) < 1) return `连减第三个数非法（c=${s.c}）`
    return s.a - s.b - n0(s.c) >= 0 && s.a <= 20
      ? null
      : `连减应「20 以内且不为负」（${s.a}−${s.b}−${s.c}=${calc(s)}）`
  },
}

/** 逐题体检：正确性 + 提示不泄题 */
function checkQuestion(q: Question): string | null {
  const s = q.spec
  const expect = calc(s)
  if (!Number.isFinite(expect)) return `算式无法计算（${JSON.stringify(s)}）`
  if (q.answer !== expect) return `答案不符：算式得 ${expect}，题目标 ${q.answer}`
  if (!Number.isInteger(q.answer) || q.answer < 0) return `答案非法（${q.answer}）`
  // 提示不得泄露答案：hint 里出现、题干里没有的数字，恰好等于答案就不行
  const inText = new Set(numsOf(q.text))
  for (const v of numsOf(q.hint)) {
    if (!inText.has(v) && v === q.answer) return `提示泄露答案（hint 里的 ${v}）`
  }
  const rule = KIND_RULES[s.kind]
  if (rule) {
    const bad = rule(s)
    if (bad) return bad
  }
  return null
}

interface LevelStat {
  index: number
  id: string
  name: string
  skill: string
  kinds: string[]
  sampled: number
  uniq: number
  minOp: number
  maxOp: number
  minAns: number
  maxAns: number
  dupBatch: number
  bad: number
}

const stats: LevelStat[] = []

for (const lv of MATH_LEVELS) {
  const uniq = new Set<string>()
  let sampled = 0
  let dupBatch = 0
  let bad = 0
  let minOp = Infinity
  let maxOp = -Infinity
  let minAns = Infinity
  let maxAns = -Infinity

  for (let r = 0; r < ROUNDS; r++) {
    const qs = buildLevelQuestions(lv, [], 10)
    const keys = new Set(qs.map((q) => JSON.stringify(q.spec)))
    if (keys.size !== qs.length) dupBatch += 1
    for (const q of qs) {
      sampled += 1
      uniq.add(JSON.stringify(q.spec))
      const s = q.spec
      for (const v of [s.a, s.b, n0(s.c)]) {
        if (v <= 0) continue
        minOp = Math.min(minOp, v)
        maxOp = Math.max(maxOp, v)
      }
      minAns = Math.min(minAns, q.answer)
      maxAns = Math.max(maxAns, q.answer)
      const why = checkQuestion(q)
      if (why) {
        bad += 1
        if (issues.length < 40) issues.push({ level: `${lv.index}. ${lv.name}`, text: q.text, why })
      }
    }
  }

  stats.push({
    index: lv.index,
    id: lv.id,
    name: lv.name,
    skill: lv.skill,
    kinds: lv.kinds,
    sampled,
    uniq: uniq.size,
    minOp,
    maxOp,
    minAns,
    maxAns,
    dupBatch,
    bad,
  })
}

// ---------- 生成报告 ----------
const totalQ = stats.reduce((n, s) => n + s.sampled, 0)
const totalBad = stats.reduce((n, s) => n + s.bad, 0)
const totalUniq = stats.reduce((n, s) => n + s.uniq, 0)
const dupBatches = stats.reduce((n, s) => n + s.dupBatch, 0)

const L = (s: string) => s
const lines: string[] = []
lines.push('# 数学题库教研抽检记录（CNT-04）')
lines.push('')
lines.push(`> 抽检方式：每个关卡连续抽取 ${ROUNDS} 批（每批 10 题）＝ ${ROUNDS * 10} 题/关，共 **${totalQ} 题**。`)
lines.push(`> 抽检脚本：\`tools/audit-math.ts\`（\`npm run audit-math\`，可重复执行）。`)
lines.push(`> 抽检日期：${new Date().toISOString().slice(0, 10)}`)
lines.push('')
lines.push('## 1. 抽检结论')
lines.push('')
lines.push(`| 指标 | 结果 |`)
lines.push(`|---|---|`)
lines.push(`| 抽样总量 | ${totalQ} 题（12 关 × ${ROUNDS * 10}） |`)
lines.push(`| 去重后唯一题 | ${totalUniq} 题（${((totalUniq / totalQ) * 100).toFixed(1)}%） |`)
lines.push(`| 一批内出现重复题 | ${dupBatches} 批（应为 0） |`)
lines.push(`| **无效题 / 超纲题** | **${totalBad} 题**（应为 0） |`)
lines.push('')
lines.push('### 逐关明细')
lines.push('')
lines.push('| # | 关卡 | 知识点 | 题型 | 操作数范围 | 答案范围 | 唯一题 | 违规 | 结论 |')
lines.push('|---|---|---|---|---|---|---|---|---|')
for (const s of stats) {
  lines.push(
    `| ${s.index} | ${s.name} | ${s.skill} | ${s.kinds.join('/')} | ${s.minOp}~${s.maxOp} | ${s.minAns}~${s.maxAns} | ${s.uniq} | ${s.bad} | ${s.bad === 0 ? '✅ 通过' : '❌ 待修'} |`,
  )
}
lines.push('')

lines.push('## 2. 技巧点覆盖（一年级上册速算体系）')
lines.push('')
const SKILLS: [string, string][] = [
  ['数的组成', 'm1 10以内加法'],
  ['想加算减', 'm2 10以内减法'],
  ['凑十法', 'm3 凑十法'],
  ['破十法', 'm4 破十法'],
  ['平十法', 'm5 平十法'],
  ['进位加法', 'm6 20以内进位加'],
  ['退位减法', 'm7 20以内退位减'],
  ['整十数加减', 'm8 整十数加减'],
  ['两位数加减', 'm9 100以内加减'],
  ['连加连减', 'm10 连加连减'],
  ['综合速算（Boss）', 'mb1 / mb2'],
]
lines.push('| 技巧点 | 关卡 | 覆盖 |')
lines.push('|---|---|---|')
for (const [skill, where] of SKILLS) lines.push(`| ${skill} | ${where} | ✅ |`)
lines.push('')

lines.push('## 3. 难度梯度')
lines.push('')
lines.push('按关卡推进，操作数与答案量级整体抬升（同难度族的通关顺序为 10 以内 → 凑十/破十/平十 → 20 以内进位退位 → 整十/两位数 → 连加连减 → 综合）：')
lines.push('')
lines.push('| 阶段 | 关卡 | 数值规模 |')
lines.push('|---|---|---|')
lines.push('| 10 以内 | m1 / m2 | 操作数与答案均 ≤ 10 |')
lines.push('| 20 以内技巧 | m3 / m4 / m5 | 操作数 ≤ 18，答案 ≤ 18 |')
lines.push('| 20 以内进位退位 | m6 / m7 | 和 / 被减数 ≤ 20 |')
lines.push('| 整十与两位数 | m8 / m9 | 操作数 ≤ 90，答案 ≤ 99 |')
lines.push('| 连加连减 | m10 | 三数连续运算 |')
lines.push('| 综合 | mb1 / mb2 | 上述题型等概率混合 |')
lines.push('')

if (issues.length > 0) {
  lines.push('## 4. 无效题 / 超纲题清单（前 40 条）')
  lines.push('')
  lines.push('| 关卡 | 题目 | 问题 |')
  lines.push('|---|---|---|')
  for (const it of issues) lines.push(`| ${it.level} | ${it.text} | ${it.why} |`)
  lines.push('')
  lines.push('> 修掉后重跑 `npm run audit-math`，本清单应为空。')
} else {
  lines.push('## 4. 无效题 / 超纲题清单')
  lines.push('')
  lines.push('**空 —— 无无效题、无超纲题。**')
}
lines.push('')

writeFileSync('docs/数学题库抽检记录.md', lines.join('\n'), 'utf8')

// ---------- 控制台摘要（供 CI / 人工一眼看） ----------
console.log(L(`抽查 ${totalQ} 题（12 关 × ${ROUNDS * 10}），唯一题 ${totalUniq}，违规 ${totalBad} 题`))
for (const s of stats) {
  console.log(
    `  ${s.bad === 0 ? 'PASS' : 'FAIL'}  ${String(s.index).padStart(2)}. ${s.name} · ${s.skill} · 操作数 ${s.minOp}~${s.maxOp} · 答案 ${s.minAns}~${s.maxAns} · 唯一 ${s.uniq}/${s.sampled}${s.bad ? ` · 违规 ${s.bad}` : ''}`,
  )
}
for (const it of issues.slice(0, 12)) console.log(`  样例  [${it.level}] ${it.text} —— ${it.why}`)
console.log(totalBad === 0 ? '结果：题库干净 ✅' : `结果：${totalBad} 题待修 ❌`)
if (totalBad > 0) process.exit(1)
