import { useStore } from '../store/useStore'
import { useNav } from '../store/nav'
import { CoinBar, toast } from '../components/ui'
import { MATH_LEVELS, bossRequires } from '../engine/questions'
import { ATTR_LABEL, BATTLE_LIMIT_MIN, SUBJECT_LABEL } from '../engine/rules'
import { nowDay } from '../engine/time'

/** P07 闯关地图 —— MVP 只开放数学，语文/英语置灰「快来了」 */
export default function P07LevelMap({ subject = 'math' }: { subject?: 'math' | 'chinese' | 'english' }) {
  const nav = useNav()
  const pet = useStore((s) => s.pet)
  const levels = useStore((s) => s.levels)
  const wrong = useStore((s) => s.wrong)
  const food = useStore((s) => s.food)
  const points = useStore((s) => s.points)
  const attr = pet?.attrs[subject] ?? 0

  const dueWrong = wrong.filter((w) => w.subject === subject && !w.mastered && w.nextReviewDay <= nowDay())

  const locked = (l: (typeof MATH_LEVELS)[number]) => {
    if (l.boss) {
      const req = bossRequires(l)
      return !req.every((id) => (levels.find((x) => x.levelId === id)?.bestStars ?? 0) >= 2)
    }
    return attr < l.unlockAttr
  }

  const ordered = [...MATH_LEVELS].reverse()

  return (
    <div className="pb-4">
      <CoinBar food={food} points={points} />

      <div className="mx-4 mt-1 flex gap-2">
        {(['math', 'chinese', 'english'] as const).map((k) => (
          <button
            key={k}
            disabled={k !== 'math'}
            onClick={() => nav.go('level', k)}
            className={`flex-1 rounded-2xl py-2.5 text-[15px] font-extrabold ${
              k === subject ? 'bg-sky-400 text-white shadow-card' : 'bg-white text-muted'
            } ${k !== 'math' ? 'opacity-60' : ''}`}
          >
            {SUBJECT_LABEL[k]}
            {k !== 'math' && <span className="ml-1 text-[11px]">快来了</span>}
          </button>
        ))}
      </div>

      <div className="mx-4 mt-3 rounded-xl3 bg-white p-4 shadow-card">
        <div className="mb-2 text-[15px] font-extrabold text-ink">数学关卡</div>
        {ordered.map((l) => {
          const rec = levels.find((x) => x.levelId === l.id)
          const isLocked = locked(l)
          const need = l.boss ? '前 5 关都要 2 星' : `数学力还差 ${Math.max(0, l.unlockAttr - attr)} 点`
          return (
            <button
              key={l.id}
              disabled={isLocked}
              onClick={() => nav.go('play', l.id)}
              className={`mb-2 flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left ${
                l.boss ? 'bg-amber-50' : 'bg-sky-50'
              } ${isLocked ? 'opacity-55' : 'active:scale-[0.98]'}`}
            >
              <span className="text-[22px]">{rec?.cleared ? '✅' : isLocked ? '🔒' : l.boss ? '👑' : '⚔️'}</span>
              <span className="flex-1">
                <span className="block text-[15px] font-extrabold text-ink">
                  {l.boss ? l.name : `第${l.index}关 · ${l.name}`}
                </span>
                <span className="block text-[12px] text-muted">
                  {isLocked ? need : `知识点：${l.skill}`}
                </span>
              </span>
              <span className="text-[13px]">
                {[0, 1, 2, 3].slice(1).map((n) => (
                  <span key={n} className={(rec?.bestStars ?? 0) >= n ? 'text-amber-400' : 'text-slate-200'}>
                    ★
                  </span>
                ))}
              </span>
            </button>
          )
        })}
      </div>

      <div className="mx-4 mt-3 flex gap-3">
        <button className="btn-sub flex-1" onClick={() => nav.go('wrong', subject)}>
          📕 错题集 ({dueWrong.length})
        </button>
      </div>

      <div className="mx-4 mt-3 rounded-xl3 bg-white p-4 shadow-card">
        <div className="mb-2 text-[14px] font-extrabold text-ink">我的属性</div>
        <div className="flex justify-between text-[13px] font-bold">
          {(['math', 'chinese', 'english'] as const).map((k) => (
            <span key={k} className={k === 'math' ? 'text-sky-600' : 'text-slate-300'}>
              {ATTR_LABEL[k]} {pet?.attrs[k] ?? 0}
            </span>
          ))}
        </div>
        <div className="mt-2 text-[12px] text-muted">
          属性越高，血量越多、提示越多，还能解锁后面的关卡。单关限时 {BATTLE_LIMIT_MIN} 分钟。
        </div>
      </div>

      <div className="mx-4 mt-3 text-center text-[12px] text-muted">
        <button
          className="font-bold text-sky-500"
          onClick={() => toast('语文和英语需要教材目录后才能出题哦', 'warn')}
        >
          为什么语文和英语不能玩？
        </button>
      </div>
    </div>
  )
}
