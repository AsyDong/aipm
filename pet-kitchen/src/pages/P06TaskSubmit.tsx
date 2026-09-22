import { useEffect, useMemo, useRef, useState } from 'react'
import { useNav } from '../store/nav'
import { toast } from '../components/ui'
import { compressImage, putMedia } from '../utils/media'
import { speak } from '../utils/speech'
import { uid } from '../utils/id'
import { useGeneratedQuestions } from '../hooks/useGeneratedQuestions'
import { gradeAnswer, isThenable, type GradeResult } from '../engine/provider'
import { advanceQueue, firstCorrectCount, PASS_DELAY } from '../engine/queue'
import { MATH_LEVELS, specKey } from '../engine/questions'
import { QUESTIONS_PER_LEVEL } from '../engine/rules'
import { EN_ZH, FC_UNITS, fcImgSrc, wordImgSrc } from '../data/courses'
import { enqueueOp } from '../store/sync'
import { FC_TPL_ID, useStore } from '../store/useStore'
import { nowDay } from '../engine/time'
import { AnswerBox, AnswerPad, ChoicePad } from '../components/AnswerPad'
import type { Question } from '../types'

const TYPE_HINT: Record<string, string> = {
  photo: '拍一张照片给爸爸妈妈看',
  audio: '录一段声音给爸爸妈妈听',
  subjective: '拍照或者录音都可以',
}

/** 口算类任务名（自动出题模式） */
const QUIZ_RE = /口算|计算/

/** P06 任务提交：拍照/录音自动通过，主观类待家长确认 */
export default function P06TaskSubmit({ taskId }: { taskId: string }) {
  const nav = useNav()
  const submitTask = useStore((s) => s.submitTask)
  const task = useStore((s) => s.daily.find((t) => t.id === taskId))

  const photoRef = useRef<HTMLInputElement>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [recording, setRecording] = useState(false)
  const [audioUrl, setAudioUrl] = useState<string | null>(null)
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null)
  const recRef = useRef<MediaRecorder | null>(null)
  const chunks = useRef<Blob[]>([])

  useEffect(() => {
    return () => {
      if (audioUrl) URL.revokeObjectURL(audioUrl)
    }
  }, [audioUrl])

  if (!task) {
    return (
      <div className="p-6 text-center text-muted">
        这个任务已经过期啦
        <button className="btn-chip mt-4" onClick={() => nav.back()}>返回</button>
      </div>
    )
  }

  // 口算类任务：不出照片/录音题，直接按数学力自动出题
  if (QUIZ_RE.test(task.name) && task.status !== 'pending' && task.status !== 'done') {
    return <KouSuanQuiz taskId={task.id} />
  }

  // 闪卡速记任务（按固定模板 id 识别，不拿任务名猜 —— 家长建的同名拍照任务不该被劫持）
  if (task.templateId === FC_TPL_ID && task.status !== 'pending' && task.status !== 'done') {
    return <FlashCardQuiz taskId={task.id} />
  }

  const showPhoto = task.type === 'photo' || task.type === 'subjective'
  const showAudio = task.type === 'audio' || task.type === 'subjective'

  const handlePhoto = async (file: File) => {
    try {
      const blob = await compressImage(file)
      setPreview(URL.createObjectURL(blob))
      const id = uid('m')
      await putMedia(id, blob)
      submitTask(task.id, id)
      toast(task.type === 'subjective' ? '提交啦，等爸爸妈妈确认' : '完成啦！食物 +' + task.foodValue)
      if (task.type !== 'subjective') nav.back()
    } catch {
      toast('没传上去，再试一次', 'warn')
    }
  }

  const startRec = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const rec = new MediaRecorder(stream)
      recRef.current = rec
      chunks.current = []
      rec.ondataavailable = (e) => chunks.current.push(e.data)
      rec.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop())
        const blob = new Blob(chunks.current, { type: 'audio/webm' })
        setAudioBlob(blob)
        setAudioUrl(URL.createObjectURL(blob))
        setRecording(false)
      }
      rec.start()
      setRecording(true)
      setTimeout(() => rec.state === 'recording' && rec.stop(), 60000)
    } catch {
      toast('请允许使用麦克风哦', 'warn')
    }
  }

  const stopRec = () => recRef.current?.stop()

  const submitAudio = async () => {
    if (!audioBlob) return
    const id = uid('m')
    await putMedia(id, audioBlob)
    submitTask(task.id, id)
    toast(task.type === 'subjective' ? '提交啦，等爸爸妈妈确认' : '完成啦！食物 +' + task.foodValue)
    if (task.type !== 'subjective') nav.back()
  }

  return (
    <div className="px-5 pb-10 pt-4">
      <div className="flex items-center gap-3">
        <button className="text-[15px] font-bold text-muted" onClick={() => nav.back()}>← 返回</button>
        <div className="flex-1 text-center text-[18px] font-extrabold text-ink">{task.name}</div>
        <div className="rounded-full bg-food/15 px-2 py-1 text-[12px] font-extrabold text-food">🍖+{task.foodValue}</div>
      </div>

      <p className="mt-4 text-center text-[14px] text-muted">{TYPE_HINT[task.type]}</p>

      {/* 爸爸妈妈的说明：大字展示 + 朗读按钮（点按钮是明确意图，不受全局朗读开关限制） */}
      {task.note && (
        <div className="mt-3 rounded-xl3 bg-sky-50 px-4 py-3">
          <div className="flex items-start gap-2">
            <p className="flex-1 text-[15px] font-extrabold leading-relaxed text-sky-700">{task.note}</p>
            <button
              className="shrink-0 rounded-full bg-white px-2.5 py-1.5 text-[18px] shadow-card active:scale-95"
              aria-label="朗读说明"
              onClick={() => speak(task.note!, true)}
            >
              🔊
            </button>
          </div>
          <div className="mt-1 text-right text-[11px] font-bold text-sky-500">爸爸妈妈的说明</div>
        </div>
      )}

      {preview && (
        <img src={preview} alt="佐证" className="mt-4 w-full rounded-xl3 object-cover shadow-card" />
      )}

      {audioUrl && (
        <div className="mt-4 rounded-xl3 bg-white p-4 shadow-card">
          <audio src={audioUrl} controls className="w-full" />
          <button className="btn-main mt-3" onClick={submitAudio}>用这段录音</button>
          <button className="mt-2 w-full text-center text-[13px] font-bold text-muted" onClick={() => { setAudioUrl(null); setAudioBlob(null) }}>
            重新录
          </button>
        </div>
      )}

      {!preview && !audioUrl && (
        <div className="mt-6 flex gap-3">
          {showPhoto && (
            <button className="btn-main" onClick={() => photoRef.current?.click()}>
              📷 拍 照
            </button>
          )}
          {showAudio && (
            <button className={showPhoto ? 'btn-sub' : 'btn-main'} onClick={recording ? stopRec : startRec}>
              {recording ? '⏹ 停止录音' : '🎤 录 音'}
            </button>
          )}
        </div>
      )}

      {recording && <div className="mt-4 text-center text-[14px] font-bold text-danger">● 录音中…最多 60 秒</div>}

      {task.status === 'pending' && (
        <div className="mt-6 rounded-xl3 bg-warn/15 px-4 py-3 text-center text-[15px] font-bold text-warn">
          ⏳ 等待爸爸妈妈看一下
        </div>
      )}

      {task.rejectReason && (
        <div className="mt-4 rounded-xl3 bg-danger/10 px-4 py-3 text-[14px] font-bold text-danger">
          爸爸妈妈说：{task.rejectReason}
        </div>
      )}

      <input
        ref={photoRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0]
          if (f) void handlePhoto(f)
        }}
      />
    </div>
  )
}

/** 口算练习：按宠物数学力选难度（达标的最深一关），写对为止，全部做完任务自动完成 */
function KouSuanQuiz({ taskId }: { taskId: string }) {
  const nav = useNav()
  const task = useStore((s) => s.daily.find((t) => t.id === taskId))
  const pet = useStore((s) => s.pet)
  const completeQuiz = useStore((s) => s.completeQuiz)
  const attr = pet?.attrs.math ?? 0
  // ponytail: 题量从任务名里抠（「口算 20 题」→ 20），没写数字就 20；要正经配置再做成模板字段
  const count = Number(task?.name.match(/(\d+)\s*题/)?.[1]) || 20
  const level = useMemo(() => {
    const plain = MATH_LEVELS.filter((l) => !l.boss)
    return plain.filter((l) => attr >= l.unlockAttr).slice(-1)[0] ?? plain[0]
  }, [attr])

  const { questions, loading, error } = useGeneratedQuestions(
    { subject: 'math', levelId: level.id, count, inject: [], attr },
    `quiz|${level.id}|${count}`,
  )

  /** 待答队列：答对出队，答错回队尾（与闯关同款「写对为止」） */
  const [queue, setQueue] = useState<Question[]>([])
  const [missed, setMissed] = useState<string[]>([])
  const [input, setInput] = useState('')
  const [passing, setPassing] = useState(false)
  const qStart = useRef(Date.now())
  const q = queue[0]
  const total = questions.length
  const solved = total - queue.length

  // 远端出题返回后同步刷新队列
  useEffect(() => {
    setQueue(questions)
  }, [questions])
  /** 换题重置计时，记「这题想了多久」 */
  useEffect(() => {
    qStart.current = Date.now()
  }, [q?.text])

  if (!task) return null

  if (loading || !q) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3">
        <div className="text-[40px]">✏️</div>
        <div className="text-[15px] font-bold text-muted">
          {error ? '出题失败了，返回再进一次' : '正在出题…'}
        </div>
        <button className="btn-chip" onClick={() => nav.back()}>返回</button>
      </div>
    )
  }

  const record = (question: Question, answer: string | null, correct: boolean) => {
    enqueueOp('attempt', {
      day: nowDay(),
      subject: 'math',
      levelId: level.id,
      questionText: question.text,
      input: answer,
      correct,
      firstTry: !missed.includes(question.text),
      durationMs: Math.max(0, Date.now() - qStart.current),
    })
  }

  const answerWith = (raw: string) => {
    if (!q || passing || !raw) return
    const g = gradeAnswer(q, raw)
    const handle = (res: GradeResult) => {
      record(q, raw, res.correct)
      if (!res.correct) {
        setInput('')
        setMissed((m) => (m.includes(q.text) ? m : [...m, q.text]))
        setPassing(true)
        setQueue((qs) => advanceQueue(qs, false))
        toast('先记下，等会儿再回来做它')
        setTimeout(() => setPassing(false), PASS_DELAY)
        return
      }
      setInput('')
      if (queue.length === 1) {
        completeQuiz(task.id)
        toast(`口算做完啦！食物 +${task.foodValue}`)
        nav.back()
        return
      }
      setQueue((qs) => advanceQueue(qs, true))
    }
    if (isThenable(g)) g.then(handle)
    else handle(g)
  }

  return (
    <div className="px-5 pb-10 pt-4">
      <div className="flex items-center gap-3">
        <button className="text-[15px] font-bold text-muted" onClick={() => nav.back()}>← 返回</button>
        <div className="flex-1 text-center text-[18px] font-extrabold text-ink">{task.name}</div>
        <div className="rounded-full bg-food/15 px-2 py-1 text-[12px] font-extrabold text-food">🍖+{task.foodValue}</div>
      </div>

      <p className="mt-3 text-center text-[13px] text-muted">
        按你的数学力（{attr}）出了 {total} 道题 · 全做对就完成
      </p>
      <div className="mt-1 text-center text-[13px] font-bold text-muted">
        已答对 {solved} / {total}
        {missed.length > 0 && <span className="text-warn"> · 待重做 {queue.filter((x) => missed.includes(x.text)).length} 道</span>}
      </div>

      <div className={`mt-4 flex items-center justify-center rounded-xl3 bg-white py-6 shadow-card ${passing ? 'opacity-40' : ''}`}>
        <div className="font-extrabold text-ink text-[42px]">{q.text}</div>
      </div>

      <div className="mt-4">
        <AnswerBox value={input} />
      </div>
      <div className="mt-3">
        <AnswerPad value={input} onChange={setInput} onSubmit={() => answerWith(input)} disabled={passing} />
      </div>
    </div>
  )
}

/**
 * 闪卡速记：先按 unit 顺序过一遍卡片（看图 + 单词 + 中文，自动朗读），
 * 再做看图认词小测。答错的进错题本走遗忘曲线；到期错题穿插进本次答题。
 * 出卡进度记在 levels（fc-uN），全部通过后按日期轮换单元做总复习。
 */
function FlashCardQuiz({ taskId }: { taskId: string }) {
  const nav = useNav()
  const task = useStore((s) => s.daily.find((t) => t.id === taskId))
  const levels = useStore((s) => s.levels)
  const wrong = useStore((s) => s.wrong)
  const pet = useStore((s) => s.pet)
  const readAloud = useStore((s) => s.settings.readAloud)
  const finishBattle = useStore((s) => s.finishBattle)
  const completeQuiz = useStore((s) => s.completeQuiz)

  // 从第一个没通过的单元开始出卡；都通过了就按日期轮换一个单元总复习
  const unit = useMemo(() => {
    const next = FC_UNITS.find((u) => !levels.some((l) => l.levelId === `fc-${u.id}` && l.cleared))
    return next ?? FC_UNITS[new Date().getDate() % FC_UNITS.length]
  }, [levels])

  // 到期的闪卡错题穿插进来（遗忘曲线复习）
  const inject = useMemo(
    () =>
      wrong
        .filter((w) => !w.mastered && w.nextReviewDay <= nowDay() && w.spec.kind.startsWith('fc_'))
        .map((w) => w.spec),
    [wrong],
  )
  const injectKey = inject.map((s) => `${s.kind}:${s.a}`).join(',')

  const { questions, loading, error } = useGeneratedQuestions(
    {
      subject: 'english',
      levelId: `fc-${unit.id}`,
      count: QUESTIONS_PER_LEVEL,
      inject,
      attr: pet?.attrs.english ?? 0,
    },
    `fc|${unit.id}|${injectKey}`,
  )

  const [phase, setPhase] = useState<'cards' | 'quiz'>('cards')
  const [card, setCard] = useState(0)
  const quizStart = useRef(Date.now())

  // —— 过卡阶段（unit 若被跨设备同步改动，card 越界时夹到最后一张） ——
  const w = unit.words[Math.min(card, unit.words.length - 1)]
  useEffect(() => {
    if (phase === 'cards' && w) speak(w.en, readAloud, 'en-US')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, card])

  // —— 答题阶段（与闯关同款「写对为止」） ——
  const [queue, setQueue] = useState<Question[]>([])
  const [missed, setMissed] = useState<Question[]>([])
  const [passing, setPassing] = useState(false)
  const qStart = useRef(Date.now())
  useEffect(() => {
    setQueue(questions)
  }, [questions])
  const q = queue[0]
  const total = questions.length
  const solved = total - queue.length
  const isRetry = !!q && missed.some((m) => specKey(m.spec) === specKey(q.spec))

  // fc_pic 的 text 恒定，换题判定得用 spec（不然连着两道看图题不重读、计时不重置）
  const qKey = q ? `${q.spec.kind}:${q.spec.a}` : ''
  useEffect(() => {
    if (q && phase === 'quiz') speak(q.speech, readAloud, q.speechLang)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [qKey, phase])

  useEffect(() => {
    qStart.current = Date.now()
  }, [qKey, phase])

  if (!task) return null

  if (phase === 'cards') {
    return (
      <div className="flex min-h-screen flex-col px-5 pb-8 pt-4">
        <div className="flex items-center gap-3">
          <button className="text-[15px] font-bold text-muted" onClick={() => nav.back()}>← 返回</button>
          <div className="flex-1 text-center text-[18px] font-extrabold text-ink">{task.name}</div>
          <div className="rounded-full bg-food/15 px-2 py-1 text-[12px] font-extrabold text-food">🍖+{task.foodValue}</div>
        </div>

        <p className="mt-2 text-center text-[13px] text-muted">
          {unit.name} · 先翻翻卡片，再答题（{card + 1} / {unit.words.length}）
        </p>

        <div className="mt-3 flex flex-1 flex-col items-center justify-center gap-2 rounded-xl3 bg-white px-4 py-6 shadow-card">
          <img src={fcImgSrc(w.no)} alt={w.en} className="h-[220px] w-[220px] object-contain" />
          <div className="mt-1 text-[38px] font-extrabold leading-tight text-ink">{w.en}</div>
          <div className="text-[15px] font-bold text-muted">{w.zh}</div>
          <button className="btn-chip mt-2" onClick={() => speak(w.en, true, 'en-US')}>🔊 读一读</button>
        </div>

        <div className="mt-4 flex gap-3">
          <button className="btn-sub" disabled={card === 0} onClick={() => setCard((c) => c - 1)}>← 上一个</button>
          {card < unit.words.length - 1 ? (
            <button className="btn-main flex-1" onClick={() => setCard((c) => c + 1)}>下一个 ▶</button>
          ) : (
            <button
              className="btn-main flex-1"
              onClick={() => {
                quizStart.current = Date.now()
                setPhase('quiz')
              }}
            >
              开始答题 ✏️
            </button>
          )}
        </div>
      </div>
    )
  }

  if (loading || !q) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3">
        <div className="text-[40px]">🃏</div>
        <div className="text-[15px] font-bold text-muted">{error ? '出题失败了，返回再进一次' : '正在出题…'}</div>
        <button className="btn-chip" onClick={() => nav.back()}>返回</button>
      </div>
    )
  }

  const record = (question: Question, answer: string, correct: boolean) => {
    enqueueOp('attempt', {
      day: nowDay(),
      subject: 'english',
      levelId: `fc-${unit.id}`,
      questionText: question.text,
      input: answer,
      correct,
      firstTry: !missed.some((m) => specKey(m.spec) === specKey(question.spec)),
      durationMs: Math.max(0, Date.now() - qStart.current),
    })
  }

  const answerWith = (choice: string) => {
    if (!q || passing || !choice) return
    const g = gradeAnswer(q, choice)
    const handle = (res: GradeResult) => {
      record(q, choice, res.correct)
      if (!res.correct) {
        setMissed((m) => (m.some((x) => specKey(x.spec) === specKey(q.spec)) ? m : [...m, q]))
        setPassing(true)
        setQueue((qs) => advanceQueue(qs, false))
        toast('先记下，等会儿再回来做它')
        setTimeout(() => setPassing(false), PASS_DELAY)
        return
      }
      if (queue.length === 1) {
        finishBattle('english', `fc-${unit.id}`, firstCorrectCount(total, missed.length), total, missed, Math.max(0, Date.now() - quizStart.current))
        completeQuiz(task.id)
        toast(`闪卡速记完成啦！食物 +${task.foodValue}`)
        nav.back()
        return
      }
      setQueue((qs) => advanceQueue(qs, true))
    }
    if (isThenable(g)) g.then(handle)
    else handle(g)
  }

  return (
    <div className="px-5 pb-10 pt-4">
      <div className="flex items-center gap-3">
        <button className="text-[15px] font-bold text-muted" onClick={() => nav.back()}>← 返回</button>
        <div className="flex-1 text-center text-[18px] font-extrabold text-ink">{task.name}</div>
        <div className="rounded-full bg-food/15 px-2 py-1 text-[12px] font-extrabold text-food">🍖+{task.foodValue}</div>
      </div>

      <p className="mt-3 text-center text-[13px] text-muted">
        {unit.name} · 共 {total} 题 · 全做对就完成
      </p>
      <div className="mt-1 text-center text-[13px] font-bold text-muted">
        已答对 {solved} / {total}
        {missed.length > 0 && <span className="text-warn"> · 待重做 {queue.filter((x) => missed.some((m) => specKey(m.spec) === specKey(x.spec))).length} 道</span>}
      </div>

      <div className={`mt-4 flex flex-col items-center justify-center gap-2 rounded-xl3 bg-white py-5 shadow-card ${passing ? 'opacity-40' : ''}`}>
        {q.promptImg ? (
          <>
            <img src={fcImgSrc(q.promptImg)} alt="" className="h-[190px] w-[190px] object-contain" />
            <div className="text-[18px] font-extrabold text-ink">{q.text}</div>
          </>
        ) : (
          <div className="text-[30px] font-extrabold text-ink">{q.text}</div>
        )}
        {isRetry && <div className="rounded-xl bg-sky-50 px-3 py-1.5 text-[13px] font-bold text-sky-700">🔁 再试一次：{q.hint}</div>}
      </div>

      <div className="mt-4">
        <ChoicePad
          options={q.options ?? []}
          picOptions={q.pictureOptions ? q.options?.map((x) => ({ word: x, src: wordImgSrc(x), zh: EN_ZH[x] ?? x })) : undefined}
          onPick={answerWith}
          disabled={passing}
        />
      </div>
    </div>
  )
}
