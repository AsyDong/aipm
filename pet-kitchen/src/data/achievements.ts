import type { LevelRecord } from '../types'
import { levelById } from '../engine/questions'

/**
 * 成就（FE-06 / PRD P2）。
 *
 * 三条设计原则：
 *   ① 只做「孩子自己能理解」的成就 —— 名字短、图标直观、条件一句话说得清
 *   ② 目标分层：入门（1 关）→ 中程（10 / 30 关）→ 长线（30 天 / 满阶），
 *      让孩子在第 1 天、第 1 周、第 1 个月都有新东西可拿
 *   ③ 判定是**纯函数**：喂一个状态快照、返回是否达成，与 store 解耦、可单测
 *
 * 未解锁的成就**不隐藏**（显示成灰色 + 进度），让孩子知道下一步能拿什么 ——
 * 隐藏型成就对低龄孩子只有挫败感，没有惊喜。
 */
export interface AchievementCtx {
  levels: LevelRecord[]
  owned: string[]
  /** 宠物当前阶（1–6） */
  stage: number
  /** 历史最长连续打卡（断签不清零，成就一旦拿到就不再失去） */
  longestStreak: number
  /** 累计掌握的错题数 */
  wrongSolvedTotal: number
}

export interface Achievement {
  id: string
  icon: string
  name: string
  desc: string
  /** 达成即解锁 */
  test: (c: AchievementCtx) => boolean
  /** 进度 [当前, 目标]，用于展示「还差多少」 */
  progress: (c: AchievementCtx) => [number, number]
}

const clearedCount = (c: AchievementCtx) => c.levels.filter((l) => l.cleared).length
const bossCleared = (c: AchievementCtx) => c.levels.filter((l) => l.cleared && !!levelById(l.levelId)?.boss).length

export const ACHIEVEMENTS: Achievement[] = [
  {
    id: 'first_battle',
    icon: '🎯',
    name: '初次出征',
    desc: '完成第 1 个关卡',
    test: (c) => c.levels.length >= 1,
    progress: (c) => [Math.min(c.levels.length, 1), 1],
  },
  {
    id: 'stars_4',
    icon: '⭐',
    name: '满分小将',
    desc: '某一关拿到 4 颗星',
    test: (c) => c.levels.some((l) => l.bestStars >= 4),
    progress: (c) => [c.levels.some((l) => l.bestStars >= 4) ? 1 : 0, 1],
  },
  {
    id: 'boss_1',
    icon: '👑',
    name: '首领克星',
    desc: '击败 1 个首领关',
    test: (c) => bossCleared(c) >= 1,
    progress: (c) => [Math.min(bossCleared(c), 1), 1],
  },
  {
    id: 'boss_3',
    icon: '🏆',
    name: '三战三捷',
    desc: '击败 3 个首领关',
    test: (c) => bossCleared(c) >= 3,
    progress: (c) => [Math.min(bossCleared(c), 3), 3],
  },
  {
    id: 'clear_10',
    icon: '🧭',
    name: '十关通',
    desc: '通关 10 个关卡',
    test: (c) => clearedCount(c) >= 10,
    progress: (c) => [Math.min(clearedCount(c), 10), 10],
  },
  {
    id: 'clear_30',
    icon: '🗺️',
    name: '三十关通',
    desc: '通关 30 个关卡',
    test: (c) => clearedCount(c) >= 30,
    progress: (c) => [Math.min(clearedCount(c), 30), 30],
  },
  {
    id: 'wrong_10',
    icon: '🧹',
    name: '错题清道夫',
    desc: '掌握 10 道错题',
    test: (c) => c.wrongSolvedTotal >= 10,
    progress: (c) => [Math.min(c.wrongSolvedTotal, 10), 10],
  },
  {
    id: 'wrong_50',
    icon: '🛡️',
    name: '错题终结者',
    desc: '掌握 50 道错题',
    test: (c) => c.wrongSolvedTotal >= 50,
    progress: (c) => [Math.min(c.wrongSolvedTotal, 50), 50],
  },
  {
    id: 'streak_3',
    icon: '📅',
    name: '三日不辍',
    desc: '连续打卡 3 天',
    test: (c) => c.longestStreak >= 3,
    progress: (c) => [Math.min(c.longestStreak, 3), 3],
  },
  {
    id: 'streak_7',
    icon: '🔥',
    name: '一周坚持',
    desc: '连续打卡 7 天',
    test: (c) => c.longestStreak >= 7,
    progress: (c) => [Math.min(c.longestStreak, 7), 7],
  },
  {
    id: 'streak_30',
    icon: '🌙',
    name: '满月之星',
    desc: '连续打卡 30 天',
    test: (c) => c.longestStreak >= 30,
    progress: (c) => [Math.min(c.longestStreak, 30), 30],
  },
  {
    id: 'stage_3',
    icon: '🐾',
    name: '灵兽初成',
    desc: '宠物长到 3 阶',
    test: (c) => c.stage >= 3,
    progress: (c) => [Math.min(c.stage, 3), 3],
  },
  {
    id: 'stage_6',
    icon: '✨',
    name: '神兽降临',
    desc: '宠物满阶（6 阶）',
    test: (c) => c.stage >= 6,
    progress: (c) => [Math.min(c.stage, 6), 6],
  },
  {
    id: 'decor_5',
    icon: '🛋️',
    name: '小小设计师',
    desc: '拥有 5 件家园装饰',
    test: (c) => c.owned.length >= 5,
    progress: (c) => [Math.min(c.owned.length, 5), 5],
  },
]

/** 已解锁数量（给「我的」页的入口显示进度用） */
export function unlockedCount(ids: string[]): number {
  const got = new Set(ids)
  return ACHIEVEMENTS.filter((a) => got.has(a.id)).length
}
