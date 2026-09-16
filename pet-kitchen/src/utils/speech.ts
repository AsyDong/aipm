/** 题目朗读（1~2 年级识字量有限，线框 1.2 要求） */
export function speak(text: string, enabled = true): void {
  if (!enabled) return
  try {
    const synth = window.speechSynthesis
    if (!synth) return
    synth.cancel()
    const u = new SpeechSynthesisUtterance(text)
    u.lang = 'zh-CN'
    u.rate = 0.85
    synth.speak(u)
  } catch {
    /* 浏览器不支持时静默降级 */
  }
}
