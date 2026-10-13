// ============ 拼音 → 主应用 桥接层（结算入口） ============
//
// 「全融入主应用」：拼音方块世界不再有自己的一套货币 / 星级 / 错题。
//   - 分数与星级 → 主应用 finishBattle（levels / points）
//   - 错题       → 主应用错题本（wrong），spec.kind 用 pyw_* 以便回放
//   - 属性成长   → 主应用宠物语文力（finishBattle 内部按 subject='chinese' 处理）
//
// 题目 → Question 的纯转换在 toApp.ts（不带 store 依赖，便于冒烟测试）。

import { useStore, type BattleResult } from '../store/useStore'
import type { Question as PyQuestion } from './quiz'
import { toAppQuestion } from './toApp'

export { specOf, toAppQuestion } from './toApp'

/**
 * 拼音闯关结算：写星级 / 积分 / 错题 / 语文力。
 * 与 P08Battle 走同一个 useStore.finishBattle，保证奖励口径完全一致。
 */
export function finishPinyinBattle(
  levelId: string,
  correct: number,
  total: number,
  wrongQs: PyQuestion[],
  durationMs = 0,
): BattleResult {
  return useStore
    .getState()
    .finishBattle('chinese', levelId, correct, total, wrongQs.map(toAppQuestion), durationMs)
}

/**
 * 拼音练习量上报（FE-09）：点读字母 / 答题 / 发音评测每练一个音报一次。
 * 主应用据此在「成长报告」里回答「今天拼音练了 N 个音」。
 */
export function notePinyinPractice(n = 1): void {
  useStore.getState().notePinyinPractice(n)
}

/**
 * 拼音打卡上报（FE-09）：21 天计划的每日打卡与主应用连击**合并计数** ——
 * 同一天里「完成每日任务」和「拼音打卡」只算一次连击（主应用内部去重）。
 * 返回 false = 今天已经打过卡（连击没重复加）。
 */
export function notePinyinCheckIn(): boolean {
  return useStore.getState().notePinyinCheckIn()
}
