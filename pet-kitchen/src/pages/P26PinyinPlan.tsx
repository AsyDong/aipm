// ============ P26 拼音 21 天计划（今日任务） ============
// 移植自 pinyin-world/src/views/TodayTask.vue：
// 新知识（点读 + 闯关 + 小游戏）+ 遗忘曲线复习 + 错题巩固，全部完成才能打卡。

import { useNav } from '../store/nav'
import { useStore } from '../store/useStore'
import { usePinyin } from '../pinyin/store'
import { CoinBar, toast } from '../components/ui'
import { PINYIN_WORLD_LEVELS } from '../engine/questions'
import { PLAN_21, PLAN_DAYS, newDoneOf, reviewsForDay } from '../pinyin/plan'
import { speak } from '../pinyin/audio'
import { notePinyinCheckIn } from '../pinyin/bridge'

export default function P26PinyinPlan() {
  const nav = useNav()
  const levels = useStore((s) => s.levels)
  const wrong = useStore((s) => s.wrong)
  const food = useStore((s) => s.food)
  const points = useStore((s) => s.points)

  const plan = usePinyin((s) => s.plan)
  const readLetters = usePinyin((s) => s.readLetters)
  const checkInToday = usePinyin((s) => s.checkInToday)
  const setNewDone = usePinyin((s) => s.setNewDone)
  const setWrongDone = usePinyin((s) => s.setWrongDone)
  const toggleReview = usePinyin((s) => s.toggleReview)
  const changeDay = usePinyin((s) => s.changeDay)

  const day = Math.min(Math.max(plan.startDay, 1), PLAN_DAYS)
  const p = PLAN_21[day - 1]
  const rec = plan.days[day] ?? { newDone: false, reviewsDone: [], wrongDone: false, checked: false, date: '' }

  const starsById: Record<number, number> = {}
  for (const l of PINYIN_WORLD_LEVELS) starsById[Number(l.id.slice(2))] = levels.find((r) => r.levelId === l.id)?.bestStars ?? 0

  const newDone = rec.newDone || newDoneOf(p, readLetters, starsById)
  const reviews = reviewsForDay(day)
  const chineseWrong = wrong.filter((w) => w.subject === 'chinese')
  const wrongDone = rec.wrongDone || chineseWrong.length === 0

  const taskTotal = 1 + reviews.length + 1
  const taskDone = (newDone ? 1 : 0) + reviews.filter((r) => rec.reviewsDone.includes(r.day)).length + (wrongDone ? 1 : 0)
  const allDone = taskDone >= taskTotal

  const checkIn = () => {
    if (!allDone) { toast(`还剩 ${taskTotal - taskDone} 项任务没完成`, 'warn'); return }
    if (checkInToday()) {
      // 拼音打卡与主应用连击合并计数（FE-09）：今天没做家务任务时，这一下也能把连击续上
      notePinyinCheckIn()
      toast('🎉 打卡成功！')
    } else {
      toast('今天已经打过卡啦')
    }
  }

  const TaskCheck = ({ on, onClick }: { on: boolean; onClick?: () => void }) => (
    <button
      onClick={onClick}
      className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[15px] font-extrabold ${
        on ? 'bg-emerald-400 text-white' : 'bg-slate-100 text-slate-300'
      }`}
    >
      ✓
    </button>
  )

  return (
    <div className="pb-6">
      <CoinBar food={food} points={points} />

      <div className="mx-4 mt-1 flex items-center gap-2">
        <button onClick={() => nav.back()} className="rounded-2xl bg-white px-3 py-2 text-[14px] font-extrabold text-muted active:scale-[0.98]">← 返回</button>
        <div className="flex-1 rounded-2xl bg-amber-50 px-3 py-2 ring-1 ring-amber-100">
          <span className="text-[15px] font-extrabold text-ink">📋 今日任务</span>
          <span className="ml-2 text-[12px] font-bold text-muted">第 {day}/{PLAN_DAYS} 天 · {taskDone}/{taskTotal} 项</span>
        </div>
      </div>

      {/* 新知识 */}
      <div className="mx-4 mt-3 rounded-xl3 bg-white p-4 shadow-card">
        <div className="mb-2 flex items-baseline gap-2">
          <span className="text-[15px] font-extrabold text-ink">📚 新知识 · 今天学</span>
          <span className="text-[12px] font-bold text-muted">{newDone ? '✅ 已完成' : p.levelIds.length ? '点读 + 闯关' : '点读 + 小游戏'}</span>
        </div>
        <div className="flex gap-3">
          <TaskCheck on={newDone} />
          <div className="flex-1">
            <div className="text-[15px] font-extrabold text-ink">{p.icon} {p.title}</div>
            <div className="mt-0.5 text-[13px] leading-relaxed text-muted">
              {p.desc}{p.ruleHint ? `（规则：${p.ruleHint}）` : ''}
            </div>
            <div className="mt-2 flex flex-wrap gap-2">
              {p.letters.length > 0 ? (
                p.letters.map((l) => (
                  <button key={l} onClick={() => speak(l)} className="rounded-full bg-sky-50 px-3 py-1 text-[14px] font-extrabold text-sky-700 active:scale-95">
                    {l} 🔊
                  </button>
                ))
              ) : (
                <span className="rounded-full bg-amber-50 px-3 py-1 text-[13px] font-bold text-amber-700">🎯 巩固日 · 不学新字母</span>
              )}
            </div>
            <div className="mt-2.5 flex flex-wrap gap-2">
              {p.levelIds.slice(0, 1).map((id) => (
                <button key={id} onClick={() => nav.go('pygame', `lvl:py${id}`)} className="btn-chip">🏰 闯关</button>
              ))}
              <button onClick={() => nav.go('pyalpha')} className="btn-chip">🔤 字母表</button>
              {p.games.map((g) => (
                <button key={g.id} onClick={() => nav.go('pygame', g.id)} className="btn-chip">{g.icon} {g.label}</button>
              ))}
              {!newDone && (
                <button onClick={() => setNewDone(day, true)} className="btn-chip">✓ 标记完成</button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* 遗忘曲线复习 */}
      <div className="mx-4 mt-3 rounded-xl3 bg-white p-4 shadow-card">
        <div className="mb-2 flex items-baseline gap-2">
          <span className="text-[15px] font-extrabold text-ink">🔁 遗忘曲线复习</span>
          <span className="text-[12px] font-bold text-muted">{reviews.filter((r) => rec.reviewsDone.includes(r.day)).length}/{reviews.length} 完成</span>
        </div>
        {reviews.length === 0 ? (
          <div className="text-[13px] font-bold text-muted">今天没有到期的复习，专心学新知识吧！</div>
        ) : (
          reviews.map((r) => {
            const done = rec.reviewsDone.includes(r.day)
            return (
              <div key={r.day} className="mt-2 flex gap-3">
                <TaskCheck on={done} onClick={() => toggleReview(day, r.day)} />
                <div className="flex-1">
                  <div className="text-[14px] font-extrabold text-ink">{r.icon} 第 {r.day} 天 · {r.title}</div>
                  <div className="mt-0.5 text-[12px] text-muted">按遗忘曲线今天该复习啦，读一读、闯一闯记得更牢。</div>
                  <div className="mt-1.5 flex flex-wrap gap-2">
                    <button onClick={() => nav.go('pyalpha')} className="btn-chip">🔤 读一读</button>
                    {r.levelIds.slice(0, 1).map((id) => (
                      <button key={id} onClick={() => nav.go('pygame', `lvl:py${id}`)} className="btn-chip">🎯 重玩关卡</button>
                    ))}
                  </div>
                </div>
              </div>
            )
          })
        )}
      </div>

      {/* 错题巩固 */}
      <div className="mx-4 mt-3 rounded-xl3 bg-white p-4 shadow-card">
        <div className="mb-2 flex items-baseline gap-2">
          <span className="text-[15px] font-extrabold text-ink">📕 错题巩固</span>
          <span className="text-[12px] font-bold text-muted">{chineseWrong.length ? `${chineseWrong.length} 道待消灭` : '✅ 没有错题'}</span>
        </div>
        <div className="flex gap-3">
          <TaskCheck on={wrongDone} />
          <div className="flex-1">
            <div className="text-[14px] font-extrabold text-ink">
              {chineseWrong.length ? `把做错的 ${chineseWrong.length} 道题再练一遍` : '错题本已经清空啦'}
            </div>
            <div className="mt-0.5 text-[12px] text-muted">错过的题再练一次，保证下次不再错！</div>
            <div className="mt-1.5 flex flex-wrap gap-2">
              <button disabled={!chineseWrong.length} onClick={() => nav.go('wrong', 'chinese')} className="btn-chip disabled:opacity-50">📕 去错题本</button>
              {!wrongDone && <button onClick={() => setWrongDone(day, true)} className="btn-chip">✓ 标记完成</button>}
            </div>
          </div>
        </div>
      </div>

      {/* 打卡 */}
      <div className="mx-4 mt-4">
        <button
          onClick={checkIn}
          className={`flex h-[56px] w-full items-center justify-center rounded-2xl text-[18px] font-extrabold shadow-card transition active:scale-[0.98] ${
            rec.checked ? 'bg-emerald-100 text-emerald-700' : allDone ? 'bg-amber-400 text-white' : 'bg-white text-muted'
          }`}
        >
          {rec.checked ? '✅ 今天已经打过卡啦' : allDone ? '🎉 完成今日打卡' : `⛏️ 还差 ${taskTotal - taskDone} 项任务`}
        </button>
      </div>

      {/* 计划控制 */}
      <div className="mx-4 mt-3 rounded-xl3 bg-white p-4 shadow-card">
        <div className="mb-2 text-[14px] font-extrabold text-ink">📅 计划控制（家长 / 老师）</div>
        <div className="flex items-center gap-2">
          <button
            disabled={day <= 1}
            onClick={() => changeDay(day - 1)}
            className="rounded-xl bg-slate-100 px-3 py-2 text-[13px] font-bold text-muted disabled:opacity-40"
          >
            ◀ 前一天
          </button>
          <select
            value={day}
            onChange={(e) => changeDay(Number(e.target.value))}
            className="field flex-1 text-[13px]"
          >
            {PLAN_21.map((d) => (
              <option key={d.day} value={d.day}>第 {d.day} 天：{d.title}</option>
            ))}
          </select>
          <button
            disabled={day >= PLAN_DAYS}
            onClick={() => changeDay(day + 1)}
            className="rounded-xl bg-slate-100 px-3 py-2 text-[13px] font-bold text-muted disabled:opacity-40"
          >
            后一天 ▶
          </button>
        </div>
        <div className="mt-2 text-[12px] leading-relaxed text-muted">
          前 14 天学完新知识，后 7 天巩固复习；第 {PLAN_DAYS} 天毕业典礼后即「拼音毕业」🎓
        </div>
      </div>
    </div>
  )
}
