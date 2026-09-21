// 21 天打卡学习计划：14 天学完全部拼音 + 7 天巩固轮（遗忘曲线闭环）与遗忘曲线复习
import { save } from '../store'

export interface DayPlan {
  day: number
  icon: string
  title: string        // 今天学什么
  desc: string         // 学习要点
  letters: string[]    // 新学字母（字母表点读对应）；巩固日为空数组
  levelIds: number[]   // 主线冒险关卡（当天要闯的关）
  games: { id: string; icon: string; label: string }[] // 建议练习小游戏
  ruleHint?: string    // 相关规则提示
  review?: boolean     // true = 巩固轮（不学新字母，重打关卡）
}

// 计划总天数：14 天学习轮 + 7 天巩固轮
export const PLAN_DAYS = 21

// 闯关地图分组：21 天分成 5 个阶段（地图上的"单元"），21 天 = 21 关
export interface PlanGroup { id: number; icon: string; name: string; range: [number, number]; desc: string }
export const PLAN_GROUPS: PlanGroup[] = [
  { id: 1, icon: '🌈', name: '韵母村', range: [1, 2], desc: '单韵母 a o e i u ü' },
  { id: 2, icon: '🏘️', name: '声母镇', range: [3, 9], desc: '23 个声母逐日学' },
  { id: 3, icon: '🌲', name: '复韵母森林', range: [10, 12], desc: '复韵母 + 整体认读' },
  { id: 4, icon: '⛰️', name: '鼻韵母山脉', range: [13, 14], desc: '前鼻韵母 + 后鼻韵母' },
  { id: 5, icon: '🏰', name: '巩固要塞', range: [15, 21], desc: '巩固轮 · 遗忘曲线闭环' },
]

// 21 天：前 14 天每天 = 新知识（字母 + 关卡）+ 练习游戏；后 7 天 = 巩固轮（重打关卡 + 易错点）
export const PLAN_21: DayPlan[] = [
  { day: 1, icon: '🥚', title: '单韵母 a o e', desc: '认识三个单韵母，学会四声读法', letters: ['a', 'o', 'e'], levelIds: [], games: [{ id: 'listen', icon: '🎯', label: '听力挑战' }, { id: 'follow', icon: '🎤', label: '发音擂台' }], ruleHint: '声调与标调规则' },
  { day: 2, icon: '🐣', title: '单韵母 i u ü', desc: '认识 i u ü，凑齐 6 个单韵母', letters: ['i', 'u', 'ü'], levelIds: [1], games: [{ id: 'listen', icon: '🎯', label: '听力挑战' }, { id: 'char', icon: '📖', label: '识字挑战' }], ruleHint: '单韵母' },
  { day: 3, icon: '📻', title: '声母 b p m f', desc: '两拼音节：前音轻短后音重', letters: ['b', 'p', 'm', 'f'], levelIds: [2], games: [{ id: 'listen', icon: '🎯', label: '听力挑战' }, { id: 'blend', icon: '🧩', label: '拼装工坊' }], ruleHint: '两拼音节拼读' },
  { day: 4, icon: '🥁', title: '声母 d t n l', desc: 'd 不送气、t 送气，听一听辨一辨', letters: ['d', 't', 'n', 'l'], levelIds: [3], games: [{ id: 'char', icon: '📖', label: '识字挑战' }, { id: 'blend', icon: '🧩', label: '拼装工坊' }], ruleHint: '两拼音节' },
  { day: 5, icon: '🕊️', title: '声母 g k h', desc: '三拼音节登场，拼读更复杂', letters: ['g', 'k', 'h'], levelIds: [4], games: [{ id: 'char', icon: '📖', label: '识字挑战' }, { id: 'blend', icon: '🧩', label: '拼装工坊' }], ruleHint: '三拼音节' },
  { day: 6, icon: '🐔', title: '声母 j q x', desc: '小 ü 遇到 j q x，去掉两点还读 ü', letters: ['j', 'q', 'x'], levelIds: [5], games: [{ id: 'blend', icon: '🧩', label: '拼装工坊' }, { id: 'char', icon: '📖', label: '识字挑战' }], ruleHint: 'ü 的两点省略规则' },
  { day: 7, icon: '🐝', title: '声母 z c s + zi ci si', desc: '平舌音：舌尖平平抵住下齿背', letters: ['z', 'c', 's', 'zi', 'ci', 'si'], levelIds: [6], games: [{ id: 'listen', icon: '🎯', label: '听力挑战' }, { id: 'follow', icon: '🎤', label: '发音擂台' }], ruleHint: '平舌音' },
  { day: 8, icon: '🦜', title: '声母 zh ch sh r + zhi chi shi ri', desc: '翘舌音：舌尖翘起顶住上齿龈', letters: ['zh', 'ch', 'sh', 'r', 'zhi', 'chi', 'shi', 'ri'], levelIds: [7], games: [{ id: 'listen', icon: '🎯', label: '听力挑战' }, { id: 'follow', icon: '🎤', label: '发音擂台' }], ruleHint: '翘舌音' },
  { day: 9, icon: '🎅', title: '声母 y w + yi wu yu', desc: '整体认读音节不用拼，看到直接读', letters: ['y', 'w', 'yi', 'wu', 'yu'], levelIds: [8], games: [{ id: 'char', icon: '📖', label: '识字挑战' }, { id: 'listen', icon: '🎯', label: '听力挑战' }], ruleHint: '整体认读音节' },
  { day: 10, icon: '🌵', title: '复韵母 ai ei ui', desc: '口形滑动读复韵母，标调口诀记牢', letters: ['ai', 'ei', 'ui'], levelIds: [9], games: [{ id: 'listen', icon: '🎯', label: '听力挑战' }, { id: 'blend', icon: '🧩', label: '拼装工坊' }], ruleHint: '标调规则' },
  { day: 11, icon: '🐱', title: '复韵母 ao ou iu', desc: 'iu 并列标调在后：niú 的帽子给 u', letters: ['ao', 'ou', 'iu'], levelIds: [10], games: [{ id: 'blend', icon: '🧩', label: '拼装工坊' }, { id: 'char', icon: '📖', label: '识字挑战' }], ruleHint: '标调规则' },
  { day: 12, icon: '🍂', title: '复韵母 ie üe er + ye yue', desc: 'er 是特殊韵母，自己就能成音节', letters: ['ie', 'üe', 'er', 'ye', 'yue'], levelIds: [11], games: [{ id: 'listen', icon: '🎯', label: '听力挑战' }, { id: 'blend', icon: '🧩', label: '拼装工坊' }], ruleHint: '整体认读音节' },
  { day: 13, icon: '🏔️', title: '前鼻韵母 an en in un ün + yuan yin yun', desc: '前鼻音：读完舌尖顶住上齿龈', letters: ['an', 'en', 'in', 'un', 'ün', 'yuan', 'yin', 'yun'], levelIds: [12], games: [{ id: 'char', icon: '📖', label: '识字挑战' }, { id: 'blend', icon: '🧩', label: '拼装工坊' }], ruleHint: '前鼻音' },
  { day: 14, icon: '🎓', title: '后鼻韵母 ang eng ing ong + 总复习', desc: '后鼻音：舌根抬起堵气流，闯完最后三关就学完啦！', letters: ['ang', 'eng', 'ing', 'ong', 'ying'], levelIds: [13, 14, 15], games: [{ id: 'char', icon: '📖', label: '识字挑战' }, { id: 'follow', icon: '🎤', label: '发音擂台' }], ruleHint: '后鼻音' },
  // ---- 巩固轮（第 15-21 天）：不学新字母，重打关卡 + 按遗忘曲线复习 ----
  { day: 15, icon: '🧱', title: '巩固① 基础回炉', desc: '重打前 3 关：单韵母 + b p m f / d t n l，基础打牢', letters: [], levelIds: [1, 2, 3], games: [{ id: 'listen', icon: '🎯', label: '听力挑战' }, { id: 'follow', icon: '🎤', label: '发音擂台' }], ruleHint: '单韵母四声', review: true },
  { day: 16, icon: '🪨', title: '巩固② 声母进阶', desc: '重打 g k h / j q x / z c s：三拼音节和平舌音再练练', letters: [], levelIds: [4, 5, 6], games: [{ id: 'char', icon: '📖', label: '识字挑战' }, { id: 'blend', icon: '🧩', label: '拼装工坊' }], ruleHint: '三拼音节', review: true },
  { day: 17, icon: '🪶', title: '巩固③ 翘舌音特训', desc: '重打 zh ch sh r 两关：平翘舌最容易混，重点听', letters: [], levelIds: [7, 8], games: [{ id: 'listen', icon: '🎯', label: '听力挑战' }, { id: 'follow', icon: '🎤', label: '发音擂台' }], ruleHint: '平翘舌对比', review: true },
  { day: 18, icon: '🎈', title: '巩固④ 复韵母滑动', desc: '重打复韵母三关：口形滑动 ai ei ui / ao ou iu / ie üe er', letters: [], levelIds: [9, 10, 11], games: [{ id: 'blend', icon: '🧩', label: '拼装工坊' }, { id: 'char', icon: '📖', label: '识字挑战' }], ruleHint: '标调规则', review: true },
  { day: 19, icon: '🏔️', title: '巩固⑤ 鼻韵母冲刺', desc: '重打前鼻/后鼻两关：前后鼻音对比是老大难，多听多读', letters: [], levelIds: [12, 13], games: [{ id: 'listen', icon: '🎯', label: '听力挑战' }, { id: 'blend', icon: '🧩', label: '拼装工坊' }], ruleHint: '前后鼻音', review: true },
  { day: 20, icon: '⚔️', title: '巩固⑥ 易错大作战', desc: '重打最后两关：平翘舌、前后鼻、ü 省略、标调全副武装', letters: [], levelIds: [14, 15], games: [{ id: 'char', icon: '📖', label: '识字挑战' }, { id: 'follow', icon: '🎤', label: '发音擂台' }], ruleHint: '易错点总攻', review: true },
  { day: 21, icon: '👑', title: '毕业典礼 · 总复习', desc: '任意关卡重打拿三星，再做单元测试，今天过后就是拼音毕业生！', letters: [], levelIds: [], games: [{ id: 'listen', icon: '🎯', label: '听力挑战' }, { id: 'blend', icon: '🧩', label: '拼装工坊' }], ruleHint: '总复习', review: true },
]

// 遗忘曲线复习间隔（天）：学后第 1、2、4、7 天各复习一次
export const REVIEW_GAPS = [1, 2, 4, 7]

/** 第 day 天需要按遗忘曲线复习哪几天的内容 */
export function reviewsForDay(day: number): DayPlan[] {
  const out: DayPlan[] = []
  for (let d = 1; d < day; d++) {
    if (REVIEW_GAPS.includes(day - d)) out.push(PLAN_21[d - 1])
  }
  return out
}

/** 新知识是否学完：当天字母全部点读 + 当天关卡全部通关（巩固日空关卡也算完成） */
export function newDoneOf(p: DayPlan): boolean {
  const lettersOk = p.letters.length === 0 || p.letters.every((x) => save.readLetters.includes(x))
  const levelsOk = p.levelIds.length === 0 || p.levelIds.every((id) => (save.stars[id] || 0) > 0)
  return lettersOk && levelsOk
}

/** 截至第 day 天已学的全部字母集合（声母/韵母/整体认读，去重）——练习小游戏按此范围出题 */
export function learnedLettersByDay(day: number): Set<string> {
  const set = new Set<string>()
  const n = Math.min(Math.max(day, 1), PLAN_DAYS)
  for (let d = 1; d <= n; d++) {
    for (const l of PLAN_21[d - 1].letters) set.add(l)
  }
  return set
}

/** 截至第 day 天已解锁的关卡 id 集合 */
export function learnedLevelIdsByDay(day: number): Set<number> {
  const set = new Set<number>()
  const n = Math.min(Math.max(day, 1), PLAN_DAYS)
  for (let d = 1; d <= n; d++) {
    for (const id of PLAN_21[d - 1].levelIds) set.add(id)
  }
  return set
}
