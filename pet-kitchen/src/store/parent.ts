import { create } from 'zustand'

/** 家长模式解锁状态：离开家长页 5 分钟后自动重新上锁 */
const LOCK_MS = 5 * 60 * 1000

interface ParentState {
  unlockedAt: number
  fails: number
  lockedUntil: number
  unlock: () => void
  fail: () => void
  isUnlocked: () => boolean
  lock: () => void
}

export const useParent = create<ParentState>((set, get) => ({
  unlockedAt: 0,
  fails: 0,
  lockedUntil: 0,
  unlock: () => set({ unlockedAt: Date.now(), fails: 0, lockedUntil: 0 }),
  fail: () => {
    const fails = get().fails + 1
    set(fails >= 5 ? { fails: 0, lockedUntil: Date.now() + 5 * 60 * 1000 } : { fails })
  },
  isUnlocked: () => {
    const s = get()
    return s.unlockedAt > 0 && Date.now() - s.unlockedAt < LOCK_MS
  },
  lock: () => set({ unlockedAt: 0 }),
}))
