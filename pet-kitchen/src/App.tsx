import { useEffect, useRef } from 'react'
import { useStore } from './store/useStore'
import { useNav } from './store/nav'
import { useParent } from './store/parent'
import TabBar from './components/TabBar'
import LimitGuard from './components/LimitGuard'
import { ToastLayer, toast } from './components/ui'
import { ACHIEVEMENTS } from './data/achievements'
import P01Adopt from './pages/P01Adopt'
import P02Hatch from './pages/P02Hatch'
import P03Name from './pages/P03Name'
import P04Home from './pages/P04Home'
import P06TaskSubmit from './pages/P06TaskSubmit'
import P07LevelMap from './pages/P07LevelMap'
import P08Battle from './pages/P08Battle'
import P18FollowRead from './pages/P18FollowRead'
import P20PinyinHub from './pages/P20PinyinHub'
import P21PinyinAlphabet from './pages/P21PinyinAlphabet'
import P22PinyinLesson from './pages/P22PinyinLesson'
import P23PinyinSpell from './pages/P23PinyinSpell'
import P24PinyinGame from './pages/P24PinyinGame'
import P25PinyinMap from './pages/P25PinyinMap'
import P26PinyinPlan from './pages/P26PinyinPlan'
import P28EnglishListen from './pages/P28EnglishListen'
import P10WrongBook from './pages/P10WrongBook'
import P11Shop from './pages/P11Shop'
import P12Decorate from './pages/P12Decorate'
import P13Mine from './pages/P13Mine'
import P14Report from './pages/P14Report'
import P15ParentGate from './pages/P15ParentGate'
import P16TaskManage from './pages/P16TaskManage'
import P17PrizeManage from './pages/P17PrizeManage'
import ParentHub from './pages/ParentHub'
import type { Section } from './types'

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

  // 成就解锁提示（FE-06）。
  // store 只负责判定与落库；「告诉孩子」这一步放 UI 层，
  // 这样 store 就不必依赖 .tsx，冒烟测试能继续在纯 Node 里跑。
  const achCount = useStore((s) => s.achievements.length)
  const seenAch = useRef(achCount)
  useEffect(() => {
    if (achCount > seenAch.current) {
      const last = useStore.getState().achievements[achCount - 1]
      const def = last ? ACHIEVEMENTS.find((a) => a.id === last.id) : null
      if (def) toast(`🏅 解锁成就「${def.name}」`, 'ok')
    }
    seenAch.current = achCount
  }, [achCount])

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
        {/* 闯关第一屏是「版块中心」，选版块用 replace 原地换参（go 会压栈，TabBar 就没了） */}
        {page === 'battle' && <P07LevelMap section={top.arg as Section | undefined} />}
        {/* key 绑定关卡/任务 id：连续闯关时必须重挂载，否则上一关的答题状态会残留 */}
        {/* 三个战斗页都套 LimitGuard：入口守卫之外的兜底（防沉迷，PRD §8） */}
        {page === 'play' && (
          <LimitGuard>
            <P08Battle key={top.arg ?? 'm1'} levelId={top.arg ?? 'm1'} />
          </LimitGuard>
        )}
        {/* 课本跟读关走 P18（录音 + 讯飞评测），不是 P08 */}
        {page === 'follow' && (
          <LimitGuard>
            <P18FollowRead key={top.arg ?? ''} levelId={top.arg ?? ''} />
          </LimitGuard>
        )}
        {/* 拼音版块 = 一套完整的「拼音方块世界」，已整体搬进本应用（不再是 iframe 子应用） */}
        {page === 'pinyin' && <P20PinyinHub />}
        {page === 'pyalpha' && <P21PinyinAlphabet />}
        {page === 'pylesson' && <P22PinyinLesson />}
        {page === 'pyspell' && <P23PinyinSpell />}
        {/* key 绑定玩法 / 关卡 id：换玩法必须重挂载，否则上一轮答题状态会残留 */}
        {/* 拼音页只在「闯关型」玩法（lvl: / unit:）受限；听音 / 认字 / 拼装是学习，放行 */}
        {page === 'pygame' && (
          <LimitGuard active={/^(lvl|unit):/.test(String(top.arg ?? ''))}>
            <P24PinyinGame key={top.arg ?? 'listen'} mode={top.arg ?? 'listen'} />
          </LimitGuard>
        )}
        {page === 'pymap' && <P25PinyinMap />}
        {page === 'pyplan' && <P26PinyinPlan />}
        {/* 英语版块由 P07 渲染 P27EnglishHub；听音选词是它下面的一个游戏页 */}
        {page === 'enlisten' && <P28EnglishListen />}
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
