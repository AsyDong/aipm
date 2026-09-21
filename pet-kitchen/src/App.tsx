import { useEffect } from 'react'
import { useStore } from './store/useStore'
import { useNav } from './store/nav'
import { useParent } from './store/parent'
import TabBar from './components/TabBar'
import { ToastLayer } from './components/ui'
import P01Adopt from './pages/P01Adopt'
import P02Hatch from './pages/P02Hatch'
import P03Name from './pages/P03Name'
import P04Home from './pages/P04Home'
import P06TaskSubmit from './pages/P06TaskSubmit'
import P07LevelMap from './pages/P07LevelMap'
import P08Battle from './pages/P08Battle'
import P10WrongBook from './pages/P10WrongBook'
import P11Shop from './pages/P11Shop'
import P12Decorate from './pages/P12Decorate'
import P13Mine from './pages/P13Mine'
import P14Report from './pages/P14Report'
import P15ParentGate from './pages/P15ParentGate'
import P16TaskManage from './pages/P16TaskManage'
import P17PrizeManage from './pages/P17PrizeManage'
import ParentHub from './pages/ParentHub'

const PARENT_PAGES = ['parentHub', 'ptasks', 'pprizes']
const TAB_PAGES = ['home', 'battle', 'shop', 'mine']

export default function App() {
  const phase = useStore((s) => s.phase)
  const init = useStore((s) => s.init)
  const ensureDay = useStore((s) => s.ensureDay)
  const syncNow = useStore((s) => s.syncNow)
  const stack = useNav((s) => s.stack)
  const unlockedAt = useParent((s) => s.unlockedAt)

  useEffect(() => {
    // 拉远端（新设备先拉再种）→ 引导 → 推 → 再拉
    init()
  }, [init])

  // 回到前台 / 跨天时重新结算，并顺手把攒着的数据推上去、把另一台设备的改动拉下来
  useEffect(() => {
    const onVis = () => {
      if (document.visibilityState !== 'visible') return
      ensureDay()
      syncNow()
    }
    document.addEventListener('visibilitychange', onVis)
    const t = setInterval(ensureDay, 60_000)
    return () => {
      document.removeEventListener('visibilitychange', onVis)
      clearInterval(t)
    }
  }, [ensureDay, syncNow])

  const top = stack[stack.length - 1] ?? { page: 'home' }
  const unlocked = unlockedAt > 0 && Date.now() - unlockedAt < 5 * 60 * 1000
  const page = PARENT_PAGES.includes(top.page) && !unlocked ? 'parent' : top.page
  const showTab = stack.length === 1 && TAB_PAGES.includes(page)

  if (phase !== 'home') {
    return (
      <div className="app-shell">
        {phase === 'adopt' && <P01Adopt />}
        {phase === 'hatch' && <P02Hatch />}
        {phase === 'name' && <P03Name />}
        <ToastLayer />
      </div>
    )
  }

  return (
    <div className="app-shell">
      <main className={`flex-1 ${showTab ? 'pb-[68px]' : ''}`}>
        {page === 'home' && <P04Home />}
        {/* 闯关地图就是 battle 本页：切科目用 replace 原地换参（go 会压栈，TabBar 就没了） */}
        {page === 'battle' && <P07LevelMap subject={top.arg as 'math' | 'chinese' | 'english' | undefined} />}
        {/* key 绑定关卡/任务 id：连续闯关时必须重挂载，否则上一关的答题状态会残留 */}
        {page === 'play' && <P08Battle key={top.arg ?? 'm1'} levelId={top.arg ?? 'm1'} />}
        {page === 'task' && <P06TaskSubmit key={top.arg ?? ''} taskId={top.arg ?? ''} />}
        {page === 'wrong' && <P10WrongBook subject={(top.arg as 'math') ?? 'math'} />}
        {page === 'shop' && <P11Shop />}
        {page === 'decorate' && <P12Decorate />}
        {page === 'mine' && <P13Mine />}
        {page === 'report' && <P14Report />}
        {page === 'parent' && <P15ParentGate then={top.arg ?? undefined} />}
        {page === 'pin' && <P15ParentGate then="parentHub" />}
        {page === 'parentHub' && <ParentHub />}
        {page === 'ptasks' && <P16TaskManage />}
        {page === 'pprizes' && <P17PrizeManage />}
      </main>
      {showTab && <TabBar />}
      <ToastLayer />
    </div>
  )
}
