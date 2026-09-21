// 全局状态 + localStorage 持久化（无账号，进度保存在当前设备）
import { reactive, watch } from 'vue'
import { INITIALS } from './data/pinyin'

export interface WrongItem {
  kind: 'listen' | 'char' | 'blend'
  q: string      // 题面（listen 为汉字提示、char 为汉字、blend 为声母+韵母）
  audioZh: string // 播放发音用汉字
  answer: string  // 正确拼音
  picked: string  // 上次选错的拼音
  from: string    // 来源（关卡名/练习名）
  time: number
}

export interface DayRecord {
  newDone: boolean       // 新知识已完成（自动检测或手动）
  reviewsDone: number[]  // 已勾选完成的复习日
  wrongDone: boolean     // 错题巩固已勾选
  checked: boolean       // 今日已打卡
  date: string           // 打卡日期 YYYY-MM-DD
}

export interface PlanState {
  startDay: number       // 计划进行到第几天（1-21）
  days: Record<number, DayRecord>
  streak: number         // 当前连续打卡天数
  bestStreak: number     // 历史最长连续打卡
  lastDate: string       // 最近打卡日期
}

export interface SaveData {
  gems: number                          // 绿宝石（积分）
  stars: Record<number, number>         // 关卡 → 星级
  testScores: Record<number, number>    // 单元测试 → 分数
  badges: string[]                      // 已获得徽章
  readLetters: string[]                 // 点读过的字母
  wrongs: WrongItem[]                   // 错题本
  stats: { answered: number; correct: number; followFull: number; wrongCleared: boolean }
  settings: { rate: number; volume: number; effects: boolean }
  plan: PlanState                       // 21 天打卡计划
}

const KEY = 'pinyin-block-world-v1'

function load(): SaveData {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) {
      const d = JSON.parse(raw)
      return {
        gems: d.gems || 0,
        stars: d.stars || {},
        testScores: d.testScores || {},
        badges: d.badges || [],
        readLetters: d.readLetters || [],
        wrongs: Array.isArray(d.wrongs) ? d.wrongs : [],
        stats: { answered: 0, correct: 0, followFull: 0, wrongCleared: false, ...(d.stats || {}) },
        settings: { rate: 0.85, volume: 1, effects: true, ...(d.settings || {}) },
        plan: {
          startDay: d.plan?.startDay || 1,
          days: d.plan?.days || {},
          streak: d.plan?.streak || 0,
          bestStreak: d.plan?.bestStreak || 0,
          lastDate: d.plan?.lastDate || '',
        },
      }
    }
  } catch { /* 损坏数据忽略 */ }
  return {
    gems: 0, stars: {}, testScores: {}, badges: [], readLetters: [], wrongs: [],
    stats: { answered: 0, correct: 0, followFull: 0, wrongCleared: false },
    settings: { rate: 0.85, volume: 1, effects: true },
    plan: { startDay: 1, days: {}, streak: 0, bestStreak: 0, lastDate: '' },
  }
}

export const save = reactive<SaveData>(load())

watch(save, () => {
  try { localStorage.setItem(KEY, JSON.stringify(save)) } catch { /* 存储满等异常忽略 */ }
}, { deep: true })

export function resetAll() {
  save.gems = 0
  save.stars = {}
  save.testScores = {}
  save.badges = []
  save.readLetters = []
  save.wrongs = []
  save.stats = { answered: 0, correct: 0, followFull: 0 }
  save.plan = { startDay: 1, days: {}, streak: 0, bestStreak: 0, lastDate: '' }
}

export function addGems(n: number) { save.gems += n }

export function recordAnswer(correct: boolean) {
  save.stats.answered++
  if (correct) save.stats.correct++
}

export function addWrong(w: WrongItem) {
  // 同题去重：同 kind+answer+from 只保留最新
  save.wrongs = save.wrongs.filter((x) => !(x.kind === w.kind && x.answer === w.answer && x.from === w.from))
  save.wrongs.unshift(w)
  if (save.wrongs.length > 100) save.wrongs.length = 100
}

export function removeWrong(w: WrongItem) {
  const i = save.wrongs.indexOf(w)
  if (i >= 0) {
    save.wrongs.splice(i, 1)
    if (save.wrongs.length === 0) save.stats.wrongCleared = true
  }
}

export function markLetterRead(py: string) {
  if (!save.readLetters.includes(py)) save.readLetters.push(py)
}

export function setLevelStars(levelId: number, stars: number) {
  const old = save.stars[levelId] || 0
  if (stars > old) save.stars[levelId] = stars
}

// ---------- 21 天打卡计划 ----------
export function dayRec(day: number): DayRecord {
  if (!save.plan.days[day]) save.plan.days[day] = { newDone: false, reviewsDone: [], wrongDone: false, checked: false, date: '' }
  return save.plan.days[day]
}
/** 勾选/取消某个复习日（遗忘曲线）的完成状态 */
export function toggleReview(day: number, reviewDay: number) {
  const r = dayRec(day)
  const i = r.reviewsDone.indexOf(reviewDay)
  if (i >= 0) r.reviewsDone.splice(i, 1)
  else r.reviewsDone.push(reviewDay)
}
export function setNewDone(day: number, v: boolean) { dayRec(day).newDone = v }
export function setWrongDone(day: number, v: boolean) { dayRec(day).wrongDone = v }

function todayStr(d: Date = new Date()): string {
  const m = `${d.getMonth() + 1}`.padStart(2, '0')
  const dd = `${d.getDate()}`.padStart(2, '0')
  return `${d.getFullYear()}-${m}-${dd}`
}

/** 完成今日打卡：更新连续天数、+5 绿宝石，返回是否成功 */
export function checkInToday(): boolean {
  const day = save.plan.startDay
  const rec = dayRec(day)
  if (rec.checked) return false
  const t = todayStr()
  const y = todayStr(new Date(Date.now() - 864e5))
  save.plan.streak = save.plan.lastDate === y ? save.plan.streak + 1 : 1
  save.plan.bestStreak = Math.max(save.plan.bestStreak, save.plan.streak)
  save.plan.lastDate = t
  rec.checked = true
  rec.date = t
  save.gems += 5
  return true
}

// ---------- 徽章定义 ----------
export interface BadgeDef { id: string; icon: string; name: string; desc: string; got: () => boolean }

export const BADGES: BadgeDef[] = [
  { id: 'first-star', icon: '⭐', name: '初露锋芒', desc: '第一次闯关得到星星', got: () => Object.keys(save.stars).length > 0 },
  { id: 'gem-50', icon: '💎', name: '小富翁', desc: '攒到 50 颗绿宝石', got: () => save.gems >= 50 },
  { id: 'gem-200', icon: '💰', name: '宝石大亨', desc: '攒到 200 颗绿宝石', got: () => save.gems >= 200 },
  { id: 'letters-23', icon: '🔤', name: '声母全通', desc: '点读过全部 23 个声母', got: () => INITIALS.every((s) => save.readLetters.includes(s.py)) },
  { id: 'level-5', icon: '🗺️', name: '探险家', desc: '闯过 5 个关卡', got: () => Object.keys(save.stars).length >= 5 },
  { id: 'all-clear', icon: '👑', name: '拼音大王', desc: '15 个关卡全部通关', got: () => Object.keys(save.stars).length >= 15 },
  { id: 'correct-100', icon: '🎯', name: '百发百中', desc: '累计答对 100 题', got: () => save.stats.correct >= 100 },
  { id: 'perfect', icon: '🏆', name: '完美关卡', desc: '一次闯关全部答对', got: () => Object.values(save.stars).some((s) => s >= 3) },
  { id: 'test-90', icon: '📝', name: '考试高手', desc: '单元测试拿到 90 分以上', got: () => Object.values(save.testScores).some((s) => s >= 90) },
  { id: 'follow-10', icon: '🎤', name: '小小朗读家', desc: '跟读评分 10 次达到 3 星', got: () => save.stats.followFull >= 10 },
  { id: 'wrong-empty', icon: '🧹', name: '错题清零', desc: '把错题本全部消灭掉', got: () => save.stats.wrongCleared },
  { id: 'streak-3', icon: '🔥', name: '三日不辍', desc: '连续打卡 3 天', got: () => save.plan.bestStreak >= 3 },
  { id: 'streak-7', icon: '🔥', name: '一周坚持', desc: '连续打卡 7 天', got: () => save.plan.bestStreak >= 7 },
  { id: 'plan-mid', icon: '⛏️', name: '学习轮完成', desc: '完成前 14 天学习打卡', got: () => !!save.plan.days[14]?.checked },
  { id: 'plan-done', icon: '🎓', name: '拼音毕业', desc: '完成 21 天打卡计划', got: () => !!save.plan.days[21]?.checked },
]

// 每次状态变化后刷新徽章（每解锁一枚新徽章 +10 绿宝石）
export function refreshBadges(): string[] {
  const newly: string[] = []
  for (const b of BADGES) {
    if (!save.badges.includes(b.id) && b.got()) {
      save.badges.push(b.id)
      save.gems += 10
      newly.push(b.name)
    }
  }
  return newly
}
