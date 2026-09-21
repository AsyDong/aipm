// 语音引擎：真人标准发音（本地音频）→ 在线 CDN → 浏览器 TTS 兜底
// MediaRecorder 录音回放 / SpeechRecognition 跟读识别
import { save } from './store'
import manifest from './data/audio-manifest.json'

// ---------- 标准发音 ----------
let curAudio: HTMLAudioElement | null = null

function stopAudio() {
  if (curAudio) { try { curAudio.pause() } catch { /* noop */ } curAudio = null }
  if ('speechSynthesis' in window) { try { window.speechSynthesis.cancel() } catch { /* noop */ } }
}

/** 播放本地真人发音文件 */
function playFile(file: string) {
  stopAudio()
  try {
    const a = new Audio('/audio/' + file)
    a.volume = Math.max(0, Math.min(1, save.settings.volume ?? 1))
    curAudio = a
    a.play().catch(() => { /* 浏览器拦截自动播放时静默 */ })
  } catch { /* noop */ }
}

/** 播放在线 CDN 发音（本地缺失时兜底） */
function playRemote(py: string) {
  stopAudio()
  try {
    const a = new Audio('https://hanyu-word-pinyin-short.cdn.bcebos.com/' + py)
    a.volume = Math.max(0, Math.min(1, save.settings.volume ?? 1))
    curAudio = a
    a.play().catch(() => { /* noop */ })
  } catch { /* noop */ }
}

// ---------- 浏览器 TTS（兜底） ----------
let voices: SpeechSynthesisVoice[] = []

function pickVoice(): SpeechSynthesisVoice | undefined {
  if (!('speechSynthesis' in window)) return undefined
  if (!voices.length) voices = window.speechSynthesis.getVoices()
  const zh = voices.filter((v) => v.lang && v.lang.toLowerCase().startsWith('zh'))
  return (
    zh.find((v) => /xiaoxiao|xiaoyan|yaoyao|huihui|female|女/i.test(v.name)) ||
    zh.find((v) => /zh-CN/i.test(v.lang)) ||
    zh[0]
  )
}

if ('speechSynthesis' in window) {
  window.speechSynthesis.onvoiceschanged = () => { voices = window.speechSynthesis.getVoices() }
}

export const ttsSupported = 'speechSynthesis' in window

function ttsSpeak(text: string, opts?: { rate?: number }) {
  if (!ttsSupported) return
  try {
    window.speechSynthesis.cancel()
    const u = new SpeechSynthesisUtterance(text)
    u.lang = 'zh-CN'
    u.rate = opts?.rate ?? save.settings.rate
    u.volume = Math.max(0, Math.min(1, save.settings.volume ?? 1))
    u.pitch = 1.05
    const v = pickVoice()
    if (v) u.voice = v
    window.speechSynthesis.speak(u)
  } catch { /* 忽略异常 */ }
}

/** 播放拆分后的拼音部件（用于拼装工坊），不朗读对应汉字。 */
export function speakParts(parts: string[]) {
  const list = parts.filter(Boolean)
  if (!list.length) return
  stopAudio()
  list.forEach((part, i) => {
    window.setTimeout(() => ttsSpeak(part, { rate: Math.min(save.settings.rate, 0.8) }), i * 520)
  })
}

/**
 * 播放标准发音（text 为汉字或拼音字母均可）
 * 优先本地真人音频（清单见 audio-manifest.json），否则浏览器 TTS
 */
export function speak(text: string, opts?: { rate?: number }) {
  if (!text) return
  const f = (manifest as any).byZh[text] || (manifest as any).byPy[text]
  if (f) { playFile(f); return }
  ttsSpeak(text, opts)
}

/** 按带调拼音直接发音（如 'mā'、'zhōng'） */
export function speakPinyin(py: string) {
  if (!py) return
  const f = (manifest as any).byPy[py]
  if (f) { playFile(f); return }
  // 未收录：尝试 CDN 在线（ü→v、声调→数字 的文件名规则）
  const TONE_MAP: Record<string, string> = { ā: 'a1', á: 'a2', ǎ: 'a3', à: 'a4', ō: 'o1', ó: 'o2', ǒ: 'o3', ò: 'o4', ē: 'e1', é: 'e2', ě: 'e3', è: 'e4', ī: 'i1', í: 'i2', ǐ: 'i3', ì: 'i4', ū: 'u1', ú: 'u2', ǔ: 'u3', ù: 'u4', ǖ: 'v1', ǘ: 'v2', ǚ: 'v3', ǜ: 'v4' }
  let file = ''
  for (const ch of py) file += TONE_MAP[ch] ? TONE_MAP[ch][0] : ch === 'ü' ? 'v' : ch
  playRemote(file + '.mp3')
}

// ---------- 语音识别（跟读评分） ----------
const SR: any = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
export const asrSupported = !!SR

/** 识别一次，返回识别文本；失败返回 null */
export function recognizeOnce(): Promise<string | null> {
  return new Promise((resolve) => {
    if (!SR) return resolve(null)
    let rec: any
    try { rec = new SR() } catch { return resolve(null) }
    rec.lang = 'zh-CN'
    rec.interimResults = false
    rec.maxAlternatives = 3
    let done = false
    const finish = (t: string | null) => { if (!done) { done = true; resolve(t) } }
    rec.onresult = (e: any) => {
      let text = ''
      for (let i = 0; i < e.results.length; i++) text += e.results[i][0].transcript
      finish(text.trim() || null)
    }
    rec.onerror = () => finish(null)
    rec.onend = () => finish(null)
    try { rec.start() } catch { finish(null) }
    // 超时保护 12s
    setTimeout(() => { try { rec.stop() } catch { /* noop */ } }, 12000)
  })
}

// ---------- 录音回放 ----------
export const recSupported = 'MediaRecorder' in window && !!navigator.mediaDevices?.getUserMedia

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
      if (!this.mr) return resolve(null)
      this.mr.onstop = () => {
        const blob = new Blob(this.chunks, { type: 'audio/webm' })
        this.stream?.getTracks().forEach((t) => t.stop())
        resolve(URL.createObjectURL(blob))
      }
      try { this.mr.stop() } catch { resolve(null) }
    })
  }
}
