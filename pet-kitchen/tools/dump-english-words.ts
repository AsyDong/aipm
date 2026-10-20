/*
 * 英语单词清单生成器 —— 按章节和关卡整理英语部分全部单词，标注配图状态。
 *
 * 用户要给单词加闪卡图片，这份清单就是工作底稿：
 *   - 图片查找规则 = wordImgSrc()：先查牛津树闪卡图（img/fc/<no>.jpg，115 张已齐），
 *     没有再退 img/en/<word>.jpg（空格转 -）。
 *   - 所以「缺图」仅指 img/en 里还没有、且没有闪卡图可复用的词。
 *
 * 产出：docs/英语单词清单.md
 * 跑法：
 *   npx esbuild tools/dump-english-words.ts --bundle --platform=node --format=cjs --outfile=tools/dump-english-words.build.cjs
 *   node tools/dump-english-words.build.cjs
 */

import { readdirSync, writeFileSync } from 'node:fs'
import { READ_UNITS } from '../src/data/readtext'
import { FC_FILE_BY_NO, FC_NO_BY_WORD, FC_UNITS, EN_UNITS } from '../src/data/courses'

interface Status {
  state: 'fc' | 'en' | 'missing' | 'n/a'
  detail: string
}

const fcNo = (word: string): number | undefined => FC_NO_BY_WORD[word]

/** 与 courses.ts 的 enImgSrc 同一规则：空格转 -，其余原样（词库里都是小写） */
const slug = (word: string): string => word.replace(/ /g, '-')

function imgStatus(word: string, enFiles: Set<string>): Status {
  const no = fcNo(word)
  if (no) return { state: 'fc', detail: `复用闪卡 \`img/fc/${FC_FILE_BY_NO[no]}.jpg\`` }
  const s = slug(word)
  if (enFiles.has(`${s}.jpg`)) return { state: 'en', detail: `已有 \`img/en/${s}.jpg\`` }
  return { state: 'missing', detail: `**缺图** → \`img/en/${s}.jpg\`` }
}

function main(): void {
  const enFiles = new Set(readdirSync('public/img/en').filter((f) => f.endsWith('.jpg')))
  const fcFiles = new Set(readdirSync('public/img/fc').filter((f) => f.endsWith('.jpg')))

  const L: string[] = []
  const missing: { word: string; where: string }[] = []
  const seen = new Set<string>()
  const counts = { fc: 0, en: 0, missing: 0 }

  const statusCell = (word: string, where: string): string => {
    const st = imgStatus(word, enFiles)
    if (st.state === 'fc') counts.fc++
    else if (st.state === 'en') counts.en++
    else if (st.state === 'missing') {
      counts.missing++
      if (!seen.has(word)) {
        seen.add(word)
        missing.push({ word, where })
      }
    }
    return st.detail
  }

  // ---------- 第一部分：课本跟读 ----------
  L.push('# 英语单词清单（加闪卡图片工作底稿）\n')
  L.push('> 自动生成：`node tools/dump-english-words.build.cjs`（源 tools/dump-english-words.ts）。数据改动后重跑即可。\n')
  L.push('配图查找规则 = `wordImgSrc()`：**先查牛津树闪卡图** `img/fc/<单词>.jpg`（115 张已齐，图按单词命名；orange 颜色/水果两张，水果是 `orange-2.jpg`），没有再退 `img/en/<word>.jpg`（空格转 `-`）。')
  L.push('所以「缺图」只补 `img/en/` 下缺的文件；放进 `public/img/en/` 后无需改代码，UI 自动生效（加载失败有文字兜底）。\n')

  L.push('## 一、课本跟读（沪教牛津一年级上册，6 单元 × 词/短语/句）\n')
  L.push('跟读关（P18）目前只显示文字，不加载图片 —— 这批图加了以后，未来给跟读页加配图可以直接用。\n')
  for (const u of READ_UNITS) {
    L.push(`### ${u.title.replace(' · ', ' · ')}\n`)
    L.push(`> ${u.cn}　|　关卡：词 \`rd-${u.id}-w\` · 短语 \`rd-${u.id}-p\` · 句 \`rd-${u.id}-s\`\n`)
    L.push('| 单词 | 中文 | 配图状态 |')
    L.push('| --- | --- | --- |')
    for (const w of u.words) L.push(`| ${w.en} | ${w.cn} | ${statusCell(w.en, `课本U${u.id.slice(1)}词`)} |`)
    L.push('')
    if (u.phrases.length) {
      L.push('**短语级**（`rd-' + u.id + '-p`，多词组合不做单词图）：')
      L.push(u.phrases.map((w) => `${w.en}（${w.cn}）`).join('、') + '\n')
    }
    if (u.sentences.length) {
      L.push('**句子级**（`rd-' + u.id + '-s`，整句不做单词图）：')
      L.push(u.sentences.map((w) => w.en).join('；') + '\n')
    }
  }

  // ---------- 第二部分：牛津树闪卡 ----------
  L.push('## 二、牛津树闪卡（剑桥 Power Up Start Smart 预备级，`fc-uN` 关）\n')
  L.push('图按卡号存 `img/fc/<no>.jpg`，115 张已齐 —— 这部分**不用补**，列出仅为对照。\n')
  for (const u of FC_UNITS) {
    L.push(`### 闪卡 Unit ${u.id} · ${u.name}（${u.words.length} 卡）\n`)
    L.push('| 卡号 | 单词 | 中文 | 图 |')
    L.push('| --- | --- | --- | --- |')
    for (const w of u.words) {
      const file = `${FC_FILE_BY_NO[w.no]}.jpg`
      L.push(`| ${w.no} | ${w.en} | ${w.zh} | ${fcFiles.has(file) ? '`img/fc/' + file + '`' : '**缺**'} |`)
    }
    L.push('')
  }

  // ---------- 第三部分：认读巩固词库 ----------
  L.push('## 三、认读巩固词库（P08 选择题配图，`en_pic`/`en_wp`/`en_meaning` 直接吃这些词）\n')
  L.push('这批词是选择题里真正显示图片的地方（wordImgSrc），**优先补这里的缺图**。\n')
  for (const [gid, u] of Object.entries(EN_UNITS)) {
    L.push(`### ${gid} · ${u.name}\n`)
    L.push('| 单词 | 中文 | 配图状态 |')
    L.push('| --- | --- | --- |')
    for (const w of u.words) L.push(`| ${w.en} | ${w.zh} | ${statusCell(w.en, `认读${gid}`)} |`)
    L.push('')
  }

  // ---------- 汇总 ----------
  L.push('---\n')
  L.push(`## 缺图清单（去重后 ${missing.length} 个，按文件名即补即生效）\n`)
  L.push(`全库词图覆盖：复用闪卡 ${counts.fc} 词 · img/en 已有 ${counts.en} 词 · 缺图 ${counts.missing} 处（去重 ${missing.length} 词）\n`)
  for (const m of missing) {
    L.push(`- \`${slug(m.word)}.jpg\` —— ${m.word}（用于：${m.where}）`)
  }
  L.push('')

  writeFileSync('docs/英语单词清单.md', L.join('\n'), 'utf8')
  const missingFc = [...fcFiles].length
  console.log(`课本单元 ${READ_UNITS.length} · 闪卡 ${FC_UNITS.reduce((n, u) => n + u.words.length, 0)} 卡（图 ${missingFc} 张）· 认读组 ${Object.keys(EN_UNITS).length}`)
  console.log(`词图覆盖：闪卡复用 ${counts.fc} · img/en 已有 ${counts.en} · 缺图（去重）${missing.length}`)
  console.log('→ docs/英语单词清单.md')
}

main()
