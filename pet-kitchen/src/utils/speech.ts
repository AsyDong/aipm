import { speakSmart } from './tts'

/** 录音前掐掉正在播的范本：iOS 上边放边录会让音频会话打架（录不上或录成全静音） */
export { stopSpeak } from './tts'

/** 朗读（1~2 年级识字量有限，线框 1.2 要求）；英语题传 'en-US' 用英文嗓音。
 *  内部：edge-tts（全端统一嗓音 + 缓存）→ 失败退回设备 TTS，见 utils/tts.ts */
export function speak(text: string, enabled = true, lang: 'zh-CN' | 'en-US' = 'zh-CN'): void {
  if (!enabled || !text) return
  void speakSmart(text, lang, lang === 'en-US' ? 0.8 : 0.85)
}
