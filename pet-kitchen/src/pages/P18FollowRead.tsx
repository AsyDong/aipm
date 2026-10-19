import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useStore } from '../store/useStore'
import type { BattleResult } from '../store/useStore'
import { useNav } from '../store/nav'
import { CoinBar, toast } from '../components/ui'
import { levelById } from '../engine/questions'
import { readItemsOf, type ReadItem, type ReadTier } from '../data/readtext'
import { outcomeOf, wordTone, type ReadOutcome, type ScoreResponse } from '../engine/follow'
import { reviewItemsOf, weakWordsOf, wrongQuestionsOf } from '../engine/readwrong'
import { nowDay } from '../engine/time'
import { WRONG_INJECT } from '../engine/rules'
import {
  MAX_RECORD_MS, blobToBase64, canRecord, getMicStream, micErrorHint, newRid, pickMime,
  recordBlockReason, toWav16k,
} from '../utils/audio'
import { providerConfig } from '../engine/provider/config'
import { speak, stopSpeak } from '../utils/speech'

/**
 * 每关练几条。
 * 一个单元的单词有 20 多个，全读一遍对孩子是负担，所以一关只练一批；
 * 下一批从哪开始由 playCount 轮转（见 pickItems），多玩几次自然把整个单元轮完。
 */
const READ_PER_LEVEL: Record<ReadTier, number> = { words: 10, phrases: 6, sentences: 6 }

/** 从整档题库里挑本关要练的一批，用 playCount 做轮转起点 */
function pickItems(all: ReadItem[], tier: ReadTier, playCount: number): ReadItem[] {
  const n = Math.min(READ_PER_LEVEL[tier], all.length)
  const batches = Math.max(1, Math.ceil(all.length / n))
  const b = (((playCount % batches) + batches) % batches)
  return all.slice(b * n, b * n + n)
}

type Phase = 'ready' | 'recording' | 'scoring' | 'result' | 'summary'

/**
 * P18 跟读评分（英语课本的「跟读」关）
 *
 * 玩法：听范本 → 点话筒读 → 引擎给分 → 出 3 颗星 + 没读好的词标红。
 * 一步一步来：**单词关先求音准，短语关求连读，句子关再求流利**。
 *
 * 数据链路：浏览器录音 → 重采样 16k 单声道 WAV → POST /api/score → 讯飞 ISE。
 * 讯飞的密钥只在服务端，前端拿不到（官方明确要求不能从浏览器直连）。
 */
export default function P18FollowRead({ levelId }: { levelId: string }) {
  const nav = useNav()
  const level = levelById(levelId)
  const playCount = useStore((s) => s.levels.find((l) => l.levelId === levelId)?.playCount ?? 0)
  const readAloud = useStore((s) => s.settings.readAloud)
  const finishBattle = useStore((s) => s.finishBattle)
  const food = useStore((s) => s.food)
  const points = useStore((s) => s.points)

  const info = useMemo(() => readItemsOf(levelId), [levelId])
  /**
   * 本关要练的一批 = 错题复习词 + 轮转取的一批（FE-08）。
   * 复习词固定排最前：先把上次读不好的词补上，再往下学新内容。
   * 只在进关卡时取一次 —— 结算会改错题本，不该把正在练的列表中途换掉。
   */
  const [reviewSeed] = useState<ReadItem[]>(() =>
    reviewItemsOf(useStore.getState().wrong, nowDay(), WRONG_INJECT),
  )
  const items = useMemo(() => {
    if (!info) return []
    const seen = new Set(reviewSeed.map((r) => r.en.toLowerCase()))
    const picked = pickItems(info.items, info.tier, playCount).filter((p) => !seen.has(p.en.toLowerCase()))
    return [...reviewSeed, ...picked]
  }, [info, playCount, reviewSeed])

  const [idx, setIdx] = useState(0)
  const [phase, setPhase] = useState<Phase>('ready')
  const [outcome, setOutcome] = useState<ReadOutcome | null>(null)
  /** 已读完的条数 / 其中拿到 ≥2 星的条数 —— 结算口径 */
  const [done, setDone] = useState(0)
  const [passed, setPassed] = useState(0)
  const [apiReady, setApiReady] = useState<boolean | null>(null)
  const [apiHint, setApiHint] = useState('')
  const [hint, setHint] = useState('')
  const [result, setResult] = useState<BattleResult | null>(null)
  /**
   * 家长人工打分：设备录不了音（老 iPad / 权限被拒）或评分服务挂掉时的兜底。
   * 家长听孩子读完点「👍 / 🔁」，进度照走。代价：没有逐词分析，
   * 弱词收不进错题本 —— 能用引擎就别待在这个模式。
   */
  const [manual, setManual] = useState(() => !canRecord())

  const streamRef = useRef<MediaStream | null>(null)
  const recRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const timerRef = useRef<number | null>(null)
  const limitRef = useRef<number | null>(null)
  const startedAt = useRef(Date.now())
  /** 本关读不好的词：先在页面里攒着，结算时一次性回灌错题本（见 engine/readwrong.ts） */
  const weakRef = useRef<Set<string>>(new Set())

  const cur = items[idx]
  const apiBase = providerConfig().apiBaseUrl || ''

  // ---------- 服务状态 ----------
  useEffect(() => {
    let alive = true
    fetch(`${apiBase}/api/score/health`)
      .then((r) => r.json())
      .then((d: { credentials_ready?: boolean; hint?: string }) => {
        if (!alive) return
        setApiReady(!!d.credentials_ready)
        setApiHint(d.credentials_ready ? '' : d.hint || '评分服务还没配好密钥')
      })
      .catch(() => {
        if (!alive) return
        setApiReady(false)
        setApiHint('连不上评分服务：跟读评分需要有后端在跑（见 README 的「跟读评分」一节）')
      })
    return () => {
      alive = false
    }
  }, [apiBase])

  // ---------- 读范本 ----------
  const playDemo = useCallback(() => {
    if (!cur) return
    speak(cur.en, true, 'en-US')
  }, [cur])

  // 换一条题就自动念一遍范本
  const curKey = cur?.en ?? ''
  useEffect(() => {
    if (curKey) speak(curKey, readAloud, 'en-US')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [curKey])

  useEffect(() => {
    // 注入在最前面的几条是「上次没读好的词」（FE-08），提示要说清它们的来头
    if (idx < reviewSeed.length) setHint('这个词上次没读好，跟着范本再读一遍')
    else if (info?.tier === 'words') setHint('先听一遍范本，把这个词读准')
    else if (info?.tier === 'phrases') setHint('连起来读，词与词之间别断开')
    else setHint('先听一遍范本，再跟着读')
  }, [curKey, info?.tier, idx, reviewSeed.length])

  // ---------- 录音 ----------
  const release = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => {
      try { t.stop() } catch { /* noop */ }
    })
    streamRef.current = null
    if (timerRef.current) window.clearInterval(timerRef.current)
    if (limitRef.current) window.clearTimeout(limitRef.current)
    timerRef.current = null
    limitRef.current = null
  }, [])

  // 离开页面一定要放掉麦克风，否则浏览器的小红点一直亮着
  useEffect(() => () => release(), [release])

  const settleAudio = useCallback(
    async (blob: Blob, text: string, category: string) => {
      setPhase('scoring')
      setHint('正在评分…')
      try {
        const wav = await toWav16k(blob)
        const audio = await blobToBase64(wav)
        const res = (await fetch(`${apiBase}/api/score`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text, language: 'en', category, rid: newRid(), audio }),
        }).then((r) => r.json())) as ScoreResponse

        if (!res || !res.ok) {
          setHint(`评分失败：${res?.error || '未知错误'}`)
          setPhase('ready')
          return
        }
        const out = outcomeOf(text.split(' '), res)
        // 读不好的词攒起来，本关结束时一起回灌错题本（只收课本实词，虚词在 readwrong 里被挡掉）
        for (const w of weakWordsOf(text.split(' '), out.rows)) weakRef.current.add(w)
        setOutcome(out)
        setPhase('result')
        setDone((d) => d + 1)
        // 「过关」口径：这条拿到 2 星以上（3 星 = 每个词都到位，一关要求 90% 条数都过关）
        if (!out.rejected && out.stars >= 2) setPassed((p) => p + 1)
        setHint('')
      } catch (e) {
        setHint(`评分请求失败：${e instanceof Error ? e.message : String(e)}`)
        setPhase('ready')
      }
    },
    [apiBase],
  )

  const startRec = useCallback(async () => {
    if (!cur || phase === 'recording' || phase === 'scoring') return
    const blocked = recordBlockReason()
    if (blocked) {
      setHint(blocked)
      return
    }
    stopSpeak() // 范本还在念就掐掉：iOS 上边放边录音频会话会打架
    let stream: MediaStream
    try {
      stream = await getMicStream()
    } catch (e) {
      setHint(micErrorHint(e))
      return
    }
    streamRef.current = stream
    chunksRef.current = []
    const mime = pickMime()
    let rec: MediaRecorder
    try {
      rec = mime
        ? new MediaRecorder(stream, { mimeType: mime, audioBitsPerSecond: 64000 })
        : new MediaRecorder(stream)
    } catch {
      setHint('录音器初始化失败')
      release()
      return
    }
    recRef.current = rec
    rec.ondataavailable = (e) => {
      if (e.data && e.data.size) chunksRef.current.push(e.data)
    }
    rec.onstop = () => {
      release()
      const type = rec.mimeType || 'audio/webm'
      const blob = new Blob(chunksRef.current, { type })
      chunksRef.current = []
      if (blob.size < 1200) {
        setHint('这次没录到声音，再读一次试试')
        setPhase('ready')
        return
      }
      void settleAudio(blob, cur.en, cur.category)
    }
    try {
      rec.start()
    } catch {
      setHint('录音启动失败')
      release()
      return
    }
    setPhase('recording')
    setHint('读完后点一下按钮结束')
    // 15 秒上限：低龄孩子容易忘记点结束
    limitRef.current = window.setTimeout(() => {
      if (recRef.current?.state !== 'inactive') recRef.current?.stop()
    }, MAX_RECORD_MS)
  }, [cur, phase, release, settleAudio])

  const stopRec = useCallback(() => {
    if (timerRef.current) window.clearInterval(timerRef.current)
    if (limitRef.current) window.clearTimeout(limitRef.current)
    timerRef.current = null
    limitRef.current = null
    if (recRef.current && recRef.current.state !== 'inactive') {
      try { recRef.current.stop() } catch { /* noop */ }
    }
  }, [])

  // ---------- 结算 ----------
  const settle = useCallback(
    (doneN: number, passedN: number) => {
      if (doneN <= 0) {
        nav.back()
        return
      }
      // 读不好的词一并交给主应用：入库 / 去重 / 遗忘曲线 / 同步 op 全走既有那一条链路（FE-08）
      const weak = wrongQuestionsOf(weakRef.current)
      const r = finishBattle('english', levelId, passedN, doneN, weak, Date.now() - startedAt.current)
      setResult(r)
      setPhase('summary')
      setOutcome(null)
      setHint('')
      toast(r.stars > 0 ? `过关啦！拿到 ${r.stars} 颗星` : '再练一遍会更好～', r.stars > 0 ? 'ok' : 'warn')
    },
    [finishBattle, levelId, nav],
  )

  const goNext = useCallback(() => {
    if (idx + 1 >= items.length) {
      settle(done, passed)
      return
    }
    setIdx((i) => i + 1)
    setOutcome(null)
    setPhase('ready')
  }, [idx, items.length, done, passed, settle])

  /** 家长打分：「读得好」按引擎 2 星计（过关口径），「再练练」只记条数 */
  const manualJudge = useCallback(
    (ok: boolean) => {
      const doneN = done + 1
      const passedN = passed + (ok ? 1 : 0)
      setDone(doneN)
      setPassed(passedN)
      setOutcome(null)
      if (idx + 1 >= items.length) settle(doneN, passedN)
      else setIdx((i) => i + 1)
    },
    [done, passed, idx, items.length, settle],
  )

  if (!level || !info || items.length === 0) {
    return (
      <div className="px-6 pb-10 pt-14 text-center">
        <div className="text-[40px]">🤔</div>
        <div className="mt-2 text-[16px] font-extrabold text-ink">这个跟读关没有找到内容</div>
        <button className="btn-main mt-4" onClick={() => nav.back()}>返回</button>
      </div>
    )
  }

  if (phase === 'summary') {
    const stars = result?.stars ?? 0
    const weakCount = weakRef.current.size
    return (
      <div className="flex min-h-screen flex-col items-center px-6 pb-10 pt-14">
        <div className="animate-popin text-[54px]">{stars > 0 ? '🎉' : '💪'}</div>
        <div className="mt-2 text-[26px] font-extrabold text-ink">{stars > 0 ? '过 关 啦 ！' : '再 接 再 厉 ！'}</div>
        {/* 星级与主应用口径一致：最高 4 星（限时通关额外 +1 星），所以是 4 个槽 */}
        <div className="mt-3 text-[15px] text-amber-400">
          {[1, 2, 3, 4].map((n) => (
            <span key={n}>{stars >= n ? '★' : '☆'}</span>
          ))}
        </div>
        <div className="mt-3 text-center text-[15px] font-bold text-muted">
          读了 {done} 条，其中 {passed} 条读得很好
        </div>
        {weakCount > 0 && (
          <div className="mt-2 text-center text-[13px] font-bold text-warn">
            {weakCount} 个词还没读到位，已经替你收进错题本，下次开练先补它们
          </div>
        )}
        {result && stars > 0 && (
          <div className="mt-5 w-full max-w-[340px] rounded-xl3 bg-white p-4 shadow-card">
            <div className="flex justify-between border-b border-sky-50 py-2 text-[15px] font-bold">
              <span className="text-muted">积分</span>
              <span className="text-sky-600">+{result.points}</span>
            </div>
            <div className="flex justify-between py-2 text-[15px] font-bold">
              <span className="text-muted">英语力</span>
              <span className="text-sky-600">+{result.attr}</span>
            </div>
          </div>
        )}
        <div className="mt-6 flex w-full max-w-[340px] gap-3">
          <button className="btn-sub" onClick={() => nav.back()}>返回地图</button>
          <button
            className="btn-main"
            onClick={() => {
              setIdx(0)
              setDone(0)
              setPassed(0)
              setOutcome(null)
              setPhase('ready')
              weakRef.current.clear()
              startedAt.current = Date.now()
            }}
          >
            再 来 一 次
          </button>
        </div>
      </div>
    )
  }

  const tokens = cur.en.split(' ')
  const tone = (i: number) => (outcome ? wordTone(outcome.rows[i]) : '')
  const toneClass = (t: string) =>
    t === 'bad' ? 'text-danger' : t === 'warn' ? 'text-amber-500' : 'text-ink'

  return (
    <div className="pb-6">
      <CoinBar food={food} points={points} />

      <div className="mx-4 mt-1 flex items-center gap-2">
        <button
          onClick={() => nav.back()}
          className="rounded-2xl bg-white px-3 py-2 text-[14px] font-extrabold text-muted active:scale-[0.98]"
        >
          ← 返回
        </button>
        <div className="flex-1 text-center">
          <div className="text-[15px] font-extrabold text-ink">{level.name}</div>
          <div className="text-[11px] text-muted">{info.unit.title}</div>
        </div>
        <div className="rounded-2xl bg-white px-3 py-2 text-[13px] font-extrabold text-violet-600">
          {idx + 1}/{items.length}
        </div>
      </div>

      {/* 主卡：一句一屏 */}
      <div className="mx-4 mt-3 rounded-xl3 bg-white p-5 shadow-card">
        <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-center text-[26px] font-extrabold leading-snug">
          {tokens.map((tok, i) => (
            <span key={`${tok}-${i}`} className={toneClass(tone(i))}>
              {tok}
            </span>
          ))}
        </div>
        <div className="mt-2 text-center text-[14px] text-muted">{cur.cn}</div>

        <button
          onClick={playDemo}
          className="mx-auto mt-3 block rounded-2xl bg-violet-50 px-4 py-2 text-[14px] font-extrabold text-violet-600 active:scale-[0.98]"
        >
          🔊 听范本
        </button>

        {/* 星星：孩子看的就是它 */}
        <div className="mt-4 flex items-end justify-center gap-2">
          {[1, 2, 3].map((n) => (
            <span
              key={n}
              className={`text-[38px] leading-none transition ${
                outcome && !outcome.rejected && outcome.stars >= n ? 'text-amber-400' : 'text-slate-200'
              }`}
            >
              ★
            </span>
          ))}
        </div>
        {outcome && !outcome.rejected && (
          <div className="mt-1 text-center text-[13px] font-bold text-muted">
            综合得分 {outcome.total ?? '-'}
          </div>
        )}

        {/* 提示栏：漏读排最前。孩子看得见红字，就得让他知道错在哪 */}
        {outcome && !outcome.rejected && (
          <div className="mt-3 rounded-2xl bg-slate-50 px-3 py-2 text-left text-[13px]">
            {outcome.lows.length === 0 ? (
              <div className="font-bold text-ok">每个词都读得很到位，直接下一条吧。</div>
            ) : (
              <>
                <div className="font-extrabold text-ink">这几个词再练练：</div>
                {outcome.lows.map((l, i) => (
                  <div key={`${l.word}-${i}`} className="mt-1 flex items-start gap-2">
                    <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${l.missed || (l.score ?? 0) < 70 ? 'bg-danger' : 'bg-amber-400'}`} />
                    <span className="text-muted">
                      <b className="text-ink">{l.word}</b>{' '}
                      {l.missed ? '—— 这个词没读出来，跟着范本再读两遍' : `—— 得分 ${Number(l.score).toFixed(1)}，跟着范本再读两遍`}
                    </span>
                  </div>
                ))}
              </>
            )}
          </div>
        )}

        {outcome?.rejected && (
          <div className="mt-3 rounded-2xl bg-warn/15 px-3 py-2 text-center text-[13px] font-bold text-warn">
            {outcome.rejectMsg}
          </div>
        )}

        {/* 话筒 / 家长人工打分 */}
        {manual ? (
          <div className="mx-auto mt-5 w-full max-w-[300px]">
            <div className="text-center text-[13px] font-extrabold text-ink">👂 家长听孩子读完，点一个：</div>
            <div className="mt-2 flex gap-3">
              <button className="btn-sub flex-1" onClick={() => manualJudge(false)}>🔁 再练练</button>
              <button className="btn-main flex-1" onClick={() => manualJudge(true)}>👍 读得好</button>
            </div>
            {canRecord() && (
              <button
                className="mx-auto mt-2 block text-[12px] font-bold text-sky-500 underline"
                onClick={() => setManual(false)}
              >
                麦克风能用了？切回录音评分
              </button>
            )}
          </div>
        ) : (
          <>
            <button
              onClick={phase === 'recording' ? stopRec : phase === 'scoring' ? undefined : startRec}
              disabled={phase === 'scoring'}
              className={`mx-auto mt-5 flex h-[84px] w-[84px] items-center justify-center rounded-full text-[13px] font-extrabold leading-tight text-white transition active:scale-95 ${
                phase === 'recording' ? 'animate-pulse bg-danger' : phase === 'scoring' ? 'bg-slate-300' : 'bg-sky-400'
              }`}
            >
              {phase === 'recording' ? <>正在<br />听你说</> : phase === 'scoring' ? <>评分<br />中…</> : outcome ? <>再读<br />一次</> : <>开始<br />跟读</>}
            </button>
            {phase !== 'recording' && phase !== 'scoring' && (
              <button
                className="mx-auto mt-2 block text-[12px] font-bold text-muted underline"
                onClick={() => setManual(true)}
              >
                不能录音或评分？家长打分
              </button>
            )}
          </>
        )}

        <div className="mt-3 min-h-[20px] text-center text-[13px] font-bold text-muted">{hint}</div>
      </div>

      {/* 底部动作 */}
      <div className="mx-4 mt-4 flex gap-3">
        <button
          className="btn-sub"
          onClick={() => settle(done, passed)}
          disabled={done === 0 || phase === 'recording' || phase === 'scoring'}
        >
          结束本关
        </button>
        <button className="btn-main" onClick={goNext} disabled={phase === 'recording' || phase === 'scoring'}>
          {idx + 1 >= items.length ? '完 成' : '下 一 条'}
        </button>
      </div>

      <div className="mx-4 mt-3 text-center text-[12px] leading-relaxed text-muted">
        {manual
          ? canRecord()
            ? '家长人工打分中：听孩子读完，读得好点「👍」，还差点「🔁」。'
            : '⚠ 这台设备 / 浏览器录不了音，已切换为家长人工打分：听孩子读完点「👍 / 🔁」，进度照常。'
          : apiReady === false
            ? `⚠ ${apiHint}`
            : apiReady === true
              ? '评分来自讯飞语音评测。读错、漏读、乱读都会被认出来 —— 拿到 3 颗星就是每个词都读到位了。'
              : '正在检查评分服务…'}
      </div>
    </div>
  )
}
