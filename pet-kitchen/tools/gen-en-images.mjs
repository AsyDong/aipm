// ============ 英语单词配图批量生成（AI 生图） ============
//
// 用法：
//   node tools/gen-en-images.mjs            生成全部缺失的图
//   node tools/gen-en-images.mjs dog cat    只生成指定单词
//
// 图保存到 public/img/en/<word>.png（空格转 -，如 pencil-case.png）。
// 已存在的文件跳过，可随时重跑补漏。
//
// 生图通道按序探测（找到第一个可用的就用）：
//   1. 火山方舟 Seedream   —— env ARK_API_KEY（注意：agent plan 通道的令牌不支持生图模型）
//   2. 智谱 CogView-3-Flash —— env ZHIPU_API_KEY / BIGMODEL_API_KEY（免费）
// 风格统一靠提示词前缀保证；换模型后可整批重生成（先删掉旧图）。

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const OUT_DIR = join(ROOT, 'public', 'img', 'en')

/** 统一风格前缀：儿童闪卡、扁平卡通、纯白底、单主体、无文字 */
const STYLE = '儿童英语学习闪卡插图，扁平卡通风格，色彩明亮柔和，纯白色背景，画面居中一个主体，简洁可爱，画面中不要出现任何文字和字母：'

const WORDS = [
  // family
  { en: 'grandma', desc: '一位慈祥的老奶奶，银色短卷发，戴圆眼镜，穿紫色开衫，微笑着挥手' },
  { en: 'grandpa', desc: '一位和蔼的老爷爷，白发白胡子，穿棕色马甲，微笑着竖大拇指' },
  { en: 'dad', desc: '一位年轻的爸爸，黑色短发，穿蓝色衬衫，微笑着张开双臂' },
  { en: 'mum', desc: '一位年轻的妈妈，棕色长发，穿橙色连衣裙，微笑着' },
  { en: 'brother', desc: '一个小男孩，黑色短发，穿绿色T恤和短裤，开心地笑' },
  { en: 'sister', desc: '一个小女孩，扎双马尾辫，穿粉色裙子，开心地笑' },
  // feeling
  { en: 'cold', desc: '一个小男孩裹着厚厚的蓝色围巾和毛线帽，抱着双臂瑟瑟发抖，周围飘着雪花' },
  { en: 'hot', desc: '一个小女孩满头大汗，穿着短袖，拿着扇子扇风，头顶有一个红太阳' },
  { en: 'thirsty', desc: '一个小男孩口渴的样子，手里拿着空玻璃杯，旁边有一大杯水' },
  { en: 'hungry', desc: '一个小女孩双手摸着咕咕叫的肚子，表情期待，旁边有一碗米饭和筷子' },
  // school
  { en: 'one', desc: '一个又大又圆的红苹果' },
  { en: 'two', desc: '两个并排的黄柠檬' },
  { en: 'three', desc: '三根并排的橙色香蕉' },
  { en: 'four', desc: '四片绿色的四叶草' },
  { en: 'pencil', desc: '一支削好的黄色木铅笔' },
  { en: 'pencil case', desc: '一个打开的蓝色长方形铅笔盒' },
  { en: 'eraser', desc: '一块粉白色的长方形橡皮' },
  { en: 'ruler', desc: '一把带刻度的黄绿色直尺' },
  // ability
  { en: 'draw', desc: '一个小女孩拿蜡笔在画架上画画，画纸上有彩虹' },
  { en: 'write', desc: '一个小男孩趴在书桌前拿铅笔在本子上写字' },
  { en: 'read', desc: '一个小女孩捧着一本打开的蓝皮书认真阅读' },
  { en: 'sing', desc: '一个小男孩拿着麦克风开心地唱歌，周围飘着音符' },
  { en: 'dance', desc: '一个小女孩穿着黄色裙子踮脚跳舞，裙摆飞起' },
  // animal
  { en: 'dog', desc: '一只可爱的棕色小狗，摇着尾巴' },
  { en: 'cat', desc: '一只可爱的橘色小猫，竖着尾巴' },
  { en: 'fish', desc: '一条橙红色的金鱼在水里游' },
  { en: 'bird', desc: '一只蓝色的小鸟站在树枝上' },
  { en: 'hamster', desc: '一只毛茸茸的金黄色仓鼠，捧着瓜子' },
  { en: 'tortoise', desc: '一只绿色的小乌龟慢慢爬' },
  // colour
  { en: 'red', desc: '一个红色的大气球' },
  { en: 'white', desc: '一朵洁白的云朵' },
  { en: 'yellow', desc: '一只黄色的小鸭子' },
  { en: 'green', desc: '一片绿色的嫩树叶' },
  { en: 'blue', desc: '一滴蓝色的大水滴' },
  { en: 'black', desc: '一顶黑色的圆顶礼帽' },
]

const fileName = (en) => `${en.replace(/ /g, '-')}.png`

// ---------- 通道 ----------

async function arkGen(key, prompt) {
  const res = await fetch('https://ark.cn-beijing.volces.com/api/v3/images/generations', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
    body: JSON.stringify({
      model: process.env.ARK_MODEL || 'doubao-seedream-3-0-t2i-240828',
      prompt,
      size: '1024x1024',
      response_format: 'b64_json',
    }),
  })
  const body = await res.json().catch(() => null)
  if (!res.ok) throw new Error(`ark ${res.status}: ${JSON.stringify(body).slice(0, 200)}`)
  const b64 = body?.data?.[0]?.b64_json
  if (!b64) throw new Error(`ark 无图片数据: ${JSON.stringify(body).slice(0, 200)}`)
  return Buffer.from(b64, 'base64')
}

async function zhipuGen(key, prompt) {
  const res = await fetch('https://open.bigmodel.cn/api/paas/v4/images/generations', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
    body: JSON.stringify({ model: process.env.ZHIPU_MODEL || 'cogview-3-flash', prompt, size: '1024x1024' }),
  })
  const body = await res.json().catch(() => null)
  if (!res.ok) throw new Error(`zhipu ${res.status}: ${JSON.stringify(body).slice(0, 200)}`)
  const url = body?.data?.[0]?.url
  if (!url) throw new Error(`zhipu 无图片 URL`)
  const img = await fetch(url)
  if (!img.ok) throw new Error(`下载图片失败 ${img.status}`)
  return Buffer.from(await img.arrayBuffer())
}

function pickChannel() {
  const ark = process.env.ARK_API_KEY
  if (ark) return { name: `ark(${process.env.ARK_MODEL || 'doubao-seedream-3-0-t2i-240828'})`, gen: (p) => arkGen(ark, p) }
  const zhipu = process.env.ZHIPU_API_KEY || process.env.BIGMODEL_API_KEY
  if (zhipu) return { name: 'zhipu(cogview-3-flash)', gen: (p) => zhipuGen(zhipu, p) }
  return null
}

// ---------- 主流程 ----------

const only = process.argv.slice(2)
const targets = only.length ? WORDS.filter((w) => only.includes(w.en)) : WORDS
const missing = targets.filter((w) => !existsSync(join(OUT_DIR, fileName(w.en))))
if (!missing.length) {
  console.log('没有缺图，全部已生成 ✅')
  process.exit(0)
}

const channel = pickChannel()
if (!channel) {
  console.error('未找到可用的生图 key。设置 ARK_API_KEY 或 ZHIPU_API_KEY 后重试。')
  process.exit(1)
}

mkdirSync(OUT_DIR, { recursive: true })
console.log(`通道 ${channel.name}，本次待生成 ${missing.length} 张`)

let ok = 0
for (const w of missing) {
  const file = join(OUT_DIR, fileName(w.en))
  let done = false
  for (let attempt = 1; attempt <= 2 && !done; attempt++) {
    try {
      const buf = await channel.gen(STYLE + w.desc)
      writeFileSync(file, buf)
      console.log(`  ✅ ${w.en} (${(buf.length / 1024).toFixed(0)} KB)`)
      done = true
      ok++
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      if (attempt === 1) {
        console.log(`  ⏳ ${w.en} 第一次失败，重试：${msg.slice(0, 120)}`)
        await new Promise((r) => setTimeout(r, 1500))
      } else {
        console.error(`  ❌ ${w.en}: ${msg.slice(0, 200)}`)
      }
    }
  }
  await new Promise((r) => setTimeout(r, 500)) // 轻微限速
}
console.log(`完成 ${ok}/${missing.length} → ${OUT_DIR}`)
process.exit(ok === missing.length ? 0 : 1)
