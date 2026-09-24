import { useEffect, useMemo, useRef, useState } from 'react'
import { useStore } from '../store/useStore'
import { useNav } from '../store/nav'
import PetAvatar from '../components/PetAvatar'
import { AnswerBox, AnswerPad, ChoicePad } from '../components/AnswerPad'
import { toast } from '../components/ui'
import { BOSS_META, MATH_LEVELS, LEVELS_BY_SUBJECT, levelById, specKey } from '../engine/questions'

import {
  BATTLE_LIMIT_MIN, QUESTIONS_PER_LEVEL, WRONG_INJECT, ATTR_LABEL, baseHp, hintCount, FIRST_CLEAR_BONUS,
  BOSS_MAX_HP, BOSS_SHIELD_AT, BOSS_RAGE_AT, BOSS_RAGE_SECONDS, STREAK_WRONG_MERCY, bossDamage,
} from '../engine/rules'
import { nowDay } from '../engine/time'
import { advanceQueue, firstCorrectCount, PASS_DELAY } from '../engine/queue'
import { gradeAnswer, isThenable } from '../engine/provider'
import type { GradeResult } from '../engine/provider'
import { useGeneratedQuestions } from '../hooks/useGeneratedQuestions'
import { EN_UNITS, EN_ZH, enUnitOf, FC_BY_NO, fcImgSrc, wordImgSrc } from '../data/courses'
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
  const isBoss = !!level.boss
  const boss = isBoss ? BOSS_META[level.id] : undefined

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
  // gen 计入 key：「再来一次」时重新生成题目（设计建议 §4.5 防背题）
  const [gen, setGen] = useState(0)
  const { questions, loading, degraded, error } = useGeneratedQuestions(
    { subject: level.subject, levelId: level.id, count: QUESTIONS_PER_LEVEL, inject, attr },
    `${level.id}|${injectKey}|${gen}`,
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
    /** Boss 战失败时 Boss 的剩余血量百分比，用于「下次就能赢」进度文案 */
    bossLeft?: number
    /** 当日 Boss 首胜加成（积分 ×1.5），结算页展示 */
    dailyBossWin?: boolean
  } | null>(null)

  // —— Boss 对战演出状态（设计建议 v0.1 §4，普通关不用）——
  const [bossHp, setBossHp] = useState(BOSS_MAX_HP)
  /** 破盾阶段：护盾立起，下一次答对 = 双倍伤害打碎 */
  const [shield, setShield] = useState(false)
  /** Boss 头顶伤害数字 */
  const [float, setFloat] = useState<{ id: number; text: string } | null>(null)
  /** 受击特效：boss = Boss 被打 / pet = 宠物被打 */
  const [hitFx, setHitFx] = useState<{ id: number; on: 'boss' | 'pet' } | null>(null)
  const [consecWrong, setConsecWrong] = useState(0)
  /** 连错保护：下一题自动附带提示（本场只送一次） */
  const [mercy, setMercy] = useState(false)
  const [mercyUsed, setMercyUsed] = useState(false)
  /** 本场实际作答数（含答错的），失败结算的练习量口径；ref 供结算回调读最新值 */
  const answeredRef = useRef(0)
  /** 狂暴阶段每题倒计时（秒），null = 未在狂暴 */
  const [rageLeft, setRageLeft] = useState<number | null>(null)
  const fxId = useRef(0)
  const rage = isBoss && bossHp > 0 && bossHp <= BOSS_MAX_HP * BOSS_RAGE_AT

  /** 战斗特写：受击方抖动 + 伤害数字。id 匹配才清场，旧定时器不会误伤新特效 */
  const showFx = (on: 'boss' | 'pet', text?: string) => {
    const id = ++fxId.current
    setHitFx({ id, on })
    if (text) setFloat({ id, text })
    window.setTimeout(() => {
      setHitFx((f) => (f?.id === id ? null : f))
      if (text) setFloat((f) => (f?.id === id ? null : f))
    }, 700)
  }

  /** 每答一次就 +1（对错都算） */
  const bumpAnswered = () => {
    answeredRef.current += 1
  }
  const [left, setLeft] = useState(BATTLE_LIMIT_MIN * 60)
  const [confirmQuit, setConfirmQuit] = useState(false)
  const settled = useRef(false)
  const tick = useRef<number | null>(null)

  /** 英语词汇关：答题前先过一遍单词闪卡（图 + 音 + 义）；boss / 句型关没有 */
  const cardUnit = !level.boss && level.subject === 'english' ? enUnitOf(level.kinds) : undefined
  const flashcards = cardUnit ? EN_UNITS[cardUnit].words : []
  const [phase, setPhase] = useState<'cards' | 'quiz'>(cardUnit ? 'cards' : 'quiz')
  const [card, setCard] = useState(0)
  const startQuiz = () => {
    setPhase('quiz')
    // 计时和快通星都从答题才开始算，翻卡片不算闯关用时
    battleStart.current = Date.now()
  }

  const q = queue[0]
  const solved = total - queue.length
  /** 第一次就答对的题数 = 总数 − 曾做错的题数（做错的最终都会被重做到对） */
  const firstCorrect = firstCorrectCount(total, missed.length)
  const retryPending = queue.filter((x) => missed.some((m) => specKey(m.spec) === specKey(x.spec))).length
  /** 回炉重做的题：自动给思路当脚手架，但仍不公布答案 */
  const isRetry = !!q && missed.some((m) => specKey(m.spec) === specKey(q.spec))

  // fc_pic 的 text 恒定，换题判定得用 spec（不然连着两道看图题不重读）
  const qKey = q ? `${q.spec.kind}:${q.spec.a}` : ''
  useEffect(() => {
    if (q && phase === 'quiz') speak(q.speech, readAloud, q.speechLang)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [qKey, phase])

  useEffect(() => {
    const w = flashcards[card]
    if (phase === 'cards' && w) speak(w.en, readAloud, 'en-US')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, card])

  /** 换一道题就重置计时，用来记「这题实际想了多久」 */
  const qStart = useRef(Date.now())
  useEffect(() => {
    qStart.current = Date.now()
  }, [qKey])

  /** 整关用时（快速通关 +1 星的判定依据） */
  const battleStart = useRef(Date.now())

  useEffect(() => {
    if (result || phase !== 'quiz') return
    const t = setInterval(() => setLeft((v) => Math.max(0, v - 1)), 1000)
    return () => clearInterval(t)
  }, [result, phase])

  useEffect(() => {
    if (left === 0 && !result) finish(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [left])

  /** 狂暴阶段（Boss 血量 ≤25%）：每题倒计时，换题重置；过场/结算时暂停 */
  useEffect(() => {
    if (!rage || result || phase !== 'quiz' || !q || passing) {
      setRageLeft(null)
      return
    }
    setRageLeft(BOSS_RAGE_SECONDS)
    const t = setInterval(() => setRageLeft((v) => Math.max(0, (v ?? BOSS_RAGE_SECONDS) - 1)), 1000)
    return () => clearInterval(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rage, result, phase, qKey, passing])

  useEffect(() => {
    // 归零视为答错：Boss 反击、宠物扣血、题目回队尾（只惩罚走神，不惩罚思考慢）
    if (rageLeft === 0 && q && !passing && !result) {
      recordAttempt(q, null, false)
      passToBack(false, '时间到！Boss 反击了')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rageLeft])

  /** 结算音效：金币逐枚落袋的「叮」，节奏与下方掉落动画一致（0.16s/枚） */
  useEffect(() => {
    if (!result?.win || !sound) return
    coinDrops(result.firstClear ? result.stars + 1 : 1)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [result])

  // 说明：普通关血量只表示「本关失误次数」，扣到 0 也不再判负——
  // 本关的完成标准是「每题都真正做对」，判负会和这个目标直接冲突。
  // Boss 关不同（设计建议 §4）：答错 = Boss 反击扣血，血量归零 = 温和失败
  // （不没收任何资产，重试无限制；P2 支柱「输了不心疼」）。
  useEffect(() => () => {
    if (tick.current) window.clearTimeout(tick.current)
  }, [])

  const finish = (win: boolean) => {
    if (settled.current) return
    settled.current = true
    const durationMs = Date.now() - battleStart.current
    // 超时没做完：不结算（题都没做完，不写通关也不发奖）。
    // Boss 战落败走 opts.failed 路径：错题与练习量照记，积分/星级/属性一律不发。
    if (!win) {
      if (isBoss) {
        const bTotal = Math.max(1, answeredRef.current)
        const bCorrect = Math.max(0, answeredRef.current - missed.length)
        finishBattle(level.subject, level.id, bCorrect, bTotal, missed, durationMs, { failed: true })
        setResult({
          win: false, correct: bCorrect, total: bTotal, points: 0, stars: 0, attr: 0, firstClear: false,
          bossLeft: Math.ceil((bossHp / BOSS_MAX_HP) * 100),
        })
      } else {
        setResult({ win: false, correct: firstCorrect, total, points: 0, stars: 0, attr: 0, firstClear: false })
      }
      return
    }
    // 做完了就交给 store 统一结算：0 星也记错题进错题本，只是 0 分 0 星（r.stars===0 → 负局界面）
    const r = finishBattle(level.subject, level.id, firstCorrect, total, missed, durationMs)
    setResult({ win: r.stars > 0, correct: firstCorrect, total, ...r })
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
      firstTry: !missed.some((x) => specKey(x.spec) === specKey(question.spec)),
      durationMs: Math.max(0, Date.now() - qStart.current),
      // 点过提示，或这是回炉重做的题（回炉会自动给思路，等于用过脚手架），或连错保护送的提示
      hintsUsed: hinted || isRetry || mercy ? 1 : 0,
    })
  }

  /** 答错 / 跳过：不公布答案，题目回队尾，扣 1 血（Boss 战时 Boss 同时反击） */
  const passToBack = (bySkip: boolean, msg?: string) => {
    if (!q || passing || result) return
    const cur = q
    setInput('')
    setHinted(false)
    setPassing(true)
    setMissed((m) => (m.some((x) => specKey(x.spec) === specKey(cur.spec)) ? m : [...m, cur]))
    const nextHp = Math.max(0, petHp - 1)
    setPetHp(nextHp)
    bumpAnswered()
    // 连错保护（设计建议 §4.5）：同场连错 2 题 → 下一题自动附带提示，本场只送一次
    let tip = msg ?? (bySkip ? '先放一放，最后再回来做它' : '先记下，最后再回来做它')
    const nWrong = consecWrong + 1
    setConsecWrong(nWrong)
    if (nWrong >= STREAK_WRONG_MERCY && !mercyUsed) {
      setMercy(true)
      setMercyUsed(true)
      tip = '🐾 别灰心！下一题自动送你一个提示'
    } else if (mercy) {
      setMercy(false)
    }
    if (isBoss) {
      showFx('pet')
      if (nextHp === 0) {
        finish(false) // 宠物打累了：温和失败，零损失
        return
      }
    }
    setQueue((qs) => advanceQueue(qs, false))
    toast(tip)
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
    setConsecWrong(0)
    if (mercy) setMercy(false)
    bumpAnswered()
    if (isBoss) {
      // 宠物反击！答对一次 = 一拳，破盾期双倍伤害（设计建议 §4.3）
      const dmg = bossDamage(attr) * (shield ? 2 : 1)
      const nextBossHp = Math.max(0, bossHp - dmg)
      setBossHp(nextBossHp)
      showFx('boss', `${shield ? '💥 双倍 ' : ''}−${dmg}`)
      if (shield) {
        setShield(false)
        toast('🛡 护盾被打碎了！')
      }
      if (nextBossHp <= 0) {
        finish(true) // Boss 倒下，剩余题目不用做了
        return
      }
      // 阶段推进：跨线那一刻提示一次（破盾 → 狂暴）
      if (nextBossHp <= BOSS_MAX_HP * BOSS_SHIELD_AT && bossHp > BOSS_MAX_HP * BOSS_SHIELD_AT) {
        setShield(true)
        toast('Boss 举起了护盾！答对一题就能打碎它！')
      } else if (nextBossHp <= BOSS_MAX_HP * BOSS_RAGE_AT && bossHp > BOSS_MAX_HP * BOSS_RAGE_AT) {
        toast('Boss 狂暴了！要在 10 秒内作答！')
      }
    }
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
    setGen((g) => g + 1) // 重新出题（Boss 重开防背题，设计建议 §4.5）
    setQueue(questions)
    setPetHp(maxHp)
    setHints(hintCount(attr))
    setHinted(false)
    setInput('')
    setMissed([])
    setPassing(false)
    setResult(null)
    setLeft(BATTLE_LIMIT_MIN * 60)
    // Boss 战场复位
    setBossHp(BOSS_MAX_HP)
    setShield(false)
    setConsecWrong(0)
    setMercy(false)
    setMercyUsed(false)
    answeredRef.current = 0
    setRageLeft(null)
    setFloat(null)
    setHitFx(null)
  }

  const quitDialog = confirmQuit && (
    <div className="fixed inset-0 z-[85] flex items-center justify-center bg-ink/45 px-6">
      <div className="w-full max-w-[340px] animate-popin rounded-xl3 bg-white p-5 shadow-pop">
        <div className="text-center text-[18px] font-extrabold text-ink">现在退出，这关要重来哦</div>
        <div className="mt-4 flex gap-3">
          <button className="btn-sub" onClick={() => setConfirmQuit(false)}>继续闯关</button>
          <button className="btn-main bg-danger" onClick={() => nav.back()}>退出</button>
        </div>
      </div>
    </div>
  )

  if (result) {
    const nextLevel = LEVELS_BY_SUBJECT[level.subject].find((l) => l.index === level.index + 1)
    return (
      <div className="flex min-h-screen flex-col items-center px-6 pb-10 pt-14">
        <div className="animate-popin text-[54px]">{result.win ? '🎉' : '💪'}</div>
        <div className="mt-2 text-[26px] font-extrabold text-ink">
          {result.win ? (level.boss && boss ? `打 败 ${boss.name} 啦！` : '过 关 啦 ！') : level.boss ? '打 得 好 累 ！' : '差 一 点 点 ！'}
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
            {result.dailyBossWin && <div className="mt-1 text-center text-[13px] font-extrabold text-amber-500">今日 Boss 首胜：积分 ×1.5！</div>}
          </div>
        )}

        {!result.win && (
          level.boss && result.bossLeft != null ? (
            // Boss 战失败：把失败重构为进度（设计建议 §4.5 —— 显示已造成的伤害）
            <div className="mt-5 w-full max-w-[340px] rounded-xl3 bg-white p-4 text-center shadow-card">
              <div className="text-[15px] font-extrabold text-ink">{pet?.nickname} 打累了，回家吃点东西再战！</div>
              <div className="mt-1 text-[13px] font-bold text-muted">
                {boss?.name ?? 'Boss'} 还剩 {result.bossLeft}% 血，下次就能赢！
              </div>
              <div className="mt-1 text-[13px] font-bold text-muted">
                第一次就答对 {result.correct} / {result.total} 题
              </div>
            </div>
          ) : (
            <div className="mt-5 w-full max-w-[340px] rounded-xl3 bg-white p-4 text-center text-[13px] leading-relaxed text-muted shadow-card">
              {solved === total
                ? '题目都做完了，只是第一次对的还不够多。再来一遍会顺很多～'
                : '题目还有没做完的。慢一点，看清算式再写答案。'}
            </div>
          )
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

  if (cardUnit && phase === 'cards') {
    const w = flashcards[Math.min(card, flashcards.length - 1)]
    const last = card >= flashcards.length - 1
    return (
      <div className="flex min-h-screen flex-col px-6 pb-8 pt-3">
        <div className="flex items-center justify-between">
          <button className="text-[14px] font-bold text-muted" onClick={() => setConfirmQuit(true)}>← 退出</button>
          <div className="text-[16px] font-extrabold text-ink">{level.name} · 单词卡</div>
          <div className="text-[14px] font-extrabold text-muted">{Math.min(card + 1, flashcards.length)} / {flashcards.length}</div>
        </div>

        <div className="flex flex-1 flex-col items-center justify-center py-4">
          <button
            className="flex w-full max-w-[300px] flex-col items-center gap-3 rounded-xl3 bg-white px-6 py-8 shadow-card active:scale-[0.98]"
            onClick={() => speak(w.en, true, 'en-US')}
          >
            <WordImg word={w.en} className="h-[140px] w-[140px] object-contain" />
            <div className="text-[34px] font-extrabold tracking-wide text-sky-600">{w.en}</div>
            <div className="text-[15px] font-bold text-muted">{w.zh}</div>
            <div className="text-[13px] font-bold text-sky-400">🔊 点卡片再听一遍</div>
          </button>
        </div>

        <div className="mx-auto flex w-full max-w-[340px] gap-3">
          {!last && <button className="btn-sub flex-1" onClick={() => setCard((c) => c + 1)}>下一个 →</button>}
          <button className="btn-main flex-1" onClick={startQuiz}>{last ? '开始答题！' : '跳过，直接答题'}</button>
        </div>
        {quitDialog}
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

      {isBoss && boss ? (
        // Boss 战：回合制演出（设计建议 §4.1）—— 答对宠物反击、Boss 掉血；答错 Boss 反击、宠物掉血
        <div className="mt-3 rounded-2xl bg-white px-3 py-2.5 shadow-card">
          <div className="flex items-center gap-3">
            <span
              key={hitFx?.on === 'boss' ? hitFx.id : 'boss'}
              className={`text-[38px] leading-none ${hitFx?.on === 'boss' ? 'animate-jump' : ''}`}
            >
              {boss.emoji}
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between">
                <span className="text-[14px] font-extrabold text-ink">{boss.name}</span>
                <span className={`text-[12px] font-extrabold ${rage ? 'text-danger' : 'text-sky-500'}`}>
                  {rage ? `🔥 狂暴 ⏱ ${rageLeft ?? 0}s` : shield ? '🛡 护盾' : ''}
                </span>
              </div>
              <div className="mt-1 h-2.5 overflow-hidden rounded-full bg-slate-200">
                <div
                  className={`h-full rounded-full transition-all duration-300 ${rage ? 'bg-danger' : shield ? 'bg-sky-400' : 'bg-amber-400'}`}
                  style={{ width: `${(bossHp / BOSS_MAX_HP) * 100}%` }}
                />
              </div>
            </div>
            <div className="relative w-9 text-right text-[12px] font-extrabold text-muted">
              {Math.ceil((bossHp / BOSS_MAX_HP) * 100)}%
              {float && (
                <span
                  key={float.id}
                  className="absolute -top-4 right-0 animate-coindrop whitespace-nowrap text-[15px] font-extrabold text-danger"
                >
                  {float.text}
                </span>
              )}
            </div>
          </div>
          <div className="mt-2 flex items-center justify-between border-t border-sky-50 pt-1.5">
            <div className="flex items-center gap-2">
              <PetAvatar species={pet.species} stage={pet.stage} size={34} mood={hitFx?.on === 'pet' ? 'sad' : 'idle'} />
              <div>
                <div className="text-[12px] font-extrabold text-ink">{pet.nickname}</div>
                <Hearts n={petHp} total={maxHp} />
              </div>
            </div>
            <div className="text-[11px] font-bold text-muted">答对一题，打 Boss 一拳！</div>
          </div>
        </div>
      ) : (
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
      )}

      <div className="mt-2 flex items-center justify-between text-[13px] font-bold text-muted">
        <span>已答对 {solved} / {total}</span>
        <span>
          {retryPending > 0 && <span className="text-warn">待重做 {retryPending} 道</span>}
          {retryPending > 0 && missed.length > 0 && <span className="mx-1 text-slate-300">·</span>}
          {missed.length > 0 && <span>失误 {missed.length} 次</span>}
        </span>
      </div>

      {petHp === 0 && !isBoss && (
        <div className="mt-2 rounded-xl bg-warn/10 px-3 py-2 text-center text-[13px] font-bold text-warn">
          失误有点多啦，不着急，慢慢算清楚再写
        </div>
      )}

      <div className={`mt-3 flex items-center justify-center gap-2 rounded-xl3 bg-white py-5 shadow-card ${passing ? 'opacity-40' : ''}`}>
        <button className="text-[22px]" onClick={() => speak(q.speech, true)}>🔊</button>
        <div className={`font-extrabold text-ink ${q.promptImg ? 'text-[20px]' : q.text.length > 14 ? 'text-[24px] leading-snug' : 'text-[42px]'}`}>
          {q.promptImg && <WordImg word={q.promptImg} className="mx-auto mb-2 block h-[130px] w-[130px] object-contain" />}
          {q.text}
        </div>
      </div>

      <div className="mt-3 flex gap-3">
        <button
          className="btn-chip"
          disabled={hints <= 0 || hinted || isRetry || mercy || passing}
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

      {(hinted || isRetry || mercy) && (
        <div className="mt-3 rounded-xl bg-sky-50 px-3 py-2.5 text-[14px] font-bold leading-relaxed text-sky-700">
          {isRetry
            ? `🔁 这道刚才没做出来，看个思路：${q.hint}`
            : mercy && !hinted
              ? `🐾 ${pet.nickname} 给你打气，送你一个思路：${q.hint}`
              : `💡 ${q.hint}`}
        </div>
      )}

      {passing && (
        <div className="mt-3 rounded-xl bg-warn/10 px-3 py-2.5 text-center text-[14px] font-bold text-warn">
          这道一会儿再回来做，先看下一题
        </div>
      )}

      {q.answerType === 'choice' && q.options ? (
        <div className={`mt-3 ${passing ? 'pointer-events-none opacity-40' : ''}`}>
          <ChoicePad
            options={q.options}
            picOptions={q.pictureOptions ? q.options.map((w) => ({ word: w, src: wordImgSrc(w), zh: EN_ZH[w] ?? w })) : undefined}
            onPick={pickChoice}
            disabled={passing}
          />
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

      {quitDialog}
    </div>
  )
}

/** 单词配图：纯数字 = 闪卡卡号（public/img/fc/），否则按单词找 en/ 图；挂了退回中文文字，题仍可作答 */
function WordImg({ word, className }: { word: string; className?: string }) {
  const [err, setErr] = useState(false)
  // 换词重置加载失败标记：否则一张图挂了，后面所有卡都退化成文字
  useEffect(() => setErr(false), [word])
  const zh = EN_ZH[word] ?? FC_BY_NO.get(Number(word))?.zh ?? word
  if (err) return <span className="text-[34px] font-extrabold text-ink">{zh}</span>
  return <img src={/^\d+$/.test(word) ? fcImgSrc(word) : wordImgSrc(word)} alt={word} className={className} onError={() => setErr(true)} />
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
