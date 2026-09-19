// ============ 轻量音效（WebAudio 现场合成，零音频资产） ============
//
// 金币掉落的「叮」声：两个方波音 B5→E6（马里奥金币式的经典双音），
// 不引音频文件、不依赖网络、加载零成本。
//
// 浏览器要求 AudioContext 在用户手势之后才能出声 —— 闯关结算屏一定出现在
// 孩子点击答题之后，天然满足这个约束，无需额外解锁逻辑。

let ctx: AudioContext | null = null

function ac(): AudioContext | null {
  try {
    const AC =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!AC) return null
    if (!ctx) ctx = new AC()
    if (ctx.state === 'suspended') void ctx.resume()
    return ctx
  } catch {
    return null
  }
}

/** 一个短促的方波音符 */
function note(a: AudioContext, at: number, freq: number, dur: number, vol: number): void {
  const osc = a.createOscillator()
  const gain = a.createGain()
  osc.type = 'square'
  osc.frequency.value = freq
  gain.gain.setValueAtTime(vol, at)
  gain.gain.exponentialRampToValueAtTime(0.001, at + dur)
  osc.connect(gain)
  gain.connect(a.destination)
  osc.start(at)
  osc.stop(at + dur + 0.05)
}

/** 一枚金币落袋的「叮」：低音起、高音收 */
function dingAt(a: AudioContext, at: number): void {
  note(a, at, 987.77, 0.08, 0.06) // B5
  note(a, at + 0.08, 1318.51, 0.5, 0.05) // E6 尾音（指数衰减）
}

/**
 * 金币逐枚掉落的声音，配合结算屏的掉落动画节奏（每枚间隔 0.16s，
 * 与 P08Battle 里 animationDelay 的步长一致）。startDelay 给动画留出起跳时间。
 */
export function coinDrops(count: number, startDelay = 0.3): void {
  const a = ac()
  if (!a) return
  const n = Math.max(1, Math.min(count, 8))
  for (let i = 0; i < n; i++) dingAt(a, a.currentTime + startDelay + i * 0.16)
}
