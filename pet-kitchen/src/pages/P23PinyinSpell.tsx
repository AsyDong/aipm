// ============ P23 拼音拼读演示 ============
// 移植自 pinyin-world/src/views/Spell.vue：选声母 + 韵母 + 声调，拼出音节并朗读。

import { useMemo, useState } from 'react'
import { useNav } from '../store/nav'
import { CHAR_BANK, FINALS, INITIALS, PW_LEVELS, ZHENGTI } from '../pinyin/data'
import { setTone as applyTone } from '../pinyin/quiz'
import { speak } from '../pinyin/audio'

const TONE_MARKS = ['ˉ', 'ˊ', 'ˇ', 'ˋ']

export default function P23PinyinSpell() {
  const nav = useNav()
  const [init, setInit] = useState('b')
  const [fin, setFin] = useState('a')
  const [tone, setTone] = useState(1)

  /** 音节 → 汉字查找表（用于朗读与展示） */
  const charOf = useMemo(() => {
    const m: Record<string, string> = {}
    for (const s of [...CHAR_BANK, ...ZHENGTI]) if (!m[s.py]) m[s.py] = s.zh
    for (const l of PW_LEVELS) for (const w of l.words) if (!m[w.py]) m[w.py] = w.zh
    return m
  }, [])

  const presets = useMemo(() => PW_LEVELS.flatMap((l) => l.blends), [])

  // j q x y 与 ü 相拼时先去点再标调（j + ü + 1声 → jū）
  const base = ['j', 'q', 'x', 'y'].includes(init) && fin.includes('ü') ? fin.replace(/ü/g, 'u') : fin
  const py = init + applyTone(base, tone)
  const zh = charOf[py] ?? ''

  const Chip = ({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) => (
    <button
      onClick={onClick}
      className={`min-h-[38px] rounded-full px-3.5 text-[16px] font-extrabold transition active:scale-95 ${
        on ? 'bg-sky-400 text-white shadow-card' : 'bg-white text-ink shadow-card'
      }`}
    >
      {children}
    </button>
  )

  return (
    <div className="px-4 pb-8 pt-2">
      <div className="flex items-center gap-2">
        <button onClick={() => nav.back()} className="rounded-2xl bg-white px-3 py-2 text-[14px] font-extrabold text-muted active:scale-[0.98]">← 返回</button>
        <div className="flex-1 rounded-2xl bg-sky-50 px-3 py-2 ring-1 ring-sky-100">
          <div className="text-[15px] font-extrabold text-ink">🧪 拼读演示</div>
          <div className="text-[12px] font-bold text-muted">三步拼出音节：声母 → 韵母 → 声调</div>
        </div>
      </div>

      <div className="mt-3 rounded-xl3 bg-white p-4 shadow-card">
        <div className="text-[13px] font-extrabold text-muted">1️⃣ 选声母</div>
        <div className="mt-2 flex flex-wrap gap-2">
          {INITIALS.map((s) => <Chip key={s.py} on={init === s.py} onClick={() => setInit(s.py)}>{s.py}</Chip>)}
        </div>

        <div className="mt-4 text-[13px] font-extrabold text-muted">2️⃣ 选韵母</div>
        <div className="mt-2 flex flex-wrap gap-2">
          {FINALS.map((s) => <Chip key={s.py} on={fin === s.py} onClick={() => setFin(s.py)}>{s.py}</Chip>)}
        </div>

        <div className="mt-4 text-[13px] font-extrabold text-muted">3️⃣ 选声调</div>
        <div className="mt-2 flex flex-wrap gap-2">
          {[1, 2, 3, 4].map((n) => (
            <Chip key={n} on={tone === n} onClick={() => setTone(n)}>{TONE_MARKS[n - 1]} 第{n}声</Chip>
          ))}
        </div>

        <div className="mt-5 flex flex-col items-center gap-2 rounded-2xl bg-sky-50/70 py-5">
          <div className="flex items-center gap-2 text-[30px] font-extrabold text-ink">
            <span className="rounded-xl bg-white px-3 py-1 shadow-card">{init}</span>
            <span className="text-muted">+</span>
            <span className="rounded-xl bg-white px-3 py-1 shadow-card">{fin}</span>
            <span className="text-muted">→</span>
            <span className="text-[36px] text-sky-600">{py}</span>
          </div>
          {zh && <div className="text-[34px] font-extrabold text-ink">{zh}</div>}
          <button onClick={() => speak(zh || py)} className="btn-chip mt-1">🔊 听一听</button>
        </div>
      </div>

      <div className="mt-3 rounded-xl3 bg-white p-4 shadow-card">
        <div className="mb-2 text-[14px] font-extrabold text-ink">💡 示例拼读（{presets.length} 组）</div>
        {presets.map((b, i) => (
          <div key={i} className="flex items-center gap-2 border-b border-slate-100 py-2 last:border-0">
            <span className="rounded-lg bg-violet-50 px-2.5 py-0.5 text-[16px] font-extrabold text-violet-700">{b.initial}</span>
            <span className="text-muted">+</span>
            <span className="rounded-lg bg-violet-50 px-2.5 py-0.5 text-[16px] font-extrabold text-violet-700">{b.final}</span>
            <span className="text-muted">→</span>
            <b className="text-[17px] text-ink">{b.py}</b>
            <span className="text-[13px] font-bold text-muted">{b.zh}</span>
            <button onClick={() => speak(b.zh)} className="ml-auto rounded-full bg-sky-100 px-2.5 py-1 text-[13px] font-bold text-sky-700 active:scale-95">🔊</button>
          </div>
        ))}
      </div>
    </div>
  )
}
