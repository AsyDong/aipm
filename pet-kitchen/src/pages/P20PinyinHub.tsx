// ============ P20 拼音版块 · 多游戏中心 ============
//
// 原「拼音方块世界」的首页（Home.vue）搬进来，视觉改成 pet-kitchen 风格。
// 三个分组：成长区（闯关地图 / 错题本）、游戏区（4 个小游戏）、学习区（字母表 / 讲堂 / 拼读演示 / 21 天计划）。

import { useStore } from '../store/useStore'
import { useNav } from '../store/nav'
import { usePinyin } from '../pinyin/store'
import { CoinBar } from '../components/ui'
import { PINYIN_WORLD_LEVELS } from '../engine/questions'
import { PLAN_21, PLAN_DAYS, newDoneOf, reviewsForDay } from '../pinyin/plan'
import { nowDay } from '../engine/time'

interface Tile {
  page: string
  arg?: string
  icon: string
  label: string
  sub: string
}

export default function P20PinyinHub() {
  const nav = useNav()
  const levels = useStore((s) => s.levels)
  const wrong = useStore((s) => s.wrong)
  const food = useStore((s) => s.food)
  const points = useStore((s) => s.points)
  const readLetters = usePinyin((s) => s.readLetters)
  const plan = usePinyin((s) => s.plan)

  // 关卡进度（星级走主应用 levels）
  const recOf = (id: string) => levels.find((r) => r.levelId === id)
  const cleared = PINYIN_WORLD_LEVELS.filter((l) => recOf(l.id)?.cleared).length
  const stars = PINYIN_WORLD_LEVELS.reduce((n, l) => n + (recOf(l.id)?.bestStars ?? 0), 0)

  // 今日任务（21 天计划）
  const day = Math.min(Math.max(plan.startDay, 1), PLAN_DAYS)
  const p = PLAN_21[day - 1]
  const rec = plan.days[day] ?? { newDone: false, reviewsDone: [], wrongDone: false, checked: false, date: '' }
  const starsById: Record<number, number> = {}
  for (const l of PINYIN_WORLD_LEVELS) starsById[Number(l.id.slice(2))] = recOf(l.id)?.bestStars ?? 0
  const newDone = rec.newDone || newDoneOf(p, readLetters, starsById)
  const reviews = reviewsForDay(day)
  const wrongDone = rec.wrongDone || wrong.filter((w) => w.subject === 'chinese').length === 0
  const taskTotal = 1 + reviews.length + 1
  const taskDone = (newDone ? 1 : 0) + reviews.filter((r) => rec.reviewsDone.includes(r.day)).length + (wrongDone ? 1 : 0)
  const percent = taskTotal ? Math.round((taskDone / taskTotal) * 100) : 0

  const today = nowDay()
  const dueWrong = wrong.filter((w) => w.subject === 'chinese' && !w.mastered && w.nextReviewDay <= today).length

  const groups: { name: string; icon: string; desc: string; tint: string; ring: string; tiles: Tile[] }[] = [
    {
      name: '成长区', icon: '🏆', desc: '见证进步',
      tint: 'bg-violet-50', ring: 'ring-violet-100',
      tiles: [
        { page: 'pymap', icon: '🗺️', label: '闯关地图', sub: `${cleared}/${PINYIN_WORLD_LEVELS.length} 关 · ${stars}★` },
        { page: 'wrong', arg: 'chinese', icon: '📕', label: '错题本', sub: dueWrong > 0 ? `${dueWrong} 道待复习` : '已清空' },
      ],
    },
    {
      name: '游戏区', icon: '🎮', desc: '4 个小游戏',
      tint: 'bg-emerald-50', ring: 'ring-emerald-100',
      tiles: [
        { page: 'pygame', arg: 'listen', icon: '🎧', label: '听力挑战', sub: '听真人发音选拼音' },
        { page: 'pygame', arg: 'char', icon: '📖', label: '识字挑战', sub: '看汉字选拼音' },
        { page: 'pygame', arg: 'blend', icon: '🧩', label: '拼装工坊', sub: '声母+韵母拼音节' },
        { page: 'pygame', arg: 'follow', icon: '🎤', label: '发音擂台', sub: '大声跟读拿星星' },
      ],
    },
    {
      name: '学习区', icon: '📚', desc: '先认识拼音',
      tint: 'bg-sky-50', ring: 'ring-sky-100',
      tiles: [
        { page: 'pyalpha', icon: '🔤', label: '拼音字母表', sub: `${readLetters.length}/63 已点读` },
        { page: 'pylesson', icon: '📚', label: '学习讲堂', sub: '九课拼音规则' },
        { page: 'pyspell', icon: '🧪', label: '拼读演示', sub: '声母+韵母=音节' },
        { page: 'pyplan', icon: '📋', label: '21 天计划', sub: `第 ${day}/${PLAN_DAYS} 天` },
      ],
    },
  ]

  return (
    <div className="pb-4">
      <CoinBar food={food} points={points} />

      <div className="mx-4 mt-1 flex items-center gap-2">
        <button
          onClick={() => nav.replace('battle')}
          className="rounded-2xl bg-white px-3 py-2 text-[14px] font-extrabold text-muted active:scale-[0.98]"
        >
          ← 版块
        </button>
        <div className="flex-1 rounded-2xl bg-emerald-50 px-3 py-2 ring-1 ring-emerald-100">
          <span className="text-[15px] font-extrabold text-ink">🅰️ 拼音方块世界</span>
          <span className="ml-2 text-[12px] font-bold text-muted">{cleared}/{PINYIN_WORLD_LEVELS.length} 关 · {stars}★</span>
        </div>
      </div>

      {/* 今日任务卡 */}
      <button
        onClick={() => nav.go('pyplan')}
        className="mx-4 mt-3 flex w-[calc(100%-2rem)] items-center gap-3 rounded-xl3 bg-white px-4 py-3.5 text-left shadow-card active:scale-[0.99]"
      >
        <span className="text-[26px]">📋</span>
        <span className="flex-1">
          <span className="block text-[15px] font-extrabold text-ink">今日任务</span>
          <span className="block text-[12px] font-bold text-muted">
            第 {day}/{PLAN_DAYS} 天 · {p.icon} {p.title}
          </span>
          <span className="mt-1.5 block h-1.5 w-full overflow-hidden rounded-full bg-sky-100">
            <span className="block h-full rounded-full bg-sky-400" style={{ width: `${percent}%` }} />
          </span>
        </span>
        <span className="text-right">
          <span className={`block text-[12px] font-extrabold ${rec.checked ? 'text-emerald-600' : 'text-amber-500'}`}>
            {rec.checked ? '✅ 已打卡' : `🔥 ${plan.streak} 天`}
          </span>
          <span className="block text-[11px] font-bold text-muted">{taskDone}/{taskTotal} 项</span>
        </span>
      </button>

      {groups.map((g) => (
        <div key={g.name} className={`mx-4 mt-3 rounded-xl3 p-4 ring-1 ${g.tint} ${g.ring}`}>
          <div className="mb-2.5 flex items-baseline gap-2">
            <span className="text-[15px] font-extrabold text-ink">{g.icon} {g.name}</span>
            <span className="text-[12px] font-bold text-muted">{g.desc}</span>
          </div>
          <div className="grid grid-cols-2 gap-2.5">
            {g.tiles.map((t) => (
              <button
                key={t.label}
                onClick={() => nav.go(t.page, t.arg)}
                className="flex flex-col items-start rounded-2xl bg-white/90 px-3.5 py-3 text-left shadow-card active:scale-[0.98]"
              >
                <span className="text-[24px]">{t.icon}</span>
                <span className="mt-1 text-[15px] font-extrabold text-ink">{t.label}</span>
                <span className="mt-0.5 text-[11px] font-bold leading-snug text-muted">{t.sub}</span>
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
