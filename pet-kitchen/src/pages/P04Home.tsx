import { useEffect, useState } from 'react'
import { useStore } from '../store/useStore'
import { useNav } from '../store/nav'
import PetAvatar from '../components/PetAvatar'
import { CoinBar, Empty, SatietyBar, toast } from '../components/ui'
import { SHOP_ITEMS, SPECIES, PET_LINES } from '../data/content'
import { FEED_LIMIT, SATIETY_MAX, STAGE_TITLE, STAGE_EXP } from '../engine/rules'
import { pick } from '../utils/id'
import { speak } from '../utils/speech'

function Scene() {
  const placed = useStore((s) => s.placed)
  return (
    <>
      {placed.map((p) => {
        const it = SHOP_ITEMS.find((i) => i.id === p.itemId)
        if (!it) return null
        return (
          <div
            key={p.uid}
            className="absolute text-[30px] select-none"
            style={{ left: `${p.x}%`, top: `${p.y}%`, transform: 'translate(-50%,-50%)' }}
          >
            {it.emoji}
          </div>
        )
      })}
    </>
  )
}

/** P05 喂养面板：只给 1 份 / 3 份 / 加满，不给数字输入（低龄孩子算不清） */
function FeedDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const pet = useStore((s) => s.pet)
  const food = useStore((s) => s.food)
  const feed = useStore((s) => s.feed)
  const [sel, setSel] = useState(0)
  if (!open || !pet) return null

  const room = Math.max(0, Math.ceil((SATIETY_MAX - pet.satiety) / 20))
  const remainTimes = FEED_LIMIT - pet.fedToday
  const fill = Math.min(5, Math.max(0, Math.ceil((100 - pet.satiety) / 20)))
  const maxByLimit = Math.min(remainTimes, room)
  const actual = sel === 0 ? 0 : Math.min(sel, maxByLimit)
  const preview = Math.min(SATIETY_MAX, pet.satiety + actual * 20)

  const opts = [
    { n: 1, label: '1 份' },
    { n: 3, label: '3 份' },
    { n: fill, label: '加 满' },
  ]

  const canFeed = actual > 0 && food >= actual && maxByLimit > 0

  return (
    <div className="fixed inset-0 z-[80] flex items-end" onClick={onClose}>
      <div className="absolute inset-0 bg-ink/40" />
      <div
        className="relative w-full animate-slideup rounded-t-xl3 bg-white px-5 pb-8 pt-4 shadow-pop"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="text-center text-[19px] font-extrabold text-ink">喂 {pet.nickname}</div>
        <div className="mt-3">
          <SatietyBar value={pet.satiety} />
          {actual > 0 && (
            <div className="mt-2 text-center text-[15px] font-extrabold text-sky-600">
              {pet.satiety} → {preview}
            </div>
          )}
        </div>

        <div className="mt-4 grid grid-cols-3 gap-3">
          {opts.map((o) => {
            const disabled = o.n <= 0 || o.n > maxByLimit || food < o.n
            return (
              <button
                key={o.label}
                disabled={disabled}
                onClick={() => setSel(o.n)}
                className={`h-[52px] rounded-2xl text-[17px] font-extrabold transition active:scale-95 ${
                  sel === o.n ? 'bg-sky-400 text-white shadow-card' : 'bg-sky-100 text-sky-700'
                } disabled:bg-slate-100 disabled:text-slate-400`}
              >
                {o.label}
              </button>
            )
          })}
        </div>

        <div className="mt-3 flex items-center justify-between text-[13px] font-bold text-muted">
          <span>今天已喂 {pet.fedToday} / {FEED_LIMIT} 次</span>
          <span>食物剩余 {food} 份</span>
        </div>

        {pet.fedToday >= FEED_LIMIT ? (
          <div className="mt-3 rounded-xl bg-sky-50 px-3 py-2 text-[13px] font-bold text-sky-600">今天喂满啦，明天再来吧～</div>
        ) : pet.fedToday === FEED_LIMIT - 1 ? (
          <div className="mt-3 rounded-xl bg-warn/15 px-3 py-2 text-[13px] font-bold text-warn">⚠ 再喂 1 份就顶格啦</div>
        ) : null}

        <button
          className="btn-main mt-4"
          disabled={!canFeed}
          onClick={() => {
            const r = feed(actual)
            toast(r.msg, r.ok ? 'ok' : 'warn')
            if (r.ok) {
              setSel(0)
              onClose()
            }
          }}
        >
          确 定 投 喂
        </button>
      </div>
    </div>
  )
}

/** P04 家园首页（稳定态 · 核心页） */
export default function P04Home() {
  const s = useStore()
  const nav = useNav()
  const [feedOpen, setFeedOpen] = useState(false)
  const [line, setLine] = useState<string | null>(null)
  const [mood, setMood] = useState<'idle' | 'happy'>('idle')

  useEffect(() => {
    s.ensureDay()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const pet = s.pet
  if (!pet) return null
  const def = SPECIES.find((x) => x.id === pet.species)!

  const undone = s.daily.filter((t) => t.status === 'todo' || t.status === 'rejected')
  const done = s.daily.filter((t) => t.status === 'done' || t.status === 'pending')
  const sorted = [...undone, ...done]
  const allDone = s.daily.length > 0 && undone.length === 0

  const expBase = STAGE_EXP[pet.stage - 1] ?? 0
  const expNext = STAGE_EXP[pet.stage] ?? STAGE_EXP[5]
  const expPct = pet.stage >= 6 ? 100 : Math.min(100, ((pet.exp - expBase) / Math.max(1, expNext - expBase)) * 100)

  const cannotFeed =
    s.food <= 0 || pet.satiety >= SATIETY_MAX || pet.fedToday >= FEED_LIMIT

  return (
    <div className="pb-4">
      <CoinBar food={s.food} points={s.points} />

      {/* 宠物主视觉 */}
      <div className="relative mx-4 mt-1 h-[240px] overflow-hidden rounded-xl3 bg-gradient-to-b from-sky-100 to-white shadow-card">
        <div className="absolute inset-x-0 bottom-0 h-14 bg-gradient-to-t from-emerald-50 to-transparent" />
        <Scene />
        <button
          className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2"
          onClick={() => {
            setLine(pick(PET_LINES))
            setMood('happy')
            speak(pick(PET_LINES), s.settings.readAloud)
            setTimeout(() => setMood('idle'), 900)
            setTimeout(() => setLine(null), 2600)
          }}
        >
          <div className="animate-floaty">
            <PetAvatar species={pet.species} stage={pet.stage} size={190} mood={mood} />
          </div>
        </button>
        {line && (
          <div className="absolute left-1/2 top-3 -translate-x-1/2 animate-popin whitespace-nowrap rounded-2xl bg-white px-3 py-1.5 text-[14px] font-bold text-ink shadow-card">
            {line}
          </div>
        )}
        <div className="absolute left-3 top-3 rounded-full bg-white/90 px-2.5 py-1 text-[12px] font-extrabold text-sky-600 shadow-card">
          {def.name} · {STAGE_TITLE[pet.stage - 1]}
        </div>
      </div>

      <div className="mt-3 px-4">
        <div className="mb-1 flex items-baseline justify-between">
          <div className="text-[20px] font-extrabold text-ink">
            {pet.nickname} <span className="text-[15px] text-sky-500">Lv.{pet.stage}</span>
          </div>
          <div className="text-[12px] font-bold text-muted">
            经验 {pet.exp} / {pet.stage >= 6 ? '满级' : expNext}
          </div>
        </div>
        <div className="mb-3 h-2 w-full overflow-hidden rounded-full bg-sky-100">
          <div className="h-full rounded-full bg-sky-400 transition-all" style={{ width: `${expPct}%` }} />
        </div>
        <SatietyBar value={pet.satiety} />
      </div>

      <div className="mt-4 flex gap-3 px-4">
        <button
          className="btn-main"
          disabled={cannotFeed}
          onClick={() => setFeedOpen(true)}
        >
          🍖 喂 食
        </button>
        <button className="btn-sub" onClick={() => nav.go('decorate')}>
          🎨 布 置
        </button>
      </div>

      {/* 今日任务 */}
      <div className="mt-5 px-4">
        <div className="mb-2 flex items-center justify-between">
          <div className="text-[16px] font-extrabold text-ink">今日任务</div>
          <div className="text-[13px] font-bold text-sky-600">
            {s.streak > 0 ? `连续 ${s.streak} 天 🔥` : '今天重新开始'}
          </div>
        </div>

        {s.daily.length === 0 ? (
          <div className="card">
            <Empty
              emoji="📝"
              text="还没有任务哦，请爸爸妈妈先添加"
              action={
                <button className="btn-chip" onClick={() => nav.go('parent')}>
                  请爸爸妈妈来设置
                </button>
              }
            />
          </div>
        ) : allDone ? (
          <div className="card text-center">
            <div className="animate-floaty text-[44px]">🎉</div>
            <div className="mt-1 text-[16px] font-extrabold text-ok">今天全部完成啦！</div>
            <div className="mt-1 text-[13px] text-muted">（全部完成没有额外食物哦）</div>
          </div>
        ) : (
          <div className="card divide-y divide-sky-50 p-0">
            {sorted.map((t) => {
              const finished = t.status === 'done'
              const waiting = t.status === 'pending'
              return (
                <button
                  key={t.id}
                  disabled={finished || waiting}
                  onClick={() => nav.go('task', t.id)}
                  className="flex w-full items-center gap-3 px-4 py-3.5 text-left active:bg-sky-50"
                >
                  <span className="text-[22px]">{t.icon}</span>
                  <span className={`flex-1 text-[16px] font-bold ${finished ? 'text-muted line-through' : 'text-ink'}`}>
                    {t.name}
                  </span>
                  {waiting ? (
                    <span className="rounded-full bg-warn/20 px-2 py-1 text-[12px] font-bold text-warn">⏳ 等确认</span>
                  ) : finished ? (
                    <span className="text-[20px]">✅</span>
                  ) : (
                    <span className="rounded-full bg-food/15 px-2 py-1 text-[12px] font-extrabold text-food">
                      +{t.foodValue} 份
                    </span>
                  )}
                </button>
              )
            })}
          </div>
        )}
      </div>

      <FeedDrawer open={feedOpen} onClose={() => setFeedOpen(false)} />
    </div>
  )
}
