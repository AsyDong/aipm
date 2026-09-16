import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type {
  AppState, BodyType, DailySnapshot, DailyTask, LedgerEntry, Pet, Question,
  Settings, Subject, TaskTemplate,
} from '../types'
import { addDays, diffDays, nowDay } from '../engine/time'
import {
  ATTR_GAIN_CAP, ATTR_PER_CORRECT, DAILY_DECAY, EXP_PER_FOOD, FAT_FULL_DAYS,
  FEED_LIMIT, FOOD_PER_SATIETY, MASTER_STREAK, POINT_PER_CORRECT, REDEEM_TIMEOUT_DAYS,
  REVIEW_INTERVALS, SATIETY_FULL, SATIETY_MAX, STAR_BONUS, STREAK_30_FOOD,
  STREAK_7_FOOD, THIN_DAYS, stageOf, starsOf,
} from '../engine/rules'
import { DEFAULT_PRIZES, defaultTemplates } from '../data/content'
import { uid } from '../utils/id'
import { pruneMedia } from '../utils/media'

const emptyPet = (species: Pet['species']): Pet => ({
  species,
  nickname: '',
  stage: 1,
  exp: 0,
  satiety: 60,
  body: 'normal',
  fedToday: 0,
  noFeedDays: 0,
  fullDays: 0,
  attrs: { math: 0, chinese: 0, english: 0 },
  locked: false,
  bornAt: Date.now(),
})

const baseSettings: Settings = {
  sound: true,
  readAloud: true,
  parentPin: '1234',
  pinChanged: false,
  dailyBattleMinutes: 15,
}

const initialState: AppState = {
  phase: 'adopt',
  pet: null,
  templates: [],
  daily: [],
  food: 0,
  points: 0,
  frozenPoints: 0,
  foodLedger: [],
  pointLedger: [],
  streak: 0,
  longestStreak: 0,
  levels: [],
  wrong: [],
  prizes: [],
  redeems: [],
  owned: [],
  placed: [],
  snapshots: [],
  settings: baseSettings,
  activeDay: nowDay(),
  todayBattles: 0,
  todayCorrect: 0,
  todayTotal: 0,
  todayPoints: 0,
  todayFoodEarned: 0,
  todayTasksDone: 0,
  wrongSolvedTotal: 0,
}

function pushLedger(
  list: LedgerEntry[],
  kind: LedgerEntry['kind'],
  delta: number,
  balance: number,
  source: LedgerEntry['source'],
  note: string,
): LedgerEntry[] {
  const entry: LedgerEntry = { id: uid('l'), kind, delta, balance, source, note, at: Date.now() }
  return [entry, ...list].slice(0, 300)
}

/** 结算单个游戏日：饱食度衰减 → 体型判定 → 连击判定 → 计数器归零 */
function settleDayOnce(s: AppState): Partial<AppState> {
  const pet = s.pet
  const fed = pet?.fedToday ?? 0

  const noFeed = fed === 0 ? (pet?.noFeedDays ?? 0) + 1 : 0
  const fullToday = (pet?.satiety ?? 0) >= SATIETY_FULL
  const full = fullToday ? (pet?.fullDays ?? 0) + 1 : 0

  let body: BodyType = 'normal'
  if (noFeed >= THIN_DAYS) body = 'thin'
  else if (fed >= FEED_LIMIT || full >= FAT_FULL_DAYS) body = 'fat'

  const satiety = Math.max(0, (pet?.satiety ?? 0) - DAILY_DECAY)
  const streak = s.todayTasksDone > 0 ? s.streak : 0

  const snapshot: DailySnapshot = {
    day: s.activeDay,
    satiety,
    fed,
    full: fullToday,
    body,
    streak,
    tasksDone: s.todayTasksDone,
    tasksTotal: s.daily.length,
    battles: s.todayBattles,
    correctRate: s.todayTotal ? s.todayCorrect / s.todayTotal : 0,
    pointsEarned: s.todayPoints,
    foodEarned: s.todayFoodEarned,
  }

  return {
    activeDay: addDays(s.activeDay, 1),
    pet: pet ? { ...pet, satiety, body, noFeedDays: noFeed, fullDays: full, fedToday: 0 } : null,
    streak,
    longestStreak: Math.max(s.longestStreak, streak),
    daily: [],
    todayBattles: 0,
    todayCorrect: 0,
    todayTotal: 0,
    todayPoints: 0,
    todayFoodEarned: 0,
    todayTasksDone: 0,
    snapshots: [...s.snapshots, snapshot].slice(-400),
  }
}

export interface FeedResult { ok: boolean; msg: string }
export interface BattleResult { points: number; stars: number; attr: number; firstClear: boolean }

interface Actions {
  bootstrap: () => void
  ensureDay: () => void
  adopt: (species: Pet['species']) => void
  hatchDone: () => void
  setName: (name: string) => void
  renamePet: (name: string) => void
  feed: (n: number) => FeedResult
  submitTask: (taskId: string, mediaId?: string) => void
  approveTask: (taskId: string) => void
  rejectTask: (taskId: string, reason: string) => void
  parentAdjustFood: (n: number, note: string) => void
  parentGrantPoints: (n: number, note: string) => void
  finishBattle: (subject: Subject, levelId: string, correct: number, total: number, wrongQs: Question[]) => BattleResult
  reviewWrong: (wrongId: string, ok: boolean) => void
  buyItem: (itemId: string, cost: number) => boolean
  placeItem: (itemId: string, x: number, y: number) => void
  movePlaced: (u: string, x: number, y: number) => void
  removePlaced: (u: string) => void
  resetPlaced: () => void
  redeem: (prizeId: string) => boolean
  approveRedeem: (id: string) => void
  rejectRedeem: (id: string, reason: string) => void
  deliverRedeem: (id: string) => void
  addPrize: (name: string, points: number, note: string) => void
  updatePrize: (id: string, patch: Partial<{ name: string; points: number; note: string }>) => void
  removePrize: (id: string) => void
  addTemplate: (t: Omit<TaskTemplate, 'id' | 'createdAt'>) => string
  updateTemplate: (id: string, patch: Partial<TaskTemplate>) => void
  removeTemplate: (id: string) => void
  setPin: (pin: string) => void
  toggleSetting: (k: 'sound' | 'readAloud') => void
}

export type Store = AppState & Actions

export const useStore = create<Store>()(
  persist(
    (set, get) => {
      /** 推进活跃日到今天，并逐日结算 */
      const advanceDays = () => {
        let guard = 0
        while (get().activeDay !== nowDay() && guard < 20) {
          set(settleDayOnce(get()))
          guard += 1
        }
        return guard
      }

      /** 生成当日任务实例；家长中途新增的任务会即时补进来 */
      const ensureTasks = () => {
        const s = get()
        if (s.templates.length === 0) return
        const mk = (t: TaskTemplate): DailyTask => ({
          id: uid('d'),
          day: s.activeDay,
          templateId: t.id,
          name: t.name,
          icon: t.icon,
          type: t.type,
          foodValue: t.foodValue,
          status: 'todo',
        })
        if (s.daily.length > 0 && s.daily[0].day === s.activeDay) {
          const have = new Set(s.daily.map((d) => d.templateId))
          const add = s.templates.filter((t) => t.enabled && !have.has(t.id)).map(mk)
          if (add.length > 0) set({ daily: [...s.daily, ...add] })
          return
        }
        set({ daily: s.templates.filter((t) => t.enabled).map(mk) })
      }

      /** 超时未审批的兑换自动解冻（REDEEM_TIMEOUT_DAYS） */
      const autoUnfreeze = () => {
        const s = get()
        const today = nowDay()
        let points = s.points
        let frozen = s.frozenPoints
        let ledger = s.pointLedger
        const redeems = s.redeems.map((r) => {
          if (r.state !== 'pending') return r
          if (diffDays(nowDay(r.at), today) < REDEEM_TIMEOUT_DAYS) return r
          points += r.points
          frozen -= r.points
          ledger = pushLedger(ledger, 'point', r.points, points, 'refund', `超时未审批退回：${r.prizeName}`)
          return { ...r, state: 'rejected' as const, reason: '超过 7 天未处理，已自动退回积分' }
        })
        if (points !== s.points) set({ redeems, points, frozenPoints: frozen, pointLedger: ledger })
      }

      const earnFood = (n: number, source: LedgerEntry['source'], note: string) => {
        const s = get()
        const food = Math.max(0, s.food + n)
        set({
          food,
          todayFoodEarned: s.todayFoodEarned + Math.max(0, n),
          foodLedger: pushLedger(s.foodLedger, 'food', n, food, source, note),
        })
      }

      /** 完成任务：发食物 → 首个任务时连击 +1 → 第 7/30 天额外奖励 */
      const completeOne = (t: DailyTask) => {
        earnFood(t.foodValue, 'task', `完成「${t.name}」`)
        const s = get()
        if (s.todayTasksDone !== 1) return
        const streak = s.streak + 1
        set({ streak, longestStreak: Math.max(s.longestStreak, streak) })
        if (streak === 30) earnFood(STREAK_30_FOOD, 'streak30', '连续打卡 30 天，额外奖励 5 份')
        else if (streak === 7) earnFood(STREAK_7_FOOD, 'streak7', '连续打卡 7 天，额外奖励 1 份')
      }

      return {
        ...initialState,

        bootstrap: () => {
          if (get().templates.length === 0) set({ templates: defaultTemplates() })
          if (get().prizes.length === 0) set({ prizes: DEFAULT_PRIZES })
          advanceDays()
          ensureTasks()
          autoUnfreeze()
          void pruneMedia()
        },

        ensureDay: () => {
          if (advanceDays() > 0) void pruneMedia()
          ensureTasks()
          autoUnfreeze()
        },

        adopt: (species) => set({ pet: emptyPet(species), phase: 'hatch' }),

        hatchDone: () => set({ phase: 'name' }),

        setName: (name) => {
          const pet = get().pet
          if (!pet) return
          set({ pet: { ...pet, nickname: name, locked: true }, phase: 'home' })
          ensureTasks()
        },

        renamePet: (name) => {
          const pet = get().pet
          if (pet) set({ pet: { ...pet, nickname: name } })
        },

        feed: (n) => {
          get().ensureDay()
          const s = get()
          const pet = s.pet
          if (!pet) return { ok: false, msg: '还没有小宠物哦' }
          if (n <= 0) return { ok: false, msg: '请选择要喂几份' }
          if (s.food < n) return { ok: false, msg: '食物不够啦，先去完成任务' }
          const remain = FEED_LIMIT - pet.fedToday
          if (remain <= 0) return { ok: false, msg: '今天吃太多啦，明天再喂' }
          if (pet.satiety >= SATIETY_MAX) return { ok: false, msg: '宝宝撑到啦，明天再来' }
          const room = Math.ceil((SATIETY_MAX - pet.satiety) / FOOD_PER_SATIETY)
          const actual = Math.max(1, Math.min(n, remain, room))

          const satiety = Math.min(SATIETY_MAX, pet.satiety + actual * FOOD_PER_SATIETY)
          const exp = pet.exp + actual * EXP_PER_FOOD
          const fedToday = pet.fedToday + actual
          const body: BodyType = fedToday >= FEED_LIMIT ? 'fat' : pet.body
          const food = s.food - actual

          set({
            food,
            foodLedger: pushLedger(s.foodLedger, 'food', -actual, food, 'feed', `喂养 ${actual} 份`),
            pet: { ...pet, satiety, exp, stage: stageOf(exp), fedToday, body, noFeedDays: 0 },
          })
          if (fedToday >= FEED_LIMIT) return { ok: true, msg: '吃太饱了，变胖啦！' }
          if (satiety >= SATIETY_FULL) return { ok: true, msg: '吃饱啦，好幸福～' }
          return { ok: true, msg: `喂了 ${actual} 份，饱食度 +${actual * FOOD_PER_SATIETY}` }
        },

        submitTask: (taskId, mediaId) => {
          get().ensureDay()
          const s = get()
          const idx = s.daily.findIndex((t) => t.id === taskId)
          if (idx < 0) return
          const t = s.daily[idx]
          if (t.status === 'done' || t.status === 'pending') return

          const next = s.daily.slice()
          if (t.type === 'subjective') {
            next[idx] = { ...t, status: 'pending', mediaId }
            set({ daily: next })
            return
          }
          next[idx] = { ...t, status: 'done', mediaId, doneAt: Date.now() }
          set({ daily: next, todayTasksDone: s.todayTasksDone + 1 })
          completeOne(t)
        },

        approveTask: (taskId) => {
          get().ensureDay()
          const s = get()
          const idx = s.daily.findIndex((t) => t.id === taskId)
          if (idx < 0) return
          const t = s.daily[idx]
          if (t.status === 'done') return
          const next = s.daily.slice()
          next[idx] = { ...t, status: 'done', doneAt: Date.now() }
          set({ daily: next, todayTasksDone: s.todayTasksDone + 1 })
          completeOne(t)
        },

        rejectTask: (taskId, reason) =>
          set((s) => ({
            daily: s.daily.map((t) => (t.id === taskId ? { ...t, status: 'rejected', rejectReason: reason } : t)),
          })),

        parentAdjustFood: (n, note) => {
          get().ensureDay()
          earnFood(n, 'parent', note || '家长手动调整')
        },

        parentGrantPoints: (n, note) => {
          get().ensureDay()
          const s = get()
          const points = Math.max(0, s.points + n)
          set({
            points,
            todayPoints: s.todayPoints + Math.max(0, n),
            pointLedger: pushLedger(s.pointLedger, 'point', n, points, 'parent', note || '家长奖励'),
          })
        },

        finishBattle: (subject, levelId, correct, total, wrongQs) => {
          get().ensureDay()
          const s = get()
          const pet = s.pet
          const stars = starsOf(correct, total)
          const zero: BattleResult = { points: 0, stars: 0, attr: 0, firstClear: false }
          if (stars === 0) return zero

          const rec = s.levels.find((l) => l.levelId === levelId)
          const firstClear = !rec?.cleared
          const points = (correct * POINT_PER_CORRECT + STAR_BONUS[stars]) * (firstClear ? 2 : 1)
          const attrGain = Math.min(ATTR_GAIN_CAP, Math.floor(correct / ATTR_PER_CORRECT))

          const today = nowDay()
          const wrong = s.wrong.slice()
          for (const q of wrongQs) {
            const exist = wrong.find((w) => !w.mastered && w.text === q.text)
            if (exist) {
              exist.wrongCount += 1
              exist.rightStreak = 0
              exist.nextReviewDay = addDays(today, REVIEW_INTERVALS[0])
            } else {
              wrong.push({
                id: uid('w'),
                subject,
                spec: q.spec,
                text: q.text,
                answer: q.answer,
                skill: q.skill,
                explain: q.explain,
                wrongCount: 1,
                rightStreak: 0,
                mastered: false,
                nextReviewDay: addDays(today, REVIEW_INTERVALS[0]),
                createdAt: Date.now(),
              })
            }
          }

          const levels = s.levels.filter((l) => l.levelId !== levelId)
          levels.push({
            levelId,
            subject,
            bestStars: Math.max(stars, rec?.bestStars ?? 0),
            cleared: true,
            bestCorrect: Math.max(correct, rec?.bestCorrect ?? 0),
            total,
            lastAt: Date.now(),
          })

          const newPoints = s.points + points
          set({
            points: newPoints,
            todayPoints: s.todayPoints + points,
            pointLedger: pushLedger(s.pointLedger, 'point', points, newPoints, 'battle', `闯关获得 ${points} 分`),
            levels,
            wrong,
            todayBattles: s.todayBattles + 1,
            todayCorrect: s.todayCorrect + correct,
            todayTotal: s.todayTotal + total,
            pet: pet ? { ...pet, attrs: { ...pet.attrs, [subject]: pet.attrs[subject] + attrGain } } : pet,
          })
          return { points, stars, attr: attrGain, firstClear }
        },

        reviewWrong: (wrongId, ok) => {
          const s = get()
          const today = nowDay()
          let solved = 0
          const wrong = s.wrong.map((w) => {
            if (w.id !== wrongId) return w
            if (!ok) {
              return {
                ...w,
                wrongCount: w.wrongCount + 1,
                rightStreak: 0,
                mastered: false,
                nextReviewDay: addDays(today, REVIEW_INTERVALS[0]),
              }
            }
            const rs = w.rightStreak + 1
            const mastered = rs >= MASTER_STREAK
            if (mastered) solved += 1
            const step = Math.min(w.wrongCount, REVIEW_INTERVALS.length - 1)
            return {
              ...w,
              rightStreak: rs,
              mastered,
              nextReviewDay: mastered ? w.nextReviewDay : addDays(today, REVIEW_INTERVALS[step]),
            }
          })
          set({ wrong, wrongSolvedTotal: s.wrongSolvedTotal + solved })
        },

        buyItem: (itemId, cost) => {
          const s = get()
          if (s.points < cost) return false
          const points = s.points - cost
          set({
            points,
            owned: s.owned.includes(itemId) ? s.owned : [...s.owned, itemId],
            pointLedger: pushLedger(s.pointLedger, 'point', -cost, points, 'spend', '购买装饰'),
          })
          return true
        },

        placeItem: (itemId, x, y) =>
          set((s) => ({ placed: [...s.placed, { uid: uid('pi'), itemId, x, y }] })),

        movePlaced: (u, x, y) =>
          set((s) => ({ placed: s.placed.map((p) => (p.uid === u ? { ...p, x, y } : p)) })),

        removePlaced: (u) => set((s) => ({ placed: s.placed.filter((p) => p.uid !== u) })),

        resetPlaced: () => set({ placed: [] }),

        redeem: (prizeId) => {
          const s = get()
          const prize = s.prizes.find((p) => p.id === prizeId)
          if (!prize || s.points < prize.points) return false
          const points = s.points - prize.points
          set({
            points,
            frozenPoints: s.frozenPoints + prize.points,
            redeems: [
              { id: uid('r'), prizeId: prize.id, prizeName: prize.name, points: prize.points, state: 'pending', at: Date.now() },
              ...s.redeems,
            ],
            pointLedger: pushLedger(s.pointLedger, 'point', -prize.points, points, 'exchange', `兑换冻结：${prize.name}`),
          })
          return true
        },

        approveRedeem: (id) => {
          const s = get()
          const r = s.redeems.find((x) => x.id === id)
          if (!r || r.state !== 'pending') return
          set({
            frozenPoints: Math.max(0, s.frozenPoints - r.points),
            redeems: s.redeems.map((x) => (x.id === id ? { ...x, state: 'approved', reviewedAt: Date.now() } : x)),
          })
        },

        rejectRedeem: (id, reason) => {
          const s = get()
          const r = s.redeems.find((x) => x.id === id)
          if (!r || r.state !== 'pending') return
          const points = s.points + r.points
          set({
            points,
            frozenPoints: Math.max(0, s.frozenPoints - r.points),
            pointLedger: pushLedger(s.pointLedger, 'point', r.points, points, 'refund', `兑换被驳回：${r.prizeName}`),
            redeems: s.redeems.map((x) => (x.id === id ? { ...x, state: 'rejected', reviewedAt: Date.now(), reason } : x)),
          })
        },

        deliverRedeem: (id) =>
          set((s) => ({
            redeems: s.redeems.map((x) => (x.id === id ? { ...x, state: 'delivered', deliveredAt: Date.now() } : x)),
          })),

        addPrize: (name, points, note) =>
          set((s) => ({ prizes: [...s.prizes, { id: uid('p'), name, points, note }] })),

        updatePrize: (id, patch) =>
          set((s) => ({ prizes: s.prizes.map((p) => (p.id === id ? { ...p, ...patch } : p)) })),

        removePrize: (id) => set((s) => ({ prizes: s.prizes.filter((p) => p.id !== id) })),

        addTemplate: (t) => {
          const id = uid('t')
          set((s) => ({ templates: [...s.templates, { ...t, id, createdAt: Date.now() }] }))
          return id
        },

        updateTemplate: (id, patch) =>
          set((s) => ({ templates: s.templates.map((t) => (t.id === id ? { ...t, ...patch } : t)) })),

        removeTemplate: (id) => set((s) => ({ templates: s.templates.filter((t) => t.id !== id) })),

        setPin: (pin) => set((s) => ({ settings: { ...s.settings, parentPin: pin, pinChanged: true } })),

        toggleSetting: (k) => set((s) => ({ settings: { ...s.settings, [k]: !s.settings[k] } })),
      }
    },
    { name: 'pet-checkin-v1', version: 1 },
  ),
)
