// ============ 拼音发音引擎（移植自 pinyin-world/src/audio.ts） ============
// 优先级：本地真人发音（public/audio-py）→ 在线 CDN → 浏览器 TTS 兜底。
// 与 pinyin-world 的差异：去掉了对全局 store 的依赖，音量/语速改为模块级偏好（由设置页注入）。

import manifest from './audio-manifest.json'
import { speakSmart, stopSpeak } from '../utils/tts'

/** 音频根路径：随 BASE_URL 变化，保证在任意部署前缀下都能取到 */
const BASE = import.meta.env.BASE_URL || './'

const prefs = { volume: 1, rate: 0.85 }
export function setAudioPrefs(p: Partial<typeof prefs>) {
  Object.assign(prefs, p)
}
export function audioPrefs() {
  return { ...prefs }
}

// ---------- 标准发音 ----------
let curAudio: HTMLAudioElement | null = null

function stopAudio() {
  if (curAudio) {
    try { curAudio.pause() } catch { /* noop */ }
    curAudio = null
  }
  stopSpeak() // 掐掉 edge-tts / 浏览器 TTS（统一在 utils/tts 管理）
}

function playFile(file: string) {
  stopAudio()
  try {
    const a = new Audio(BASE + 'audio-py/' + file)
    a.volume = Math.max(0, Math.min(1, prefs.volume))
    curAudio = a
    a.play().catch(() => { /* 浏览器拦截自动播放时静默 */ })
  } catch { /* noop */ }
}

/** 播放在线 CDN 发音（本地缺失时兜底） */
function playRemote(file: string) {
  stopAudio()
  try {
    const a = new Audio('https://hanyu-word-pinyin-short.cdn.bcebos.com/' + file)
    a.volume = Math.max(0, Math.min(1, prefs.volume))
    curAudio = a
    a.play().catch(() => { /* noop */ })
  } catch { /* noop */ }
}

// ---------- 网络 TTS（兜底）：edge-tts 统一嗓音，失败退回设备 TTS（见 utils/tts） ----------
export const ttsSupported = 'speechSynthesis' in window

function ttsSpeak(text: string, rate?: number) {
  void speakSmart(text, 'zh-CN', rate ?? prefs.rate, prefs.volume)
}

/** 逐段朗读拼音部件（拼装工坊用），不朗读对应汉字 */
export function speakParts(parts: string[]) {
  const list = parts.filter(Boolean)
  if (!list.length) return
  stopAudio()
  list.forEach((part, i) => {
    window.setTimeout(() => ttsSpeak(part, Math.min(prefs.rate, 0.8)), i * 520)
  })
}

/** 播放标准发音（text 为汉字或拼音字母均可） */
export function speak(text: string) {
  if (!text) return
  const m = manifest as { byZh?: Record<string, string>; byPy?: Record<string, string> }
  const f = m.byZh?.[text] || m.byPy?.[text]
  if (f) { playFile(f); return }
  ttsSpeak(text)
}

const TONE_FILE: Record<string, string> = {
  ā: 'a1', á: 'a2', ǎ: 'a3', à: 'a4', ō: 'o1', ó: 'o2', ǒ: 'o3', ò: 'o4',
  ē: 'e1', é: 'e2', ě: 'e3', è: 'e4', ī: 'i1', í: 'i2', ǐ: 'i3', ì: 'i4',
  ū: 'u1', ú: 'u2', ǔ: 'u3', ù: 'u4', ǖ: 'v1', ǘ: 'v2', ǚ: 'v3', ǜ: 'v4',
}

/** 按带调拼音直接发音（如 'mā'、'zhōng'） */
export function speakPinyin(py: string) {
  if (!py) return
  const m = manifest as { byPy?: Record<string, string> }
  const f = m.byPy?.[py]
  if (f) { playFile(f); return }
  // 未收录：尝试 CDN 在线（ü→v、声调→数字 的文件名规则）
  let file = ''
  for (const ch of py) file += TONE_FILE[ch] ? TONE_FILE[ch][0] : ch === 'ü' ? 'v' : ch
  playRemote(file + '.mp3')
}

// ---------- 语音识别（跟读评分） ----------
interface SRWindow {
  SpeechRecognition?: new () => SRInstance
  webkitSpeechRecognition?: new () => SRInstance
}
interface SRInstance {
  lang: string
  interimResults: boolean
  maxAlternatives: number
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null
  onerror: (() => void) | null
  onend: (() => void) | null
  start: () => void
  stop: () => void
}

const SR = (window as unknown as SRWindow).SpeechRecognition || (window as unknown as SRWindow).webkitSpeechRecognition
export const asrSupported = !!SR

/** 识别一次，返回识别文本；失败返回 null */
export function recognizeOnce(): Promise<string | null> {
  return new Promise((resolve) => {
    if (!SR) { resolve(null); return }
    let rec: SRInstance
    try { rec = new SR() } catch { resolve(null); return }
    rec.lang = 'zh-CN'
    rec.interimResults = false
    rec.maxAlternatives = 3
    let done = false
    const finish = (t: string | null) => { if (!done) { done = true; resolve(t) } }
    rec.onresult = (e) => {
      let text = ''
      for (let i = 0; i < e.results.length; i++) text += e.results[i][0].transcript
      finish(text.trim() || null)
    }
    rec.onerror = () => finish(null)
    rec.onend = () => finish(null)
    try { rec.start() } catch { finish(null) }
    window.setTimeout(() => { try { rec.stop() } catch { /* noop */ } }, 12000)
  })
}

// ---------- 录音回放 ----------
export const recSupported = typeof MediaRecorder !== 'undefined' && !!navigator.mediaDevices?.getUserMedia

export class Recorder {
  private mr: MediaRecorder | null = null
  private chunks: Blob[] = []
  private stream: MediaStream | null = null

  async start(): Promise<void> {
    this.stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    this.chunks = []
    this.mr = new MediaRecorder(this.stream)
    this.mr.ondataavailable = (e) => { if (e.data.size) this.chunks.push(e.data) }
    this.mr.start()
  }

  async stop(): Promise<string | null> {
    return new Promise((resolve) => {
      if (!this.mr) { resolve(null); return }
      this.mr.onstop = () => {
        const blob = new Blob(this.chunks, { type: 'audio/webm' })
        this.stream?.getTracks().forEach((t) => t.stop())
        resolve(URL.createObjectURL(blob))
      }
      try { this.mr.stop() } catch { resolve(null) }
    })
  }
}
