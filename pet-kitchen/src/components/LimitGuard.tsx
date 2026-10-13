import type { ReactNode } from 'react'
import { useStore } from '../store/useStore'
import { useNav } from '../store/nav'
import { limitOf } from '../engine/limits'

/**
 * 防沉迷兜底（PRD §8）。
 *
 * 入口（P07 / P25 / P26 / P27）已经用 `enterGuard()` 拦过一道，
 * 这里再包一层是为了「直接导航进来」的路径也能挡住 —— 比如从结算页点「下一关」、
 * 或页面状态被恢复时。两道锁都指向同一份判定（`engine/limits.limitOf`），不会打架。
 *
 * `active=false` 时整块放行：拼音的自由练习（听音 / 认字 / 拼装）是**学习**不是闯关，
 * 限制只针对「闯关型」玩法（lvl: / unit: / 关卡页）。
 */
export default function LimitGuard({ active = true, children }: { active?: boolean; children: ReactNode }) {
  const nav = useNav()
  const settings = useStore((s) => s.settings)
  const todayBattles = useStore((s) => s.todayBattles)

  const r = limitOf({ settings, todayBattles })
  if (!active || !r.blocked) return <>{children}</>

  return (
    <div className="px-6 py-16 text-center">
      <div className="text-[54px]">🌙</div>
      <div className="mt-3 text-[18px] font-extrabold leading-relaxed text-ink">{r.reason}</div>
      <div className="mt-2 text-[13px] text-muted">
        今日已玩 {r.used} 场{r.limit > 0 ? ` / 上限 ${r.limit} 场` : ''}
        {r.limit > 0 ? '，明天 0 点重新计算。' : '。'}
      </div>
      <div className="mx-auto mt-5 max-w-[280px] rounded-xl3 bg-white p-4 text-left text-[13px] leading-relaxed text-muted shadow-card">
        💡 想调时间或场次？跟爸爸妈妈说一声，在
        <b className="text-ink"> 家长模式 → 游玩限制 </b>
        里改。
      </div>
      <button className="btn-main mx-auto mt-6 w-[200px]" onClick={() => nav.tab('home')}>
        回 家 园
      </button>
    </div>
  )
}
