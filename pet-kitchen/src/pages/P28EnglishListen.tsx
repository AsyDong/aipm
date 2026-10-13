// ============ P28 英语 · 听音选词 ============
//
// 英语版块新增的玩法（对齐拼音的「听力挑战」）：
// 播放英文发音 → 从 4 个英文单词里选出正确的那一个。
// 素材取自课本跟读库（src/data/readtext.ts 的单词级条目），发音用浏览器英文嗓音。

import { useEffect, useRef, useState } from 'react'
import { useNav } from '../store/nav'
import { useStore } from '../store/useStore'
import { CoinBar } from '../components/ui'
import { READ_UNITS } from '../data/readtext'
import { shuffle } from '../utils/id'
import { speak } from '../utils/speech'

interface EnQ {
  en: string
  cn: string
  options: string[]
}

const ALL_WORDS = READ_UNITS.flatMap((u) => u.words)
const PER_ROUND = 8
const POINTS_PER_CORRECT = 2

function genRound(): EnQ[] {
  const picked = shuffle(ALL_WORDS).slice(0, PER_ROUND)
  return picked.map((it) => {
    const others = shuffle(ALL_WORDS.filter((x) => x.en !== it.en && x.cn !== it.cn)).slice(0, 3)
    return { en: it.en, cn: it.cn, options: shuffle([it.en, ...others.map((o) => o.en)]) }
  })
}

export default function P28EnglishListen() {
  const nav = useNav()
  const earnPoints = useStore((s) => s.earnPoints)
  const food = useStore((s) => s.food)
  const points = useStore((s) => s.points)

  const [qs, setQs] = useState<EnQ[]>(() => genRound())
  const [idx, setIdx] = useState(0)
  const [picked, setPicked] = useState('')
  const [locked, setLocked] = useState(false)
  const [correct, setCorrect] = useState(0)
  const [done, setDone] = useState(false)
  const startedAt = useRef(Date.now())

  const q = qs[idx]
  const total = qs.length

  // 换题自动播放英文发音
  useEffect(() => {
    if (done || !q) return
    const t = window.setTimeout(() => speak(q.en, true, 'en-US'), 220)
    return () => window.clearTimeout(t)
  }, [idx, done, q])

  const play = () => q && speak(q.en, true, 'en-US')

  const choose = (opt: string) => {
    if (locked || !q) return
    setLocked(true)
    setPicked(opt)
    if (opt === q.en) {
      setCorrect((c) => c + 1)
      earnPoints(POINTS_PER_CORRECT, '英语 · 听音选词')
    }
  }

  const next = () => {
    if (idx < total - 1) {
      setIdx(idx + 1)
      setPicked('')
      setLocked(false)
      return
    }
    setDone(true)
  }

  const restart = () => {
    setQs(genRound())
    setIdx(0)
    setPicked('')
    setLocked(false)
    setCorrect(0)
    setDone(false)
    startedAt.current = Date.now()
  }

  const header = (
    <>
      <CoinBar food={food} points={points} />
      <div className="mx-4 mt-1 flex items-center gap-2">
        <button onClick={() => nav.back()} className="rounded-2xl bg-white px-3 py-2 text-[14px] font-extrabold text-muted active:scale-[0.98]">← 返回</button>
        <div className="flex-1 rounded-2xl bg-emerald-50 px-3 py-2 ring-1 ring-emerald-100">
          <div className="text-[15px] font-extrabold text-ink">🎧 听音选词</div>
          <div className="text-[12px] font-bold text-muted">听英文发音，选出正确的单词</div>
        </div>
        <div className="rounded-2xl bg-white px-3 py-2 text-[13px] font-extrabold text-muted">{done ? `${correct}/${total}` : `${idx + 1}/${total}`}</div>
      </div>
    </>
  )

  if (done || !q) {
    const rate = total ? correct / total : 0
    const face = rate >= 0.9 ? '🏆' : rate >= 0.6 ? '😄' : rate >= 0.3 ? '🙂' : '💪'
    return (
      <div className="pb-6">
        {header}
        <div className="mx-4 mt-3 rounded-xl3 bg-white p-6 text-center shadow-card">
          <div className="text-[56px]">{face}</div>
          <div className="mt-2 text-[24px] font-extrabold text-ink">答对 {correct} / {total}</div>
          <div className="mt-2 rounded-2xl bg-emerald-50 px-3 py-2.5 text-[13px] font-bold text-emerald-700">
            获得积分 +{correct * POINTS_PER_CORRECT}
          </div>
          <div className="mt-5 flex gap-3">
            <button className="btn-main" onClick={restart}>🔄 再来一轮</button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="pb-6">
      {header}

      {/* 播放区 */}
      <div className="mx-4 mt-3 flex min-h-[170px] flex-col items-center justify-center rounded-xl3 bg-white px-4 py-6 shadow-card">
        <button onClick={play} className="text-[62px] leading-none active:scale-95">🔊</button>
        <div className="mt-3 text-[14px] font-bold text-muted">点喇叭再听一遍</div>
      </div>

      {/* 选项 */}
      <div className="mx-4 mt-3 grid grid-cols-2 gap-3">
        {q.options.map((opt) => {
          const isRight = locked && opt === q.en
          const isWrong = locked && opt === picked && opt !== q.en
          return (
            <button
              key={opt}
              disabled={locked}
              onClick={() => choose(opt)}
              className={`flex min-h-[64px] items-center justify-center rounded-xl3 px-3 text-[20px] font-extrabold shadow-card transition active:scale-[0.97] ${
                isRight ? 'bg-emerald-400 text-white' : isWrong ? 'bg-rose-300 text-white' : 'bg-white text-ink'
              }`}
            >
              {opt}
            </button>
          )
        })}
      </div>

      {locked && (
        <div className="mx-4 mt-3">
          <div className={`rounded-2xl px-4 py-3 text-center text-[15px] font-extrabold ${picked === q.en ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'}`}>
            {picked === q.en ? <>✅ 太棒了！+{POINTS_PER_CORRECT} 积分</> : <>❌ 正确答案是 <span className="text-[19px]">{q.en}</span></>}
            <div className="mt-0.5 text-[13px] font-bold text-muted">{q.cn}</div>
          </div>
          <button className="btn-main mt-3" onClick={next}>{idx === total - 1 ? '🎉 看结果' : '下一题 ▶'}</button>
        </div>
      )}
    </div>
  )
}
