import { create } from 'zustand'
import { useEffect, type ReactNode } from 'react'
import { uid } from '../utils/id'
import Coin from './Coin'

// ============ Toast ============
interface ToastItem { id: string; msg: string; tone: 'ok' | 'warn' }
interface ToastState {
  items: ToastItem[]
  show: (msg: string, tone?: 'ok' | 'warn') => void
}
export const useToastStore = create<ToastState>((set) => ({
  items: [],
  show: (msg, tone = 'ok') => {
    const id = uid('t')
    set((s) => ({ items: [...s.items, { id, msg, tone }] }))
    setTimeout(() => set((s) => ({ items: s.items.filter((t) => t.id !== id) })), 2500)
  },
}))
export const toast = (msg: string, tone?: 'ok' | 'warn') => useToastStore.getState().show(msg, tone)

export function ToastLayer() {
  const items = useToastStore((s) => s.items)
  return (
    <div className="pointer-events-none fixed left-0 right-0 top-2 z-[100] flex flex-col items-center gap-2">
      {items.map((t) => (
        <div
          key={t.id}
          className={`animate-toastin rounded-full px-5 py-2.5 text-[15px] font-bold text-white shadow-pop ${
            t.tone === 'warn' ? 'bg-warn' : 'bg-sky-500'
          }`}
        >
          {t.msg}
        </div>
      ))}
    </div>
  )
}

// ============ Modal ============
export function Modal({
  open,
  title,
  children,
  onClose,
}: {
  open: boolean
  title?: string
  children: ReactNode
  onClose?: () => void
}) {
  useEffect(() => {
    if (!open) return
    const h = (e: KeyboardEvent) => e.key === 'Escape' && onClose?.()
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [open, onClose])
  if (!open) return null
  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-ink/40 px-6" onClick={onClose}>
      <div
        className="w-full max-w-[360px] animate-popin rounded-xl3 bg-white p-5 shadow-pop"
        onClick={(e) => e.stopPropagation()}
      >
        {title && <div className="mb-3 text-center text-[19px] font-extrabold text-ink">{title}</div>}
        {children}
      </div>
    </div>
  )
}

/** 二次确认弹窗（不可逆操作必弹，文案用孩子口吻） */
export function Confirm({
  open,
  title,
  desc,
  okText = '确定',
  cancelText = '再想想',
  danger,
  onOk,
  onCancel,
}: {
  open: boolean
  title: ReactNode
  desc?: string
  okText?: string
  cancelText?: string
  danger?: boolean
  onOk: () => void
  onCancel: () => void
}) {
  return (
    <Modal open={open} onClose={onCancel}>
      <div className="text-center text-[19px] font-extrabold text-ink">{title}</div>
      {desc && <div className="mt-2 text-center text-[14px] leading-relaxed text-muted">{desc}</div>}
      <div className="mt-5 flex gap-3">
        <button className="btn-sub" onClick={onCancel}>
          {cancelText}
        </button>
        <button
          className={`btn-main ${danger ? 'bg-danger' : ''}`}
          onClick={() => {
            onOk()
            onCancel()
          }}
        >
          {okText}
        </button>
      </div>
    </Modal>
  )
}

// ============ 币种胶囊 ============
export function CoinBar({ food, points }: { food: number; points: number }) {
  return (
    <div className="flex items-center justify-between px-4 py-2">
      <div className="flex items-center gap-1.5 rounded-full bg-white/90 px-3.5 py-1.5 shadow-card">
        <span className="text-[17px]">🍖</span>
        <span className="text-[16px] font-extrabold text-food">{food}</span>
      </div>
      <div className="flex items-center gap-1.5 rounded-full bg-white/90 px-3.5 py-1.5 shadow-card">
        <Coin size={18} />
        <span className={`text-[16px] font-extrabold ${points > 0 ? 'text-amber-500' : 'text-slate-300'}`}>{points}</span>
      </div>
    </div>
  )
}

// ============ 饱食度条 ============
export function SatietyBar({ value }: { value: number }) {
  const pct = Math.min(100, (value / 100) * 100)
  const over = value > 100
  const low = value <= 20
  const color = over ? 'bg-warn' : low ? 'bg-danger' : 'bg-ok'
  const label = over ? '撑到了' : low ? '饿了' : '饱食度'
  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-[13px] font-bold">
        <span className={over ? 'text-warn' : low ? 'text-danger' : 'text-muted'}>{label}</span>
        <span className={over ? 'text-warn' : low ? 'text-danger' : 'text-muted'}>{value} / 100</span>
      </div>
      <div className="h-3.5 w-full overflow-hidden rounded-full bg-sky-100">
        <div className={`h-full rounded-full ${color} transition-all duration-500`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}

// ============ 空状态 ============
export function Empty({ emoji, text, action }: { emoji: string; text: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-3 py-10 text-center">
      <div className="animate-floaty text-[56px]">{emoji}</div>
      <div className="text-[15px] font-bold text-muted">{text}</div>
      {action}
    </div>
  )
}
