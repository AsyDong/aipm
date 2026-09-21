import { useEffect, useState } from 'react'

const DIGITS = ['1', '2', '3', '4', '5', '6', '7', '8', '9']
/** 答案最大 99（100 以内加减 / 连加连减），3 位足够，顺便挡住乱按 */
const MAX_LEN = 3

/**
 * 大按钮数字键盘：1-9 / 删除 / 0 / 确定。
 * 不用原生 input —— 手机上系统键盘会顶起页面盖住题干，且小孩按不准。
 * 桌面端同时支持物理键盘：数字键输入、Backspace 删除、Enter 提交。
 */
export function AnswerPad({
  value,
  onChange,
  onSubmit,
  disabled,
  compact,
}: {
  value: string
  onChange: (v: string) => void
  onSubmit: () => void
  disabled?: boolean
  compact?: boolean
}) {
  const push = (d: string) => {
    if (disabled || value.length >= MAX_LEN) return
    // 前导 0 直接替换，避免出现 "05"
    onChange(value === '0' ? d : value + d)
  }
  const back = () => {
    if (!disabled) onChange(value.slice(0, -1))
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (disabled) return
      if (/^[0-9]$/.test(e.key)) {
        e.preventDefault()
        push(e.key)
      } else if (e.key === 'Backspace') {
        e.preventDefault()
        back()
      } else if (e.key === 'Enter') {
        e.preventDefault()
        if (value) onSubmit()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  const h = compact ? 'h-[46px] text-[22px]' : 'h-[56px] text-[26px]'
  const base = `${h} rounded-2xl font-extrabold shadow-card transition active:scale-[0.95] disabled:opacity-40`

  return (
    <div className="grid grid-cols-3 gap-2">
      {DIGITS.map((d) => (
        <button key={d} className={`${base} bg-white text-sky-600`} onClick={() => push(d)} disabled={disabled}>
          {d}
        </button>
      ))}
      <button className={`${base} bg-white text-muted`} onClick={back} disabled={disabled || !value}>
        ⌫
      </button>
      <button className={`${base} bg-white text-sky-600`} onClick={() => push('0')} disabled={disabled}>
        0
      </button>
      <button className={`${base} bg-sky-400 text-white`} onClick={onSubmit} disabled={disabled || !value}>
        确 定
      </button>
    </div>
  )
}

/** 图片选项（看词选图）：图片挂了用中文兜底，题仍可作答 */
export interface PicOption {
  word: string
  src: string
  zh: string
}

function PicCell({ o, onPick, disabled }: { o: PicOption; onPick: (choice: string) => void; disabled?: boolean }) {
  const [err, setErr] = useState(false)
  return (
    <button
      disabled={disabled}
      onClick={() => onPick(o.word)}
      className="flex min-h-[110px] flex-col items-center justify-center gap-1 rounded-2xl bg-white p-3 shadow-card transition active:scale-[0.95] disabled:opacity-40"
    >
      {err ? (
        <span className="text-[17px] font-extrabold text-ink">{o.zh}</span>
      ) : (
        <img src={o.src} alt={o.zh} className="h-[72px] w-[72px] object-contain" onError={() => setErr(true)} />
      )}
    </button>
  )
}

/**
 * 四选一选项板：语文 / 英语认读题用（拼音、汉字、单词）。
 * 传 picOptions 时以图片呈现（options 仍传单词，点选返回单词）。
 * 点了就算作答 —— 低龄孩子没有「选完再确定」的耐心。
 */
export function ChoicePad({
  options,
  picOptions,
  onPick,
  disabled,
}: {
  options: string[]
  picOptions?: PicOption[]
  onPick: (choice: string) => void
  disabled?: boolean
}) {
  return (
    <div className="grid grid-cols-2 gap-2">
      {options.map((o, i) => {
        const pic = picOptions?.[i]
        return pic ? (
          <PicCell key={`pic-${o}-${i}`} o={pic} onPick={onPick} disabled={disabled} />
        ) : (
          <button
            key={`${o}-${i}`}
            disabled={disabled}
            onClick={() => onPick(o)}
            className="flex min-h-[56px] items-center justify-center rounded-2xl bg-white px-2 py-2 text-center text-[17px] font-extrabold leading-snug text-ink shadow-card transition active:scale-[0.95] disabled:opacity-40"
          >
            {o}
          </button>
        )
      })}
    </div>
  )
}

/** 答案显示框 */
export function AnswerBox({ value, size = 'lg' }: { value: string; size?: 'lg' | 'md' }) {
  const big = size === 'lg'
  return (
    <div
      className={`flex items-center justify-center rounded-2xl border-[3px] border-dashed ${
        value ? 'border-sky-300 bg-white' : 'border-sky-100 bg-white/60'
      } ${big ? 'h-[76px]' : 'h-[60px]'}`}
    >
      {value ? (
        <span className={`font-extrabold tracking-[0.08em] text-sky-600 ${big ? 'text-[44px]' : 'text-[34px]'}`}>
          {value}
        </span>
      ) : (
        <span className={`font-bold text-slate-300 ${big ? 'text-[18px]' : 'text-[15px]'}`}>
          用下面的数字键输入答案
        </span>
      )}
    </div>
  )
}
