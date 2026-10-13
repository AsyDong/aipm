// ============ 讯飞语音评测（ISE 流式 WebAPI）============
//
// 从 reading-score-demo/server.py 移植（Python 标准库 → Node 零依赖）。
// 它和 pet-kitchen 原有职责的唯一区别是：这一块要连外网。
//
// 接口地址（官方「语音评测」）：
//   wss://ise-api.xfyun.cn/v2/open-ise
//   签名原文：host: ise-api.xfyun.cn\ndate: {GMT}\nGET /v2/open-ise HTTP/1.1
//
// ⚠ 网上常见的 wss://cn-east-1.ws-api.xf-yun.com/v1/private/xxxxxx 是
//   「语音评测 suntone」等其他产品的私有路径，签名 host 与 path 都不同，混用必然握手失败。
//
// ⚠ 密钥只在服务端出现。讯飞官方明确要求「不支持跨域，请在后端调用」，
//   APIKey/APISecret 放进前端等于送人刷额度。
//
// 零依赖实现说明：WebSocket 用 Node 22 内置的全局 WebSocket，签名用 node:crypto，
// XML 用本文件里的小解析器（讯飞返回的是机器生成的规整 XML，够用，也省掉一个依赖）。

import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'

export const XF_HOST = 'ise-api.xfyun.cn'
export const XF_PATH = '/v2/open-ise'

/** 打分门限（仅英文引擎支持）：hard / common / easy */
export const DEFAULT_CHECK_TYPE = 'common'
/** 允许的题型：短语/句子用 read_sentence；单词用 read_word（试卷标头不同） */
export const ALLOWED_CATEGORIES = ['read_sentence', 'read_word'] as const
export type Category = (typeof ALLOWED_CATEGORIES)[number]

/**
 * 音质 / 内容异常码 → 给孩子/家长看的中文提示。
 * 依据讯飞 FAQ「用户非正常朗读怎么办 / 录音设备或环境异常怎么办」。
 * 28689 不在讯飞公开表里，是实测「喂静音音频」时收到的码（与 is_rejected=true、total=0 同时出现）。
 */
export const EXCEPT_MSG: Record<number, string> = {
  0: '',
  28673: '没听到声音（音量太小或没有语音输入），检查一下麦克风',
  28676: '检测到读的内容和这句话对不上，再读一次试试',
  28680: '环境有点吵（信噪比过低），换个安静的地方试试',
  28689: '没听到声音（可能是静音或音量太小），再读一次试试',
  28690: '录音有爆音（截幅），离麦克风稍微远一点点',
  28709: '环境太吵了（信噪比过低），换个安静的地方试试',
}

export interface XfyunSecrets {
  app_id: string
  api_key: string
  api_secret: string
  check_type?: string
}

export interface XfyunConfig {
  provider: string
  xfyun: XfyunSecrets
  /** 密钥从哪儿来的，/api/health 会回显，方便排查「怎么没读到配置」 */
  source: string
}

/**
 * 读讯飞密钥。优先级：环境变量 > server/xfyun.config.json。
 *
 * 走环境变量是为了跟本服务其它配置（TCB_ENV_ID / SYNC_TOKEN）一致，部署到服务器时
 * 密钥不必落盘；本地开发直接放 json 文件更省事。
 */
export function loadXfyunConfig(): XfyunConfig {
  const env = {
    app_id: (process.env.XFYUN_APP_ID || '').trim(),
    api_key: (process.env.XFYUN_API_KEY || '').trim(),
    api_secret: (process.env.XFYUN_API_SECRET || '').trim(),
    check_type: (process.env.XFYUN_CHECK_TYPE || '').trim() || undefined,
  }
  if (env.app_id && env.api_key && env.api_secret) {
    return { provider: 'xfyun', xfyun: env, source: 'env' }
  }

  const candidates = [
    process.env.PET_XFYUN_CONFIG || '',
    path.join(process.cwd(), 'server', 'xfyun.config.json'),
    path.join(process.cwd(), 'xfyun.config.json'),
  ].filter(Boolean)

  for (const p of candidates) {
    try {
      if (!fs.existsSync(p)) continue
      const raw = JSON.parse(fs.readFileSync(p, 'utf8')) as {
        provider?: string
        xfyun?: Partial<XfyunSecrets>
      }
      const xf = raw.xfyun ?? {}
      return {
        provider: raw.provider || 'xfyun',
        xfyun: {
          app_id: String(xf.app_id ?? '').trim(),
          api_key: String(xf.api_key ?? '').trim(),
          api_secret: String(xf.api_secret ?? '').trim(),
          check_type: xf.check_type,
        },
        source: p,
      }
    } catch {
      /* 配置坏了就当没配，/api/health 会如实回报 */
    }
  }

  return {
    provider: 'xfyun',
    xfyun: { app_id: '', api_key: '', api_secret: '' },
    source: '',
  }
}

export const credentialsReady = (cfg: XfyunConfig): boolean =>
  !!(cfg.xfyun.app_id && cfg.xfyun.api_key && cfg.xfyun.api_secret)

// ---------------------------------------------------------------------------
// 签名与请求
// ---------------------------------------------------------------------------

function buildUrl(cfg: XfyunConfig): string {
  const date = new Date().toUTCString() // 'Tue, 16 Aug 2022 08:28:38 GMT'
  const signatureOrigin = `host: ${XF_HOST}\ndate: ${date}\nGET ${XF_PATH} HTTP/1.1`
  const signature = crypto.createHmac('sha256', cfg.xfyun.api_secret).update(signatureOrigin).digest('base64')
  const authorizationOrigin =
    `api_key="${cfg.xfyun.api_key}", algorithm="hmac-sha256", headers="host date request-line", signature="${signature}"`
  const authorization = Buffer.from(authorizationOrigin, 'utf8').toString('base64')
  const q = new URLSearchParams({ authorization, date, host: XF_HOST })
  return `wss://${XF_HOST}${XF_PATH}?${q.toString()}`
}

/**
 * 试卷文本格式（写错会「乱读得高分」，务必按规范）：
 *   英文单词：首行用 [word] 标记（category=read_word）
 *   英文句子/短语：[content] 标记，换行后接正文
 *   中文：纯文本
 *   都要带 UTF-8 BOM 头
 */
export function buildTextBody(text: string, language = 'en', category: string = 'read_sentence'): string {
  if (language === 'en') {
    const tag = category === 'read_word' ? 'word' : 'content'
    return `\ufeff[${tag}]\n${text}`
  }
  return `\ufeff${text}`
}

export interface Frame {
  common: { app_id: string }
  business: Record<string, unknown>
  data: { status: number; data?: string }
}

/**
 * 四段帧（这套接口最容易写错的地方，少一段都跑不通）：
 *   第 1 帧：business 全量参数 + cmd=ssb，status=0，**不带音频**
 *   第 2 帧：cmd=auw, aus=1（音频首帧），status=1 + 音频
 *   中间帧：cmd=auw, aus=2，status=1 + 音频
 *   末  帧：cmd=auw, aus=4，status=2 + 音频
 */
export function buildFrames(
  appId: string,
  pcm: Buffer,
  text: string,
  opts: { language?: string; category?: string; checkType?: string } = {},
): Frame[] {
  const language = opts.language ?? 'en'
  const category = opts.category ?? 'read_sentence'
  const checkType = opts.checkType ?? DEFAULT_CHECK_TYPE
  const ent = language === 'en' ? 'en_vip' : 'cn_vip'

  const business: Record<string, unknown> = {
    sub: 'ise',
    ent,
    category,
    cmd: 'ssb',
    auf: 'audio/L16;rate=16000', // 16k / 16bit / 单声道
    aue: 'raw',
    tte: 'utf-8',
    rstcd: 'utf8',
    ttp_skip: true, // 直接用 ssb 里的文本评测
    text: buildTextBody(text, language, category),
    // ⚠ plev / ise_unite 必须是**字符串**：传数字会直接 10163 参数校验失败
    plev: '0', // 全维度 + 纠错信息
    ise_unite: '1', // 让 extra_ability 生效
    rst: 'entirety',
    extra_ability: 'multi_dimension;syll_phone_err_msg',
  }
  if (language === 'en' && category === 'read_sentence') {
    // check_type 仅英文句子/篇章题型支持；单词题型下发会被拒
    business.check_type = checkType
  } else if (language !== 'en') {
    // group（adult/youth/pupil）仅中文字/词/句题型支持，英文不支持
    business.group = 'pupil'
  }

  const frames: Frame[] = [{ common: { app_id: appId }, business, data: { status: 0 } }]

  const CHUNK = 1280 // 40ms @ 16k/16bit 单声道
  const chunks: Buffer[] = []
  for (let i = 0; i < pcm.length; i += CHUNK) chunks.push(pcm.subarray(i, i + CHUNK))
  if (chunks.length === 0) chunks.push(Buffer.alloc(0))
  const n = chunks.length

  chunks.forEach((ch, i) => {
    const aus = n === 1 ? 1 : i === 0 ? 1 : i === n - 1 ? 4 : 2
    const last = i === n - 1 && n > 1
    frames.push({
      common: { app_id: appId },
      business: { cmd: 'auw', aus, aue: 'raw' },
      data: { status: last ? 2 : 1, data: ch.toString('base64') },
    })
  })

  if (n === 1) {
    // 只有一块音频时，首帧发完还要补一个末帧，否则引擎不会收尾出分
    frames.push({
      common: { app_id: appId },
      business: { cmd: 'auw', aus: 4, aue: 'raw' },
      data: { status: 2, data: '' },
    })
  }

  return frames
}

/** 从 WAV 二进制里取出 PCM 裸流（跳过 44 字节头）；顺便读出采样率 */
export function wavToPcm(data: Buffer): { pcm: Buffer; rate: number | null } {
  const idx = data.indexOf('data')
  if (idx === -1 || idx + 8 > data.length) return { pcm: data, rate: null }
  const size = data.readUInt32LE(idx + 4)
  const pcm = data.subarray(idx + 8, idx + 8 + size)
  let rate: number | null = null
  const fi = data.indexOf('fmt ')
  if (fi !== -1 && fi + 24 <= data.length) rate = data.readUInt32LE(fi + 12)
  return { pcm, rate }
}

// ---------------------------------------------------------------------------
// XML 解析
//
// 讯飞 WebAPI 的 data.data 是 base64 编码的 **XML**（不是 JSON —— 这是实测更正，
// 官方 SDK 文档写的是 JSON，容易带偏）。分数全写在属性里。
//
// 结构（2026-10-10 真实返回）：
//   <xml_result><read_sentence lan="en" type="study"><rec_paper>
//     <read_chapter total_score="85.2795" accuracy_score="100" fluency_score="98.3092"
//                   integrity_score="85.71428" is_rejected="false" except_info="0"
//                   content="How many books do you have?" word_count="6">
//       <sentence total_score="83.96042">
//         <word content="how" total_score="88.37172" dp_message="0">
//           <syll content="hh aw" syll_score="53.3061" syll_accent="0">
//             <phone content="hh" gwpp="-0.359189" dp_message="0"/>
//
// 两个坑：
//   1) 句子题型的分数在 read_chapter 上，外层 read_sentence 只有 lan/type；
//   2) 单词题型的 read_word 会**同名嵌套两层** —— 外层无分，内层（在 rec_paper 里）才带分。
//      所以不能取第一个，必须挑「带 total_score 的那个」。
// ---------------------------------------------------------------------------

interface XmlNode {
  tag: string
  attrs: Record<string, string>
  children: XmlNode[]
}

/** 极简 XML 解析器：只处理讯飞这种机器生成的规整 XML（属性 + 嵌套 + 自闭合） */
export function parseXml(src: string): XmlNode | null {
  const text = src.replace(/^\ufeff/, '')
  const root: XmlNode = { tag: '#root', attrs: {}, children: [] }
  const stack: XmlNode[] = [root]
  let i = 0

  const readName = (): string => {
    const start = i
    while (i < text.length && /[^\s/>=]/.test(text[i])) i++
    return text.slice(start, i)
  }
  const skipWs = () => {
    while (i < text.length && /\s/.test(text[i])) i++
  }
  const readAttrs = (attrs: Record<string, string>) => {
    for (;;) {
      skipWs()
      if (i >= text.length) return
      const c = text[i]
      if (c === '/' || c === '>') return
      const name = readName()
      if (!name) {
        i++
        continue
      }
      skipWs()
      if (text[i] !== '=') continue
      i++
      skipWs()
      const quote = text[i]
      if (quote !== '"' && quote !== "'") continue
      i++
      const start = i
      while (i < text.length && text[i] !== quote) i++
      attrs[name] = text.slice(start, i)
      i++
    }
  }

  while (i < text.length) {
    const lt = text.indexOf('<', i)
    if (lt === -1) break
    i = lt + 1
    if (text.startsWith('!--', i)) {
      const end = text.indexOf('-->', i)
      i = end === -1 ? text.length : end + 3
      continue
    }
    if (text[i] === '?' || text[i] === '!') {
      const end = text.indexOf('>', i)
      i = end === -1 ? text.length : end + 1
      continue
    }
    if (text[i] === '/') {
      i++
      readName()
      skipWs()
      if (text[i] === '>') i++
      if (stack.length > 1) stack.pop()
      continue
    }
    const tag = readName()
    if (!tag) continue
    const node: XmlNode = { tag, attrs: {}, children: [] }
    readAttrs(node.attrs)
    skipWs()
    const selfClosing = text[i] === '/'
    if (selfClosing) i++
    if (text[i] === '>') i++
    stack[stack.length - 1].children.push(node)
    if (!selfClosing) stack.push(node)
  }

  return root.children[0] ?? null
}

function findAll(node: XmlNode, tag: string, out: XmlNode[] = []): XmlNode[] {
  for (const c of node.children) {
    if (c.tag === tag) out.push(c)
    findAll(c, tag, out)
  }
  return out
}

const asNum = (v: string | undefined): number | null => {
  if (v == null) return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}
const asInt = (v: string | undefined): number | null => {
  const n = asNum(v)
  return n == null ? null : Math.round(n)
}
const r1 = (n: number | null) => (n == null ? null : Math.round(n * 10) / 10)

export interface IseWord {
  word: string
  score: number | null
  dp_message: number | null
}
export interface IseParsed {
  total: number | null
  words: IseWord[]
  dimensions: Record<string, number>
  is_rejected: boolean
  except_info: number | null
  content?: string
}

export function parseIseXml(xmlText: string): IseParsed | null {
  const root = parseXml(xmlText)
  if (!root) return null

  const candidates: XmlNode[] = []
  for (const tag of ['read_chapter', 'read_sentence', 'read_word']) candidates.push(...findAll(root, tag))

  let chapter = candidates.find((c) => c.attrs.total_score !== undefined) ?? candidates[0]
  if (!chapter) {
    // 有些返回把分挂在根上
    if (root.attrs.total_score !== undefined) chapter = root
    else return null
  }
  const a = chapter.attrs

  const words: IseWord[] = []
  for (const w of findAll(chapter, 'word')) {
    const content = (w.attrs.content || '').trim()
    if (!content) continue
    words.push({
      word: content,
      score: r1(asNum(w.attrs.total_score)),
      dp_message: asInt(w.attrs.dp_message),
    })
  }

  const dimensions: Record<string, number> = {}
  for (const k of ['accuracy_score', 'fluency_score', 'integrity_score']) {
    const v = r1(asNum(a[k]))
    if (v != null) dimensions[k.replace('_score', '')] = v
  }

  return {
    total: r1(asNum(a.total_score)),
    words,
    dimensions,
    is_rejected: (a.is_rejected || '').trim().toLowerCase() === 'true',
    except_info: asInt(a.except_info),
    content: a.content,
  }
}

/** JSON 版返回的兜底解析（部分接口/旧版走 JSON；WebAPI 实测是 XML） */
function parseIseJson(obj: unknown): IseParsed | null {
  if (!obj || typeof obj !== 'object') return null
  const seen = new Set<unknown>()
  const words: IseWord[] = []
  let total: number | null = null
  let isRejected = false
  let exceptInfo: number | null = null
  const dimensions: Record<string, number> = {}

  const walk = (node: unknown) => {
    if (!node || typeof node !== 'object' || seen.has(node)) return
    seen.add(node)
    if (Array.isArray(node)) {
      node.forEach(walk)
      return
    }
    const o = node as Record<string, unknown>
    if (typeof o.content === 'string' && o.content.trim() && o.total_score != null) {
      words.push({
        word: o.content.trim(),
        score: r1(asNum(String(o.total_score))),
        dp_message: asInt(o.dp_message == null ? undefined : String(o.dp_message)),
      })
    }
    if (total == null && o.total_score != null) total = r1(asNum(String(o.total_score)))
    for (const k of ['accuracy_score', 'fluency_score', 'integrity_score']) {
      if (o[k] != null && dimensions[k.replace('_score', '')] == null) {
        dimensions[k.replace('_score', '')] = r1(asNum(String(o[k]))) ?? 0
      }
    }
    if (o.is_rejected === true || o.is_rejected === 'true') isRejected = true
    if (exceptInfo == null && o.except_info != null) exceptInfo = asInt(String(o.except_info))
    Object.values(o).forEach(walk)
  }
  walk(obj)
  return { total, words, dimensions, is_rejected: isRejected, except_info: exceptInfo }
}

/** 兼容入口：data.result / data.data 是 base64，解码后可能是 XML 也可能是 JSON */
export function parseXfyunResult(payload: unknown): IseParsed | null {
  if (!payload || typeof payload !== 'object') return null
  const data = (payload as { data?: unknown }).data
  if (!data || typeof data !== 'object') return null
  const d = data as Record<string, unknown>

  for (const key of ['result', 'data']) {
    const v = d[key]
    if (typeof v !== 'string' || !v) continue
    let decoded: string
    try {
      decoded = Buffer.from(v, 'base64').toString('utf8')
    } catch {
      continue
    }
    const head = decoded.replace(/^\ufeff/, '').trimStart()
    if (head.startsWith('<')) {
      const parsed = parseIseXml(decoded)
      if (parsed) return parsed
      continue
    }
    try {
      return parseIseJson(JSON.parse(decoded))
    } catch {
      continue
    }
  }
  return null
}

// ---------------------------------------------------------------------------
// 一次评测
// ---------------------------------------------------------------------------

export interface ScoreResult {
  ok: boolean
  /** 数据帧是否真的发出去了 —— true 才算一次计费提交（握手失败不算） */
  submitted?: boolean
  total?: number | null
  words?: IseWord[]
  dimensions?: Record<string, number>
  is_rejected?: boolean
  except_info?: number | null
  error?: string
  /** 解析不出分数时的原始返回，便于定位 */
  raw_last?: unknown
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

export async function scoreWithXfyun(
  cfg: XfyunConfig,
  pcm: Buffer,
  text: string,
  opts: { language?: string; category?: string; checkType?: string; timeoutMs?: number } = {},
): Promise<ScoreResult> {
  if (!credentialsReady(cfg)) {
    return {
      ok: false,
      error:
        '评分服务还没配讯飞密钥（服务端设 XFYUN_APP_ID / XFYUN_API_KEY / XFYUN_API_SECRET，'
        + '或写 server/xfyun.config.json，模板见 server/xfyun.config.json.example）',
    }
  }

  const frames = buildFrames(cfg.xfyun.app_id, pcm, text, opts)
  const responses: unknown[] = []
  const errors: string[] = []
  let submitted = false

  // Node 22 内置全局 WebSocket（undici），所以本服务仍然零依赖
  let ws: WebSocket
  try {
    ws = new WebSocket(buildUrl(cfg))
  } catch (e) {
    return { ok: false, submitted: false, error: `连接讯飞失败：${(e as Error).message}` }
  }

  await new Promise<void>((resolve) => {
    let settled = false
    const finish = () => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      try {
        ws.close()
      } catch {
        /* noop */
      }
      resolve()
    }
    const timer = setTimeout(() => {
      errors.push('等待讯飞响应超时')
      finish()
    }, opts.timeoutMs ?? 25_000)

    ws.onopen = async () => {
      try {
        for (const fr of frames) {
          ws.send(JSON.stringify(fr))
          submitted = true
          await sleep(20) // 官方建议 40ms；实测偏快也稳
        }
      } catch (e) {
        errors.push(`发送失败：${(e as Error).message}`)
        finish()
      }
    }

    ws.onmessage = (ev: MessageEvent) => {
      let msg: { code?: number | string; message?: string; desc?: string; data?: { status?: number } }
      try {
        msg = JSON.parse(String(ev.data))
      } catch {
        return
      }
      const code = msg.code
      if (code !== 0 && code !== '0' && code != null) {
        // 讯飞自己的业务错误码：48195 试卷/题型不匹配、28682 试卷内容有误……
        errors.push(`${code}: ${msg.message || msg.desc || ''}`)
        finish()
        return
      }
      if (msg.data) responses.push(msg)
      if (msg.data && msg.data.status === 2) finish()
    }

    ws.onerror = () => {
      /* 具体原因由 close 兜底；握手阶段的 401 也从这里过 */
    }
    ws.onclose = () => finish()
  })

  if (errors.length > 0 && responses.length === 0) {
    if (!submitted) {
      return {
        ok: false,
        submitted: false,
        error: `连接讯飞失败：${errors.join('；')}（检查网络、密钥，以及本机系统时间是否准确）`,
      }
    }
    return { ok: false, submitted, error: errors.join('；') }
  }

  let total: number | null = null
  let words: IseWord[] = []
  const dimensions: Record<string, number> = {}
  let isRejected = false
  let exceptInfo: number | null = null

  for (const resp of responses) {
    const parsed = parseXfyunResult(resp)
    if (!parsed) continue
    if (parsed.total != null) total = parsed.total
    if (parsed.words.length > 0) words = parsed.words
    Object.assign(dimensions, parsed.dimensions)
    if (parsed.is_rejected) isRejected = true
    if (parsed.except_info != null) exceptInfo = parsed.except_info
  }

  const out: ScoreResult = {
    ok: true,
    submitted,
    total,
    words,
    dimensions,
    is_rejected: isRejected,
    except_info: exceptInfo,
    raw_last: responses[responses.length - 1] ?? null,
  }

  if (total == null && words.length === 0) {
    out.ok = false
    out.error = errors.length
      ? `讯飞返回错误：${errors.join('；')}`
      : '讯飞返回了响应，但没解析出分数'
  }
  return out
}
