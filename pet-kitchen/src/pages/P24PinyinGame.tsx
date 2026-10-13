// ============ P24 拼音通用游戏页 ============
//
// 一个页面按 arg 分发四种模式（避免为每个小游戏各写一个页面）：
//   listen / char / blend → 练习小游戏（按已学范围出题，每答对 +1 积分）
//   follow                → 跟读擂台（ASR 评分）
//   lvl:pyN               → 关卡（走主应用结算：星级 / 积分 / 错题 / 语文力）
//   unit:N                → 单元测试（分数写拼音本地 testScores）

import { useMemo } from 'react'
import { useNav } from '../store/nav'
import { usePinyin } from '../pinyin/store'
import QuizRunner, { type Tone } from '../pinyin/QuizRunner'
import PinyinFollowRead from '../pinyin/FollowRead'
import { genLevelQuestions, genPractice, genTestQuestions, type QKind } from '../pinyin/quiz'
import { PW_LEVELS, PW_UNITS } from '../pinyin/data'
import { learnedLettersByDay, PLAN_DAYS } from '../pinyin/plan'

const PRACTICE: Record<string, { title: string; tone: Tone }> = {
  listen: { title: '🎧 听力挑战', tone: 'amber' },
  char: { title: '📖 识字挑战', tone: 'sky' },
  blend: { title: '🧩 拼装工坊', tone: 'violet' },
}

function Missing({ onBack }: { onBack: () => void }) {
  return (
    <div className="px-4 pb-8 pt-2">
      <button onClick={onBack} className="rounded-2xl bg-white px-3 py-2 text-[14px] font-extrabold text-muted">← 返回</button>
      <div className="mt-6 text-center text-[15px] font-bold text-muted">没有找到这个玩法 🙈</div>
    </div>
  )
}

export default function P24PinyinGame({ mode }: { mode: string }) {
  const nav = useNav()
  const plan = usePinyin((s) => s.plan)
  const day = Math.min(Math.max(plan.startDay, 1), PLAN_DAYS)
  const learned = useMemo(() => learnedLettersByDay(day), [day])

  if (mode === 'follow') return <PinyinFollowRead />

  if (PRACTICE[mode]) {
    const kind = mode as QKind
    const meta = PRACTICE[mode]
    return (
      <QuizRunner
        title={meta.title}
        sub={learned.size > 0 ? `已学范围（第 ${day} 天）：共 ${learned.size} 个拼音` : '自由模式 · 全部拼音'}
        gen={() => genPractice(kind, learned).qs}
        pointsPerCorrect={1}
        tone={meta.tone}
      />
    )
  }

  if (mode.startsWith('lvl:')) {
    // 调用方写法是 `lvl: py1`（冒号后有空格），必须 trim 掉再比，否则匹配不上
    const id = mode.slice(4).trim()
    const lvl = PW_LEVELS.find((l) => `py${l.id}` === id)
    if (!lvl) return <Missing onBack={() => nav.back()} />
    return (
      <QuizRunner
        title={`🏰 第${lvl.id}关 · ${lvl.name}`}
        sub={lvl.tip}
        gen={() => genLevelQuestions(lvl)}
        levelId={id}
        tone="emerald"
      />
    )
  }

  if (mode.startsWith('unit:')) {
    const uid = Number(mode.slice(5))
    const unit = PW_UNITS.find((u) => u.id === uid)
    if (!unit) return <Missing onBack={() => nav.back()} />
    return (
      <QuizRunner
        title={`📝 ${unit.name}测试`}
        sub="共 10 题 · 满分 100"
        gen={() => genTestQuestions(uid)}
        unit={uid}
        tone="emerald"
      />
    )
  }

  return <Missing onBack={() => nav.back()} />
}
