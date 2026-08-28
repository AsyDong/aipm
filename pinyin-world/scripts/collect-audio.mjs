// 拼音标准发音音频：分类整理 + 声调补全脚本（v4.1）
//
// 1) 解析 src/data/pinyin.ts 提取全部需要发音的素材（字母 / 关卡字 / 字库字）
// 2) 四个分类目录，每个目录自包含（共享音节的读音文件在各目录各放一份副本）：
//      public/audio/shengmu/  声母 23（呼读音，文件名 = 字母本身，如 b.mp3 / zh.mp3，无四声）
//      public/audio/yunmu/    韵母 24（教学读法，文件名 = 韵母 + 声调，如 i1.mp3 / üe3.mp3，四声全套；
//                             教学音即第 1 声文件，2-4 声取同音 syllable 录音）
//      public/audio/zhengti/  整体认读音节 16 + 每个音节 1-4 声
//      public/audio/pindu/    拼读音节（关卡字 / 字库字基名 + 呼读音音节 bo po mo fo le ne te）
//                             + 每个基名 1-4 声
//    说明：v4 起与目录现状对齐——声母用独立呼读音录音（misc/1-声母），韵母教学音不再借用
//    yi wu yu ye yue yin ying 等整体认读文件名，而是用韵母本名（i1/u1/ü1/ie1/üe1/in1/ing1…）；
//    eng ong 有了纯韵母录音（eng1/ong1），不再用 heng1/weng1 代替。
//    v4.1 新增三拼音节（声母 + i/u/ü 介母 + 韵母）：来源 github-shikangkai/audio-male 的 wav
//    录音，ffmpeg 转 mp3（22050Hz 单声道 56kbps，与现有文件一致）后放入 pindu/。
// 3) 声调补全只补来源库中真实存在的音节；全渠道都没有的记入报告（多为普通话不存在的声调）
// 4) 来源优先级：现有文件 → 本地 hanyu-pinyin-audio-data 库（mp3 直接复制 / wav 需 ffmpeg 转码）→ 百度云 CDN
// 5) 重新生成 src/data/audio-manifest.json（值带分类子目录路径，含带调拼音键 + 分类清单 + 声调覆盖表）
//    并输出 public/audio/AUDIO-REPORT.md
//
// 用法: node scripts/collect-audio.mjs [--prune] [--recompress]
//   --prune       删除分类目录中不在声明表里的文件（默认只警告不删除，避免误删手工整理的文件）
//   --recompress  把超参文件（>56kbps / >22050Hz / 立体声）重编码为 22050Hz 单声道 56kbps
import { readFileSync, writeFileSync, existsSync, copyFileSync, statSync, readdirSync, rmSync, renameSync } from 'fs'
import { spawnSync } from 'child_process'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const SRC_DATA = join(ROOT, 'src', 'data')
const PUB_AUDIO = join(ROOT, 'public', 'audio')
const CDN = 'https://hanyu-word-pinyin-short.cdn.bcebos.com'
const PRUNE = process.argv.includes('--prune')
const RECOMPRESS = process.argv.includes('--recompress')

// 本地拼音音频库（hanyu-pinyin-audio-data），按优先级排序（仅 mp3 来源）
const LIB = 'D:/Download/hanyu-pinyin-audio-data/hanyu-pinyin-audio-data'
const SOURCE_DIRS = [
  'misc/2-所有音节',          // 216 个，精选全部音节
  'studycli.org/audio',       // 1572
  'digmandarin.com/audio',    // 1627
  'yabla.com/audio',          // 1628
  'yoyochinese.com/audio',    // 1612
  'github-davinfifield/audio',// 1623
  'github-hugolpz/audio',     // 1679（含 lv/nv 等 ü 音节）
  'gitcode.com/audio',        // 1289
]
// 呼读音的独立录音（misc/1-声母）与韵母教学音（misc/1-韵母，文件名无声调数字）
const LIB_INITIALS_DIR = 'misc/1-声母'
const LIB_FINALS_DIR = 'misc/1-韵母'
// wav 录音库（男声全音节，需 ffmpeg 转 mp3）
const WAV_SOURCE_DIRS = ['github-shikangkai/audio-male']
const CATS = ['shengmu', 'yunmu', 'zhengti', 'pindu']
const CAT_CN = { shengmu: '声母', yunmu: '韵母', zhengti: '整体认读', pindu: '拼读' }

// ---------- 教学标准读法表 ----------
const SHENGMU = ['b', 'p', 'm', 'f', 'd', 't', 'n', 'l', 'g', 'k', 'h', 'j', 'q', 'x', 'zh', 'ch', 'sh', 'r', 'z', 'c', 's', 'y', 'w']
const YUNMU = ['a', 'o', 'e', 'i', 'u', 'ü', 'ai', 'ei', 'ui', 'ao', 'ou', 'iu', 'ie', 'üe', 'er', 'an', 'en', 'in', 'un', 'ün', 'ang', 'eng', 'ing', 'ong']
const ZHENGTI = ['zhi', 'chi', 'shi', 'ri', 'zi', 'ci', 'si', 'yi', 'wu', 'yu', 'ye', 'yue', 'yuan', 'yin', 'yun', 'ying']

// 字母 → 本分类目录内的音频文件基名（不含 .mp3）
// 声母 = 字母本身（呼读音）；韵母 = 韵母本名 + 第 1 声（教学音）；
// 整体认读 = 音节 + 教学声调（ri4 / yu2 / yun2 等，与目录现状一致）
const LETTER_PY = {
  ...Object.fromEntries(SHENGMU.map((x) => [x, x])),
  ...Object.fromEntries(YUNMU.map((x) => [x, x + '1'])),
  zhi: 'zhi1', chi: 'chi1', shi: 'shi1', ri: 'ri4',
  zi: 'zi1', ci: 'ci1', si: 'si1',
  yi: 'yi1', wu: 'wu1', yu: 'yu2', ye: 'ye1', yue: 'yue1',
  yuan: 'yuan1', yin: 'yin1', yun: 'yun2', ying: 'ying1',
}

// 字母条目代表字的发音文件基名（按字母索引；带调数据项自动从数据提取）。
// 按字母而非汉字索引：同一汉字可代表多个字母（如 英 = 韵母 ing 和整体认读 ying、
// 鱼 = 韵母 ü 和整体认读 yu），代表字发音取该字母本类的教学读法 / 代表字声调文件。
const REP_PY = {
  // 23 声母：呼读音
  ...Object.fromEntries(SHENGMU.map((x) => [x, x])),
  // 24 韵母：教学读法（第 1 声）；爱/奥/耳 用代表字声调（ai4 / ao4 / er3）
  ...Object.fromEntries(YUNMU.map((x) => [x, x + '1'])),
  ai: 'ai4', ao: 'ao4', er: 'er3',
  // 16 整体认读：代表字声调
  zhi: 'zhi1', chi: 'chi1', shi: 'shi1', ri: 'ri4',
  zi: 'zi4', ci: 'ci4', si: 'si4',
  yi: 'yi1', wu: 'wu3', yu: 'yu2', ye: 'ye4', yue: 'yue4',
  yuan: 'yuan2', yin: 'yin1', yun: 'yun2', ying: 'ying1',
}

// 呼读音音节（b p m f l n t 的代表音节）也进拼读池补全四声；
// d（de）除外：全部来源只有 de2 一个声调，目录现状未收录
const HU_EXTRA_BASES = ['bo', 'po', 'mo', 'fo', 'le', 'ne', 'te']

// 三拼音节（声母 + i/u/ü 介母 + 韵母）进拼读池补全四声；
// 录音取自 github-shikangkai/audio-male（wav）。已在数据里、目录已收录的
// （xia hua huo xiao niao jiu liu niu tian shui dui xue 等）不重复列出
const THREE_PHONEME_BASES = [
  // i 介母
  'jia', 'qia',                                                              // ia（xia 已有）
  'biao', 'piao', 'miao', 'diao', 'tiao', 'liao', 'jiao', 'qiao',            // iao（xiao niao 已有）
  'diu', 'miu', 'qiu', 'xiu',                                                // iu（jiu liu niu 已有）
  'bian', 'pian', 'mian', 'dian', 'nian', 'lian', 'jian', 'qian', 'xian',    // ian（tian 已有）
  'liang', 'jiang', 'qiang', 'xiang',                                        // iang
  'xiong', 'jiong',                                                          // iong
  // u 介母
  'gua', 'kua', 'zhua', 'shua',                                              // ua（hua 已有）
  'guai', 'kuai', 'huai', 'shuai',                                           // uai
  'duo', 'tuo', 'nuo', 'luo', 'zuo', 'cuo', 'suo',                           // uo 甲组（huo 已有）
  'zhuo', 'chuo', 'shuo', 'ruo', 'guo', 'kuo',                               // uo 乙组
  'zhui', 'chui', 'cui', 'sui', 'rui',                                       // ui（dui shui 已有）
  'duan', 'tuan', 'nuan', 'luan', 'guan', 'kuan', 'huan',                    // uan 甲组
  'zhuan', 'chuan', 'shuan', 'suan', 'zuan', 'cuan',                         // uan 乙组
  'guang', 'kuang', 'huang', 'zhuang', 'chuang', 'shuang',                   // uang
  // ü 介母
  'juan', 'quan', 'xuan',                                                    // üan
]

// ---------- 工具 ----------
const TONE_RE = /[āáǎàōóǒòēéěèīíǐìūúǔùǖǘǚǜ]/
const TONE_MAP = { ā: 'a1', á: 'a2', ǎ: 'a3', à: 'a4', ō: 'o1', ó: 'o2', ǒ: 'o3', ò: 'o4', ē: 'e1', é: 'e2', ě: 'e3', è: 'e4', ī: 'i1', í: 'i2', ǐ: 'i3', ì: 'i4', ū: 'u1', ú: 'u2', ǔ: 'u3', ù: 'u4', ǖ: 'v1', ǘ: 'v2', ǚ: 'v3', ǜ: 'v4' }

/** 带调拼音 → 音频文件名（如 mā → ma1.mp3，bái → bai2.mp3，lǜ → lv4.mp3） */
function toFile(py) {
  let base = ''
  let tone = ''
  for (const ch of py) {
    const t = TONE_MAP[ch]
    if (t) { base += t[0]; tone = t[1] }
    else base += ch === 'ü' ? 'v' : ch
  }
  if (base === 'i') base = 'yi'
  else if (base === 'u') base = 'wu'
  else if (base === 'v') base = 'yu'
  return base + tone + '.mp3'
}

/** 声调标注：给基名标上第 tone 声（如 ma,3 → mǎ；yue,4 → yuè；ün,4 → ǜn） */
const TONE_CHARS = { a: 'āáǎà', o: 'ōóǒò', e: 'ēéěè', i: 'īíǐì', u: 'ūúǔù', v: 'ǖǘǚǜ', ü: 'ǖǘǚǜ' }
function markTone(base, tone) {
  let idx = -1
  if (base.includes('a')) idx = base.indexOf('a')
  else if (base.includes('o')) idx = base.indexOf('o')
  else if (base.includes('e')) idx = base.indexOf('e')
  else if (/iu/.test(base)) idx = base.indexOf('u')   // iu 标在 u 上
  else for (let i = base.length - 1; i >= 0; i--) { if ('iuvü'.includes(base[i])) { idx = i; break } }
  if (idx < 0) return null
  const ch = base[idx]
  return base.slice(0, idx) + TONE_CHARS[ch][tone - 1] + base.slice(idx + 1)
}

/** 文件名 → { base, tone }（如 zhi3.mp3 → { base:'zhi', tone:3 }；无调文件返回 null） */
function parseFile(f) {
  const m = /^([a-zü]+)([1-5])\.mp3$/.exec(f)
  return m ? { base: m[1], tone: +m[2] } : null
}

// ---------- 1. 解析数据 ----------
const ts = readFileSync(join(SRC_DATA, 'pinyin.ts'), 'utf8')
const items = []
for (const m of ts.matchAll(/\{\s*py:\s*'([^']+)',\s*zh:\s*'([^']+)'\s*\}/g)) items.push({ py: m[1], zh: m[2] })
for (const m of ts.matchAll(/\{\s*initial:\s*'[^']+',\s*final:\s*'[^']+',\s*py:\s*'([^']+)',\s*zh:\s*'([^']+)'\s*\}/g)) items.push({ py: m[1], zh: m[2] })

// ---------- 2. 构建声明表 claims：file → Set<cat>（一个文件可属于多个分类目录） ----------
const claims = new Map() // file → { cats: Set, keys: Set<带调拼音键> }
function claim(file, cat, key) {
  if (!claims.has(file)) claims.set(file, { cats: new Set(), keys: new Set() })
  const c = claims.get(file)
  c.cats.add(cat)
  if (key) c.keys.add(key)
}

// 声母 23：呼读音（无调文件 b.mp3，键 = 字母）
for (const x of SHENGMU) claim(LETTER_PY[x] + '.mp3', 'shengmu', x)
// 韵母 24：教学读法四声全套（教学音 = 第 1 声文件，键同时挂韵母本名和带调写法）
for (const x of YUNMU) {
  for (let t = 1; t <= 4; t++) {
    const keys = t === 1 ? [x, markTone(x, 1)] : [markTone(x, t)]
    for (const k of keys) claim(x + t + '.mp3', 'yunmu', k)
  }
}
// 整体认读 16：四声全套
for (const x of ZHENGTI) {
  for (let t = 1; t <= 4; t++) claim(x + t + '.mp3', 'zhengti', markTone(x, t))
}

// 拼读：数据里的带调字词（基名进 pindu 声调补全池）
const pinduBases = new Set()
for (const it of items) {
  if (TONE_RE.test(it.py)) {
    const f = toFile(it.py)
    claim(f, 'pindu', it.py)
    pinduBases.add(parseFile(f).base)
  }
}
// 呼读音音节补全四声（bo po mo fo le ne te）
for (const b of HU_EXTRA_BASES) pinduBases.add(b)
// 三拼音节补全四声
for (const b of THREE_PHONEME_BASES) pinduBases.add(b)

const LETTER_CAT = (x) => (SHENGMU.includes(x) ? 'shengmu' : YUNMU.includes(x) ? 'yunmu' : ZHENGTI.includes(x) ? 'zhengti' : null)

// 声调补全（音节基名 → 所属分类）：
//  单韵母 a o e 四声同时进韵母目录（与教学音同批文件）
//  整体认读 16 基名四声 → zhengti（数据里作为拼读音节的也进 pindu）
//  拼读基名四声 → pindu
const ZHENGTI_SET = new Set(ZHENGTI)
function baseCats(b) {
  const cats = new Set()
  if (b === 'a' || b === 'o' || b === 'e') cats.add('yunmu')
  if (ZHENGTI_SET.has(b)) cats.add('zhengti')
  if (pinduBases.has(b)) cats.add('pindu')
  return cats
}
const toneBases = new Set(['a', 'o', 'e', ...ZHENGTI_SET, ...pinduBases])
for (const b of toneBases) {
  for (let t = 1; t <= 4; t++) {
    const f = b + t + '.mp3'
    for (const cat of baseCats(b)) claim(f, cat, markTone(b, t))
  }
}

// ---------- 3. 现有文件池（根目录 + 四个分类目录；不做清空重建，只增不删） ----------
const pool = new Map() // file → 绝对路径（任意目录中找到的第一份）
for (const f of readdirSync(PUB_AUDIO)) if (f.endsWith('.mp3')) pool.set(f, join(PUB_AUDIO, f))
for (const cat of CATS) {
  const d = join(PUB_AUDIO, cat)
  if (existsSync(d)) for (const f of readdirSync(d)) if (f.endsWith('.mp3') && !pool.has(f)) pool.set(f, join(d, f))
}

function sizeOk(p) { try { return statSync(p).size > 1000 } catch { return false } }

// ---------- 4. 物化每个 (file, cat)：现有文件 → 本地库 → CDN ----------
function findInLib(file) {
  // 声母呼读音 / 韵母教学音的独立录音（绝对路径查找，文件名无声调数字）
  const mI = /^([a-z]+)\.mp3$/.exec(file)
  if (mI && SHENGMU.includes(mI[1])) {
    const p = join(LIB, LIB_INITIALS_DIR, file)
    if (existsSync(p) && sizeOk(p)) return { path: p, from: LIB_INITIALS_DIR }
  }
  const mF = /^([a-zü]+)1\.mp3$/.exec(file)
  if (mF && YUNMU.includes(mF[1])) {
    const p = join(LIB, LIB_FINALS_DIR, mF[1] + '.mp3')
    if (existsSync(p) && sizeOk(p)) return { path: p, from: LIB_FINALS_DIR }
  }
  // wav 录音库优先（男声全音节，音色统一；三拼音节由此库提供），需 ffmpeg 转 mp3
  for (const dir of WAV_SOURCE_DIRS) {
    const p = join(LIB, dir, file.replace(/\.mp3$/, '.wav'))
    if (existsSync(p) && sizeOk(p)) return { path: p, from: dir, wav: true }
  }
  // 其余音节库（同名 mp3；独立 ü 音节库内写作 v / ve / vn）
  const alts = [file]
  const m = /^(yu|yue|yun|ü|üe|ün)([1-5])\.mp3$/.exec(file)
  if (m) {
    const alt = { yu: 'v', yue: 've', yun: 'vn', ü: 'v', üe: 've', ün: 'vn' }[m[1]]
    alts.push(alt + m[2] + '.mp3')
  }
  for (const dir of SOURCE_DIRS) {
    for (const alt of alts) {
      const p = join(LIB, dir, alt)
      if (existsSync(p) && sizeOk(p)) return { path: p, from: dir }
    }
  }
  return null
}

// 统一编码为 22050Hz 单声道 56kbps mp3（wav 录音转码 / 超参 mp3 重编码共用）；
// -map_metadata -1 丢弃 ID3 元数据（CDN 源文件内嵌 Adobe XMP 约 8.4KB/个，不丢会原样带进产物）
let ffmpegOk = null
function encodeMp3(src, dest) {
  if (ffmpegOk === null) ffmpegOk = spawnSync('ffmpeg', ['-version'], { encoding: 'utf8' }).status === 0
  if (!ffmpegOk) { console.warn('未找到 ffmpeg，无法转码：' + src); return false }
  const r = spawnSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', src, '-vn', '-map_metadata', '-1', '-codec:a', 'libmp3lame', '-b:a', '56k', '-ar', '22050', '-ac', '1', dest])
  return r.status === 0 && existsSync(dest) && sizeOk(dest)
}

async function fromCdn(file) {
  try {
    const r = await fetch(CDN + '/' + file, { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' } })
    if (!r.ok) return null
    const buf = Buffer.from(await r.arrayBuffer())
    return buf.length > 1000 ? buf : null
  } catch { return null }
}

let okCount = 0, libCount = 0, cdnCount = 0, wavCount = 0
const dupCount = [] // 多目录副本数
const notExist = [] // 全渠道都没有 → 该音节声调不存在
const filled = []   // 本轮新补（本地库 / CDN）
for (const [file, info] of claims) {
  let have = null
  for (const cat of info.cats) {
    const dest = join(PUB_AUDIO, cat, file)
    if (existsSync(dest) && sizeOk(dest)) { have = dest; break }
  }
  // 每个分类目录各放一份
  let src = have
  if (!src) {
    const p = pool.get(file)
    if (p && sizeOk(p)) src = p
    else {
      const lib = findInLib(file)
      if (lib && lib.wav) {
        // wav 录音：ffmpeg 转 mp3 到首个分类目录，再作为源复制到其余目录
        const first = join(PUB_AUDIO, [...info.cats][0], file)
        if (encodeMp3(lib.path, first)) {
          src = first
          wavCount++
          filled.push({ file, from: '库:' + lib.from + '（wav转mp3）' })
        }
      } else if (lib) {
        src = lib.path
        filled.push({ file, from: '库:' + lib.from })
      }
      if (!src) {
        const buf = await fromCdn(file)
        if (buf) {
          src = join(PUB_AUDIO, [...info.cats][0], file)
          writeFileSync(src, buf)
          filled.push({ file, from: 'CDN' })
        } else { notExist.push(file); continue }
      }
    }
  }
  for (const cat of info.cats) {
    const dest = join(PUB_AUDIO, cat, file)
    if (!existsSync(dest)) copyFileSync(src, dest)
  }
  if (info.cats.size > 1) dupCount.push({ file, cats: [...info.cats] })
  if (pool.has(file)) okCount++; else if (filled.some((x) => x.file === file)) libCount++
}
const cdnFiles = filled.filter((x) => x.from === 'CDN').length
const libFiles = filled.length - cdnFiles

// 清理：分类目录中不在声明表里的遗留文件（默认只警告，--prune 才删除）
let cleaned = 0
const strays = []
for (const cat of CATS) {
  const d = join(PUB_AUDIO, cat)
  if (!existsSync(d)) continue
  for (const f of readdirSync(d)) {
    if (f.endsWith('.mp3') && !claims.has(f)) {
      if (PRUNE) { rmSync(join(d, f)); cleaned++ }
      else strays.push(cat + '/' + f)
    }
  }
}

// 重编码：超参文件（>56kbps / >22050Hz / 立体声）统一压缩到 22050Hz 单声道 56kbps（--recompress）
let recompressed = 0
if (RECOMPRESS) {
  for (const cat of CATS) {
    const d = join(PUB_AUDIO, cat)
    if (!existsSync(d)) continue
    for (const f of readdirSync(d)) {
      if (!f.endsWith('.mp3')) continue
      const p = join(d, f)
      if (!sizeOk(p) || statSync(p).size <= 15000) continue // 小于 15KB 的必然已是低码率
      const probe = spawnSync('ffprobe', ['-v', 'error', '-select_streams', 'a:0', '-show_entries', 'stream=sample_rate,channels,bit_rate', '-of', 'csv=p=0', p], { encoding: 'utf8' })
      const [rate, ch, br] = (probe.stdout || '').trim().split(',')
      if (!(+br > 56000 || +rate > 22050 || +ch > 1)) continue
      const tmp = p + '.tmp.mp3'
      if (encodeMp3(p, tmp) && statSync(tmp).size < statSync(p).size) {
        rmSync(p)
        renameSync(tmp, p)
        recompressed++
      } else {
        try { rmSync(tmp) } catch { /* noop */ }
      }
    }
  }
}

// ---------- 5. 生成 manifest ----------
// 带调键 → 目录优先级：整体认读 > 韵母 > 拼读（声母目录只有无调呼读音）
const KEY_PRIORITY = ['zhengti', 'yunmu', 'pindu', 'shengmu']
function pickCat(cats) { return KEY_PRIORITY.find((c) => cats.has(c)) }

const byPy = {}
const byZh = {}
// 字母 / 整体认读：无调键（指向本分类目录的教学读法文件）
for (const x of SHENGMU) byPy[x] = `shengmu/${LETTER_PY[x]}.mp3`
for (const x of YUNMU) byPy[x] = `yunmu/${LETTER_PY[x]}.mp3`
for (const x of ZHENGTI) byPy[x] = `zhengti/${LETTER_PY[x]}.mp3`
// 全部文件的带调键
for (const [file, info] of claims) {
  const cat = pickCat(info.cats)
  for (const key of info.keys) if (key && TONE_RE.test(key)) byPy[key] = `${cat}/${file}`
}
// 汉字 → 文件（数据项 + 代表字）
for (const it of items) {
  if (!it.zh) continue
  if (TONE_RE.test(it.py)) {
    const f = toFile(it.py)
    byZh[it.zh] = `${pickCat(claims.get(f)?.cats ?? new Set(['pindu']))}/${f}`
  } else {
    const cat = LETTER_CAT(it.py)
    const f = REP_PY[it.py]
    if (cat && f) byZh[it.zh] = `${cat}/${f}.mp3`
  }
}

// 分类清单 + 声调覆盖表
const categories = {}
const toneTable = {}
for (const cat of CATS) categories[cat] = readdirSync(join(PUB_AUDIO, cat)).filter((f) => f.endsWith('.mp3')).sort()
for (const [file, info] of claims) {
  const p = parseFile(file)
  if (!p) continue
  const dest = [...info.cats].map((c) => join(PUB_AUDIO, c, file)).find((d) => existsSync(d))
  if (!dest) continue
  if (!toneTable[p.base]) toneTable[p.base] = { cats: [...info.cats].map((c) => CAT_CN[c]), tones: [] }
  toneTable[p.base].tones.push(p.tone)
}

const manifest = { byPy, byZh, categories, toneTable, generatedAt: new Date().toISOString().slice(0, 10), missing: notExist }
writeFileSync(join(SRC_DATA, 'audio-manifest.json'), JSON.stringify(manifest, null, 2))

// ---------- 6. 报告 ----------
const toneRows = Object.entries(toneTable).sort((a, b) => (a[1].cats[0] || '').localeCompare(b[1].cats[0] || '') || a[0].localeCompare(b[0]))
const report = [
  '# 拼音音频分类与声调覆盖报告',
  '',
  `生成时间：${manifest.generatedAt}（脚本：scripts/collect-audio.mjs v4.1）`,
  '',
  '## 分类统计（目录自包含：共享音节的读音在各目录各放一份副本）',
  '',
  ...CATS.map((cat) => {
    const kb = categories[cat].reduce((a, f) => a + statSync(join(PUB_AUDIO, cat, f)).size, 0) / 1024
    return `- **${CAT_CN[cat]} \`${cat}/\`**：${categories[cat].length} 个文件（${kb >= 1024 ? (kb / 1024).toFixed(1) + ' MB' : Math.round(kb) + ' KB'}）`
  }),
  '',
  '> 声母为呼读音独立录音（文件名 = 字母，如 b.mp3），无四声；',
  '> 韵母为教学读法四声全套（文件名 = 韵母本名 + 声调，如 i1.mp3 / üe3.mp3）；',
  '> 共享音节（单韵母 a o e、整体认读同基名等）在韵母 / 整体认读 / 拼读目录各有一份副本，',
  '> manifest 按键各自指向本类目录。',
  '',
  '## 声调覆盖（× = 该声调在全部来源中均无此音节）',
  '',
  '| 类别 | 音节基名 | 1 | 2 | 3 | 4 |',
  '| --- | --- | --- | --- | --- | --- |',
  ...toneRows.map(([base, v]) => `| ${[...new Set(v.cats)].join('/')} | ${base} | ${[1, 2, 3, 4].map((t) => (v.tones.includes(t) ? '✓' : '×')).join(' | ')} |`),
  '',
  `共 ${toneRows.length} 个音节基名。声调不全的基名多为普通话中不存在的声调组合。`,
  '',
  '## 本次执行',
  '',
  `- 已有文件命中：${okCount} 个`,
  `- 本地库（hanyu-pinyin-audio-data）补齐：${libFiles} 个`,
  `- 其中 wav 录音转 mp3（ffmpeg，22050Hz 单声道 56kbps）：${wavCount} 个`,
  `- CDN 下载：${cdnFiles} 个`,
  ...(RECOMPRESS ? [`- 重编码压缩（22050Hz 单声道 56kbps）：${recompressed} 个`] : []),
  `- 跨目录副本：${dupCount.length} 个文件（${dupCount.reduce((a, d) => a + d.cats.length - 1, 0)} 份副本）`,
  `- 清理遗留：${cleaned} 个${PRUNE ? '' : `（--prune 未开启；目录外遗留 ${strays.length} 个${strays.length ? '：' + strays.join(', ') : ''}）`}`,
  `- 全渠道无此音节：${notExist.length} 个${notExist.length ? '（' + notExist.join(', ') + '）' : ''}`,
  '',
  `manifest：byPy ${Object.keys(byPy).length} 键 / byZh ${Object.keys(byZh).length} 键 / categories 四类清单 / toneTable 声调覆盖表`,
  '',
].join('\n')
writeFileSync(join(PUB_AUDIO, 'AUDIO-REPORT.md'), report)

console.log(`声母 ${categories.shengmu.length} / 韵母 ${categories.yunmu.length} / 整体认读 ${categories.zhengti.length} / 拼读 ${categories.pindu.length}`)
console.log(`命中 ${okCount}，本地库补 ${libFiles}（wav 转 mp3 ${wavCount}），CDN 补 ${cdnFiles}，副本 ${dupCount.length} 文件，清理 ${cleaned}${RECOMPRESS ? `，重编码 ${recompressed}` : ''}，无此音节 ${notExist.length}`)
if (strays.length) console.log(`声明表之外的遗留文件 ${strays.length} 个（--prune 可删除）：` + strays.join(', '))
if (notExist.length) console.log('无此音节：' + notExist.join(', '))
console.log(`manifest：byPy ${Object.keys(byPy).length} 键 / byZh ${Object.keys(byZh).length} 键`)
console.log('报告已写入 public/audio/AUDIO-REPORT.md')
