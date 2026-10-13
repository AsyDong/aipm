// ============ 拼音本地进度（点读字母 / 21 天计划 / 单元测试分数） ============
//
// 「全融入主应用」的边界：
//   - 关卡星级、积分、错题 → 主应用（levels / points / wrong）
//   - 点读字母、21 天打卡计划、单元测试分数 → 拼音特有的学习行为，本应用没有对应概念，本地保留
// 存储与主应用分开（key 不同），互不覆盖。

import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { PLAN_DAYS } from './plan'

export interface DayRecord {
  /** 新知识已完成 */
  newDone: boolean
  /** 已勾选完成的复习日 */
  reviewsDone: number[]
  /** 错题巩固已勾选 */
  wrongDone: boolean
  /** 今日已打卡 */
  checked: boolean
  /** 打卡日期 YYYY-MM-DD */
  date: string
}

export interface PlanState {
  /** 计划进行到第几天（1-21） */
  startDay: number
  days: Record<number, DayRecord>
  streak: number
  bestStreak: number
  lastDate: string
}

interface PinyinState {
  /** 点读过的字母 */
  readLetters: string[]
  /** 单元测试分数（单元 id → 分数） */
  testScores: Record<number, number>
  plan: PlanState
  settings: { rate: number; volume: number }

  markLetterRead: (py: string) => void
  setTestScore: (unit: number, score: number) => void
  dayRec: (day: number) => DayRecord
  toggleReview: (day: number, reviewDay: number) => void
  setNewDone: (day: number, v: boolean) => void
  setWrongDone: (day: number, v: boolean) => void
  checkInToday: () => boolean
  changeDay: (n: number) => void
  setSettings: (p: Partial<{ rate: number; volume: number }>) => void
  reset: () => void
}

const todayStr = (d: Date = new Date()) => {
  const m = `${d.getMonth() + 1}`.padStart(2, '0')
  const dd = `${d.getDate()}`.padStart(2, '0')
  return `${d.getFullYear()}-${m}-${dd}`
}

const emptyRec = (): DayRecord => ({ newDone: false, reviewsDone: [], wrongDone: false, checked: false, date: '' })
const emptyPlan = (): PlanState => ({ startDay: 1, days: {}, streak: 0, bestStreak: 0, lastDate: '' })

export const usePinyin = create<PinyinState>()(
  persist(
    (set, get) => ({
      readLetters: [],
      testScores: {},
      plan: emptyPlan(),
      settings: { rate: 0.85, volume: 1 },

      markLetterRead: (py) =>
        set((s) => (s.readLetters.includes(py) ? s : { readLetters: [...s.readLetters, py] })),

      setTestScore: (unit, score) =>
        set((s) => ({
          testScores: { ...s.testScores, [unit]: Math.max(score, s.testScores[unit] ?? 0) },
        })),

      dayRec: (day) => {
        const cur = get().plan.days[day]
        if (cur) return cur
        const rec = emptyRec()
        set((s) => ({ plan: { ...s.plan, days: { ...s.plan.days, [day]: rec } } }))
        return rec
      },

      toggleReview: (day, reviewDay) => {
        get().dayRec(day)
        set((s) => {
          const rec = s.plan.days[day] ?? emptyRec()
          const done = rec.reviewsDone.includes(reviewDay)
            ? rec.reviewsDone.filter((d) => d !== reviewDay)
            : [...rec.reviewsDone, reviewDay]
          return { plan: { ...s.plan, days: { ...s.plan.days, [day]: { ...rec, reviewsDone: done } } } }
        })
      },

      setNewDone: (day, v) => {
        get().dayRec(day)
        set((s) => {
          const rec = s.plan.days[day] ?? emptyRec()
          return { plan: { ...s.plan, days: { ...s.plan.days, [day]: { ...rec, newDone: v } } } }
        })
      },

      setWrongDone: (day, v) => {
        get().dayRec(day)
        set((s) => {
          const rec = s.plan.days[day] ?? emptyRec()
          return { plan: { ...s.plan, days: { ...s.plan.days, [day]: { ...rec, wrongDone: v } } } }
        })
      },

      /** 完成今日打卡：更新连续天数；返回是否成功（今天已打过返回 false） */
      checkInToday: () => {
        const day = get().plan.startDay
        const rec = get().dayRec(day)
        if (rec.checked) return false
        const t = todayStr()
        const y = todayStr(new Date(Date.now() - 864e5))
        set((s) => {
          const streak = s.plan.lastDate === y ? s.plan.streak + 1 : 1
          const cur = s.plan.days[day] ?? emptyRec()
          return {
            plan: {
              ...s.plan,
              streak,
              bestStreak: Math.max(s.plan.bestStreak, streak),
              lastDate: t,
              days: { ...s.plan.days, [day]: { ...cur, checked: true, date: t } },
            },
          }
        })
        return true
      },

      changeDay: (n) =>
        set((s) => ({ plan: { ...s.plan, startDay: Math.min(Math.max(n, 1), PLAN_DAYS) } })),

      setSettings: (p) => set((s) => ({ settings: { ...s.settings, ...p } })),

      reset: () => set({ readLetters: [], testScores: {}, plan: emptyPlan(), settings: { rate: 0.85, volume: 1 } }),
    }),
    {
      name: 'pet-pinyin-v1',
      version: 1,
      partialize: (s) => ({ readLetters: s.readLetters, testScores: s.testScores, plan: s.plan, settings: s.settings }),
    },
  ),
)

export { todayStr }
