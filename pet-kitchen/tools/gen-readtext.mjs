/*
 * 把 reading-score-demo 的打卡内容库转录成 pet-kitchen 的 TS 数据模块。
 *
 * 为什么要脚本转：内容库有 261 条（134 词 / 36 短语 / 91 句），手抄必错。
 * 源头永远是 reading-score-demo/content-grade1a.js，改内容改那边再重跑本脚本。
 *
 * 用法：
 *   node tools/gen-readtext.mjs [源文件路径] [输出路径]
 * 缺省：
 *   源   D:/workspace/workbuddy/2026-10-10-10-12-37/reading-score-demo/content-grade1a.js
 *   输出 ./src/data/readtext.ts
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(here, '..')

const SRC =
  process.argv[2] ||
  'D:/workspace/workbuddy/2026-10-10-10-12-37/reading-score-demo/content-grade1a.js'
const OUT = process.argv[3] || path.join(root, 'src/data/readtext.ts')

const raw = fs.readFileSync(SRC, 'utf8')

// 源文件是给浏览器用的：window.CONTENT_UNITS = [...]。用一个假 window 接住它。
const win = {}
new Function('window', raw)(win)
const units = win.CONTENT_UNITS
if (!Array.isArray(units) || units.length === 0) throw new Error('没解析出 CONTENT_UNITS')

/** 讯飞 read_word 的试卷标头是 [word]，短语/句子用 [content]；引擎题型据此分派 */
const tierMeta = {
  words: { tier: 'words', suffix: 'w', category: 'read_word', label: '单词' },
  phrases: { tier: 'phrases', suffix: 'p', category: 'read_sentence', label: '短语' },
  sentences: { tier: 'sentences', suffix: 's', category: 'read_sentence', label: '句子' },
}

const j = (v) => JSON.stringify(v)

const lines = []
lines.push('/*')
lines.push(' * 课本跟读内容库（沪教牛津版 一年级上册 Unit 1–6，词 → 短语 → 句 三级）')
lines.push(' *')
lines.push(' * 本文件由 tools/gen-readtext.mjs 从 reading-score-demo/content-grade1a.js 自动转录。')
lines.push(' * 不要手改 —— 改内容请改源文件后重跑脚本：')
lines.push(' *   node tools/gen-readtext.mjs')
lines.push(' *')
lines.push(' * 单词级约束（讯飞 read_word 要求，源库已校对）：一个单词一行；不支持 ? ! ; : , ；')
lines.push(' * 仅支持半角 . - \' ；单词语义 ≤ 32 字节。所以 queen bee 这类条目归在短语级。')
lines.push(' */')
lines.push('')
lines.push('export interface ReadItem {')
lines.push('  /** 参考文本（发给引擎判分的标准答案） */')
lines.push("  en: string")
lines.push('  /** 中文释义（页面提示 + 家长看的） */')
lines.push("  cn: string")
lines.push("  /** 引擎题型：单词用 read_word（试卷标头 [word]），短语/句子用 read_sentence（[content]） */")
lines.push("  category: 'read_word' | 'read_sentence'")
lines.push('}')
lines.push('')
lines.push('export interface ReadUnit {')
lines.push("  id: string")
lines.push("  title: string")
lines.push("  cn: string")
lines.push("  words: ReadItem[]")
lines.push("  phrases: ReadItem[]")
lines.push("  sentences: ReadItem[]")
lines.push('}')
lines.push('')
lines.push('export type ReadTier = \'words\' | \'phrases\' | \'sentences\'')
lines.push('')
lines.push('export const READ_UNITS: ReadUnit[] = [')
for (const u of units) {
  lines.push('  {')
  lines.push(`    id: ${j(u.id)},`)
  lines.push(`    title: ${j(u.title)},`)
  lines.push(`    cn: ${j(u.cn)},`)
  for (const [key, meta] of Object.entries(tierMeta)) {
    lines.push(`    ${key}: [`)
    for (const it of u[key] ?? []) {
      const en = Array.isArray(it.en) ? it.en.join(' ') : String(it.en)
      lines.push(`      { en: ${j(en)}, cn: ${j(it.cn)}, category: ${j(meta.category)} },`)
    }
    lines.push('    ],')
  }
  lines.push('  },')
}
lines.push(']')
lines.push('')
lines.push('/** 三档的决定性元数据：后缀 → 档位 / 引擎题型 / 中文名 */')
lines.push('export const TIER_META: Record<string, { tier: ReadTier; category: ReadItem[\'category\']; label: string }> = {')
for (const meta of Object.values(tierMeta)) {
  lines.push(`  ${meta.suffix}: { tier: '${meta.tier}', category: '${meta.category}', label: '${meta.label}' },`)
}
lines.push('}')
lines.push('')
lines.push('export function readUnit(unitId: string): ReadUnit | undefined {')
lines.push('  return READ_UNITS.find((u) => u.id === unitId)')
lines.push('}')
lines.push('')
lines.push('/**')
lines.push(' * 跟读关 id 约定：rd-<unitId>-<档位后缀>，例如 rd-u1-w / rd-u1-p / rd-u1-s。')
lines.push(' * 返回该关的素材；id 不认识时返回 undefined（调用方负责兜底）。')
lines.push(' */')
lines.push('export function readItemsOf(levelId: string): { unit: ReadUnit; tier: ReadTier; items: ReadItem[] } | undefined {')
lines.push("  const m = /^rd-(u\\d+)-([wps])$/.exec(levelId)")
lines.push('  if (!m) return undefined')
lines.push('  const unit = readUnit(m[1])')
lines.push('  const meta = TIER_META[m[2]]')
lines.push('  if (!unit || !meta) return undefined')
lines.push('  return { unit, tier: meta.tier, items: unit[meta.tier] }')
lines.push('}')
lines.push('')

fs.mkdirSync(path.dirname(OUT), { recursive: true })
fs.writeFileSync(OUT, lines.join('\n'), 'utf8')

const count = units.reduce(
  (n, u) => n + (u.words?.length ?? 0) + (u.phrases?.length ?? 0) + (u.sentences?.length ?? 0),
  0,
)
console.log(`OK  源: ${SRC}`)
console.log(`    输出: ${OUT}`)
console.log(`    ${units.length} 个单元 / ${count} 条内容`)
