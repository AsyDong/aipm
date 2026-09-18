import type { Subject } from '../types'

// ============ PRD v0.4 定稿数值，集中在此，便于数值策划调整 ============

/** 每份食物 +20 饱食度 */
export const FOOD_PER_SATIETY = 20
/** 每日自然衰减 60（C3 裁决：从 100 下调，保证存在「健康维持」中间态） */
export const DAILY_DECAY = 60
/** 饱食度上限（100~120 显示「撑到了」） */
export const SATIETY_MAX = 120
/** 顶格判定线 */
export const SATIETY_FULL = 100
/**
 * 日投喂上限 5 份。
 * 2026-09-17 需求变更：体型机制移除，上限由 6 降到 5 —— 恰好是顶格线（100）所需份数，
 * 从此物理上喂不到「撑」。「第 6 份 → 肥胖」这条规则已不存在。
 */
export const FEED_LIMIT = 5
/** 维持成本：60 / 20 = 3 份/天 */
export const MAINTAIN_FOOD = DAILY_DECAY / FOOD_PER_SATIETY

/** 连击奖励（D1：一次性，仅在第 7 / 30 天当天发放） */
export const STREAK_7_FOOD = 1
export const STREAK_30_FOOD = 5

/** 每份食物经验（D2 数值策划填充：按 3 份/天 × 90 天 ≈ 满阶倒推） */
export const EXP_PER_FOOD = 10
/** 6 阶累计经验门槛，index 0 = Lv1 起点 */
export const STAGE_EXP = [0, 150, 400, 800, 1400, 2200]

/** 闯关积分：得几颗星就得几分（4 星 = 4 分），首次通关额外 +1 分 */
export const FIRST_CLEAR_BONUS = 1
/**
 * 属性提升：每答对 3 题 +1，单关上限 +3（答对 9~10 题拿满）
 * 关卡解锁门槛按「每关 +3」的节奏排布，正常发挥即可一路解锁，不用回头刷属性
 */
export const ATTR_PER_CORRECT = 3
export const ATTR_GAIN_CAP = 3
/** 关卡解锁属性门槛（与 MATH_LEVELS 顺序一一对应） */
export const ATTR_LADDER = [0, 3, 6, 9, 12, 15, 18, 21, 24, 27, 30, 33]

/** 血量 = 4 + floor(属性 / 5) */
export const baseHp = (attr: number) => 4 + Math.floor(attr / 5)
/** 提示次数 = floor(属性 / 10) + 1 */
export const hintCount = (attr: number) => Math.floor(attr / 10) + 1
/** 单关限时（分钟，防沉迷） */
export const BATTLE_LIMIT_MIN = 15
export const QUESTIONS_PER_LEVEL = 10
/** 未掌握错题注入下次同类关卡的道数 */
export const WRONG_INJECT = 2
/** 连续答对 N 次判定掌握 */
export const MASTER_STREAK = 3
/** 错题复习间隔（天） */
export const REVIEW_INTERVALS = [1, 3, 7, 15]
/** 兑换审批超时（天）→ 自动解冻 */
export const REDEEM_TIMEOUT_DAYS = 7

export const SUBJECT_LABEL: Record<Subject, string> = {
  math: '数学',
  chinese: '语文',
  english: '英语',
}
export const ATTR_LABEL: Record<Subject, string> = {
  math: '数学力',
  chinese: '语文力',
  english: '英语力',
}
export const STAGE_TITLE = ['幼崽', '小兽', '灵兽', '瑞兽', '圣兽', '神兽']

/** 快速通关线：限时内通关额外 +1 星（数学 2 分钟，语文/英语 5 分钟） */
export const FAST_CLEAR_MS: Record<Subject, number> = {
  math: 2 * 60_000,
  chinese: 5 * 60_000,
  english: 5 * 60_000,
}

/**
 * 星级：≥90% 3星 / ≥70% 2星 / ≥50% 1星 / 低于 50% 0 星视为未通关（基础最高 3 星）
 * 限时内通关（数学 2 分钟 / 语文英语 5 分钟）：额外 +1 星，总最高 4 星
 * 0 星时不发积分、不计通关、不解锁下一关（P08 结算页走「未通过」分支）
 */
export function starsOf(correct: number, total: number, durationMs?: number, subject: Subject = 'math'): number {
  if (total <= 0) return 0
  const r = correct / total
  if (r < 0.5) return 0
  const fast = durationMs !== undefined && durationMs <= FAST_CLEAR_MS[subject]
  if (r >= 0.9) return fast ? 4 : 3
  if (r >= 0.7) return fast ? 3 : 2
  return fast ? 2 : 1
}

export function stageOf(exp: number): number {
  let s = 1
  for (let i = 1; i < STAGE_EXP.length; i++) {
    if (exp >= STAGE_EXP[i]) s = i + 1
  }
  return s
}
