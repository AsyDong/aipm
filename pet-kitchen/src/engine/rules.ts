import type { AttrKey, Subject } from '../types'

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

/**
 * 连击奖励。**NUM-03 决策：保持「一次性」，不做持续发放**。
 *
 * 理由：第 7 / 30 天是**里程碑**，不是日常收益。若第 7 天之后每天都发，
 * 里程碑就被摊平成日常，激励迅速钝化（边际递减），还会造成食物通胀、
 * 削弱每日任务本身的必要性。里程碑 + streak 数字本身的荣誉感，激励更健康。
 * 将来若要给后期加盼头，应**新增更高的里程碑**（如 60 / 100 天），
 * 而不是把已有的改成持续发放。
 */
export const STREAK_7_FOOD = 1
export const STREAK_30_FOOD = 5

/**
 * 每份食物经验。
 *
 * 注意：每天实际能喂几份由**饱食度**决定，不是日上限 5 份 ——
 * 日衰减 60（= 3 份）、上限 120（= 6 份），所以稳态就是「每天喂 3 份正好回满」。
 * 于是养成节奏 = 3 份/天 × 10 经验 = **30 经验/天**（NUM-01 的推导基准）。
 */
export const EXP_PER_FOOD = 10
/**
 * 6 阶累计经验门槛，index 0 = Lv1 起点。
 *
 * 按「约 3 个月（90 天）满阶」倒推：90 天 × 30 经验 = **2700**，
 * 再把 2700 拆成递增的 5 段（越往后越慢：前期给足成就感，后期拉长生命周期）：
 *   幼崽→小兽 200（≈7 天） · 小兽→灵兽 350（≈12 天） · 灵兽→瑞兽 550（≈18 天）
 *   瑞兽→圣兽 700（≈23 天） · 圣兽→神兽 900（≈30 天）
 * 合计 2700 经验 = 90 天 = 3 个月。
 */
export const STAGE_EXP = [0, 200, 550, 1100, 1800, 2700]

/** 闯关积分：得几颗星就得几分（4 星 = 4 分），首次通关额外 +1 分 */
export const FIRST_CLEAR_BONUS = 1
/**
 * 奖励定价参考（NUM-02）。
 *
 * 积分产出会随「新关耗尽」明显下降 —— 重复通关每关最多只算 1 分（防刷分设计），
 * 所以产出不是恒定的：
 *   前期：每天约 3 关首通 × 4 分 ≈ 12 分
 *   后期：新关都玩完后，每天约 4 分
 * 家长端按这两个数给出「这个价大概要攒多久」的区间提示，
 * 免得把大额奖品定成永远攒不到的数字。
 */
export const AVG_POINTS_PER_DAY_EARLY = 12
export const AVG_POINTS_PER_DAY_LATE = 4
/**
 * 属性提升：每答对 3 题 +1，单关上限 +3（答对 9~10 题拿满）
 * 关卡解锁门槛按「每关 +3」的节奏排布，正常发挥即可一路解锁，不用回头刷属性
 */
export const ATTR_PER_CORRECT = 3
export const ATTR_GAIN_CAP = 3
/** 关卡解锁属性门槛（与 MATH_LEVELS 顺序一一对应） */
export const ATTR_LADDER = [0, 3, 6, 9, 12, 15, 18, 21, 24, 27, 30, 33]

/**
 * 血量 = 5 + floor(属性 / 10)，上限 7（Boss 对战设计建议 v0.1 §4.2）。
 * 属性加成温和（≤ +40%）：属性滚雪球后 Boss 仍要有威胁，张力不能塌。
 */
export const baseHp = (attr: number) => Math.min(5 + Math.floor(attr / 10), 7)
/** 提示次数 = floor(属性 / 10) + 1，上限 3（同上 §4.2） */
export const hintCount = (attr: number) => Math.min(3, Math.floor(attr / 10) + 1)
/** 单关限时（分钟，防沉迷） */
export const BATTLE_LIMIT_MIN = 15
export const QUESTIONS_PER_LEVEL = 10

// ============ Boss 对战（设计建议 v0.1 §4，数值未 playtest，都是占位） ============

/** Boss 总血量：答对 9 题（倍率 1.0）即可击杀 —— 0.9 系数 = 容错 1 题，首通率目标 60~80% */
export const BOSS_MAX_HP = 90
/** 每答对一题的基础伤害（Boss 血量的 10%），乘以属性倍率后取整 */
export const BOSS_HIT = 10
/** 伤害倍率 0.8 ~ 2.0×：属性 0 → 0.8×，属性 ≥30 → 2.0×（数学力归一化） */
export function bossDamageMult(attr: number) {
  return 0.8 + 1.2 * Math.min(1, attr / 30)
}
/** 单击伤害 = BOSS_HIT × 倍率（取整） */
export function bossDamage(attr: number) {
  return Math.round(BOSS_HIT * bossDamageMult(attr))
}
/** 破盾线：Boss 血量 ≤ 60% 举起护盾，下一次答对 = 双倍伤害打碎 */
export const BOSS_SHIELD_AT = 0.6
/** 狂暴线：Boss 血量 ≤ 25% 进入狂暴，每题限时 */
export const BOSS_RAGE_AT = 0.25
/** 狂暴每题倒计时（秒）。归零视为答错 —— 只惩罚走神，不惩罚思考慢 */
export const BOSS_RAGE_SECONDS = 10
/** 连错保护：同场连错 N 题 → 下一题自动附带提示（本场只送一次） */
export const STREAK_WRONG_MERCY = 2
/** 每日 Boss 首胜：当天第一场 Boss 胜利，积分 ×1.5（当日一次性，防刷分三件套之一） */
export const DAILY_BOSS_BONUS = 1.5
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
  mixed: '综合',
}
export const ATTR_LABEL: Record<Subject, string> = {
  math: '数学力',
  chinese: '语文力',
  english: '英语力',
  mixed: '综合力',
}
export const STAGE_TITLE = ['幼崽', '小兽', '灵兽', '瑞兽', '圣兽', '神兽']

/** 快速通关线：限时内通关额外 +1 星（数学 2 分钟，语文/英语 5 分钟） */
export const FAST_CLEAR_MS: Record<Subject, number> = {
  math: 2 * 60_000,
  chinese: 5 * 60_000,
  english: 5 * 60_000,
  mixed: 5 * 60_000,
}

/** 三科属性的键序（综合关摊成长时按这个顺序轮转） */
export const ATTR_KEYS: AttrKey[] = ['math', 'chinese', 'english']

/**
 * 取某学科对应的属性值。
 * 综合关没有自己的属性，用三科均值当它的「实力」—— 血量/提示次数等仍要有个数。
 */
export function attrOf(attrs: Partial<Record<AttrKey, number>>, s: Subject): number {
  if (s !== 'mixed') return attrs[s] ?? 0
  const sum = ATTR_KEYS.reduce((n, k) => n + (attrs[k] ?? 0), 0)
  return Math.floor(sum / ATTR_KEYS.length)
}

/**
 * 属性成长落地。综合关把 gain 轮转摊到三科（总量不变，避免三科各加一份变成刷属性漏洞）。
 * 单科关就是把 gain 加到自己那一科，与旧行为完全一致。
 */
export function gainAttrs(
  attrs: Record<AttrKey, number>,
  s: Subject,
  gain: number,
): Record<AttrKey, number> {
  if (gain <= 0) return attrs
  if (s !== 'mixed') return { ...attrs, [s]: (attrs[s] ?? 0) + gain }
  const next = { ...attrs }
  for (let i = 0; i < gain; i++) {
    const k = ATTR_KEYS[i % ATTR_KEYS.length]
    next[k] = (next[k] ?? 0) + 1
  }
  return next
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
