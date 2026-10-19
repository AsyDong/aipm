/*
 * 统一发音 —— 服务端合成（edge-tts 代理）+ Cache API 缓存 + 浏览器 TTS 兜底。
 *
 * 为什么：speechSynthesis 的嗓音随设备走（Windows 晓晓 / 安卓 Google / iOS Siri），
 * 教发音的 app 每台设备声音不一样，娃会困惑。2026-10 起微软按 Origin 封杀浏览器
 * 直连 edge-tts，所以合成放在服务端（server/tts.ts），嗓音全端一致。
 *
 * 兜底链：缓存命中直接用 → 请求 /api/tts → 任何失败（断网 / 后端挂 / 微软掐接口 /
 * 未配置后端）退回设备 TTS。声音退回「不一致」，但功能永远不挂。
 *
 * 缓存：同一句只请求一次，音频存 Cache API（一条几十 KB），离线时命中照常播。
 */

export type SpeakLang = 'zh-CN' | 'en-US'

const CACHE_NAME = 'tts-v1'
const TIMEOUT_MS = 8000
/** 与 main.tsx 同一约定：留空 = 纯本地模式（无服务端合成，直接用设备 TTS） */
const API_BASE = (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? ''

const hasWindow = typeof window !== 'undefined'

// ---------- 声道管理（题面 / 单词 / 拼音共用一条声道，新的来了停旧的） ----------
let cur: HTMLAudioElement | null = null
let generation = 0

export function stopSpeak(): void {
  generation++
  if (cur) {
    try { cur.pause() } catch { /* noop */ }
    cur = null
  }
  if (hasWindow && 'speechSynthesis' in window) {
    try { window.speechSynthesis.cancel() } catch { /* noop */ }
  }
}

// ---------- 浏览器 TTS（最终兜底，嗓音随设备） ----------
let voices: SpeechSynthesisVoice[] = []

function pickZhVoice(): SpeechSynthesisVoice | undefined {
  if (!hasWindow || !('speechSynthesis' in window)) return undefined
  if (!voices.length) voices = window.speechSynthesis.getVoices()
  const zh = voices.filter((v) => v.lang && v.lang.toLowerCase().startsWith('zh'))
  return (
    zh.find((v) => /xiaoxiao|xiaoyan|yaoyao|huihui|female|女/i.test(v.name)) ||
    zh.find((v) => /zh-CN/i.test(v.lang)) ||
    zh[0]
  )
}

if (hasWindow && 'speechSynthesis' in window) {
  window.speechSynthesis.onvoiceschanged = () => { voices = window.speechSynthesis.getVoices() }
}

export function browserSpeak(text: string, lang: SpeakLang, rate: number, volume = 1): void {
  if (!hasWindow || !('speechSynthesis' in window)) return
  try {
    const u = new SpeechSynthesisUtterance(text)
    u.lang = lang
    u.rate = rate
    u.volume = Math.max(0, Math.min(1, volume))
    u.pitch = lang === 'zh-CN' ? 1.05 : 1
    const v = lang === 'zh-CN' ? pickZhVoice() : undefined
    if (v) u.voice = v
    window.speechSynthesis.speak(u)
  } catch { /* 静默降级 */ }
}

// ---------- 服务端合成 + 缓存 ----------
function ttsUrl(text: string, lang: SpeakLang, rate: number): string {
  return `${API_BASE}/api/tts?text=${encodeURIComponent(text)}&lang=${lang}&rate=${rate}`
}

async function fetchBlob(url: string): Promise<Blob> {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`TTS ${res.status}`)
  const blob = await res.blob()
  if (blob.size < 100) throw new Error('TTS 空音频')
  return blob
}

async function ttsBlob(text: string, lang: SpeakLang, rate: number): Promise<Blob> {
  if (!API_BASE) throw new Error('未配置后端，跳过服务端合成')
  const url = ttsUrl(text, lang, rate)
  if (!('caches' in window)) return fetchBlob(url)
  let c: Cache | null = null
  try {
    c = await caches.open(CACHE_NAME)
    const hit = await c.match(url)
    if (hit) {
      const blob = await hit.blob()
      if (blob.size >= 100) return blob
    }
  } catch {
    c = null // 缓存读失败不挡请求
  }
  const blob = await fetchBlob(url)
  if (c) {
    try {
      await c.put(url, new Response(blob, { headers: { 'Content-Type': blob.type || 'audio/mpeg' } }))
    } catch { /* 配额满时丢缓存不丢功能 */ }
  }
  return blob
}

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    p,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error('TTS 超时')), ms)),
  ])
}

function playBlob(blob: Blob, volume: number): Promise<void> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(blob)
    const a = new Audio(url)
    a.volume = Math.max(0, Math.min(1, volume))
    cur = a
    const done = () => {
      URL.revokeObjectURL(url)
      if (cur === a) cur = null
      resolve()
    }
    a.onended = done
    a.onerror = done
    a.play().catch(() => done()) // 自动播放被拦时静默
  })
}

/**
 * 朗读一句话：缓存 / 服务端合成 → 失败退回设备 TTS。
 * 连续调用时后一句会掐掉前一句（含正在请求的）。
 */
export async function speakSmart(text: string, lang: SpeakLang = 'zh-CN', rate = 0.85, volume = 1): Promise<void> {
  if (!text || !hasWindow) return
  stopSpeak()
  const g = generation
  try {
    const blob = await withTimeout(ttsBlob(text, lang, rate), TIMEOUT_MS)
    if (g !== generation) return // 等待期间又来了新的一句，这句扔掉
    await playBlob(blob, volume)
  } catch {
    if (g !== generation) return
    browserSpeak(text, lang, rate, volume)
  }
}
