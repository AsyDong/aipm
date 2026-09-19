import { useStore } from '../store/useStore'
import { useNav } from '../store/nav'
import { CoinBar } from '../components/ui'
import { LEVELS_BY_SUBJECT, bossRequires, type LevelDef } from '../engine/questions'
import { ATTR_LABEL, BATTLE_LIMIT_MIN, SUBJECT_LABEL } from '../engine/rules'
import { nowDay } from '../engine/time'

/** P07 闯关地图：三科关卡（数学速算 / 语文拼音识字 / 英语单元词汇） */
export default function P07LevelMap({ subject = 'math' }: { subject?: 'math' | 'chinese' | 'english' }) {
  const nav = useNav()
  const pet = useStore((s) => s.pet)
  const levels = useStore((s) => s.levels)
  const wrong = useStore((s) => s.wrong)
  const food = useStore((s) => s.food)
  const points = useStore((s) => s.points)
  const attr = pet?.attrs[subject] ?? 0

  const dueWrong = wrong.filter((w) => w.subject === subject && !w.mastered && w.nextReviewDay <= nowDay())

  const levelList = LEVELS_BY_SUBJECT[subject]

  const locked = (l: LevelDef) => {
    if (l.boss) {
      const req = bossRequires(l)
      return !req.every((id) => (levels.find((x) => x.levelId === id)?.bestStars ?? 0) >= 2)
    }
    return attr < l.unlockAttr
  }

  const ordered = levelList

  return (
    <div className="pb-4">
      <CoinBar food={food} points={points} />

      <div className="mx-4 mt-1 flex gap-2">
        {(['math', 'chinese', 'english'] as const).map((k) => (
          <button
            key={k}
            onClick={() => nav.go('level', k)}
            className={`flex-1 rounded-2xl py-2.5 text-[15px] font-extrabold ${
              k === subject ? 'bg-sky-400 text-white shadow-card' : 'bg-white text-muted'
            }`}
          >
            {SUBJECT_LABEL[k]}
          </button>
        ))}
        <button
          onClick={() => nav.go('wrong', subject)}
          className="flex-1 rounded-2xl bg-white py-2.5 text-[15px] font-extrabold text-ink active:scale-[0.98]"
        >
          📕 错题集
          {dueWrong.length > 0 && <span className="ml-1 text-[11px] text-danger">{dueWrong.length}</span>}
        </button>
      </div>

      <div className="mx-4 mt-3 rounded-xl3 bg-white p-4 shadow-card">
        <div className="mb-2 text-[15px] font-extrabold text-ink">{SUBJECT_LABEL[subject]}关卡</div>
        {ordered.map((l) => {
          const rec = levels.find((x) => x.levelId === l.id)
          const isLocked = locked(l)
          const need = l.boss ? '前 5 关都要 2 星' : `${ATTR_LABEL[subject]}还差 ${Math.max(0, l.unlockAttr - attr)} 点`
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
                {[1, 2, 3].map((n) => (
                  <span key={n} className={(rec?.bestStars ?? 0) >= n ? 'text-amber-400' : 'text-slate-200'}>
                    ★
                  </span>
                ))}
              </span>
            </button>
          )
        })}
      </div>

      <div className="mx-4 mt-3 rounded-xl3 bg-white p-4 shadow-card">
        <div className="mb-2 text-[14px] font-extrabold text-ink">我的属性</div>
        <div className="flex justify-between text-[13px] font-bold">
          {(['math', 'chinese', 'english'] as const).map((k) => (
            <span key={k} className={k === subject ? 'text-sky-600' : 'text-slate-300'}>
              {ATTR_LABEL[k]} {pet?.attrs[k] ?? 0}
            </span>
          ))}
        </div>
        <div className="mt-2 text-[12px] text-muted">
          属性越高，血量越多、提示越多，还能解锁后面的关卡。单关限时 {BATTLE_LIMIT_MIN} 分钟。
        </div>
      </div>

    </div>
  )
}
