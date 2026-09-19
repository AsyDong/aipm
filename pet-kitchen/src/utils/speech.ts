/** 朗读（1~2 年级识字量有限，线框 1.2 要求）；英语题传 'en-US' 用英文嗓音 */
export function speak(text: string, enabled = true, lang: 'zh-CN' | 'en-US' = 'zh-CN'): void {
  if (!enabled) return
  try {
    const synth = window.speechSynthesis
    if (!synth) return
    synth.cancel()
    const u = new SpeechSynthesisUtterance(text)
    u.lang = lang
    u.rate = lang === 'en-US' ? 0.8 : 0.85
    synth.speak(u)
  } catch {
    /* 浏览器不支持时静默降级 */
  }
}
