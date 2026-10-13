// ============ P25 拼音闯关地图 ============
//
// 移植自 pinyin-world 的 MapView.vue + LevelPlay.vue + UnitTest.vue，合并成一个页面：
// 15 关（按 4 个单元分组）+ 单元测试入口 + 字母点读进度。
// 关卡星级取自主应用 levels（与数学/英语/识字同一套记录）。

import { useNav } from '../store/nav'
import { useStore } from '../store/useStore'
import { usePinyin } from '../pinyin/store'
import { CoinBar } from '../components/ui'
import { PINYIN_WORLD_LEVELS } from '../engine/questions'
import { FINAL_GROUPS, INITIALS, PW_LEVELS, PW_UNITS, ZHENGTI } from '../pinyin/data'

export default function P25PinyinMap() {
  const nav = useNav()
  const levels = useStore((s) => s.levels)
  const food = useStore((s) => s.food)
  const points = useStore((s) => s.points)
  const readLetters = usePinyin((s) => s.readLetters)
  const testScores = usePinyin((s) => s.testScores)

  const recOf = (id: string) => levels.find((r) => r.levelId === id)
  const cleared = PINYIN_WORLD_LEVELS.filter((l) => recOf(l.id)?.cleared).length
  const stars = PINYIN_WORLD_LEVELS.reduce((n, l) => n + (recOf(l.id)?.bestStars ?? 0), 0)

  const finItems = FINAL_GROUPS.flatMap((g) => g.items)
  const progress = [
    { name: '声母', n: INITIALS.filter((s) => readLetters.includes(s.py)).length, total: 23 },
    { name: '韵母', n: finItems.filter((s) => readLetters.includes(s.py)).length, total: 24 },
    { name: '整体认读', n: ZHENGTI.filter((s) => readLetters.includes(s.py)).length, total: 16 },
  ]

  const unitUnlocked = (uid: number) =>
    PW_LEVELS.filter((l) => l.unit === uid).every((l) => (recOf(`py${l.id}`)?.bestStars ?? 0) > 0)

  return (
    <div className="pb-6">
      <CoinBar food={food} points={points} />

      <div className="mx-4 mt-1 flex items-center gap-2">
        <button onClick={() => nav.back()} className="rounded-2xl bg-white px-3 py-2 text-[14px] font-extrabold text-muted active:scale-[0.98]">← 返回</button>
        <div className="flex-1 rounded-2xl bg-emerald-50 px-3 py-2 ring-1 ring-emerald-100">
          <span className="text-[15px] font-extrabold text-ink">🗺️ 闯关地图</span>
          <span className="ml-2 text-[12px] font-bold text-muted">{cleared}/{PINYIN_WORLD_LEVELS.length} 关 · {stars}★</span>
        </div>
      </div>

      {/* 字母点读进度 */}
      <div className="mx-4 mt-3 rounded-xl3 bg-white p-4 shadow-card">
        <div className="mb-2 text-[14px] font-extrabold text-ink">🔤 字母点读进度</div>
        {progress.map((p) => (
          <div key={p.name} className="mt-2">
            <div className="flex justify-between text-[12px] font-bold text-muted">
              <span>{p.name}</span>
              <span>{p.n}/{p.total}</span>
            </div>
            <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-sky-100">
              <div className="h-full rounded-full bg-sky-400 transition-all" style={{ width: `${(p.n / p.total) * 100}%` }} />
            </div>
          </div>
        ))}
      </div>

      {/* 15 关，按单元分组 */}
      {PW_UNITS.map((u) => {
        const list = PW_LEVELS.filter((l) => l.unit === u.id)
        const unlocked = unitUnlocked(u.id)
        return (
          <div key={u.id} className="mx-4 mt-3 rounded-xl3 bg-white p-4 shadow-card">
            <div className="mb-2 flex items-baseline gap-2">
              <span className="text-[15px] font-extrabold text-ink">{u.icon} {u.name}</span>
              <span className="text-[12px] font-bold text-muted">第 {u.range[0]}-{u.range[1]} 关</span>
            </div>

            {list.map((l) => {
              const rec = recOf(`py${l.id}`)
              const done = rec?.cleared
              return (
                <button
                  key={l.id}
                  onClick={() => nav.go('pygame', `lvl:py${l.id}`)}
                  className={`mb-2 flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left active:scale-[0.98] ${
                    done ? 'bg-emerald-50' : 'bg-sky-50'
                  }`}
                >
                  <span className="text-[22px]">{done ? '✅' : l.icon}</span>
                  <span className="flex-1">
                    <span className="block text-[15px] font-extrabold text-ink">第{l.id}关 · {l.name}</span>
                    <span className="block text-[12px] font-bold text-muted">{done ? '已通关，可重玩' : l.tip}</span>
                  </span>
                  <span className="text-[13px]">
                    {[1, 2, 3, 4].map((n) => (
                      <span key={n} className={(rec?.bestStars ?? 0) >= n ? 'text-amber-400' : 'text-slate-200'}>★</span>
                    ))}
                  </span>
                </button>
              )
            })}

            <button
              disabled={!unlocked}
              onClick={() => nav.go('pygame', `unit:${u.id}`)}
              className={`mt-1 flex w-full items-center justify-center gap-2 rounded-2xl py-3 text-[15px] font-extrabold ${
                unlocked ? 'bg-amber-400 text-white shadow-card active:scale-[0.98]' : 'bg-slate-100 text-slate-400'
              }`}
            >
              {unlocked ? '📝 单元测试' : '🔒 通关本单元后解锁'}
              {testScores[u.id] ? <span className="text-[12px] font-bold">（上次 {testScores[u.id]} 分）</span> : null}
            </button>
          </div>
        )
      })}
    </div>
  )
}
