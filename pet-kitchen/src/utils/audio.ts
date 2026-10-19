/*
 * 录音与音频重采样 —— 从 reading-score-demo/star-rating.html 移植。
 *
 * 讯飞语音评测要的是 **16kHz / 单声道 / 16bit WAV**，而浏览器 MediaRecorder
 * 在 iOS 上给 MP4/AAC、在安卓/桌面给 WebM/Opus，采样率还不固定。
 * 所以必须：录 → decodeAudioData 解码 → OfflineAudioContext 重采样到 16k → 手写 WAV 头。
 *
 * 三个坑（都是踩过的，别删）：
 *   ① getUserMedia 必须显式关掉 echoCancellation / noiseSuppression / autoGainControl，
 *      否则浏览器会把孩子的语音「优化」掉，评分明显偏低。
 *   ② 不指定 mimeType 时 Safari 会给出它自己那套，解码后端可能不认；按优先级探测。
 *   ③ 不能用在线转码服务，全程在浏览器本地做完。
 */

/** 一次录音最长 15 秒，超时自动停（低龄孩子容易忘记点结束） */
export const MAX_RECORD_MS = 15_000

export const RECORD_CONSTRAINTS: MediaStreamConstraints = {
  audio: {
    echoCancellation: false,
    noiseSuppression: false,
    autoGainControl: false,
    channelCount: 1,
  },
}

/** 按优先级挑一个浏览器支持的录音格式 */
export function pickMime(): string {
  const list = [
    'audio/webm;codecs=opus',
    'audio/webm',
    'audio/mp4;codecs=mp4a.40.2',
    'audio/mp4',
  ]
  for (const m of list) {
    try {
      if (window.MediaRecorder && MediaRecorder.isTypeSupported(m)) return m
    } catch {
      /* 某些浏览器 isTypeSupported 会抛，忽略继续试 */
    }
  }
  return ''
}

export const canRecord = (): boolean =>
  typeof navigator !== 'undefined' && !!navigator.mediaDevices?.getUserMedia && typeof window.MediaRecorder !== 'undefined'

/** 录音不可用的原因（null = 能用）。iPad 上最常见的死因是非安全上下文：
 *  用 http://局域网IP 打开页面时浏览器直接不暴露麦克风，必须 https 或 127.0.0.1 */
export function recordBlockReason(): string | null {
  if (typeof window !== 'undefined' && window.isSecureContext === false)
    return '这个网址不是 https，浏览器不肯给麦克风（要用 https 或 http://127.0.0.1 打开）'
  if (!canRecord()) return '这个浏览器不支持录音'
  return null
}

/** 拿麦克风：先按评分要求关三项「优化」；老设备约束过敏就退到最朴素的 { audio: true }
 * （设备默认的回声消除会拉低一点分数，但好过录不了）。权限被拒不重试 —— 再试也是拒 */
export async function getMicStream(): Promise<MediaStream> {
  try {
    return await navigator.mediaDevices.getUserMedia(RECORD_CONSTRAINTS)
  } catch (e) {
    if (e instanceof DOMException && (e.name === 'NotAllowedError' || e.name === 'SecurityError')) throw e
    return navigator.mediaDevices.getUserMedia({ audio: true })
  }
}

/** getUserMedia 报错 → 家长看得懂的话 */
export function micErrorHint(e: unknown): string {
  const name = e instanceof DOMException ? e.name : ''
  if (name === 'NotAllowedError' || name === 'SecurityError')
    return '麦克风权限被拒了：在系统设置里允许这个网站用麦克风，再回来试'
  if (name === 'NotFoundError') return '没找到麦克风设备'
  if (name === 'NotReadableError') return '麦克风被别的应用占用了，关掉它们再试'
  return '打不开麦克风，请检查权限后重试'
}

/** Float32 PCM → 16bit 单声道 WAV Blob */
export function encodeWav(samples: Float32Array, rate: number): Blob {
  const buf = new ArrayBuffer(44 + samples.length * 2)
  const v = new DataView(buf)
  const str = (off: number, s: string) => {
    for (let i = 0; i < s.length; i++) v.setUint8(off + i, s.charCodeAt(i))
  }
  str(0, 'RIFF')
  v.setUint32(4, 36 + samples.length * 2, true)
  str(8, 'WAVE')
  str(12, 'fmt ')
  v.setUint32(16, 16, true)
  v.setUint16(20, 1, true)
  v.setUint16(22, 1, true)
  v.setUint32(24, rate, true)
  v.setUint32(28, rate * 2, true)
  v.setUint16(32, 2, true)
  v.setUint16(34, 16, true)
  str(36, 'data')
  v.setUint32(40, samples.length * 2, true)
  let o = 44
  for (let i = 0; i < samples.length; i++, o += 2) {
    const x = Math.max(-1, Math.min(1, samples[i]))
    v.setInt16(o, x < 0 ? x * 0x8000 : x * 0x7fff, true)
  }
  return new Blob([v], { type: 'audio/wav' })
}

/** 任意浏览器录音格式 → 16kHz 单声道 WAV */
export async function toWav16k(blob: Blob): Promise<Blob> {
  const AC: typeof AudioContext =
    window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
  const OC: typeof OfflineAudioContext =
    window.OfflineAudioContext ||
    (window as unknown as { webkitOfflineAudioContext: typeof OfflineAudioContext }).webkitOfflineAudioContext

  const ab = await blob.arrayBuffer()
  const decoded = await new Promise<AudioBuffer>((resolve, reject) => {
    const c = new AC()
    c.decodeAudioData(
      ab,
      (d) => {
        resolve(d)
        try { void c.close() } catch { /* noop */ }
      },
      (e) => {
        try { void c.close() } catch { /* noop */ }
        reject(e)
      },
    )
  })

  const RATE = 16000
  const frames = Math.ceil(decoded.duration * RATE) || 1
  const oc = new OC(1, frames, RATE)
  const src = oc.createBufferSource()
  src.buffer = decoded
  src.connect(oc.destination)
  src.start()
  const rendered = await oc.startRendering()
  return encodeWav(rendered.getChannelData(0), RATE)
}

/** Blob → 纯 base64（不要 data: 前缀） */
export function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const fr = new FileReader()
    fr.onload = () => resolve(String(fr.result).split(',')[1] || '')
    fr.onerror = reject
    fr.readAsDataURL(blob)
  })
}

/** 一次录音的唯一编号：后端用它记账 + 拦重复提交（同一编号 180 秒内不再调引擎） */
export function newRid(): string {
  return Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8)
}
