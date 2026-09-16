import { useMemo, useState } from 'react'
import { useStore } from '../store/useStore'
import { useNav } from '../store/nav'
import { monthDays, weekDays, dayLabel, nowDay } from '../engine/time'
import { BODY_LABEL, MAINTAIN_FOOD, SATIETY_FULL, STAGE_TITLE } from '../engine/rules'
import type { DailySnapshot } from '../types'

type Range = 'week' | 'month' | 'all'

/** P14 成长报告（MVP 只用横向进度条，低龄家长也能一眼看懂） */
export default function P14Report() {
  const nav = useNav()
  const snapshots = useStore((s) => s.snapshots)
  const pet = useStore((s) => s.pet)
  const wrong = useStore((s) => s.wrong)
  const templates = useStore((s) => s.templates)
  const [range, setRange] = useState<Range>('week')

  // 当天还没结算（04:00 才跨日），把实时计数补成一行，否则今天的数据全是 0
  const today = nowDay()
  // 逐项取值，避免返回新对象导致 zustand 无限重渲染
  const activeDay = useStore((s) => s.activeDay)
  const curStreak = useStore((s) => s.streak)
  const dailyCount = useStore((s) => s.daily.length)
  const todayBattles = useStore((s) => s.todayBattles)
  const todayCorrect = useStore((s) => s.todayCorrect)
  const todayTotalQ = useStore((s) => s.todayTotal)
  const todayPoints = useStore((s) => s.todayPoints)
  const todayFoodEarned = useStore((s) => s.todayFoodEarned)
  const todayTasksDone = useStore((s) => s.todayTasksDone)

  const todayRow: DailySnapshot = {
    day: activeDay,
    satiety: pet?.satiety ?? 0,
    fed: pet?.fedToday ?? 0,
    full: (pet?.satiety ?? 0) >= SATIETY_FULL,
    body: pet?.body ?? 'normal',
    streak: curStreak,
    tasksDone: todayTasksDone,
    tasksTotal: dailyCount,
    battles: todayBattles,
    correctRate: todayTotalQ ? todayCorrect / todayTotalQ : 0,
    pointsEarned: todayPoints,
    foodEarned: todayFoodEarned,
  }

  const days = useMemo(() => {
    if (range === 'week') return weekDays()
    if (range === 'month') return monthDays()
    return null
  }, [range])

  const rows = useMemo(() => {
    const history = snapshots.filter((s) => s.day !== todayRow.day)
    const base = !days ? history : history.filter((s) => days.includes(s.day))
    const inRange = !days || days.includes(todayRow.day)
    return inRange ? [...base, todayRow] : base
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [days, snapshots, today, activeDay, todayBattles, todayPoints, todayTasksDone, dailyCount, pet])

  const sum = (f: (r: (typeof rows)[number]) => number) => rows.reduce((a, r) => a + f(r), 0)
  const tasksDone = sum((r) => r.tasksDone)
  const tasksTotal = sum((r) => r.tasksTotal)
  const rate = tasksTotal ? tasksDone / tasksTotal : 0
  const battles = sum((r) => r.battles)
  const points = sum((r) => r.pointsEarned)
  const food = sum((r) => r.foodEarned)
  const maxStreak = rows.reduce((a, r) => Math.max(a, r.streak), 0)
  const avgCorrect = rows.length ? rows.reduce((a, r) => a + r.correctRate, 0) / rows.length : 0
  const noFeedDays = rows.filter((r) => r.fed === 0).length
  const mastered = wrong.filter((w) => w.mastered).length

  const dailyProduce = templates.filter((t) => t.enabled).reduce((a, t) => a + t.foodValue, 0)
  const shortFood = dailyProduce < MAINTAIN_FOOD

  return (
    <div className="px-4 pb-8 pt-4">
      <div className="flex items-center gap-3">
        <button className="text-[15px] font-bold text-muted" onClick={() => nav.back()}>← 返回</button>
        <div className="flex-1 text-center text-[18px] font-extrabold text-ink">成长报告</div>
        <div className="w-[52px]" />
      </div>

      <div className="seg mt-3">
        <button data-on={range === 'week'} onClick={() => setRange('week')}>本周</button>
        <button data-on={range === 'month'} onClick={() => setRange('month')}>本月</button>
        <button data-on={range === 'all'} onClick={() => setRange('all')}>全部</button>
      </div>

      <div className="mt-4 rounded-xl3 bg-white p-4 shadow-card">
        <Bar label="任务完成率" value={rate} text={`${Math.round(rate * 100)}%  (${tasksDone} / ${tasksTotal})`} />
        <Stat label="最长连续" value={`${maxStreak} 天`} />
        <Stat label="获得食物" value={`${food} 份`} />
      </div>

      <div className="mt-3 rounded-xl3 bg-white p-4 shadow-card">
        <Stat label="闯关次数" value={`${battles} 次`} />
        <Bar label="平均正确率" value={avgCorrect} text={`${Math.round(avgCorrect * 100)}%`} />
        <Stat label="获得积分" value={`${points} 分`} />
        <Stat label="攻克错题" value={`${mastered} 道`} />
      </div>

      <div className="mt-3 rounded-xl3 bg-white p-4 shadow-card">
        <div className="mb-1 text-[14px] font-extrabold text-ink">宠物状态</div>
        <Stat label="当前" value={`Lv.${pet?.stage ?? 1} ${STAGE_TITLE[(pet?.stage ?? 1) - 1]} · ${BODY_LABEL[pet?.body ?? 'normal']} · 饱食度 ${pet?.satiety ?? 0}`} />
        {noFeedDays > 0 && (
          <div className="mt-2 rounded-xl bg-warn/15 px-3 py-2 text-[13px] font-bold text-warn">
            ⚠ 这段时间有 {noFeedDays} 天没喂，差点变瘦
          </div>
        )}
        {shortFood && (
          <div className="mt-2 rounded-xl bg-warn/15 px-3 py-2 text-[13px] font-bold text-warn">
            ⚠ 每日产出 {dailyProduce} 份，低于维持所需的 {MAINTAIN_FOOD} 份/天，建议调高单个任务的食物值
          </div>
        )}
        {battles === 0 && (
          <div className="mt-2 rounded-xl bg-sky-50 px-3 py-2 text-[13px] font-bold text-sky-600">
            还没闯过关，去试试吧，积分只能靠闯关获得哦
          </div>
        )}
      </div>

      {rows.length > 0 && (
        <div className="mt-3 rounded-xl3 bg-white p-4 shadow-card">
          <div className="mb-2 text-[14px] font-extrabold text-ink">每日打卡</div>
          <div className="flex gap-1.5">
            {rows.slice(-14).map((r) => (
              <div key={r.day} className="flex flex-1 flex-col items-center gap-1">
                <div
                  className={`w-full rounded-md ${r.tasksDone > 0 ? 'bg-ok' : 'bg-sky-100'}`}
                  style={{ height: `${Math.max(6, (r.tasksDone / Math.max(1, r.tasksTotal)) * 44)}px` }}
                />
                <span className="text-[9px] text-muted">{dayLabel(r.day).replace('月', '/').replace('日', '')}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="mt-4">
        <button className="btn-sub" onClick={() => nav.go('parent', 'grant')}>🎁 家长奖励积分</button>
      </div>
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between border-b border-sky-50 py-2 last:border-0">
      <span className="text-[14px] font-bold text-muted">{label}</span>
      <span className="text-[15px] font-extrabold text-ink">{value}</span>
    </div>
  )
}

function Bar({ label, value, text }: { label: string; value: number; text: string }) {
  return (
    <div className="border-b border-sky-50 py-2 last:border-0">
      <div className="flex items-center justify-between">
        <span className="text-[14px] font-bold text-muted">{label}</span>
        <span className="text-[15px] font-extrabold text-ink">{text}</span>
      </div>
      <div className="mt-1.5 h-2.5 w-full overflow-hidden rounded-full bg-sky-100">
        <div className="h-full rounded-full bg-sky-400 transition-all" style={{ width: `${Math.min(100, value * 100)}%` }} />
      </div>
    </div>
  )
}
