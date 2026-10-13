// ============ P21 拼音字母表 ============
// 移植自 pinyin-world/src/views/Alphabet.vue：点方块听标准发音，读过的变绿。

import { useState } from 'react'
import { usePinyin } from '../pinyin/store'
import { useNav } from '../store/nav'
import { FINAL_GROUPS, INITIALS, ZHENGTI } from '../pinyin/data'
import { speak } from '../pinyin/audio'
import { notePinyinPractice } from '../pinyin/bridge'

type Tab = 'init' | 'fin' | 'zheng'

const TABS: { id: Tab; label: string }[] = [
  { id: 'init', label: '声母' },
  { id: 'fin', label: '韵母' },
  { id: 'zheng', label: '整体认读' },
]

export default function P21PinyinAlphabet() {
  const nav = useNav()
  const readLetters = usePinyin((s) => s.readLetters)
  const markLetterRead = usePinyin((s) => s.markLetterRead)
  const [tab, setTab] = useState<Tab>('init')

  const tap = (py: string, zh: string) => {
    speak(zh)
    markLetterRead(py)
    // 点读一次 = 练了一个音，记进家长报告的「今天拼音练了 N 个音」（FE-09）
    notePinyinPractice(1)
  }

  const finItems = FINAL_GROUPS.flatMap((g) => g.items)
  const countOf = (list: { py: string }[]) => list.filter((s) => readLetters.includes(s.py)).length

  const Block = ({ py, zh }: { py: string; zh: string }) => {
    const read = readLetters.includes(py)
    return (
      <button
        onClick={() => tap(py, zh)}
        className={`flex aspect-square flex-col items-center justify-center rounded-2xl shadow-card transition active:scale-95 ${
          read ? 'bg-emerald-50 ring-1 ring-emerald-200' : 'bg-white'
        }`}
      >
        <span className={`text-[30px] font-extrabold leading-none ${read ? 'text-emerald-600' : 'text-ink'}`}>{py}</span>
        <span className="mt-0.5 text-[12px] font-bold text-muted">{zh}</span>
      </button>
    )
  }

  return (
    <div className="px-4 pb-8 pt-2">
      <div className="flex items-center gap-2">
        <button onClick={() => nav.back()} className="rounded-2xl bg-white px-3 py-2 text-[14px] font-extrabold text-muted active:scale-[0.98]">← 返回</button>
        <div className="flex-1 rounded-2xl bg-sky-50 px-3 py-2 ring-1 ring-sky-100">
          <div className="text-[15px] font-extrabold text-ink">🔤 拼音字母表</div>
          <div className="text-[12px] font-bold text-muted">点方块听标准发音，读过的会变绿</div>
        </div>
      </div>

      <div className="mt-3 flex gap-2">
        {TABS.map((t) => {
          const n = t.id === 'init' ? countOf(INITIALS) : t.id === 'fin' ? countOf(finItems) : countOf(ZHENGTI)
          const total = t.id === 'init' ? 23 : t.id === 'fin' ? 24 : 16
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex-1 rounded-2xl py-2 text-[14px] font-extrabold ${
                tab === t.id ? 'bg-sky-400 text-white shadow-card' : 'bg-white text-muted'
              }`}
            >
              {t.label}
              <span className="ml-1 text-[11px] opacity-80">{n}/{total}</span>
            </button>
          )
        })}
      </div>

      {tab === 'init' && (
        <div className="mt-3 grid grid-cols-4 gap-2.5">
          {INITIALS.map((s) => <Block key={s.py} py={s.py} zh={s.zh} />)}
        </div>
      )}

      {tab === 'fin' && FINAL_GROUPS.map((g) => (
        <div key={g.name} className="mt-4">
          <div className="mb-2 text-[14px] font-extrabold text-muted">{g.name}</div>
          <div className="grid grid-cols-4 gap-2.5">
            {g.items.map((s) => <Block key={s.py} py={s.py} zh={s.zh} />)}
          </div>
        </div>
      ))}

      {tab === 'zheng' && (
        <div className="mt-3 grid grid-cols-4 gap-2.5">
          {ZHENGTI.map((s) => <Block key={s.py} py={s.py} zh={s.zh} />)}
        </div>
      )}
    </div>
  )
}
