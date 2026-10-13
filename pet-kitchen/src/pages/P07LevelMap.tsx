import { useStore } from '../store/useStore'
import { useNav } from '../store/nav'
import { CoinBar } from '../components/ui'
import {
  BOSS_META, LEVELS_BY_SECTION, SECTIONS, SECTION_ATTR,
  bossRequires, pageOfLevel, type LevelDef, type SectionMeta,
} from '../engine/questions'
import { ATTR_KEYS, ATTR_LABEL, BATTLE_LIMIT_MIN, attrOf } from '../engine/rules'
import { nowDay } from '../engine/time'
import type { AttrKey, Section, Subject } from '../types'
import P20PinyinHub from './P20PinyinHub'
import P27EnglishHub from './P27EnglishHub'

/** 综合版块走「全部学科」的错题口子；其余版块按自己的学科筛 */
function wrongSubjectOf(section: Section): Subject | 'all' {
  return section === 'mixed' ? 'all' : (SECTION_ATTR[section] as Subject)
}

/** 进入版块后顶部显示的「关卡数 / 已通关数」 */
function progressOf(levels: LevelDef[], records: { levelId: string; cleared: boolean; bestStars: number }[]) {
  const cleared = levels.filter((l) => records.find((r) => r.levelId === l.id)?.cleared).length
  const stars = levels.reduce((n, l) => n + (records.find((r) => r.levelId === l.id)?.bestStars ?? 0), 0)
  return { cleared, total: levels.length, stars }
}

/**
 * P07 闯关
 *
 * 2026-10-12 改版：进去先看 **5 个版块**（拼音 / 数学 / 英语 / 识字 / 综合）。
 * 拼音与英语各自是「多游戏中心」（P20 / P27），数学 / 识字 / 综合仍是关卡列表。
 *
 * 传 section 参数就是「已在地图里」，不传就是版块中心 —— 用 nav.replace 原地切，
 * 不压栈（压栈会让 stack.length 变 2，底部 TabBar 就消失了）。
 */
export default function P07LevelMap({ section }: { section?: Section }) {
  const nav = useNav()
  const pet = useStore((s) => s.pet)
  const levels = useStore((s) => s.levels)
  const wrong = useStore((s) => s.wrong)
  const food = useStore((s) => s.food)
  const points = useStore((s) => s.points)

  if (!section) {
    return <SectionHub food={food} points={points} levels={levels} wrong={wrong} />
  }

  // 拼音 / 英语：多游戏中心（各自独立页面，内容与原应用一一对应）
  if (section === 'pinyin') return <P20PinyinHub />
  if (section === 'english') return <P27EnglishHub />

  const meta = SECTIONS.find((s) => s.id === section)!
  const subject = SECTION_ATTR[section]
  const attr = attrOf(pet?.attrs ?? {}, subject)
  const wrongSubject = wrongSubjectOf(section)
  const dueWrong = wrong.filter(
    (w) => !w.mastered && w.nextReviewDay <= nowDay() && (wrongSubject === 'all' || w.subject === wrongSubject),
  )

  const list = LEVELS_BY_SECTION[section]
  const prog = progressOf(list, levels)

  const locked = (l: LevelDef) => {
    if (l.boss) {
      const req = bossRequires(l)
      return req.length > 0 && !req.every((id) => (levels.find((x) => x.levelId === id)?.bestStars ?? 0) >= 2)
    }
    return attr < l.unlockAttr
  }

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
        <div className={`flex-1 rounded-2xl px-3 py-2 ring-1 ${meta.tint} ${meta.ring}`}>
          <span className="text-[15px] font-extrabold text-ink">{meta.emoji} {meta.name}</span>
          <span className="ml-2 text-[12px] font-bold text-muted">
            {prog.cleared}/{prog.total} 关 · {prog.stars}★
          </span>
        </div>
        <button
          onClick={() => nav.go('wrong', wrongSubject)}
          className="rounded-2xl bg-white px-3 py-2 text-[14px] font-extrabold text-ink active:scale-[0.98]"
        >
          📕 错题
          {dueWrong.length > 0 && <span className="ml-1 text-[11px] text-danger">{dueWrong.length}</span>}
        </button>
      </div>

      <div className="mx-4 mt-3 rounded-xl3 bg-white p-4 shadow-card">
        <div className="mb-2 text-[15px] font-extrabold text-ink">{meta.emoji} {meta.name}关卡</div>
        {list.map((l) => {
          const rec = levels.find((x) => x.levelId === l.id)
          const isLocked = locked(l)
          const need = `${ATTR_LABEL[subject]}还差 ${Math.max(0, l.unlockAttr - attr)} 点`
          const icon = rec?.cleared ? '✅' : isLocked ? '🔒' : l.boss ? '👑' : '⚔️'
          return (
            <button
              key={l.id}
              disabled={isLocked}
              onClick={() => nav.go(pageOfLevel(l), l.id)}
              className={`mb-2 flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left ${
                l.boss ? 'bg-amber-50' : 'bg-sky-50'
              } ${isLocked ? 'opacity-55' : 'active:scale-[0.98]'}`}
            >
              <span className="text-[22px]">{icon}</span>
              <span className="flex-1">
                <span className="block text-[15px] font-extrabold text-ink">
                  {l.boss
                    ? `${l.name}${BOSS_META[l.id] ? ` · ${BOSS_META[l.id].name}` : ''}`
                    : `第${l.index}关 · ${l.name}`}
                </span>
                <span className="block text-[12px] text-muted">
                  {isLocked ? need : `知识点：${l.skill}`}
                </span>
              </span>
              <span className="text-[13px]">
                {[1, 2, 3, 4].map((n) => (
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
          {ATTR_KEYS.map((k: AttrKey) => (
            <span key={k} className={k === subject ? 'text-sky-600' : 'text-slate-300'}>
              {ATTR_LABEL[k]} {pet?.attrs[k] ?? 0}
            </span>
          ))}
        </div>
        <div className="mt-2 text-[12px] text-muted">
          {subject === 'mixed'
            ? `综合关四科混着出，属性成长会摊到三科上（当前按三科均值 ${attr} 解锁）。`
            : `属性越高，血量越多、提示越多，还能解锁后面的关卡。`}
          单关限时 {BATTLE_LIMIT_MIN} 分钟。
        </div>
      </div>
    </div>
  )
}

/** 版块中心：5 张卡片，是「进闯关」看到的第一屏 */
function SectionHub({
  food, points, levels, wrong,
}: {
  food: number
  points: number
  levels: { levelId: string; cleared: boolean; bestStars: number }[]
  wrong: { subject: string; mastered: boolean; nextReviewDay: string }[]
}) {
  const nav = useNav()
  const today = nowDay()

  const statOf = (meta: SectionMeta) => {
    const list = LEVELS_BY_SECTION[meta.id]
    const p = progressOf(list, levels)
    const due = wrong.filter(
      (w) =>
        !w.mastered &&
        w.nextReviewDay <= today &&
        (meta.id === 'mixed' ? true : w.subject === SECTION_ATTR[meta.id]),
    ).length
    return { ...p, due }
  }

  return (
    <div className="pb-4">
      <CoinBar food={food} points={points} />

      <div className="mx-4 mt-1 rounded-xl3 bg-gradient-to-br from-sky-100 to-white px-4 py-4 shadow-card">
        <div className="text-[19px] font-extrabold text-ink">今天闯哪个？</div>
        <div className="mt-1 text-[13px] text-muted">
          五个版块各管一条线：拼音是一整套拼音世界，英语分课本和牛津树，综合把四科混起来复习。
        </div>
      </div>

      <div className="mx-4 mt-3 grid grid-cols-2 gap-3">
        {SECTIONS.map((meta) => {
          const st = statOf(meta)
          const pct = st.total > 0 ? Math.round((st.cleared / st.total) * 100) : 0
          return (
            <button
              key={meta.id}
              // 原地 replace 而不是 go：压栈会让 stack.length 变 2，底部 TabBar 就没了
              onClick={() => nav.replace('battle', meta.id)}
              className={`relative flex flex-col items-start rounded-xl3 px-4 py-4 text-left ring-1 active:scale-[0.98] ${meta.tint} ${meta.ring}`}
            >
              {!!st.due && (
                <span className="absolute right-3 top-3 rounded-full bg-danger px-1.5 py-0.5 text-[11px] font-extrabold text-white">
                  {st.due}
                </span>
              )}
              <span className="text-[30px]">{meta.emoji}</span>
              <span className="mt-1 text-[17px] font-extrabold text-ink">{meta.name}</span>
              <span className="mt-0.5 text-[12px] leading-snug text-muted">{meta.desc}</span>
              <span className="mt-2 w-full">
                <span className="block h-1.5 w-full overflow-hidden rounded-full bg-white/70">
                  <span className="block h-full rounded-full bg-sky-400" style={{ width: `${pct}%` }} />
                </span>
                <span className="mt-1 block text-[11px] font-bold text-muted">
                  {st.cleared}/{st.total} 关 · {st.stars}★
                </span>
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
