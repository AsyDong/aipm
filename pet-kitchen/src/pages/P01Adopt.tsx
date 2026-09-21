import { useState } from 'react'
import { SPECIES } from '../data/content'
import { useStore } from '../store/useStore'
import Egg from '../components/Egg'
import { Confirm } from '../components/ui'
import { speak } from '../utils/speech'

/** P01 领养选蛋 —— 未点确认前可无限次切换（Q26） */
export default function P01Adopt() {
  const adopt = useStore((s) => s.adopt)
  const readAloud = useStore((s) => s.settings.readAloud)
  const [picked, setPicked] = useState<string | null>(null)
  const [confirm, setConfirm] = useState(false)

  const cur = SPECIES.find((s) => s.id === picked)

  return (
    <div className="flex min-h-full flex-col px-6 pb-10 pt-12">
      <h1 className="text-center text-[26px] font-extrabold text-ink">选一颗你喜欢的蛋</h1>
      <p className="mt-2 text-center text-[14px] text-muted">它会变成陪你一起长大的小伙伴</p>

      <div className="mt-10 flex items-end justify-center gap-3">
        {SPECIES.map((s) => (
          <button
            key={s.id}
            disabled={!s.open}
            onClick={() => {
              setPicked(s.id)
              speak(s.name, readAloud)
            }}
            className={`flex flex-1 flex-col items-center transition ${picked === s.id ? 'scale-105' : ''} ${
              s.open ? '' : 'opacity-80'
            }`}
          >
            <Egg c1={s.c1} c2={s.c2} accent={s.accent} locked={!s.open} shake={picked === s.id} />
            <div className="mt-2 text-[15px] font-extrabold text-ink">{s.open ? s.name : '敬请期待'}</div>
            <div className="mt-0.5 text-[11px] text-muted">{s.open ? s.tagline : '快来了'}</div>
          </button>
        ))}
      </div>

      <div className="mt-6 min-h-[28px] text-center text-[14px] font-bold text-sky-600">
        {cur ? `你选了「${cur.name}」· ${cur.tagline}` : ''}
      </div>

      <div className="mt-auto pt-8">
        <button className="btn-main" disabled={!picked} onClick={() => setConfirm(true)}>
          就 选 它 啦 ！
        </button>
      </div>

      <Confirm
        open={confirm}
        title="确定选它吗？"
        desc="选好就不能换啦，它会一直陪着你"
        okText="确定"
        cancelText="再想想"
        onOk={() => picked && adopt(picked as never)}
        onCancel={() => setConfirm(false)}
      />
    </div>
  )
}
