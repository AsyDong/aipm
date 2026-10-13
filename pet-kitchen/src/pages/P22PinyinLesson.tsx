// ============ P22 拼音学习讲堂 ============
// 移植自 pinyin-world/src/views/Lesson.vue：九课拼音规则，段落可含少量 <b> 标记，标签可点读。

import { useNav } from '../store/nav'
import { RULE_SECTIONS } from '../pinyin/rules'
import { speak } from '../pinyin/audio'

export default function P22PinyinLesson() {
  const nav = useNav()

  return (
    <div className="px-4 pb-8 pt-2">
      <div className="flex items-center gap-2">
        <button onClick={() => nav.back()} className="rounded-2xl bg-white px-3 py-2 text-[14px] font-extrabold text-muted active:scale-[0.98]">← 返回</button>
        <div className="flex-1 rounded-2xl bg-sky-50 px-3 py-2 ring-1 ring-sky-100">
          <div className="text-[15px] font-extrabold text-ink">📚 学习讲堂</div>
          <div className="text-[12px] font-bold text-muted">把拼音规则读一读，标签可以点读发音</div>
        </div>
      </div>

      {RULE_SECTIONS.map((sec, i) => (
        <details key={i} open={i === 0} className="mt-3 overflow-hidden rounded-xl3 bg-white shadow-card">
          <summary className="cursor-pointer px-4 py-3.5 text-[16px] font-extrabold text-ink marker:content-none">
            {sec.icon} {sec.title}
          </summary>
          <div className="px-4 pb-4">
            {sec.paragraphs.map((p, j) => (
              <p
                key={j}
                className="mt-1.5 text-[14px] leading-relaxed text-muted [&_b]:font-extrabold [&_b]:text-ink"
                dangerouslySetInnerHTML={{ __html: p }}
              />
            ))}
            {sec.chips.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-2">
                {sec.chips.map((c) => (
                  <button
                    key={c.py}
                    onClick={() => speak(c.zh || c.py)}
                    className="rounded-full bg-sky-50 px-3.5 py-1.5 text-[15px] font-extrabold text-sky-700 ring-1 ring-sky-100 active:scale-95"
                  >
                    {c.py}
                    {c.zh && <span className="ml-1 text-[12px] font-bold text-muted">({c.zh})</span>}
                    <span className="ml-1">🔊</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </details>
      ))}
    </div>
  )
}
