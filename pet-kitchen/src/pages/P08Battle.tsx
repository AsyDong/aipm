import { useEffect, useMemo, useRef, useState } from 'react'
import { useStore } from '../store/useStore'
import { useNav } from '../store/nav'
import PetAvatar from '../components/PetAvatar'
import { AnswerBox, AnswerPad, ChoicePad } from '../components/AnswerPad'
import { toast } from '../components/ui'
import { MATH_LEVELS, LEVELS_BY_SUBJECT, levelById } from '../engine/questions'
import {
  BATTLE_LIMIT_MIN, QUESTIONS_PER_LEVEL, WRONG_INJECT, ATTR_LABEL, baseHp, hintCount, starsOf, FIRST_CLEAR_BONUS,
} from '../engine/rules'
import { nowDay } from '../engine/time'
import { advanceQueue, firstCorrectCount, PASS_DELAY } from '../engine/queue'
import { gradeAnswer, isThenable } from '../engine/provider'
import type { GradeResult } from '../engine/provider'
import { useGeneratedQuestions } from '../hooks/useGeneratedQuestions'
import { speak } from '../utils/speech'
import { coinDrops } from '../utils/sfx'
import Coin from '../components/Coin'
import { enqueueOp } from '../store/sync'
import type { Question } from '../types'

function Hearts({ n, total }: { n: number; total: number }) {
  return (
    <span className="text-[18px]">
      {Array.from({ length: total }, (_, i) => (
        <span key={i} className={i < n ? '' : 'opacity-25'}>❤️</span>
      ))}
    </span>
  )
}

/**
 * 规则：「写对为止」——答错或跳过都不公布答案，题目回到队尾稍后重做；
 * 队列清空（每道题都真正做对）才算做完，星级只按「第一次就答对」的题数算。
 */
export default function P08Battle({ levelId }: { levelId: string }) {
  const nav = useNav()
  const pet = useStore((s) => s.pet)
  const wrong = useStore((s) => s.wrong)
  const finishBattle = useStore((s) => s.finishBattle)
  const readAloud = useStore((s) => s.settings.readAloud)
  const sound = useStore((s) => s.settings.sound)

  const level = levelById(levelId) ?? MATH_LEVELS[0]
  const attr = pet?.attrs[level.subject] ?? 0
  const maxHp = baseHp(attr)

  /**
   * 需要穿插的错题。传 spec 而不是题面，是为了让服务端（将来）能按规则重建题目、
   * 也能从同一份 spec 派生举一反三变式。
   */
  const inject = useMemo(
    () =>
      wrong
        .filter((w) => w.subject === level.subject && !w.mastered && w.nextReviewDay <= nowDay())
        .slice(0, WRONG_INJECT)
        .map((w) => w.spec),
    [wrong, level.subject],
  )
  const injectKey = inject.map((s) => `${s.kind}:${s.a}${s.op}${s.b}${s.c ?? ''}`).join(',')

  // 出题走契约层：本地实现同步返回（不闪 loading），远端实现返回 Promise（显示「出题中」）
  const { questions, loading, degraded, error } = useGeneratedQuestions(
    { subject: level.subject, levelId: level.id, count: QUESTIONS_PER_LEVEL, inject, attr },
    `${level.id}|${injectKey}`,
  )

  const total = questions.length

  /** 待答队列：答对出队，答错/跳过回队尾，队列空 = 全部做对 */
  const [queue, setQueue] = useState<Question[]>(questions)

  // 远端出题返回后（或降级到本地后）同步刷新队列
  useEffect(() => {
    setQueue(questions)
  }, [questions])
  const [petHp, setPetHp] = useState(maxHp)
  const [hints, setHints] = useState(hintCount(attr))
  const [hinted, setHinted] = useState(false)
  const [input, setInput] = useState('')
  /** 曾答错/跳过的题（进错题本，且不再计入「第一次就答对」） */
  const [missed, setMissed] = useState<Question[]>([])
  /** 过场中（答错后的短暂停留），期间锁住输入 */
  const [passing, setPassing] = useState(false)
  const [result, setResult] = useState<{
    win: boolean; correct: number; total: number; points: number; stars: number; attr: number; firstClear: boolean
  } | null>(null)
  const [left, setLeft] = useState(BATTLE_LIMIT_MIN * 60)
  const [confirmQuit, setConfirmQuit] = useState(false)
  const settled = useRef(false)
  const tick = useRef<number | null>(null)

  const q = queue[0]
  const solved = total - queue.length
  /** 第一次就答对的题数 = 总数 − 曾做错的题数（做错的最终都会被重做到对） */
  const firstCorrect = firstCorrectCount(total, missed.length)
  const retryPending = queue.filter((x) => missed.some((m) => m.text === x.text)).length
  /** 回炉重做的题：自动给思路当脚手架，但仍不公布答案 */
  const isRetry = !!q && missed.some((m) => m.text === q.text)

  useEffect(() => {
    if (q) speak(q.speech, readAloud, q.speechLang)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q?.text])

  /** 换一道题就重置计时，用来记「这题实际想了多久」 */
  const qStart = useRef(Date.now())
  useEffect(() => {
    qStart.current = Date.now()
  }, [q?.text])

  /** 整关用时（快速通关 +1 星的判定依据） */
  const battleStart = useRef(Date.now())

  useEffect(() => {
    if (result) return
    const t = setInterval(() => setLeft((v) => Math.max(0, v - 1)), 1000)
    return () => clearInterval(t)
  }, [result])

  useEffect(() => {
    if (left === 0 && !result) finish(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [left])

  /** 结算音效：金币逐枚落袋的「叮」，节奏与下方掉落动画一致（0.16s/枚） */
  useEffect(() => {
    if (!result?.win || !sound) return
    coinDrops(result.firstClear ? result.stars + 1 : 1)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [result])

  // 说明：血量只表示「本关失误次数」，扣到 0 也不再判负——
  // 本关的完成标准是「每题都真正做对」，判负会和这个目标直接冲突。
  useEffect(() => () => {
    if (tick.current) window.clearTimeout(tick.current)
  }, [])

  const finish = (win: boolean) => {
    if (settled.current) return
    settled.current = true
    const durationMs = Date.now() - battleStart.current
    const stars = starsOf(firstCorrect, total, durationMs, level.subject)
    if (!win || stars === 0) {
      setResult({ win: false, correct: firstCorrect, total, points: 0, stars: 0, attr: 0, firstClear: false })
      return
    }
    const r = finishBattle(level.subject, level.id, firstCorrect, total, missed, durationMs)
    setResult({ win: true, correct: firstCorrect, total, ...r })
  }

  /**
   * 记一条答题流水。
   *
   * 这是服务端 attempts 表的唯一数据源 —— 每答一次记一条（只增不改），
   * 自适应出题、薄弱考点分析、模型批改都要靠它。
   * 「跳过」也记（input 为空、correct=false），因为「不会做」本身就是有信息量的信号。
   */
  const recordAttempt = (question: Question, answer: string | null, correct: boolean) => {
    enqueueOp('attempt', {
      day: nowDay(),
      subject: level.subject,
      levelId: level.id,
      questionText: question.text,
      input: answer,
      correct,
      // 此前没错过 = 这道题第一次作答
      firstTry: !missed.some((x) => x.text === question.text),
      durationMs: Math.max(0, Date.now() - qStart.current),
      // 点过提示，或这是回炉重做的题（回炉会自动给思路，等于用过脚手架）
      hintsUsed: hinted || isRetry ? 1 : 0,
    })
  }

  /** 答错 / 跳过：不公布答案，题目回队尾，扣 1 血 */
  const passToBack = (bySkip: boolean) => {
    if (!q || passing || result) return
    const cur = q
    setInput('')
    setHinted(false)
    setPassing(true)
    setMissed((m) => (m.some((x) => x.text === cur.text) ? m : [...m, cur]))
    setPetHp((h) => Math.max(0, h - 1))
    setQueue((qs) => advanceQueue(qs, false))
    toast(bySkip ? '先放一放，最后再回来做它' : '先记下，最后再回来做它')
    tick.current = window.setTimeout(() => setPassing(false), PASS_DELAY)
  }

  /** 判分结果落地。判不了（断网的开放题）也走回炉重做，断网不该算孩子错 */
  const settle = (g: GradeResult) => {
    if (!q) return
    if (!g.correct) {
      passToBack(false)
      return
    }
    // 答对：出队；队列清空即全部做对
    setHinted(false)
    if (queue.length === 1) {
      finish(true)
      return
    }
    setQueue((qs) => advanceQueue(qs, true))
  }

  const submit = () => {
    if (!q || passing || result || !input) return
    const cur = q
    const raw = input
    setInput('')
    const g = gradeAnswer(cur, raw)
    // 先记流水再结算：答对答错都要留下痕迹（记在结算之前，避免 passToBack 改动了 missed 影响 firstTry 判定）
    const handle = (res: GradeResult) => {
      recordAttempt(cur, raw, res.correct)
      settle(res)
    }
    // 数学题本地精确判定，同步返回；开放题（语文英语开放答案）才落到模型，异步返回
    if (isThenable(g)) g.then(handle)
    else handle(g)
  }

  /** 选择题（语文英语认读题）：点选项即作答 */
  const pickChoice = (choice: string) => {
    if (!q || passing || result) return
    const cur = q
    const g = gradeAnswer(cur, choice)
    const handle = (res: GradeResult) => {
      recordAttempt(cur, choice, res.correct)
      settle(res)
    }
    if (isThenable(g)) g.then(handle)
    else handle(g)
  }

  /** 跳过：记一条未作答的流水，再回队尾 */
  const skipQuestion = () => {
    if (!q || passing || result) return
    recordAttempt(q, null, false)
    passToBack(true)
  }

  const reset = () => {
    settled.current = false
    battleStart.current = Date.now()
    setQueue(questions)
    setPetHp(maxHp)
    setHints(hintCount(attr))
    setHinted(false)
    setInput('')
    setMissed([])
    setPassing(false)
    setResult(null)
    setLeft(BATTLE_LIMIT_MIN * 60)
  }

  if (result) {
    const nextLevel = LEVELS_BY_SUBJECT[level.subject].find((l) => l.index === level.index + 1)
    return (
      <div className="flex min-h-screen flex-col items-center px-6 pb-10 pt-14">
        <div className="animate-popin text-[54px]">{result.win ? '🎉' : '💪'}</div>
        <div className="mt-2 text-[26px] font-extrabold text-ink">
          {result.win ? '过 关 啦 ！' : '差 一 点 点 ！'}
        </div>
        {result.win && (
          <div className="mt-3">
            {/* 金币逐枚掉落：实心 = 本关获得的星数（首通额外 +1，见下方文案），空心 = 未拿到 */}
            <div className="flex items-end justify-center gap-1.5">
              {[1, 2, 3, 4].map((n) => (
                <span
                  key={n}
                  className={`inline-block ${result.stars >= n ? 'animate-coindrop' : 'opacity-20'}`}
                  style={result.stars >= n ? { animationDelay: `${(n - 1) * 0.16}s` } : undefined}
                >
                  <Coin size={36} />
                </span>
              ))}
            </div>
            <div
              className={`mt-1.5 text-center text-[13px] font-extrabold ${
                result.firstClear ? 'text-amber-500' : 'text-muted'
              }`}
            >
              {result.firstClear ? '首次通关，金币再 +1 枚！' : '重复闯关，金币固定 1 枚'}
            </div>
          </div>
        )}
        <div className="mt-3 text-center text-[15px] font-bold text-muted">
          第一次就答对 {result.correct} / {result.total} 题
        </div>
        <div className="mt-1 text-center text-[13px] text-muted">
          {missed.length > 0
            ? `${missed.length} 道是重做才做对的，都弄懂了 👍`
            : '全部一次做对，太厉害了！'}
        </div>

        {result.win && (
          <div className="mt-5 w-full max-w-[340px] rounded-xl3 bg-white p-4 shadow-card">
            <Row label="积分" value={`+${result.points}`} tone="point" />
            <Row label={ATTR_LABEL[level.subject]} value={`+${result.attr}`} tone="attr" />
            {missed.length > 0 ? (
              <button
                className="flex w-full items-center justify-between border-b border-sky-50 py-2 last:border-0"
                onClick={() => nav.replace('wrong', level.subject)}
              >
                <span className="text-[14px] font-bold text-muted">新错题</span>
                <span className="text-[16px] font-extrabold text-sky-600">
                  {missed.length} 道 → 去巩固
                </span>
              </button>
            ) : (
              <Row label="新错题" value="0 道，全对啦！" tone="muted" />
            )}
            {result.firstClear && <div className="mt-2 text-center text-[13px] font-extrabold text-amber-500">首通奖励：金币 +{FIRST_CLEAR_BONUS} 枚</div>}
          </div>
        )}

        {!result.win && (
          <div className="mt-5 w-full max-w-[340px] rounded-xl3 bg-white p-4 text-center text-[13px] leading-relaxed text-muted shadow-card">
            {solved === total
              ? '题目都做完了，只是第一次对的还不够多。再来一遍会顺很多～'
              : '题目还有没做完的。慢一点，看清算式再写答案。'}
          </div>
        )}

        <div className="mt-6 flex w-full max-w-[340px] gap-3">
          <button className="btn-sub" onClick={reset}>再 来 一 次</button>
          <button
            className="btn-main"
            disabled={!result.win || !nextLevel}
            onClick={() => nextLevel && nav.go('play', nextLevel.id)}
          >
            下 一 关
          </button>
        </div>
        <button className="mt-4 text-[14px] font-bold text-muted" onClick={() => nav.back()}>返回关卡地图</button>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3">
        <div className="text-[40px]">✏️</div>
        <div className="text-[15px] font-bold text-muted">
          {error ? '出题失败了，返回再试一次' : '正在出题…'}
        </div>
      </div>
    )
  }

  if (!q || !pet) return null

  const mm = Math.floor(left / 60)
  const ss = left % 60

  return (
    <div className="flex min-h-screen flex-col px-4 pb-6 pt-3">
      <div className="flex items-center justify-between">
        <button className="text-[14px] font-bold text-muted" onClick={() => setConfirmQuit(true)}>← 退出</button>
        <div className="text-[16px] font-extrabold text-ink">
          {level.boss ? level.name : `第${level.index}关 · ${level.name}`}
        </div>
        <div className={`text-[14px] font-extrabold ${left < 120 ? 'text-danger' : 'text-muted'}`}>
          {mm}:{String(ss).padStart(2, '0')}
        </div>
      </div>

      {degraded && (
        <div className="mt-2 rounded-xl bg-warn/10 px-3 py-2 text-center text-[12px] font-bold text-warn">
          连不上服务器，已用本地题目
        </div>
      )}

      <div className="mt-3 flex items-center justify-between rounded-2xl bg-white px-3 py-2 shadow-card">
        <div className="flex items-center gap-2">
          <PetAvatar species={pet.species} stage={pet.stage} size={40} />
          <div>
            <div className="text-[13px] font-extrabold text-ink">{pet.nickname}</div>
            <Hearts n={petHp} total={maxHp} />
          </div>
        </div>
        <div className="text-right">
          <div className="text-[13px] font-extrabold text-ink">Boss</div>
          <Hearts n={queue.length} total={total} />
        </div>
      </div>

      <div className="mt-2 flex items-center justify-between text-[13px] font-bold text-muted">
        <span>已答对 {solved} / {total}</span>
        <span>
          {retryPending > 0 && <span className="text-warn">待重做 {retryPending} 道</span>}
          {retryPending > 0 && missed.length > 0 && <span className="mx-1 text-slate-300">·</span>}
          {missed.length > 0 && <span>失误 {missed.length} 次</span>}
        </span>
      </div>

      {petHp === 0 && (
        <div className="mt-2 rounded-xl bg-warn/10 px-3 py-2 text-center text-[13px] font-bold text-warn">
          失误有点多啦，不着急，慢慢算清楚再写
        </div>
      )}

      <div className={`mt-3 flex items-center justify-center gap-2 rounded-xl3 bg-white py-5 shadow-card ${passing ? 'opacity-40' : ''}`}>
        <button className="text-[22px]" onClick={() => speak(q.speech, true)}>🔊</button>
        <div className={`font-extrabold text-ink ${q.text.length > 14 ? "text-[24px] leading-snug" : "text-[42px]"}`}>{q.text}</div>
      </div>

      <div className="mt-3 flex gap-3">
        <button
          className="btn-chip"
          disabled={hints <= 0 || hinted || isRetry || passing}
          onClick={() => {
            setHints((h) => h - 1)
            setHinted(true)
            toast('已显示解题思路')
          }}
        >
          💡 提示 ({hints})
        </button>
        <button className="btn-chip" disabled={passing} onClick={skipQuestion}>
          ⏭ 跳过
        </button>
      </div>

      {(hinted || isRetry) && (
        <div className="mt-3 rounded-xl bg-sky-50 px-3 py-2.5 text-[14px] font-bold leading-relaxed text-sky-700">
          {isRetry ? `🔁 这道刚才没做出来，看个思路：${q.hint}` : `💡 ${q.hint}`}
        </div>
      )}

      {passing && (
        <div className="mt-3 rounded-xl bg-warn/10 px-3 py-2.5 text-center text-[14px] font-bold text-warn">
          这道一会儿再回来做，先看下一题
        </div>
      )}

      {q.answerType === 'choice' && q.options ? (
        <div className={`mt-3 ${passing ? 'pointer-events-none opacity-40' : ''}`}>
          <ChoicePad options={q.options} onPick={pickChoice} disabled={passing} />
        </div>
      ) : (
        <>
          <div className={`mt-3 ${passing ? 'pointer-events-none opacity-40' : ''}`}>
            <AnswerBox value={input} />
          </div>

          <div className={`mt-3 ${passing ? 'pointer-events-none opacity-40' : ''}`}>
            <AnswerPad value={input} onChange={setInput} onSubmit={submit} disabled={passing} />
          </div>
        </>
      )}

      {confirmQuit && (
        <div className="fixed inset-0 z-[85] flex items-center justify-center bg-ink/45 px-6">
          <div className="w-full max-w-[340px] animate-popin rounded-xl3 bg-white p-5 shadow-pop">
            <div className="text-center text-[18px] font-extrabold text-ink">现在退出，这关要重来哦</div>
            <div className="mt-4 flex gap-3">
              <button className="btn-sub" onClick={() => setConfirmQuit(false)}>继续闯关</button>
              <button className="btn-main bg-danger" onClick={() => nav.back()}>退出</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function Row({ label, value, tone }: { label: string; value: string; tone: 'point' | 'attr' | 'muted' }) {
  const color = tone === 'point' ? 'text-amber-500' : tone === 'attr' ? 'text-sky-600' : 'text-muted'
  return (
    <div className="flex items-center justify-between border-b border-sky-50 py-2 last:border-0">
      <span className="text-[14px] font-bold text-muted">{label}</span>
      <span className={`text-[16px] font-extrabold ${color}`}>{value}</span>
    </div>
  )
}
