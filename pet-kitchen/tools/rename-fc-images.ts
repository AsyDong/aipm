/*
 * 一次性：把 public/img/fc/<卡号>.jpg 改名为 <单词>.jpg（同词多卡 -2 后缀，规则见 courses.ts FC_FILE_BY_NO）。
 * 幂等 —— 重跑安全：已是目标名的跳过。cut-fc-pdf.py 重切图后再跑一次本脚本即可。
 *
 * 跑法：npm run rename-fc
 */

import { existsSync, readdirSync, renameSync } from 'node:fs'
import { FC_FILE_BY_NO } from '../src/data/courses'

const files = new Set(readdirSync('public/img/fc'))
let moved = 0
let already = 0
let missing = 0

for (const [no, name] of Object.entries(FC_FILE_BY_NO)) {
  const src = `public/img/fc/${no}.jpg`
  const dst = `public/img/fc/${name}.jpg`
  if (!existsSync(src)) {
    if (existsSync(dst)) already++
    else {
      console.log(`缺源文件 ${no}.jpg`)
      missing++
    }
    continue
  }
  if (existsSync(dst)) {
    console.log(`目标已存在，不动：${no}.jpg → ${name}.jpg`)
    continue
  }
  renameSync(src, dst)
  moved++
}

console.log(`改名 ${moved} · 已是目标名 ${already} · 缺 ${missing}（共 ${Object.keys(FC_FILE_BY_NO).length} 卡）`)
if (moved + already !== Object.keys(FC_FILE_BY_NO).length) process.exitCode = 1
