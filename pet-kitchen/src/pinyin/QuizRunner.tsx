// ============ 拼音通用答题组件（React 版 QuizRunner） ============
//
// 移植自 pinyin-world/src/components/QuizRunner.vue，视觉改为 pet-kitchen 风格。
// 听力 / 识字 / 拼装 / 关卡 / 单元测试 / 综合挑战 全部共用这一个组件。
//
// 结算分三种（由 props 决定）：
//   levelId          → 关卡：走主应用 finishBattle（星级 + 积分 + 错题 + 语文力）
//   unit             → 单元测试：分数写拼音本地 testScores
//   pointsPerCorrect → 练习小游戏：每答对一题加主应用积分

import { useEffect, useRef, useState } from 'react'
import type { Question } from './quiz'
import { speak, speakParts } from './audio'
import { finishPinyinBattle, notePinyinPractice } from './bridge'
import { useStore, type BattleResult } from '../store/useStore'
import { useNav } from '../store/nav'
import { usePinyin } from './store'

export type Tone = 'sky' | 'emerald' | 'amber' | 'violet' | 'rose'

const TONES: Record<Tone, { chip: string; solid: string; soft: string; text: string }> = {
  sky: { chip: 'bg-sky-50 text-sky-700 ring-sky-100', solid: 'bg-sky-400', soft: 'bg-sky-50', text: 'text-sky-600' },
  emerald: { chip: 'bg-emerald-50 text-emerald-700 ring-emerald-100', solid: 'bg-emerald-400', soft: 'bg-emerald-50', text: 'text-emerald-600' },
  amber: { chip: 'bg-amber-50 text-amber-700 ring-amber-100', solid: 'bg-amber-400', soft: 'bg-amber-50', text: 'text-amber-600' },
  violet: { chip: 'bg-violet-50 text-violet-700 ring-violet-100', solid: 'bg-violet-400', soft: 'bg-violet-50', text: 'text-violet-600' },
  rose: { chip: 'bg-rose-50 text-rose-700 ring-rose-100', solid: 'bg-rose-400', soft: 'bg-rose-50', text: 'text-rose-600' },
}

export interface QuizRunnerProps {
  title: string
  sub?: string
  /** 出题函数：组件挂载与「再玩一次」时各调一次 */
  gen: () => Question[]
  /** 关卡 id（走主应用结算，写星级/积分/错题） */
  levelId?: string
  /** 单元测试编号（分数写拼音本地 testScores） */
  unit?: number
  /** 练习模式：每答对一题加的主应用积分 */
  pointsPerCorrect?: number
  tone?: Tone
  onDone?: (correct: number, total: number) => void
  /** 结果页的「继续」按钮（综合挑战接续跟读用） */
  onNext?: () => void
  nextLabel?: string
}

const starsOfResult = (correct: number, total: number) =>
  correct >= total ? 3 : correct >= Math.ceil(total * 0.75) ? 2 : correct >= Math.ceil(total * 0.5) ? 1 : 0

export default function QuizRunner({
  title, sub, gen, levelId, unit, pointsPerCorrect = 0, tone = 'sky', onDone, onNext, nextLabel = '继续 ▶',
}: QuizRunnerProps) {
  const nav = useNav()
  const earnPoints = useStore((s) => s.earnPoints)
  const setTestScore = usePinyin((s) => s.setTestScore)
  const t = TONES[tone]

  const [qs, setQs] = useState<Question[]>(() => gen())
  const [idx, setIdx] = useState(0)
  const [phase, setPhase] = useState<'q' | 'done'>('q')
  const [picked, setPicked] = useState('')
  const [locked, setLocked] = useState(false)
  const [correct, setCorrect] = useState(0)
  const [combo, setCombo] = useState(0)
  const [bestCombo, setBestCombo] = useState(0)
  const [wrongs, setWrongs] = useState<Question[]>([])
  const [battle, setBattle] = useState<BattleResult | null>(null)
  const [earned, setEarned] = useState(0)
  const startedAt = useRef(Date.now())

  const q = qs[idx]
  const total = qs.length

  // 换题自动朗读（听音 / 看字题）
  useEffect(() => {
    if (phase !== 'q' || !q) return
    const id = window.setTimeout(() => {
      if (q.kind === 'listen' || q.kind === 'char') speak(q.audioZh)
    }, 150)
    return () => window.clearTimeout(id)
  }, [idx, phase, q])

  const replay = () => {
    if (!q) return
    if (q.kind === 'blend') {
      speakParts(q.q.split(' + ').map((s) => s.trim()))
      return
    }
    speak(q.audioZh)
  }

  const choose = (opt: string) => {
    if (locked || !q) return
    setLocked(true)
    setPicked(opt)
    // 答一题 = 练了一个音（对错都算练过），家长报告据此统计今日拼音练习量（FE-09）
    notePinyinPractice(1)
    if (opt === q.answer) {
      setCorrect((c) => c + 1)
      setCombo((c) => {
        const n = c + 1
        setBestCombo((b) => Math.max(b, n))
        return n
      })
      if (pointsPerCorrect) {
        earnPoints(pointsPerCorrect, `拼音练习 · ${title}`)
        setEarned((e) => e + pointsPerCorrect)
      }
    } else {
      setCombo(0)
      setWrongs((w) => (w.some((x) => x.q === q.q && x.answer === q.answer) ? w : [...w, q]))
    }
  }

  const finish = (finalCorrect: number) => {
    setPhase('done')
    if (levelId) setBattle(finishPinyinBattle(levelId, finalCorrect, total, wrongs, Date.now() - startedAt.current))
    if (unit != null) setTestScore(unit, finalCorrect * 10)
    onDone?.(finalCorrect, total)
  }

  const next = () => {
    if (idx < total - 1) {
      setIdx(idx + 1)
      setPicked('')
      setLocked(false)
      return
    }
    finish(correct)
  }

  const restart = () => {
    setQs(gen())
    setIdx(0)
    setPhase('q')
    setPicked('')
    setLocked(false)
    setCorrect(0)
    setCombo(0)
    setBestCombo(0)
    setWrongs([])
    setBattle(null)
    setEarned(0)
    startedAt.current = Date.now()
  }

  const face = total === 0 ? '💪' : correct / total >= 0.9 ? '🏆' : correct / total >= 0.6 ? '😄' : correct / total >= 0.3 ? '🙂' : '💪'
  // 关卡结算以主应用 starsOf 为准（限时通关有第 4 星），练习/单元测试没有星级概念
  const stars = levelId && battle ? battle.stars : starsOfResult(correct, total)

  // ---------- 结果页 ----------
  if (phase === 'done' || !q) {
    return (
      <div className="px-4 pb-8 pt-2">
        <div className="flex items-center gap-2">
          <button onClick={() => nav.back()} className="rounded-2xl bg-white px-3 py-2 text-[14px] font-extrabold text-muted active:scale-[0.98]">← 返回</button>
          <div className={`flex-1 rounded-2xl px-3 py-2 ring-1 ${t.chip}`}>
            <div className="text-[15px] font-extrabold">{title}</div>
          </div>
        </div>

        <div className="mt-3 rounded-xl3 bg-white p-6 text-center shadow-card">
          <div className="text-[56px]">{face}</div>
          {levelId ? (
            <div className="mt-2 text-[28px]">
              {/* 星槽与主应用口径一致：最高 4 星（限时通关额外 +1 星） */}
              {[1, 2, 3, 4].map((n) => (
                <span key={n} className={stars >= n ? 'text-amber-400' : 'text-slate-200'}>★</span>
              ))}
            </div>
          ) : unit != null ? (
            <div className="mt-2 text-[26px] font-extrabold text-ink">得分 {correct * 10} / 100</div>
          ) : (
            <div className="mt-2 text-[24px] font-extrabold text-ink">答对 {correct} / {total}</div>
          )}
          {levelId && <div className="mt-1 text-[14px] font-bold text-muted">答对 {correct} / {total}</div>}
          {bestCombo >= 2 && <div className="mt-1 text-[14px] font-bold text-amber-500">🔥 最佳连击 x{bestCombo}</div>}

          {(battle || earned > 0) && (
            <div className="mt-3 rounded-2xl bg-sky-50 px-3 py-2.5 text-[13px] font-bold text-sky-700">
              {battle ? `获得积分 +${battle.points}${battle.attr ? ` · 语文力 +${battle.attr}` : ''}` : `获得积分 +${earned}`}
              {wrongs.length > 0 && ` · ${wrongs.length} 道错题已进错题本`}
            </div>
          )}

          {wrongs.length > 0 && (
            <div className="mt-3 text-left">
              {wrongs.map((w, i) => (
                <div key={i} className="mt-2 rounded-xl bg-rose-50 px-3 py-2">
                  <div className="text-[14px] font-extrabold text-ink">
                    {w.kind === 'listen' ? '🔊 ' : w.kind === 'char' ? '' : '🧩 '}
                    {w.kind === 'listen' ? w.audioZh : w.q}
                  </div>
                  <div className="mt-0.5 text-[13px] text-muted">正确答案：{w.answer}</div>
                </div>
              ))}
            </div>
          )}

          <div className="mt-5 flex gap-3">
            {onNext && (
              <button className="btn-main" onClick={onNext}>{nextLabel}</button>
            )}
            <button className="btn-sub" onClick={restart}>🔄 再玩一次</button>
          </div>
        </div>
      </div>
    )
  }

  // ---------- 答题页 ----------
  return (
    <div className="px-4 pb-8 pt-2">
      <div className="flex items-center gap-2">
        <button onClick={() => nav.back()} className="rounded-2xl bg-white px-3 py-2 text-[14px] font-extrabold text-muted active:scale-[0.98]">← 返回</button>
        <div className={`flex-1 rounded-2xl px-3 py-2 ring-1 ${t.chip}`}>
          <div className="text-[15px] font-extrabold">{title}</div>
          {sub && <div className="text-[12px] font-bold opacity-75">{sub}</div>}
        </div>
        <div className="rounded-2xl bg-white px-3 py-2 text-[13px] font-extrabold text-muted">
          {idx + 1}/{total}
          {combo >= 2 && <span className="ml-1 text-amber-500">🔥{combo}</span>}
        </div>
      </div>

      {/* 进度点：已答 / 当前 / 未答 */}
      <div className="mt-3 flex flex-wrap gap-1.5">
        {qs.map((_, i) => (
          <span
            key={i}
            className={`h-2.5 flex-1 rounded-full ${i < idx ? 'bg-emerald-300' : i === idx ? t.solid : 'bg-slate-100'}`}
          />
        ))}
      </div>

      {/* 题目卡 */}
      <div className="mt-3 flex min-h-[180px] flex-col items-center justify-center rounded-xl3 bg-white px-4 py-6 shadow-card">
        {q.kind === 'listen' ? (
          <>
            <button onClick={replay} className="text-[64px] leading-none active:scale-95">🔊</button>
            <div className="mt-3 text-[14px] font-bold text-muted">听一听，选出正确的拼音</div>
          </>
        ) : q.kind === 'char' ? (
          <>
            <div className="text-[72px] font-extrabold leading-none text-ink">{q.q}</div>
            <button onClick={replay} className="mt-3 rounded-full bg-sky-100 px-4 py-1.5 text-[14px] font-bold text-sky-700 active:scale-95">🔊 再听一遍</button>
          </>
        ) : (
          <>
            <div className="flex items-center gap-3 text-[44px] font-extrabold text-ink">
              <span className="rounded-2xl bg-violet-50 px-4 py-1 text-violet-700">{q.q.split(' + ')[0]}</span>
              <span className="text-muted">+</span>
              <span className="rounded-2xl bg-violet-50 px-4 py-1 text-violet-700">{q.q.split(' + ')[1]}</span>
            </div>
            <div className="mt-3 text-[14px] font-bold text-muted">拼一拼，选出正确的音节</div>
            <button onClick={replay} className="mt-2 rounded-full bg-sky-100 px-4 py-1.5 text-[14px] font-bold text-sky-700 active:scale-95">🔊 听一听</button>
          </>
        )}
      </div>

      {/* 选项 */}
      <div className="mt-3 grid grid-cols-2 gap-3">
        {q.options.map((opt) => {
          const isRight = locked && opt === q.answer
          const isWrong = locked && opt === picked && opt !== q.answer
          return (
            <button
              key={opt}
              disabled={locked}
              onClick={() => choose(opt)}
              className={`flex min-h-[64px] items-center justify-center rounded-xl3 px-3 text-[26px] font-extrabold shadow-card transition active:scale-[0.97] ${
                isRight ? 'bg-emerald-400 text-white' : isWrong ? 'bg-rose-300 text-white' : 'bg-white text-ink'
              }`}
            >
              {opt}
            </button>
          )
        })}
      </div>

      {/* 判题反馈 */}
      {locked && (
        <div className="mt-3">
          <div className={`rounded-2xl px-4 py-3 text-center text-[15px] font-extrabold ${picked === q.answer ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'}`}>
            {picked === q.answer ? (
              <>✅ 太棒了！{pointsPerCorrect > 0 && <span className="ml-1">+{pointsPerCorrect} 积分</span>}</>
            ) : (
              <>❌ 正确答案是 <span className="text-[19px]">{q.answer}</span>
                <button onClick={() => speak(q.audioZh)} className="ml-2 rounded-full bg-white px-2.5 py-0.5 text-[14px] active:scale-95">🔊</button>
              </>
            )}
          </div>
          <button className="btn-main mt-3" onClick={next}>{idx === total - 1 ? '🎉 看结果' : '下一题 ▶'}</button>
        </div>
      )}
    </div>
  )
}
