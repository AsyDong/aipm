import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type {
  AppState, ChildProfile, DailySnapshot, DailyTask, LedgerEntry, LevelRecord, Pet,
  Prize, Question, Redeem, Settings, Subject, TaskTemplate, WrongItem,
} from '../types'
import { addDays, diffDays, nowDay } from '../engine/time'
import {
  ATTR_GAIN_CAP, ATTR_PER_CORRECT, DAILY_DECAY, EXP_PER_FOOD,
  FEED_LIMIT, FOOD_PER_SATIETY, MASTER_STREAK, POINT_PER_CORRECT, REDEEM_TIMEOUT_DAYS,
  REVIEW_INTERVALS, SATIETY_FULL, SATIETY_MAX, STAR_BONUS, STREAK_30_FOOD,
  STREAK_7_FOOD, stageOf, starsOf,
} from '../engine/rules'
import { DEFAULT_PRIZES, defaultTemplates } from '../data/content'
import { uid } from '../utils/id'
import { pruneMedia } from '../utils/media'
import { enqueueOp } from './sync'

const emptyPet = (species: Pet['species']): Pet => ({
  species,
  nickname: '',
  stage: 1,
  exp: 0,
  satiety: 60,
  fedToday: 0,
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

/** 孩子档案的默认值：昵称非真名（PRD 明确要求），年级默认一年级 */
const defaultChild: ChildProfile = { name: '', grade: 'g1', textbookVer: '' }

const initialState: AppState = {
  phase: 'adopt',
  pet: null,
  child: { ...defaultChild },
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

/** 纯函数：把一笔流水插到队首（只保留最近 300 笔） */
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

/**
 * 记账 + 同步。
 *
 * 所有食物/积分流水都必须走这里，而不是直接调 pushLedger ——
 * 埋点收口在一个函数里，将来加 op 类型只改这儿，不会漏掉某条业务路径。
 */
function recordLedger(
  list: LedgerEntry[],
  kind: LedgerEntry['kind'],
  delta: number,
  balance: number,
  source: LedgerEntry['source'],
  note: string,
): LedgerEntry[] {
  const next = pushLedger(list, kind, delta, balance, source, note)
  const entry = next[0]
  if (entry) {
    enqueueOp('ledger', {
      kind: entry.kind,
      delta: entry.delta,
      balance: entry.balance,
      source: entry.source,
      note: entry.note,
      at: new Date(entry.at).toISOString(),
    })
  }
  return next
}

/** 跨日结算产出的快照 → snapshot op（服务端按 child_id + day upsert，后到覆盖） */
function recordSnapshot(s: DailySnapshot): void {
  enqueueOp('snapshot', {
    day: s.day,
    satiety: s.satiety,
    fed: s.fed,
    full: s.full,
    // 体型机制已移除（2026-09-17），恒发 'normal'。
    // 这里**显式**发送而非依赖库列默认值：库表 daily_snapshots.body 保留不动（历史体型轨迹仍可查），
    // 若靠默认值，「确实是 normal」和「字段漏发」在报表里会长得一模一样，事后无法区分。
    body: 'normal',
    streak: s.streak,
    tasksDone: s.tasksDone,
    tasksTotal: s.tasksTotal,
    battles: s.battles,
    correctRate: s.correctRate,
    pointsEarned: s.pointsEarned,
    foodEarned: s.foodEarned,
  })
}

/** 关卡记录 → level_record op（服务端对 best_stars 取 GREATEST，进度不会回退） */
function recordLevel(r: LevelRecord): void {
  enqueueOp('level_record', {
    levelId: r.levelId,
    bestStars: r.bestStars,
    cleared: r.cleared,
    playCount: r.playCount ?? 1,
  })
}

/** 错题 → wrong_item op（服务端按 child_id + question_text upsert） */
function recordWrong(w: WrongItem): void {
  enqueueOp('wrong_item', {
    subject: w.subject,
    questionText: w.text,
    spec: w.spec,
    wrongCount: w.wrongCount,
    rightStreak: w.rightStreak,
    mastered: w.mastered,
    nextReviewDay: w.nextReviewDay,
  })
}

// ============ 实体快照的埋点（v1.3 补齐六张表）============
//
// 与账本流水一样收口在函数里：将来加字段只改一处，不会漏掉某条业务路径。
// 这六类对象在服务端是「一行一实体」，按业务主键 upsert，天然幂等 ——
// 所以既不需要 opId，也不要求到达顺序（这正是 pets 外键被去掉的原因）。

/** 服务端 redeems.status 的取值集合（比本地多一个 'timeout'） */
type RedeemDbStatus = 'pending' | 'approved' | 'rejected' | 'timeout' | 'delivered'

/** 孩子档案 → child op（服务端拿 sync 自管的 childId 当主键，不接受 op 里另带 id） */
function recordChild(c: ChildProfile): void {
  enqueueOp('child', {
    name: c.name || '宝贝',
    grade: c.grade || 'g1',
    textbookVer: c.textbookVer || '',
  })
}

/** 宠物档案 → pet op（一个孩子一只，按 child_id upsert） */
function recordPet(p: Pet): void {
  enqueueOp('pet', {
    species: p.species,
    name: p.nickname,
    stage: p.stage,
    exp: p.exp,
    satiety: p.satiety,
    fedToday: p.fedToday,
    // 体型机制已移除（2026-09-17），恒发 'normal'。库列 pets.body 保留不动，
    // 与 snapshot 同理：显式发送才能区分「确实是 normal」和「字段漏发」。
    body: 'normal',
    // 三科属性整体送过去，服务端写进 jsonb
    attrs: p.attrs,
  })
}

/** 任务模板 → task_template op。删除发 active:false（软删），不物理删行。 */
function recordTemplate(t: TaskTemplate, deleted = false): void {
  enqueueOp('task_template', {
    id: t.id,
    name: t.name,
    type: t.type,
    // 本地模板还没有学科维度（都是综合任务），服务端那列用 math 兜底
    subject: 'math',
    foodValue: t.foodValue,
    // active = 还在用：既没被删，也没被家长停用
    active: !deleted && t.enabled,
  })
}

/** 每日任务实例 → daily_task op。名称/图标/食物值是模板的冗余副本，不落库（按 template_id JOIN 回模板） */
function recordDailyTask(t: DailyTask): void {
  enqueueOp('daily_task', {
    id: t.id,
    day: t.day,
    templateId: t.templateId,
    status: t.status,
    mediaKey: t.mediaId ?? null,
    note: t.rejectReason ?? null,
    at: t.doneAt ? new Date(t.doneAt).toISOString() : null,
  })
}

/** 现实奖品 → prize op。删除同样走 active:false。 */
function recordPrize(p: Prize, deleted = false): void {
  enqueueOp('prize', {
    id: p.id,
    name: p.name,
    points: p.points,
    note: p.note ?? '',
    active: !deleted,
  })
}

/**
 * 兑换单 → redeem op。
 *
 * 有一处必须由调用方显式指定：「超时自动退回」在本地也只能记成 state='rejected'，
 * 但它和家长手动驳回不是一回事 —— 服务端 CHECK 里它们是两个值（timeout / rejected）。
 */
function recordRedeem(r: Redeem, status?: RedeemDbStatus): void {
  enqueueOp('redeem', {
    id: r.id,
    prizeId: r.prizeId,
    prizeName: r.prizeName,
    points: r.points,
    status: status ?? r.state,
    createdAt: new Date(r.at).toISOString(),
    decidedAt: r.reviewedAt ?? r.deliveredAt ?? null,
  })
}

/**
 * 结算单个游戏日：饱食度衰减 → 连击判定 → 计数器归零
 *
 * 体型机制已移除（2026-09-17）：不再统计「连续未喂天数」「连续顶格天数」，也不再推导
 * 瘦 / 正常 / 胖。跨日只做衰减与归零，宠物形态只随阶段（exp）变化。
 * 保留 `full`（当日结算饱和食度是否顶格）—— 那是饱食度的事实记录，不隶属体型机制，
 * 与库列 daily_snapshots.is_full 一一对应。
 */
function settleDayOnce(s: AppState): Partial<AppState> {
  const pet = s.pet
  const fed = pet?.fedToday ?? 0

  const fullToday = (pet?.satiety ?? 0) >= SATIETY_FULL

  const satiety = Math.max(0, (pet?.satiety ?? 0) - DAILY_DECAY)
  const streak = s.todayTasksDone > 0 ? s.streak : 0

  const snapshot: DailySnapshot = {
    day: s.activeDay,
    satiety,
    fed,
    full: fullToday,
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
    pet: pet ? { ...pet, satiety, fedToday: 0 } : null,
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
  /** 修改孩子档案（P13 的采集入口待加；在此之前只有默认值） */
  setChildProfile: (patch: Partial<ChildProfile>) => void
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
          const patch = settleDayOnce(get())
          set(patch)
          // 结算出的快照是成长报告的原始数据，逐日入队（补结算多天则各记一条）
          const snaps = patch.snapshots
          if (snaps && snaps.length > 0) recordSnapshot(snaps[snaps.length - 1])
          // 结算会改饱食度与体型，宠物档案要跟着更新
          if (patch.pet) recordPet(patch.pet)
          guard += 1
        }
        return guard
      }

      /**
       * 补发一遍「实体快照」，启动时调一次。
       *
       * 全是 upsert，重复推不会写重；换来的是「同步是后来才打开的」也能把已有档案补齐 ——
       * 否则早先建好的任务模板、奖品、宠物档案永远进不了库。
       *
       * 注意每个都套了一层箭头：直接写 `forEach(recordTemplate)` 会把数组下标当成第二个
       * 参数（也就是 deleted）传进去，把第二条之后的模板统统标成「已删除」。
       */
      const seedEntities = () => {
        const s = get()
        if (!s.pet) return
        recordChild(s.child)
        recordPet(s.pet)
        s.templates.forEach((t) => recordTemplate(t))
        s.prizes.forEach((p) => recordPrize(p))
        s.daily.forEach((d) => recordDailyTask(d))
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
          if (add.length > 0) {
            set({ daily: [...s.daily, ...add] })
            add.forEach((d) => recordDailyTask(d))
          }
          return
        }
        const todayTasks = s.templates.filter((t) => t.enabled).map(mk)
        set({ daily: todayTasks })
        todayTasks.forEach((d) => recordDailyTask(d))
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
          ledger = recordLedger(ledger, 'point', r.points, points, 'refund', `超时未审批退回：${r.prizeName}`)
          const expired = { ...r, state: 'rejected' as const, reason: '超过 7 天未处理，已自动退回积分' }
          // 本地只能记成 rejected，但要跟服务端说清楚：这是「超时」不是家长驳回
          recordRedeem(expired, 'timeout')
          return expired
        })
        if (points !== s.points) set({ redeems, points, frozenPoints: frozen, pointLedger: ledger })
      }

      const earnFood = (n: number, source: LedgerEntry['source'], note: string) => {
        const s = get()
        const food = Math.max(0, s.food + n)
        set({
          food,
          todayFoodEarned: s.todayFoodEarned + Math.max(0, n),
          foodLedger: recordLedger(s.foodLedger, 'food', n, food, source, note),
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
          seedEntities()
          void pruneMedia()
        },

        ensureDay: () => {
          if (advanceDays() > 0) void pruneMedia()
          ensureTasks()
          autoUnfreeze()
        },

        setChildProfile: (patch) => {
          const child = { ...get().child, ...patch }
          set({ child })
          recordChild(child)
        },

        adopt: (species) => {
          const pet = emptyPet(species)
          set({ pet, phase: 'hatch' })
          recordPet(pet)
        },

        hatchDone: () => set({ phase: 'name' }),

        setName: (name) => {
          const pet = get().pet
          if (!pet) return
          const next = { ...pet, nickname: name, locked: true }
          set({ pet: next, phase: 'home' })
          recordPet(next)
          // 走到 home 才算真正落地，顺手把孩子档案补上（否则要等下一次启动）
          recordChild(get().child)
          ensureTasks()
        },

        renamePet: (name) => {
          const pet = get().pet
          if (!pet) return
          const next = { ...pet, nickname: name }
          set({ pet: next })
          recordPet(next)
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
          const food = s.food - actual
          // 体型机制已移除：投喂只影响 饱食度 / 经验 / 阶段，不再改变形态
          const nextPet = { ...pet, satiety, exp, stage: stageOf(exp), fedToday }

          set({
            food,
            foodLedger: recordLedger(s.foodLedger, 'food', -actual, food, 'feed', `喂养 ${actual} 份`),
            pet: nextPet,
          })
          recordPet(nextPet)
          if (fedToday >= FEED_LIMIT) return { ok: true, msg: '今天喂满啦，明天再来吧～' }
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
            recordDailyTask(next[idx])
            return
          }
          next[idx] = { ...t, status: 'done', mediaId, doneAt: Date.now() }
          set({ daily: next, todayTasksDone: s.todayTasksDone + 1 })
          recordDailyTask(next[idx])
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
          recordDailyTask(next[idx])
          completeOne(t)
        },

        rejectTask: (taskId, reason) => {
          const s = get()
          const next = s.daily.map((t) =>
            t.id === taskId ? { ...t, status: 'rejected' as const, rejectReason: reason } : t)
          set({ daily: next })
          const updated = next.find((t) => t.id === taskId)
          if (updated) recordDailyTask(updated)
        },

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
            pointLedger: recordLedger(s.pointLedger, 'point', n, points, 'parent', note || '家长奖励'),
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

          const record: LevelRecord = {
            levelId,
            subject,
            bestStars: Math.max(stars, rec?.bestStars ?? 0),
            cleared: true,
            bestCorrect: Math.max(correct, rec?.bestCorrect ?? 0),
            total,
            lastAt: Date.now(),
            playCount: (rec?.playCount ?? 0) + 1,
          }
          const levels = s.levels.filter((l) => l.levelId !== levelId)
          levels.push(record)

          const nextPet = pet
            ? { ...pet, attrs: { ...pet.attrs, [subject]: pet.attrs[subject] + attrGain } }
            : pet
          const newPoints = s.points + points
          set({
            points: newPoints,
            todayPoints: s.todayPoints + points,
            pointLedger: recordLedger(s.pointLedger, 'point', points, newPoints, 'battle', `闯关获得 ${points} 分`),
            levels,
            wrong,
            todayBattles: s.todayBattles + 1,
            todayCorrect: s.todayCorrect + correct,
            todayTotal: s.todayTotal + total,
            pet: nextPet,
          })

          recordLevel(record)
          // 三科属性变了，宠物档案跟着更新
          if (nextPet) recordPet(nextPet)
          for (const q of wrongQs) {
            const item = wrong.find((w) => w.text === q.text)
            if (item) recordWrong(item)
          }
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
          const updated = wrong.find((w) => w.id === wrongId)
          if (updated) recordWrong(updated)
        },

        buyItem: (itemId, cost) => {
          const s = get()
          if (s.points < cost) return false
          const points = s.points - cost
          set({
            points,
            owned: s.owned.includes(itemId) ? s.owned : [...s.owned, itemId],
            pointLedger: recordLedger(s.pointLedger, 'point', -cost, points, 'spend', '购买装饰'),
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
          const order: Redeem = {
            id: uid('r'), prizeId: prize.id, prizeName: prize.name,
            points: prize.points, state: 'pending', at: Date.now(),
          }
          set({
            points,
            frozenPoints: s.frozenPoints + prize.points,
            redeems: [order, ...s.redeems],
            pointLedger: recordLedger(s.pointLedger, 'point', -prize.points, points, 'exchange', `兑换冻结：${prize.name}`),
          })
          recordRedeem(order)
          return true
        },

        approveRedeem: (id) => {
          const s = get()
          const r = s.redeems.find((x) => x.id === id)
          if (!r || r.state !== 'pending') return
          const next = s.redeems.map((x) =>
            x.id === id ? { ...x, state: 'approved' as const, reviewedAt: Date.now() } : x)
          set({ frozenPoints: Math.max(0, s.frozenPoints - r.points), redeems: next })
          const updated = next.find((x) => x.id === id)
          if (updated) recordRedeem(updated)
        },

        rejectRedeem: (id, reason) => {
          const s = get()
          const r = s.redeems.find((x) => x.id === id)
          if (!r || r.state !== 'pending') return
          const points = s.points + r.points
          const next = s.redeems.map((x) =>
            x.id === id ? { ...x, state: 'rejected' as const, reviewedAt: Date.now(), reason } : x)
          set({
            points,
            frozenPoints: Math.max(0, s.frozenPoints - r.points),
            pointLedger: recordLedger(s.pointLedger, 'point', r.points, points, 'refund', `兑换被驳回：${r.prizeName}`),
            redeems: next,
          })
          const updated = next.find((x) => x.id === id)
          if (updated) recordRedeem(updated)
        },

        deliverRedeem: (id) => {
          const s = get()
          const next = s.redeems.map((x) =>
            x.id === id ? { ...x, state: 'delivered' as const, deliveredAt: Date.now() } : x)
          set({ redeems: next })
          const updated = next.find((x) => x.id === id)
          if (updated) recordRedeem(updated)
        },

        addPrize: (name, points, note) => {
          const prize: Prize = { id: uid('p'), name, points, note }
          set((s) => ({ prizes: [...s.prizes, prize] }))
          recordPrize(prize)
        },

        updatePrize: (id, patch) => {
          const s = get()
          const next = s.prizes.map((p) => (p.id === id ? { ...p, ...patch } : p))
          set({ prizes: next })
          const updated = next.find((p) => p.id === id)
          if (updated) recordPrize(updated)
        },

        removePrize: (id) => {
          const s = get()
          const removed = s.prizes.find((p) => p.id === id)
          set({ prizes: s.prizes.filter((p) => p.id !== id) })
          // 软删：服务端只把 active 置 false —— 历史兑换单还要引用这个奖品
          if (removed) recordPrize(removed, true)
        },

        addTemplate: (t) => {
          const id = uid('t')
          const created: TaskTemplate = { ...t, id, createdAt: Date.now() }
          set((s) => ({ templates: [...s.templates, created] }))
          recordTemplate(created)
          return id
        },

        updateTemplate: (id, patch) => {
          const s = get()
          const next = s.templates.map((t) => (t.id === id ? { ...t, ...patch } : t))
          set({ templates: next })
          const updated = next.find((t) => t.id === id)
          if (updated) recordTemplate(updated)
        },

        removeTemplate: (id) => {
          const s = get()
          const removed = s.templates.find((t) => t.id === id)
          set({ templates: s.templates.filter((t) => t.id !== id) })
          // 软删：历史 daily_tasks 的 template_id 还得能 JOIN 回这个模板
          if (removed) recordTemplate(removed, true)
        },

        setPin: (pin) => set((s) => ({ settings: { ...s.settings, parentPin: pin, pinChanged: true } })),

        toggleSetting: (k) => set((s) => ({ settings: { ...s.settings, [k]: !s.settings[k] } })),
      }
    },
    { name: 'pet-checkin-v1', version: 1 },
  ),
)
