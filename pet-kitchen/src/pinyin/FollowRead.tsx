// ============ 拼音跟读擂台（React 版 FollowRead） ============
// 移植自 pinyin-world/src/views/FollowRead.vue：
// 语音识别（ASR）给星级 + 录音回放。素材按「已学范围」过滤。

import { useMemo, useRef, useState } from 'react'
import { useNav } from '../store/nav'
import { usePinyin } from './store'
import { ALL_SOUNDS, CHAR_BANK, FOLLOW_BANK, PW_LEVELS } from './data'
import { asrSupported, recSupported, Recorder, recognizeOnce, speak, ttsSupported } from './audio'
import { isPinyinLearned, stripTone } from './quiz'
import { learnedLettersByDay, PLAN_DAYS } from './plan'
import { toast } from '../components/ui'
import { notePinyinPractice } from './bridge'

/** 汉字 → 拼音 查找表（同音判分用） */
const PY_MAP: Record<string, string> = {}
for (const s of [...CHAR_BANK, ...FOLLOW_BANK, ...ALL_SOUNDS]) if (!PY_MAP[s.zh]) PY_MAP[s.zh] = s.py
for (const l of PW_LEVELS) for (const w of l.words) if (!PY_MAP[w.zh]) PY_MAP[w.zh] = w.py

export default function PinyinFollowRead() {
  const nav = useNav()
  const plan = usePinyin((s) => s.plan)
  const day = Math.min(Math.max(plan.startDay, 1), PLAN_DAYS)
  const learned = useMemo(() => learnedLettersByDay(day), [day])

  const bank = useMemo(() => {
    const uniq = new Map<string, { py: string; zh: string }>()
    for (const s of [...FOLLOW_BANK, ...CHAR_BANK]) if (!uniq.has(s.zh)) uniq.set(s.zh, { py: s.py, zh: s.zh })
    const local = [...uniq.values()].filter((s) => isPinyinLearned(s.py, learned))
    return local.length >= 3 ? local : [...uniq.values()]
  }, [learned])

  const [idx, setIdx] = useState(0)
  const [stars, setStars] = useState(0)
  const [msg, setMsg] = useState('')
  const [listening, setListening] = useState(false)
  const [recording, setRecording] = useState(false)
  const [recUrl, setRecUrl] = useState('')
  const recorder = useRef(new Recorder())

  const cur = bank[idx % bank.length]
  const playStd = () => speak(cur.zh)

  const follow = async () => {
    if (listening) return
    playStd()
    if (!asrSupported) { toast('当前浏览器不支持语音识别，试试 Chrome / Edge', 'warn'); return }
    setListening(true)
    setMsg('🎧 请跟读……')
    const text = await recognizeOnce()
    setListening(false)
    if (text == null) { setMsg('😅 没听清，再试一次'); setStars(0); return }
    // 真读了一次（不管准不准）就算练了一个音（FE-09）——「没听清」那次不算，免得空刷
    notePinyinPractice(1)
    if (text.includes(cur.zh)) {
      setStars(3)
      setMsg('🌟 读得非常准！')
      return
    }
    const sameTone = [...text].some((ch) => {
      const p = PY_MAP[ch]
      return p && stripTone(p) === stripTone(cur.py)
    })
    if (sameTone) { setStars(2); setMsg('👍 音读对了，声调再练练！') }
    else { setStars(1); setMsg('🤔 再听一遍标准音试试') }
  }

  const toggleRec = async () => {
    if (!recSupported) { toast('当前浏览器不支持录音，试试 Chrome / Edge', 'warn'); return }
    if (recording) {
      const url = await recorder.current.stop()
      setRecording(false)
      if (url) { setRecUrl(url); toast('已录好，点 ▶ 播放') }
    } else {
      try { await recorder.current.start(); setRecording(true) } catch { toast('无法使用麦克风，请检查权限', 'warn') }
    }
  }

  const next = () => {
    setIdx((i) => (i + 1) % bank.length)
    setMsg('')
    setStars(0)
    setRecUrl('')
  }

  return (
    <div className="px-4 pb-8 pt-2">
      <div className="flex items-center gap-2">
        <button onClick={() => nav.back()} className="rounded-2xl bg-white px-3 py-2 text-[14px] font-extrabold text-muted active:scale-[0.98]">← 返回</button>
        <div className="flex-1 rounded-2xl bg-amber-50 px-3 py-2 ring-1 ring-amber-100">
          <div className="text-[15px] font-extrabold text-ink">🎤 发音擂台</div>
          <div className="text-[12px] font-bold text-muted">第 {idx + 1} / {bank.length} 个 · 读得准星星多</div>
        </div>
      </div>

      <div className="mt-3 rounded-xl3 bg-white p-6 text-center shadow-card">
        <div className="text-[64px] font-extrabold leading-none text-ink">{cur.zh}</div>
        <div className="mt-1 text-[26px] font-extrabold text-sky-600">{cur.py}</div>
        <div className="mt-2 text-[30px]">
          {[1, 2, 3].map((n) => (
            <span key={n} className={stars >= n ? 'text-amber-400' : 'text-slate-200'}>★</span>
          ))}
        </div>

        <div className="mt-4 flex justify-center gap-3">
          <button onClick={playStd} className="btn-chip">🔊 标准音</button>
          <button onClick={follow} disabled={listening} className="flex min-h-[44px] items-center rounded-xl bg-amber-400 px-5 text-[16px] font-bold text-white shadow-card active:scale-95 disabled:opacity-60">
            {listening ? '🎧 正在听…' : '🎤 我来读'}
          </button>
        </div>
        <div className="mt-3 min-h-[22px] text-[14px] font-bold text-muted">{msg}</div>

        <div className="mt-1 flex justify-center gap-2">
          <button onClick={toggleRec} className="rounded-xl bg-slate-100 px-3.5 py-2 text-[13px] font-bold text-muted active:scale-95">
            {recording ? '⏹ 停止录音' : '🎙️ 录音'}
          </button>
          <button
            onClick={() => recUrl && new Audio(recUrl).play()}
            disabled={!recUrl}
            className="rounded-xl bg-slate-100 px-3.5 py-2 text-[13px] font-bold text-muted active:scale-95 disabled:opacity-50"
          >
            ▶️ 播放录音
          </button>
          <button onClick={next} className="rounded-xl bg-sky-100 px-3.5 py-2 text-[13px] font-bold text-sky-700 active:scale-95">下一个 ➡</button>
        </div>
      </div>

      <div className="mt-3 rounded-xl bg-white px-3 py-2.5 text-[12px] font-bold text-muted shadow-card">
        语音识别：{asrSupported ? '✅ 可用' : '⚠️ 不支持（仍可录音回放）'} ·
        录音：{recSupported ? '✅ 可用' : '⚠️ 不支持'} ·
        发音：{ttsSupported ? '✅ 可用' : '⚠️ 不支持'}
      </div>
    </div>
  )
}
