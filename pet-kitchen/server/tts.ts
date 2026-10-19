// ============ 语音合成（edge-tts 服务端代理） ============
//
// 为什么代理在服务端：2026-10 起微软按 WebSocket 的 Origin 头封杀浏览器直连
// （上游 issue Migushthe2nd/MsEdgeTTS#41），浏览器无法伪造或去掉 Origin ——
// 客户端直连这条路已死；Node 发的 WS 不带 Origin，实测（2026-10-19）仍可用。
//
// 这是 **非官方接口，没有 SLA**：微软哪天彻底掐死，客户端会自动退回设备 TTS
// （src/utils/tts.ts 的兜底），功能不挂、只是嗓音回到「随设备」。
// 哪天要稳，把 synthSpeech 内部换成讯飞官方 TTS（讯飞已是评分供应商），
// 路由和客户端都不用动。

import { MsEdgeTTS, OUTPUT_FORMAT } from 'msedge-tts'

const VOICE: Record<string, string> = {
  'zh-CN': 'zh-CN-XiaoxiaoNeural', // 吐字最清的成人女声，教学用
  'en-US': 'en-US-AnaNeural', // 童声，读单词有「小朋友示范」感
}

export const TTS_LANGS = Object.keys(VOICE)
export const TTS_MAX_TEXT = 100
export const TTS_MIN_RATE = 0.5
export const TTS_MAX_RATE = 1.5

// ponytail: 朴素 LRU（Map 插入序），500 条封顶丢最老。题面模板重复率极高，
// 缓存能挡掉绝大多数微软往返；真到更大规模再上共享缓存
const cache = new Map<string, Buffer>()
const CACHE_MAX = 500

// 每个嗓音一条长连 WebSocket（lib 支持同 socket 并发流），断了下次请求重建
const clients = new Map<string, Promise<MsEdgeTTS>>()

function clientOf(lang: string): Promise<MsEdgeTTS> {
  let p = clients.get(lang)
  if (!p) {
    p = (async () => {
      const tts = new MsEdgeTTS()
      await tts.setMetadata(VOICE[lang], OUTPUT_FORMAT.AUDIO_24KHZ_48KBITRATE_MONO_MP3)
      return tts
    })()
    p.catch(() => {
      if (clients.get(lang) === p) clients.delete(lang)
    })
    clients.set(lang, p)
  }
  return p
}

/** 合成一句 → mp3 Buffer。抛错由路由层转成 502，客户端据此退回设备 TTS */
export async function synthSpeech(text: string, lang: string, rate: number): Promise<Buffer> {
  const key = `${lang}|${rate}|${text}`
  const hit = cache.get(key)
  if (hit) {
    cache.delete(key)
    cache.set(key, hit)
    return hit
  }
  const tts = await clientOf(lang)
  const { audioStream } = tts.toStream(text, { rate })
  const buf = await new Promise<Buffer>((resolve, reject) => {
    const chunks: Buffer[] = []
    audioStream.on('data', (c: Buffer) => chunks.push(c))
    audioStream.on('end', () => resolve(Buffer.concat(chunks)))
    audioStream.on('error', reject)
  })
  if (buf.length < 100) throw new Error('edge-tts 返回空音频')
  if (cache.size >= CACHE_MAX) cache.delete(cache.keys().next().value as string)
  cache.set(key, buf)
  return buf
}
