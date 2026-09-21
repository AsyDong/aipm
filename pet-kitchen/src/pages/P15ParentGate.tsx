import { useState } from 'react'
import { useStore } from '../store/useStore'
import { useNav } from '../store/nav'
import { useParent } from '../store/parent'
import { toast } from '../components/ui'

/** P15 家长密码页：4 位数字，默认 1234，首次进入强制修改 */
export default function P15ParentGate({ then }: { then?: string }) {
  const nav = useNav()
  const pin = useStore((s) => s.settings.parentPin)
  const pinChanged = useStore((s) => s.settings.pinChanged)
  const setPin = useStore((s) => s.setPin)
  const parent = useParent()
  const [buf, setBuf] = useState('')
  const [newPin, setNewPin] = useState('')
  const [step, setStep] = useState<'input' | 'change'>(pinChanged ? 'input' : 'change')
  const [err, setErr] = useState('')

  const locked = parent.lockedUntil > Date.now()

  const press = (d: string) => {
    if (locked) return
    const next = (buf + d).slice(0, 4)
    setBuf(next)
    if (next.length < 4) return
    if (next === pin) {
      parent.unlock()
      if (!pinChanged) {
        setStep('change')
        setBuf('')
        return
      }
      nav.go(then ?? 'parentHub')
      return
    }
    parent.fail()
    setErr('密码不对哦')
    setTimeout(() => setBuf(''), 400)
  }

  if (step === 'change') {
    return (
      <div className="flex min-h-screen flex-col items-center px-6 pt-16">
        <div className="text-[20px] font-extrabold text-ink">先改一个自己的密码吧</div>
        <div className="mt-1 text-[13px] text-muted">默认密码是 1234，为了安全请改掉</div>
        <div className="mt-6 flex gap-3">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-14 w-12 rounded-xl border-2 border-sky-100 bg-white text-center text-[26px] font-extrabold leading-[52px] text-ink">
              {newPin[i] ?? ''}
            </div>
          ))}
        </div>
        <div className="mt-6 grid w-full max-w-[280px] grid-cols-3 gap-3">
          {['1', '2', '3', '4', '5', '6', '7', '8', '9', '清空', '0', '删除'].map((k) => (
            <button
              key={k}
              className="h-14 rounded-2xl bg-white text-[20px] font-extrabold text-ink shadow-card active:scale-95"
              onClick={() => {
                if (k === '清空') setNewPin('')
                else if (k === '删除') setNewPin((v) => v.slice(0, -1))
                else setNewPin((v) => (v + k).slice(0, 4))
              }}
            >
              {k}
            </button>
          ))}
        </div>
        <button
          className="btn-main mt-6 max-w-[280px]"
          disabled={newPin.length < 4}
          onClick={() => {
            setPin(newPin)
            parent.unlock()
            toast('密码设置好啦')
            nav.go(then ?? 'parentHub')
          }}
        >
          保 存 并 进 入
        </button>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen flex-col items-center px-6 pt-16">
      <div className="text-[20px] font-extrabold text-ink">请输入家长密码</div>
      <div className="mt-6 flex gap-3">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-14 w-12 rounded-xl border-2 border-sky-100 bg-white text-center text-[26px] font-extrabold leading-[52px] text-ink">
            {buf[i] ? '●' : ''}
          </div>
        ))}
      </div>
      {err && <div className="mt-3 text-[14px] font-bold text-danger">{err}</div>}
      {locked && <div className="mt-3 text-[14px] font-bold text-danger">错误太多次，请 5 分钟后再试</div>}

      <div className="mt-6 grid w-full max-w-[280px] grid-cols-3 gap-3">
        {['1', '2', '3', '4', '5', '6', '7', '8', '9', '清空', '0', '删除'].map((k) => (
          <button
            key={k}
            className="h-14 rounded-2xl bg-white text-[20px] font-extrabold text-ink shadow-card active:scale-95"
            onClick={() => {
              setErr('')
              if (k === '清空') setBuf('')
              else if (k === '删除') setBuf((v) => v.slice(0, -1))
              else press(k)
            }}
          >
            {k}
          </button>
        ))}
      </div>
      <button className="mt-6 text-[14px] font-bold text-muted" onClick={() => nav.back()}>返回</button>
    </div>
  )
}
