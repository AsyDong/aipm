import { useEffect, useRef, useState } from 'react'
import { useStore } from '../store/useStore'
import { useNav } from '../store/nav'
import { AnswerBox, AnswerPad } from '../components/AnswerPad'
import { Empty, toast } from '../components/ui'
import { buildQuestion } from '../engine/questions'
import { advanceQueue, firstCorrectCount, PASS_DELAY } from '../engine/queue'
import { generateVariants, gradeAnswer, isThenable } from '../engine/provider'
import type { GradeResult } from '../engine/provider'
import { MASTER_STREAK } from '../engine/rules'
import { nowDay, diffDays } from '../engine/time'
import { speak } from '../utils/speech'
import type { Question } from '../types'

/** 3 题小练习（练一练 / 举一反三），无奖励，纯复习 */
function MiniQuiz({ qs, onDone }: { qs: Question[]; onDone: (correct: number) => void }) {
  const readAloud = useStore((s) => s.settings.readAloud)
  /** 待答队列：答错回队尾，直到每道题都做对 */
  const [queue, setQueue] = useState<Question[]>(qs)
  const [input, setInput] = useState('')
  const [missed, setMissed] = useState<Question[]>([])
  const [passing, setPassing] = useState(false)
  const tick = useRef<number | null>(null)

  const total = qs.length
  const firstCorrect = firstCorrectCount(total, missed.length)
  const q = queue[0]
  const isRetry = !!q && missed.some((m) => m.text === q.text)

  useEffect(() => () => {
    if (tick.current) window.clearTimeout(tick.current)
  }, [])

  if (!q) {
    return (
      <div className="p-6 text-center">
        <div className="text-[40px]">🎈</div>
        <div className="mt-2 text-[18px] font-extrabold text-ink">
          第一次就答对 {firstCorrect} / {total}
        </div>
        <div className="mt-1 text-[13px] text-muted">
          {missed.length > 0 ? `${missed.length} 道是重做才做对的，最后都弄懂了 👍` : '全部一次做对，厉害！'}
        </div>
        {missed.length > 0 && (
          <div className="mt-4 text-left">
            {missed.map((m) => (
              <div key={m.text} className="mt-2 rounded-xl bg-sky-50 px-3 py-2.5">
                <div className="text-[15px] font-extrabold text-ink">
                  {m.text.replace('?', String(m.answer))}
                </div>
                <div className="mt-0.5 text-[12px] leading-relaxed text-muted">{m.explain}</div>
              </div>
            ))}
          </div>
        )}
        <button
          className="btn-main mt-5"
          onClick={() => {
            onDone(firstCorrect)
            toast(`第一次答对 ${firstCorrect} / ${total}`)
          }}
        >
          完 成
        </button>
      </div>
    )
  }

  /** 答错：不公布答案，题目回队尾 */
  const pass = () => {
    const cur = q
    setInput('')
    setPassing(true)
    setMissed((m) => (m.some((x) => x.text === cur.text) ? m : [...m, cur]))
    setQueue((qs2) => advanceQueue(qs2, false))
    speak('再想想，一会儿再回来', readAloud)
    tick.current = window.setTimeout(() => setPassing(false), PASS_DELAY)
  }

  return (
    <div className="p-5">
      <div className="flex items-center justify-between text-[13px] font-bold text-muted">
        <span>已答对 {total - queue.length} / {total}</span>
        {missed.length > 0 && <span className="text-warn">待重做 {missed.length} 道</span>}
      </div>
      <div className={`mt-3 flex items-center justify-center gap-2 rounded-xl3 bg-white py-7 shadow-card ${passing ? 'opacity-40' : ''}`}>
        <button className="text-[20px]" onClick={() => speak(q.speech, true)}>🔊</button>
        <div className="text-[36px] font-extrabold text-ink">{q.text}</div>
      </div>

      {(isRetry || passing) && (
        <div className={`mt-3 rounded-xl px-3 py-2.5 text-[13px] font-bold leading-relaxed ${passing ? 'bg-warn/10 text-warn' : 'bg-sky-50 text-sky-700'}`}>
          {passing ? '这道一会儿再回来做，先看下一题' : `🔁 再试一次，看个思路：${q.hint}`}
        </div>
      )}

      <div className={`mt-3 ${passing ? 'pointer-events-none opacity-40' : ''}`}>
        <AnswerBox value={input} size="md" />
      </div>
      <div className={`mt-3 ${passing ? 'pointer-events-none opacity-40' : ''}`}>
        <AnswerPad
          value={input}
          onChange={setInput}
          compact
          disabled={passing}
          onSubmit={() => {
            if (!input) return
            const g = gradeAnswer(q, input)
            const done = (r: GradeResult) => {
              if (r.correct) {
                setInput('')
                setQueue((qs2) => advanceQueue(qs2, true))
                return
              }
              pass()
            }
            if (isThenable(g)) g.then(done)
            else done(g)
          }}
        />
      </div>
    </div>
  )
}

/** P10 错题集：今天要复习 / 已掌握；每道错题 3 道举一反三变式 */
export default function P10WrongBook({ subject = 'math' }: { subject?: 'math' | 'chinese' | 'english' }) {
  const nav = useNav()
  const wrong = useStore((s) => s.wrong)
  const reviewWrong = useStore((s) => s.reviewWrong)
  const [quiz, setQuiz] = useState<{ qs: Question[]; wrongId: string; mode: 'practice' | 'variant' } | null>(null)

  const today = nowDay()
  const due = wrong.filter((w) => w.subject === subject && !w.mastered && w.nextReviewDay <= today)
  const pending = wrong.filter((w) => w.subject === subject && !w.mastered && w.nextReviewDay > today)
  const mastered = wrong.filter((w) => w.subject === subject && w.mastered)

  const itemOf = (id: string) => wrong.find((w) => w.id === id)

  const startPractice = (id: string) => {
    const w = itemOf(id)
    if (!w) return
    const seed = buildQuestion(w.spec)
    // 变式走契约层：本地同步返回；将来服务端可据这道错题生成针对性变式
    const apply = (qs: Question[]) =>
      setQuiz({ qs: [seed, ...qs].slice(0, 3), wrongId: id, mode: 'practice' })
    const r = generateVariants(seed, 2)
    if (isThenable(r)) r.then((res) => apply(res.questions))
    else apply(r.questions)
  }

  if (quiz) {
    return (
      <div className="px-2 pt-4">
        <button className="mb-2 text-[14px] font-bold text-muted" onClick={() => setQuiz(null)}>← 返回</button>
        <MiniQuiz
          qs={quiz.qs}
          onDone={(firstCorrect) => {
            const total = quiz.qs.length
            if (quiz.mode === 'practice') {
              // 只有「第一次就全做对」才算这次复习通过（重做才对的说明还没真正掌握）
              reviewWrong(quiz.wrongId, firstCorrect === total)
            }
            setQuiz(null)
          }}
        />
      </div>
    )
  }

  return (
    <div className="px-4 pb-8 pt-4">
      <div className="flex items-center gap-3">
        <button className="text-[15px] font-bold text-muted" onClick={() => nav.back()}>← 返回</button>
        <div className="flex-1 text-center text-[18px] font-extrabold text-ink">错题集</div>
        <div className="w-[60px] text-right text-[13px] font-bold text-sky-600">数学 ({wrong.filter((w) => w.subject === subject).length})</div>
      </div>

      <div className="mt-3 flex gap-3">
        <div className="flex-1 rounded-2xl bg-warn/15 px-3 py-2 text-center">
          <div className="text-[12px] font-bold text-warn">今天要复习</div>
          <div className="text-[20px] font-extrabold text-warn">{due.length}</div>
        </div>
        <div className="flex-1 rounded-2xl bg-ok/15 px-3 py-2 text-center">
          <div className="text-[12px] font-bold text-ok">已掌握</div>
          <div className="text-[20px] font-extrabold text-ok">{mastered.length}</div>
        </div>
      </div>

      {due.length === 0 && pending.length === 0 && mastered.length === 0 && (
        <Empty emoji="🌟" text="太棒了，一道错题都没有！" />
      )}

      {due.length === 0 && pending.length > 0 && (
        <div className="mt-4 rounded-xl bg-warn/10 px-3 py-2.5 text-[13px] font-bold text-warn">
          {pending.length} 道错题正在排队，{diffDays(today, pending[0].nextReviewDay)} 天后回来复习
        </div>
      )}

      {due.map((w) => (
        <div key={w.id} className="card mt-3">
          <div className="flex items-start justify-between">
            <div>
              <div className="text-[20px] font-extrabold text-ink">{w.text.replace('?', String(w.answer))}</div>
              <div className="mt-0.5 text-[12px] text-muted">知识点：{w.skill} · 错 {w.wrongCount} 次</div>
            </div>
            <div className="text-[12px] font-bold text-warn">
              {w.rightStreak}/{MASTER_STREAK}
            </div>
          </div>
          <div className="mt-1 text-[13px] leading-relaxed text-muted">{w.explain}</div>
          <div className="mt-3 flex gap-2">
            <button className="btn-chip flex-1" onClick={() => startPractice(w.id)}>练 一 练</button>
            <button
              className="btn-chip flex-1"
              onClick={() => {
                const seed = buildQuestion(w.spec)
                const apply = (qs: Question[]) =>
                  setQuiz({ qs, wrongId: w.id, mode: 'variant' })
                const r = generateVariants(seed, 3)
                if (isThenable(r)) r.then((res) => apply(res.questions))
                else apply(r.questions)
              }}
            >
              举一反三 (3)
            </button>
          </div>
        </div>
      ))}

      {pending.length > 0 && (
        <>
          <div className="mt-5 text-[14px] font-extrabold text-muted">排队中（还没到复习日）</div>
          {pending.slice(0, 20).map((w) => (
            <div key={w.id} className="mt-2 flex items-center justify-between rounded-xl bg-white px-3 py-2.5 shadow-card">
              <div>
                <div className="text-[15px] font-bold text-ink">{w.text.replace('?', String(w.answer))}</div>
                <div className="text-[12px] text-muted">
                  {w.nextReviewDay} 复习 · 错 {w.wrongCount} 次
                </div>
              </div>
              <button className="btn-chip" onClick={() => startPractice(w.id)}>提前练</button>
            </div>
          ))}
        </>
      )}

      {mastered.length > 0 && (
        <>
          <div className="mt-5 text-[14px] font-extrabold text-ok">已掌握（连续答对 3 次）</div>
          {mastered.slice(0, 20).map((w) => (
            <div key={w.id} className="mt-2 flex items-center justify-between rounded-xl bg-white px-3 py-2.5 shadow-card">
              <span className="text-[15px] font-bold text-muted">{w.text.replace('?', String(w.answer))}</span>
              <span className="text-[16px]">✅</span>
            </div>
          ))}
        </>
      )}

      <div className="mt-4 rounded-xl bg-sky-50 px-3 py-2 text-[12px] leading-relaxed text-muted">
        还没掌握的错题，会自动出现在下次同类关卡里哦（每关最多 2 道）。
      </div>
    </div>
  )
}
