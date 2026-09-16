import { create } from 'zustand'

export interface Route {
  page: string
  arg?: string
}

export type TabKey = 'home' | 'battle' | 'shop' | 'mine'
export const TABS: Array<{ key: TabKey; label: string; icon: string }> = [
  { key: 'home', label: '家园', icon: '🏡' },
  { key: 'battle', label: '闯关', icon: '⚔️' },
  { key: 'shop', label: '商店', icon: '🏪' },
  { key: 'mine', label: '我的', icon: '🙋' },
]

interface NavState {
  stack: Route[]
  go: (page: string, arg?: string) => void
  /** 替换栈顶：用于「离开后就回不去了」的跳转，如结算页跳错题集 */
  replace: (page: string, arg?: string) => void
  back: () => void
  tab: (t: TabKey) => void
}

export const useNav = create<NavState>((set) => ({
  stack: [{ page: 'home' }],
  go: (page, arg) => set((s) => ({ stack: [...s.stack, { page, arg }] })),
  replace: (page, arg) => set((s) => ({ stack: [...s.stack.slice(0, -1), { page, arg }] })),
  back: () => set((s) => ({ stack: s.stack.length > 1 ? s.stack.slice(0, -1) : s.stack })),
  tab: (t) => set({ stack: [{ page: t }] }),
}))

export function currentTab(): TabKey {
  const root = useNav.getState().stack[0]?.page as TabKey
  return (['home', 'battle', 'shop', 'mine'] as string[]).includes(root) ? root : 'home'
}
