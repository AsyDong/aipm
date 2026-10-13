// ============ P27 英语版块 · 多游戏中心 ============
//
// 对齐拼音版块的形式：英语也做成「游戏宫格」。
//   课本：🎤 跟读评分（18 关，走 P18 讯飞评测）+ 📚 认读巩固（9 关，走 P08）
//   牛津树：🃏 闪卡速记（原「闪卡速记」关卡，内容与玩法保持不变）
//   新增：🎧 听音选词（播放英文发音 4 选 1，素材取自课本跟读库）

import { useState } from 'react'
import { useNav } from '../store/nav'
import { useStore } from '../store/useStore'
import { CoinBar } from '../components/ui'
import {
  BOSS_META, EN_OXFORD_LEVELS, EN_QUIZ_LEVELS, EN_READ_LEVELS,
  bossRequires, pageOfLevel, type LevelDef,
} from '../engine/questions'
import { ATTR_LABEL, BATTLE_LIMIT_MIN, attrOf } from '../engine/rules'
import { nowDay } from '../engine/time'

type View = 'hub' | 'read' | 'quiz' | 'oxford'

export default function P27EnglishHub() {
  const nav = useNav()
  const levels = useStore((s) => s.levels)
  const wrong = useStore((s) => s.wrong)
  const pet = useStore((s) => s.pet)
  const food = useStore((s) => s.food)
  const points = useStore((s) => s.points)
  const [view, setView] = useState<View>('hub')

  const attr = attrOf(pet?.attrs ?? {}, 'english')
  const recOf = (id: string) => levels.find((r) => r.levelId === id)

  const progress = (list: LevelDef[]) => {
    const cleared = list.filter((l) => recOf(l.id)?.cleared).length
    const stars = list.reduce((n, l) => n + (recOf(l.id)?.bestStars ?? 0), 0)
    return { cleared, total: list.length, stars }
  }

  const dueWrong = wrong.filter((w) => w.subject === 'english' && !w.mastered && w.nextReviewDay <= nowDay()).length

  if (view === 'hub') {
    const cards = [
      {
        key: 'enlisten', icon: '🎧', title: '听音选词', desc: '播放英文发音，选出正确单词',
        tint: 'bg-emerald-50', ring: 'ring-emerald-100', stat: null as string | null, onClick: () => nav.go('enlisten'),
      },
      {
        key: 'read', icon: '🎤', title: '跟读评分', desc: '课本 · 词 → 短语 → 句，录音评分',
        tint: 'bg-violet-50', ring: 'ring-violet-100', stat: statText(progress(EN_READ_LEVELS)), onClick: () => setView('read'),
      },
      {
        key: 'quiz', icon: '📚', title: '认读巩固', desc: '课本 · 单元词汇与句型选择',
        tint: 'bg-sky-50', ring: 'ring-sky-100', stat: statText(progress(EN_QUIZ_LEVELS)), onClick: () => setView('quiz'),
      },
      {
        key: 'oxford', icon: '🃏', title: '牛津树闪卡', desc: '剑桥预备级 · 看图认词速记',
        tint: 'bg-amber-50', ring: 'ring-amber-100', stat: statText(progress(EN_OXFORD_LEVELS)), onClick: () => setView('oxford'),
      },
    ]

    return (
      <div className="pb-4">
        <CoinBar food={food} points={points} />
        <div className="mx-4 mt-1 flex items-center gap-2">
          <button onClick={() => nav.replace('battle')} className="rounded-2xl bg-white px-3 py-2 text-[14px] font-extrabold text-muted active:scale-[0.98]">← 版块</button>
          <div className="flex-1 rounded-2xl bg-violet-50 px-3 py-2 ring-1 ring-violet-100">
            <span className="text-[15px] font-extrabold text-ink">🔤 英语</span>
            <span className="ml-2 text-[12px] font-bold text-muted">英语力 {attr}</span>
          </div>
          <button onClick={() => nav.go('wrong', 'english')} className="rounded-2xl bg-white px-3 py-2 text-[14px] font-extrabold text-ink active:scale-[0.98]">
            📕 错题{dueWrong > 0 && <span className="ml-1 text-[11px] text-danger">{dueWrong}</span>}
          </button>
        </div>

        <div className="mx-4 mt-3 grid grid-cols-2 gap-3">
          {cards.map((c) => (
            <button
              key={c.key}
              onClick={c.onClick}
              className={`flex flex-col items-start rounded-xl3 px-4 py-4 text-left ring-1 active:scale-[0.98] ${c.tint} ${c.ring}`}
            >
              <span className="text-[30px]">{c.icon}</span>
              <span className="mt-1 text-[16px] font-extrabold text-ink">{c.title}</span>
              <span className="mt-0.5 text-[12px] leading-snug text-muted">{c.desc}</span>
              {c.stat && <span className="mt-2 text-[11px] font-bold text-muted">{c.stat}</span>}
            </button>
          ))}
        </div>
      </div>
    )
  }

  // 关卡列表（跟读 / 认读 / 闪卡）
  const meta = {
    read: { label: '🎤 跟读评分 · 词 → 短语 → 句', list: EN_READ_LEVELS },
    quiz: { label: '📚 认读巩固 · 单元词汇与句型', list: EN_QUIZ_LEVELS },
    oxford: { label: '🃏 剑桥预备级电子闪卡', list: EN_OXFORD_LEVELS },
  }[view]

  const locked = (l: LevelDef) => {
    if (l.boss) {
      const req = bossRequires(l)
      return req.length > 0 && !req.every((id) => (recOf(id)?.bestStars ?? 0) >= 2)
    }
    return attr < l.unlockAttr
  }

  return (
    <div className="pb-4">
      <CoinBar food={food} points={points} />
      <div className="mx-4 mt-1 flex items-center gap-2">
        <button onClick={() => setView('hub')} className="rounded-2xl bg-white px-3 py-2 text-[14px] font-extrabold text-muted active:scale-[0.98]">← 英语</button>
        <div className="flex-1 rounded-2xl bg-violet-50 px-3 py-2 ring-1 ring-violet-100">
          <span className="text-[14px] font-extrabold text-ink">{meta.label}</span>
        </div>
      </div>

      <div className="mx-4 mt-3 rounded-xl3 bg-white p-4 shadow-card">
        {meta.list.map((l) => {
          const rec = recOf(l.id)
          const isLocked = locked(l)
          const icon = rec?.cleared ? '✅' : isLocked ? '🔒' : l.play === 'read' ? '🎤' : l.boss ? '👑' : '⚔️'
          return (
            <button
              key={l.id}
              disabled={isLocked}
              onClick={() => nav.go(pageOfLevel(l), l.id)}
              className={`mb-2 flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left ${
                l.boss ? 'bg-amber-50' : l.play === 'read' ? 'bg-violet-50' : 'bg-sky-50'
              } ${isLocked ? 'opacity-55' : 'active:scale-[0.98]'}`}
            >
              <span className="text-[22px]">{icon}</span>
              <span className="flex-1">
                <span className="block text-[15px] font-extrabold text-ink">
                  {l.boss ? `${l.name}${BOSS_META[l.id] ? ` · ${BOSS_META[l.id].name}` : ''}` : `第${l.index}关 · ${l.name}`}
                </span>
                <span className="block text-[12px] text-muted">
                  {isLocked ? `${ATTR_LABEL.english}还差 ${Math.max(0, l.unlockAttr - attr)} 点` : `知识点：${l.skill}`}
                </span>
              </span>
              <span className="text-[13px]">
                {[1, 2, 3, 4].map((n) => (
                  <span key={n} className={(rec?.bestStars ?? 0) >= n ? 'text-amber-400' : 'text-slate-200'}>★</span>
                ))}
              </span>
            </button>
          )
        })}
        <div className="mt-1 text-[12px] text-muted">单关限时 {BATTLE_LIMIT_MIN} 分钟；跟读关需麦克风权限。</div>
      </div>
    </div>
  )
}

function statText(p: { cleared: number; total: number; stars: number }) {
  return `${p.cleared}/${p.total} 关 · ${p.stars}★`
}
