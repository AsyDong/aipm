/**
 * 防沉迷守卫（PRD §8）。
 *
 * 所有「开始新的一场」的入口都调 `enterGuard()`：
 * 放行返回 true，被限制则弹一句给孩子听的提示并返回 false。
 *
 * 单点收口的原因是入口太散 —— 版块地图（P07）、英语多游戏中心（P27）、
 * 拼音关卡地图（P25）、21 天计划（P26）各有自己的 onClick，
 * 漏一个孩子就能绕过去；`App.tsx` 里另有一层战斗页兜底。
 */
import { toast } from '../components/ui'
import { limitOf } from '../engine/limits'
import { useStore } from '../store/useStore'

export function enterGuard(): boolean {
  const r = limitOf(useStore.getState())
  if (!r.blocked) return true
  toast(r.reason)
  return false
}

/** 供页面展示「今日已玩 X / Y 场」，未设上限时 limit 为 0 */
export function todayLimitBrief(): { used: number; limit: number } {
  const r = limitOf(useStore.getState())
  return { used: r.used, limit: r.limit }
}
