// ============ 英语单词配图批量生成（AI 生图） ============
//
// 用法：
//   node tools/gen-en-images.mjs            生成全部缺失的图
//   node tools/gen-en-images.mjs dog cat    只生成指定单词
//
// 图保存到 public/img/en/<word>.png（空格转 -，如 pencil-case.png）。
// 已存在的跳过（.png 或压缩后的 .jpg 都算有）；img/fc 里已有同名图的词直接共用闪卡图，不再生成。
//
// 生成后必须再跑一步压缩（UI 引用的是 .jpg）：
//   powershell -NoProfile -File tools/compress-en-images.ps1
// （png → 288px 白底 JPEG，原 png 删除，1024px 底档在 _scratch/en-img-1024/）
//
// 生图通道按序探测（找到第一个可用的就用）：
//   1. 火山方舟 Agent plan —— 令牌即 env ANTHROPIC_AUTH_TOKEN（ark- 开头，Claude Code 中转同一个），
//      端点是 /api/plan/v3/images/generations（标准 /api/v3 对 plan 令牌不开放，之前就是这么误判的）
//   2. 火山方舟标准通道 —— env ARK_API_KEY + /api/v3
//   3. 智谱 CogView-3-Flash —— env ZHIPU_API_KEY / BIGMODEL_API_KEY（免费）
//   4. Pollinations（flux） —— 免 key 兜底；Node fetch 不吃 HTTP_PROXY，走 curl + 本地代理（实测已 402 付费墙，仅留作历史）
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
  // —— 课本跟读 U1（沪教牛津一上）——
  { en: 'ant', desc: '一只红色的小蚂蚁扛着一粒大米' },
  { en: 'bear', desc: '一只憨态可掬的棕色小熊站着挥手' },
  { en: 'cow', desc: '一只白底黑斑的奶牛站在草地上' },
  { en: 'magic', desc: '一根顶端带星星的魔法棒，周围飘着彩色星光' },
  { en: 'pot', desc: '一口带盖的紫色圆肚汤锅，冒着热气' },
  { en: 'noodles', desc: '一碗热气腾腾的面条，筷子夹起几根' },
  { en: 'like', desc: '一个小女孩双手捧着一颗粉红色爱心，表情开心' },
  { en: 'help', desc: '一个小男孩帮老奶奶提菜篮子，两个人都笑' },
  { en: 'stop', desc: '一个小男孩伸出手掌做停止手势，表情认真' },
  { en: 'cook', desc: '一位妈妈戴着厨师帽拿着锅铲炒菜，开心' },
  { en: 'bye', desc: '一个小女孩挥着手说再见，微笑' },
  // —— U2 ——
  { en: 'elephant', desc: '一只灰色的大象举着长鼻子喷水' },
  { en: 'frog', desc: '一只绿色的小青蛙蹲在荷叶上' },
  { en: 'giraffe', desc: '一只黄色长颈鹿伸长脖子吃高处的树叶' },
  { en: 'hen', desc: '一只棕红色的母鸡站在草丛里' },
  { en: 'tired', desc: '一个小男孩打着哈欠揉眼睛，很困的样子' },
  { en: 'juice', desc: '一杯插着吸管的橙色果汁，旁边有一个橙子' },
  { en: 'fan', desc: '一台蓝色的小台扇，扇叶在转' },
  { en: 'trousers', desc: '一条蓝色的儿童长裤' },
  { en: 'robot', desc: '一个蓝白配色的小机器人，圆圆的眼睛，可爱友好' },
  { en: 'rabbit', desc: '一只白色的小兔子竖着长耳朵' },
  { en: 'tall', desc: '一只长颈鹿和一只小老鼠并排站着比高矮' },
  { en: 'win', desc: '一个小男孩高高举起金色奖杯庆祝胜利' },
  // —— U3 ——
  { en: 'insect', desc: '一只彩色的小瓢虫停在绿叶上' },
  { en: 'jellyfish', desc: '一只粉紫色的水母在蓝色海水里飘动' },
  { en: 'kangaroo', desc: '一只棕色袋鼠妈妈，口袋里探出小袋鼠的头' },
  { en: 'lion', desc: '一只金色鬃毛的小狮子，威风又可爱' },
  { en: 'pen', desc: '一支蓝黑色的钢笔' },
  { en: 'crayon', desc: '三支红黄蓝的蜡笔并排放着' },
  { en: 'door', desc: '一扇棕黄色的木门半开着' },
  { en: 'school', desc: '一栋彩色的小学校舍，门口有旗杆' },
  { en: 'everyone', desc: '四个小朋友手拉手围成一圈，开心欢笑' },
  { en: 'see', desc: '一个小女孩用手指着远处的彩虹' },
  { en: 'where', desc: '一个小男孩捂着眼睛在树后找东西，树后藏着一只小猫' },
  { en: 'have', desc: '一个小男孩双手捧着一个系着蝴蝶结的礼盒抱在胸前' },
  { en: 'use', desc: '一个小女孩用安全剪刀剪纸，很专注' },
  { en: 'them', desc: '一只手握着三只彩色的小气球' },
  { en: 'fly', desc: '一只小鸟展开翅膀在蓝天白云间飞翔' },
  { en: 'head', desc: '一个小男孩摸着自己的头，咧嘴笑' },
  { en: 'sorry', desc: '一个小男孩脸红着双手合十道歉，不好意思' },
  // —— U4 ——
  { en: 'monkey', desc: '一只棕色小猴子挂在树枝上吃香蕉' },
  { en: 'nightingale', desc: '一只棕色的小鸟站在树枝上唱歌，飘出音符' },
  { en: 'ox', desc: '一头黄牛站在绿色的田野里' },
  { en: 'pig', desc: '一只粉色小猪，卷卷的尾巴' },
  { en: 'violin', desc: '一把棕色的小提琴和琴弓' },
  { en: 'work', desc: '一位爸爸穿着工装背心提着工具箱' },
  { en: 'animal', desc: '狮子、大象、兔子、小鸟四种动物排排站' },
  { en: 'dream', desc: '一个小孩在床上睡觉，头顶飘着云朵和星星' },
  { en: 'snake', desc: '一条绿色的小蛇盘在树枝上，表情友好' },
  { en: 'tiger', desc: '一只橙黑条纹的小老虎' },
  { en: 'baby', desc: '一个裹着黄色襁褓的婴儿咧嘴笑' },
  { en: 'nest', desc: '一个鸟窝筑在树杈上，里面有三颗蓝色的蛋' },
  { en: 'queen', desc: '一位戴金色皇冠的女王，穿红色披风，和蔼微笑' },
  { en: 'king', desc: '一位戴金色皇冠的国王，穿蓝色披风' },
  { en: 'lovely', desc: '一只粉红色的大爱心，旁边有小花点缀' },
  { en: 'careful', desc: '一个小女孩小心地端着一杯满满的水走路' },
  { en: 'little', desc: '一只大狗身边坐着一只很小的奶狗' },
  { en: 'around', desc: '四个小朋友手拉手围着一棵大树' },
  // —— U5 ——
  { en: 'dove', desc: '一只白色的鸽子展翅飞翔，嘴里衔着橄榄枝' },
  { en: 'swan', desc: '一只白天鹅在湖面上优雅地游' },
  { en: 'fox', desc: '一只橙色的小狐狸，毛茸茸的大尾巴' },
  { en: 'yak', desc: '一头毛茸茸的黑色牦牛站在草地上' },
  { en: 'zebra', desc: '一只黑白条纹的小斑马' },
  // —— U6 ——
  { en: 'white', desc: '一朵洁白的云朵' },
  { en: 'grey', desc: '一只灰色的小考拉抱着树干' },
  { en: 'park', desc: '一个彩色的小公园，有滑梯、长椅和大树' },
  { en: 'game', desc: '两个小朋友玩套圈游戏，很开心' },
  { en: 'something', desc: '一个系着蝴蝶结的神秘礼盒，闪着星星光点' },
  { en: 'chameleon', desc: '一只绿色变色龙趴在树枝上，尾巴卷成圈' },
  { en: 'kite', desc: '一只彩虹色的燕子风筝在天上飞' },
  { en: 'find', desc: '一个小女孩拿着放大镜在地上找东西，地上有一串小脚印' },
  { en: 'children', desc: '三个背着书包的小朋友蹦蹦跳跳去上学' },
  { en: 'favourite', desc: '一个小女孩抱着一个大大的金色星星，非常开心' },
  { en: 'hurt', desc: '一个小男孩皱着眉捂着贴了创可贴的膝盖' },
  { en: 'nice', desc: '一个小女孩微笑着递给朋友一朵红花' },
  { en: 'hospital', desc: '一栋带红十字标志的白色医院小楼' },
  { en: 'colourful', desc: '一道七彩彩虹横跨绿色草地' },
  { en: 'plant', desc: '一盆两片嫩叶的绿色小盆栽放在窗台上' },
  { en: 'branch', desc: '一根粗壮的树枝，长着几片绿叶' },
  { en: 'zoo', desc: '一个动物园大门，长颈鹿和大象从门里探出头' },
]

const fileName = (en) => `${en.replace(/ /g, '-')}.png`

// ---------- 通道 ----------

// 火山方舟 Agent plan 通道：端点/模型与标准版不同（用户实测提供）
async function arkPlanGen(key, prompt) {
  const res = await fetch('https://ark.cn-beijing.volces.com/api/plan/v3/images/generations', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
    body: JSON.stringify({
      model: process.env.ARK_PLAN_MODEL || 'doubao-seedream-5.0-pro',
      prompt,
      size: '1024x1024',
      response_format: 'b64_json',
      watermark: false,
    }),
  })
  const body = await res.json().catch(() => null)
  if (!res.ok) throw new Error(`ark-plan ${res.status}: ${JSON.stringify(body).slice(0, 200)}`)
  const d = body?.data?.[0]
  if (d?.b64_json) return Buffer.from(d.b64_json, 'base64')
  if (d?.url) {
    const img = await fetch(d.url)
    if (!img.ok) throw new Error(`下载图片失败 ${img.status}`)
    return Buffer.from(await img.arrayBuffer())
  }
  throw new Error(`ark-plan 无图片数据: ${JSON.stringify(body).slice(0, 200)}`)
}

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

// Pollinations（flux）：免 key。Node 的 fetch 不走 HTTP_PROXY，直接让 curl 带代理。
const POLLINATIONS_PROXY = process.env.HTTPS_PROXY || process.env.HTTP_PROXY || 'http://127.0.0.1:7890'
async function pollinationsGen(prompt) {
  const url =
    `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}` +
    `?width=1024&height=1024&nologo=true&model=flux&seed=${Math.floor(Math.random() * 1e9)}`
  const { execFile } = await import('node:child_process')
  const { promisify } = await import('node:util')
  const { stdout } = await promisify(execFile)(
    'curl',
    ['-sfL', '--max-time', '180', '-x', POLLINATIONS_PROXY, url],
    { encoding: 'buffer', maxBuffer: 32 * 1024 * 1024 },
  )
  const buf = Buffer.from(stdout)
  // 只认真图：PNG / JPEG 魔数 + 体积下限（失败时它会回 HTML 或小占位图）
  const isPng = buf[0] === 0x89 && buf[1] === 0x50
  const isJpg = buf[0] === 0xff && buf[1] === 0xd8
  if (!isPng && !isJpg) throw new Error('pollinations 返回的不是图片')
  if (buf.length < 20 * 1024) throw new Error(`pollinations 图太小(${(buf.length / 1024).toFixed(0)}KB)，疑似占位`)
  return buf
}

function pickChannel() {
  // Agent plan 令牌：优先 ARK_PLAN_TOKEN；否则认 ANTHROPIC_AUTH_TOKEN / ANTHROPIC_API_KEY 里 ark- 开头的
  const planTok =
    process.env.ARK_PLAN_TOKEN ||
    [process.env.ANTHROPIC_AUTH_TOKEN, process.env.ANTHROPIC_API_KEY].find((t) => t && t.startsWith('ark-'))
  if (planTok) return { name: `ark-plan(${process.env.ARK_PLAN_MODEL || 'doubao-seedream-5.0-pro'})`, gen: (p) => arkPlanGen(planTok, p) }
  const ark = process.env.ARK_API_KEY
  if (ark) return { name: `ark(${process.env.ARK_MODEL || 'doubao-seedream-3-0-t2i-240828'})`, gen: (p) => arkGen(ark, p) }
  const zhipu = process.env.ZHIPU_API_KEY || process.env.BIGMODEL_API_KEY
  if (zhipu) return { name: 'zhipu(cogview-3-flash)', gen: (p) => zhipuGen(zhipu, p) }
  return { name: 'pollinations(flux)', gen: (p) => pollinationsGen(p) }
}

// ---------- 主流程 ----------

const only = process.argv.slice(2)
const targets = only.length ? WORDS.filter((w) => only.includes(w.en)) : WORDS
// 缺图 = en 里没有 png 也没有 jpg（老图压缩后只剩 jpg），且闪卡里也没有同名图（img/fc 已有的共用，不重复生成）
const missing = targets.filter(
  (w) =>
    !existsSync(join(OUT_DIR, fileName(w.en))) &&
    !existsSync(join(OUT_DIR, fileName(w.en).replace(/\.png$/, '.jpg'))) &&
    !existsSync(join(ROOT, 'public', 'img', 'fc', fileName(w.en))),
)
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
  for (let attempt = 1; attempt <= 3 && !done; attempt++) {
    try {
      const buf = await channel.gen(STYLE + w.desc)
      writeFileSync(file, buf)
      console.log(`  ✅ ${w.en} (${(buf.length / 1024).toFixed(0)} KB)`)
      done = true
      ok++
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      if (attempt < 3) {
        console.log(`  ⏳ ${w.en} 第${attempt}次失败，重试：${msg.slice(0, 120)}`)
        await new Promise((r) => setTimeout(r, 4000))
      } else {
        console.error(`  ❌ ${w.en}: ${msg.slice(0, 200)}`)
      }
    }
  }
  await new Promise((r) => setTimeout(r, 1200)) // 轻微限速
}
console.log(`完成 ${ok}/${missing.length} → ${OUT_DIR}`)
process.exit(ok === missing.length ? 0 : 1)
