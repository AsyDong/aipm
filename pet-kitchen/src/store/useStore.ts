import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type {
  AppState, ChildProfile, DailySnapshot, DailyTask, LedgerEntry, LevelRecord, Pet,
  Prize, Question, Redeem, Settings, Subject, TaskTemplate, WrongItem,
} from '../types'
import { addDays, diffDays, nowDay } from '../engine/time'
import {
  ATTR_GAIN_CAP, ATTR_PER_CORRECT, DAILY_DECAY, EXP_PER_FOOD, FIRST_CLEAR_BONUS,
  FEED_LIMIT, FOOD_PER_SATIETY, MASTER_STREAK, REDEEM_TIMEOUT_DAYS,
  REVIEW_INTERVALS, SATIETY_FULL, SATIETY_MAX, STREAK_30_FOOD,
  STREAK_7_FOOD, stageOf, starsOf,
} from '../engine/rules'
import { DEFAULT_PRIZES, defaultTemplates } from '../data/content'
import { levelById } from '../engine/questions'
import { uid } from '../utils/id'
import { pruneMedia } from '../utils/media'
import {
  childId as syncChildId, enabled as syncEnabled, enqueueOp, flushSync,
  pendingCount, pullState,
} from './sync'

// ============ 任务排期（常规 / 今日） ============

const WEEK_ALL = [1, 2, 3, 4, 5, 6, 7]

/** 游戏日 → 星期几（1=周一 … 7=周日）。UTC+8 的游戏日按本地日期解析即可，取的是星期不是时刻 */
export function weekdayOf(day: string): number {
  const d = new Date(`${day}T00:00:00`).getDay()
  return d === 0 ? 7 : d
}

/** 模板在某游戏日是否生成任务实例 */
export function templateAppliesOn(t: TaskTemplate, day: string): boolean {
  if (!t.enabled) return false
  if (t.kind === 'once') return t.onceDay === day
  const weekdays = t.weekdays && t.weekdays.length > 0 ? t.weekdays : WEEK_ALL
  return weekdays.includes(weekdayOf(day))
}

/** 今日任务已提交/已通过后即从列表消失（驳回的还要重做，所以保留展示） */
export function dailyTaskVisible(t: DailyTask): boolean {
  return !(t.kind === 'once' && (t.status === 'done' || t.status === 'pending'))
}

/** 由模板生成当天的任务实例（快照 name/icon/note/kind，模板后续改动不影响已生成的实例） */
function mkDaily(t: TaskTemplate, day: string): DailyTask {
  return {
    id: uid('d'),
    day,
    templateId: t.id,
    name: t.name,
    icon: t.icon,
    type: t.type,
    note: t.note,
    kind: t.kind ?? 'regular',
    foodValue: t.foodValue,
    status: 'todo',
  }
}

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

/** 任务模板 → task_template op。删除发 active:false（软删），不物理删行；enabled 单独传（停用≠删除） */
function recordTemplate(t: TaskTemplate, deleted = false): void {
  enqueueOp('task_template', {
    id: t.id,
    name: t.name,
    type: t.type,
    // 本地模板还没有学科维度（都是综合任务），服务端那列用 math 兜底
    subject: 'math',
    foodValue: t.foodValue,
    // active = 没被删；enabled = 没被家长停用。以前两者挤在 active 里，
    // 另一台设备无法区分「已删除」和「停用中」，拉回来只能丢 —— 分开后 /api/state 才能原样重建
    active: !deleted,
    enabled: t.enabled,
    icon: t.icon,
    note: t.note ?? null,
    kind: t.kind ?? 'regular',
    weekdays: t.weekdays ?? null,
    onceDay: t.onceDay ?? null,
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
    // 只清掉被结算的那一天。此前 daily: [] 会把跨天时刚从另一台设备拉回来的
    // 今日实例一并抹掉 → 本地重新生成 → 服务端出现两套 id 不同的当日任务
    daily: s.daily.filter((d) => d.day !== s.activeDay),
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
  /** 启动入口（App 挂载调一次）：新设备先拉后种，老设备先种后推拉 —— 见实现内注释 */
  init: () => void
  /** 推完就拉：回到前台 / 定时等场景用 */
  syncNow: () => void
  /** 从服务端拉实体快照并合并。队列没排空（本地有没推完的改动）时直接跳过 */
  pullRemote: () => Promise<void>
  ensureDay: () => void
  /** 修改孩子档案（P13 的采集入口待加；在此之前只有默认值） */
  setChildProfile: (patch: Partial<ChildProfile>) => void
  adopt: (species: Pet['species']) => void
  hatchDone: () => void
  setName: (name: string) => void
  renamePet: (name: string) => void
  feed: (n: number) => FeedResult
  submitTask: (taskId: string, mediaId?: string) => void
  /** 口算等自动判分任务：做完即完成，不经家长确认 */
  completeQuiz: (taskId: string) => void
  approveTask: (taskId: string) => void
  rejectTask: (taskId: string, reason: string) => void
  parentAdjustFood: (n: number, note: string) => void
  parentGrantPoints: (n: number, note: string) => void
  finishBattle: (subject: Subject, levelId: string, correct: number, total: number, wrongQs: Question[], durationMs?: number) => BattleResult
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

      /** 生成当日任务实例；按模板的排期（星期几 / 今日限定）过滤 */
      const ensureTasks = () => {
        const s = get()
        const applies = s.templates.filter((t) => templateAppliesOn(t, s.activeDay))
        if (applies.length === 0 && s.daily.length === 0) return
        if (s.daily.length > 0 && s.daily[0].day === s.activeDay) {
          const have = new Set(s.daily.map((d) => d.templateId))
          const add = applies.filter((t) => !have.has(t.id)).map((t) => mkDaily(t, s.activeDay))
          if (add.length > 0) {
            set({ daily: [...s.daily, ...add] })
            add.forEach((d) => recordDailyTask(d))
          }
          return
        }
        const todayTasks = applies.map((t) => mkDaily(t, s.activeDay))
        set({ daily: todayTasks })
        todayTasks.forEach((d) => recordDailyTask(d))
      }

      /**
       * 家长变更模板后，立即把「今天已生成的任务实例」对齐（不等下一次 ensureDay）。
       * 这是「家长改了任务、首页不刷新」的修复：以前 add/update/remove 只动 templates，
       * 首页的 s.daily 要等到重新挂载/跨天才会重算。
       *
       * 规则：todo/rejected 的实例跟着模板走（停用→移除、改名→改名）；已提交待确认（pending）
       * 和已完成（done）的保持原样 —— 审批流和历史统计不能被中途改动冲掉。
       */
      const reconcileToday = () => {
        const s = get()
        const alive = s.daily.filter((d) => d.day === s.activeDay)
        if (alive.length === 0 && s.daily.length > 0) return // 还没生成今天的实例，交给 ensureTasks

        const mutable = (d: DailyTask) => d.status === 'todo' || d.status === 'rejected'
        let daily = s.daily.filter((d) => d.day !== s.activeDay)

        for (const t of s.templates) {
          const applies = templateAppliesOn(t, s.activeDay)
          const existing = alive.filter((d) => d.templateId === t.id)
          if (!applies) {
            // 停用 / 今天不该出现：撤掉还没做的实例；已提交/已完成的保留（审批流不能断）
            daily.push(...existing.filter((d) => !mutable(d)))
            continue
          }
          if (existing.length === 0) {
            const inst = mkDaily(t, s.activeDay)
            daily.push(inst)
            recordDailyTask(inst)
            continue
          }
          // 已排上的：同步模板的最新内容（名字/图标/说明/食物值）
          for (const d of existing) {
            daily.push(mutable(d) ? { ...d, name: t.name, icon: t.icon, note: t.note, foodValue: t.foodValue } : d)
          }
        }
        if (daily.length === s.daily.length && daily.every((d, i) => d === s.daily[i])) return
        set({ daily })
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
          // 模板已删但今日实例还挂着（旧版删除逻辑只清 todo，已提交/已完成的漏了）→ 启动时补撤
          const tpls = new Set(get().templates.map((t) => t.id))
          const today = nowDay()
          const kept = get().daily.filter((d) => !(d.day === today && !tpls.has(d.templateId)))
          if (kept.length !== get().daily.length) set({ daily: kept })
          ensureTasks()
          autoUnfreeze()
          seedEntities()
          void pruneMedia()
        },

        init: () => {
          void (async () => {
            // 新设备（本地还没引导出宠物）：先拉后种 —— 否则 bootstrap 会先种一套
            // 随机 id 的默认模板并推上服务端，把真实孩子的数据污染成两套。
            if (!get().pet) await get().pullRemote()
            get().bootstrap()
            // 一批最多 200 条，队列超过一批时循环推到排空（拉取要求队列清零）
            for (let i = 0; i < 10 && pendingCount() > 0; i++) await flushSync()
            await get().pullRemote()
          })()
        },

        syncNow: () => {
          void (async () => {
            for (let i = 0; i < 10 && pendingCount() > 0; i++) await flushSync()
            await get().pullRemote()
          })()
        },

        // 合并策略（刻意简单）：只在本地队列排空后拉，拉到什么信什么。
        // 队列排空 = 本地已与服务器一致，服务器上任何不一样的行都来自另一台设备且更新。
        // 因此不需要时间戳、不需要 LWW、不会有冲突 —— 队列没空就先推，推完自然能拉。
        // ponytail: 钱包只对齐余额（服务端流水尾行），todayX 当日计数与 streak 不跨设备，报表以服务端快照为准。
        pullRemote: async () => {
          if (!syncEnabled() || pendingCount() > 0) return
          const remote = await pullState(syncChildId())
          // 服务端还没有这个孩子的档案（从没引导过）→ 无从拉起，走本地引导流程
          if (!remote || !remote.pet) return
          const s = get()

          const localTpl = new Map(s.templates.map((t) => [t.id, t]))
          const templates: TaskTemplate[] = remote.templates
            .filter((r) => r.active)
            .map((r) => {
              const local = localTpl.get(r.id)
              return {
                id: r.id,
                name: r.name,
                icon: r.icon ?? local?.icon ?? '📋',
                type: r.type === 'photo' || r.type === 'audio' ? r.type : 'subjective',
                note: r.note ?? local?.note,
                kind: r.kind === 'once' ? 'once' : 'regular',
                weekdays: r.weekdays ?? local?.weekdays,
                onceDay: r.onceDay ?? local?.onceDay,
                foodValue: r.foodValue,
                enabled: r.enabled,
                createdAt: local?.createdAt ?? Date.now(),
              }
            })

          const pullDay = nowDay()
          const daily: DailyTask[] = remote.daily.map((r) => ({
            id: r.id,
            day: String(r.day).slice(0, 10),
            templateId: r.templateId ?? '',
            // 模板被软删后 JOIN 不到名字 —— 实例是历史事实，兜个底别显示成空白
            name: r.tplName ?? '（已删除的任务）',
            icon: r.tplIcon ?? '📋',
            type: r.tplType === 'photo' || r.tplType === 'audio' ? r.tplType : 'subjective',
            note: r.tplNote ?? undefined,
            kind: r.tplKind === 'once' ? 'once' : 'regular',
            foodValue: r.tplFood ?? 1,
            status:
              r.status === 'done' || r.status === 'pending' || r.status === 'rejected'
                ? r.status
                : 'todo',
            mediaId: r.mediaKey ?? undefined,
            // daily_tasks.note 存的就是驳回理由（recordDailyTask 的映射），服务端没有独立的 reason 列
            rejectReason: r.note ?? undefined,
            doneAt: r.at ? Date.parse(r.at) : undefined,
          }))
          // 服务端只给了 pullDay 起的行；更早的本地历史行保留（本地通常也只有今天，跨天结算会清）
          const dailyMerged = [...s.daily.filter((d) => d.day < pullDay), ...daily]

          const prizes: Prize[] = remote.prizes
            .filter((r) => r.active)
            .map((r) => ({ id: r.id, name: r.name, points: r.points, note: r.note ?? undefined }))

          const redeems: Redeem[] = remote.redeems.map((r) => ({
            id: r.id,
            prizeId: r.prizeId,
            prizeName: r.prizeName,
            points: r.points,
            // 服务端多一个 timeout 状态，本地只有 rejected
            state: r.state === 'approved' || r.state === 'delivered' || r.state === 'pending'
              ? r.state
              : 'rejected',
            at: Date.parse(r.at),
            ...(r.state === 'delivered' && r.decidedAt
              ? { deliveredAt: Date.parse(r.decidedAt) }
              : r.decidedAt
                ? { reviewedAt: Date.parse(r.decidedAt) }
                : {}),
          }))

          const toLedger = (kind: 'food' | 'point') =>
            remote.ledgers
              .filter((l) => l.kind === kind)
              .map((l) => ({
                id: l.opId,
                kind,
                delta: l.delta,
                balance: l.balance ?? 0,
                source: l.source as LedgerEntry['source'],
                note: l.note ?? '',
                at: Date.parse(l.at),
              }))
          const foodLedger = toLedger('food')
          const pointLedger = toLedger('point')

          const pet: Pet = {
            species:
              remote.pet.species === 'dangkang' || remote.pet.species === 'tianguo'
                ? remote.pet.species
                : 'feifei',
            nickname: remote.pet.name ?? '',
            stage: remote.pet.stage,
            exp: remote.pet.exp,
            satiety: remote.pet.satiety,
            fedToday: remote.pet.fedToday,
            attrs: { math: 0, chinese: 0, english: 0, ...remote.pet.attrs },
            locked: true,
            bornAt: s.pet?.bornAt ?? Date.now(),
          }
          const child: ChildProfile = {
            name: remote.child?.name ?? s.child.name,
            grade: remote.child?.grade ?? s.child.grade,
            textbookVer: remote.child?.textbookVer ?? s.child.textbookVer,
          }

          set({
            // 新设备拉到了别处引导的档案 → 直接落地进家，不再走领养流程
            phase: s.pet ? s.phase : 'home',
            pet,
            child,
            templates,
            daily: dailyMerged,
            prizes,
            redeems,
            // 闯关进度：服务端 best_stars 取 GREATEST，不回退；服务端还没有记录时保留本地
            levels:
              remote.levels.length > 0
                ? remote.levels.map((r) => ({
                    levelId: r.levelId,
                    subject: levelById(r.levelId)?.subject ?? 'math',
                    bestStars: r.bestStars,
                    cleared: r.cleared,
                    bestCorrect: 0,
                    total: 0,
                    lastAt: 0,
                    playCount: r.playCount ?? 1,
                  }))
                : s.levels,
            // 连续打卡：快照里最后一天的 streak（昨天或今天的才算数，太久远的不认）
            streak:
              remote.lastStreak && remote.lastStreak.day >= addDays(pullDay, -1)
                ? remote.lastStreak.streak
                : s.streak,
            frozenPoints: redeems
              .filter((r) => r.state === 'pending')
              .reduce((n, r) => n + r.points, 0),
            foodLedger: foodLedger.length > 0 ? foodLedger : s.foodLedger,
            pointLedger: pointLedger.length > 0 ? pointLedger : s.pointLedger,
            // 服务端流水最新一行的 balance 就是当前余额；服务端还没有流水时保留本地
            food: foodLedger[0]?.balance ?? s.food,
            points: pointLedger[0]?.balance ?? s.points,
          })
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

        completeQuiz: (taskId) => {
          get().ensureDay()
          const s = get()
          const idx = s.daily.findIndex((t) => t.id === taskId)
          if (idx < 0) return
          const t = s.daily[idx]
          if (t.status === 'done' || t.status === 'pending') return
          const next = s.daily.slice()
          next[idx] = { ...t, status: 'done', doneAt: Date.now() }
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

        finishBattle: (subject, levelId, correct, total, wrongQs, durationMs) => {
          get().ensureDay()
          const s = get()
          const pet = s.pet
          const stars = starsOf(correct, total, durationMs, subject)
          const zero: BattleResult = { points: 0, stars: 0, attr: 0, firstClear: false }
          if (stars === 0) return zero

          const rec = s.levels.find((l) => l.levelId === levelId)
          const firstClear = !rec?.cleared
          // 首通：得几颗星就得几分，再额外 +1（FIRST_CLEAR_BONUS）；
          // 重复挑战：金币最多只给 1 枚 —— 星星照常记录（bestStars 不回退），
          // 但不给刷分留空间（2026-09-19 需求）。
          const points = firstClear ? stars + FIRST_CLEAR_BONUS : Math.min(stars, 1)
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
          get().ensureDay()
          const s = get()
          const daily = [...s.daily]
          // 今日就该出现的任务，当场生成实例 —— 家长加完孩子立刻能看到
          if (templateAppliesOn(created, s.activeDay)) {
            const inst = mkDaily(created, s.activeDay)
            daily.push(inst)
            recordDailyTask(inst)
          }
          set({ templates: [...s.templates, created], daily })
          recordTemplate(created)
          return id
        },

        updateTemplate: (id, patch) => {
          const s = get()
          const next = s.templates.map((t) => (t.id === id ? { ...t, ...patch } : t))
          set({ templates: next })
          const updated = next.find((t) => t.id === id)
          if (updated) recordTemplate(updated)
          reconcileToday()
        },

        removeTemplate: (id) => {
          const s = get()
          const removed = s.templates.find((t) => t.id === id)
          set({ templates: s.templates.filter((t) => t.id !== id) })
          // 软删：历史 daily_tasks 的 template_id 还得能 JOIN 回这个模板
          if (removed) recordTemplate(removed, true)
          // 今天的实例全部撤下（孩子端不该再看到已删除的任务；已推到服务器的记录不受影响）
          get().ensureDay()
          const cur = get()
          set({ daily: cur.daily.filter((d) => d.templateId !== id) })
        },

        setPin: (pin) => set((s) => ({ settings: { ...s.settings, parentPin: pin, pinChanged: true } })),

        toggleSetting: (k) => set((s) => ({ settings: { ...s.settings, [k]: !s.settings[k] } })),
      }
    },
    {
      name: 'pet-checkin-v1',
      version: 2,
      // v2：任务加「说明 / 常规·今日种类 / 每周排期」。历史模板缺省为「常规 · 每天」，行为不变
      migrate: (persisted) => {
        const s = persisted as Partial<Pick<AppState, 'templates' | 'daily'>>
        if (s.templates) {
          s.templates = s.templates.map((t) => ({
            ...t,
            kind: t.kind ?? 'regular',
            weekdays: t.weekdays && t.weekdays.length > 0 ? t.weekdays : [1, 2, 3, 4, 5, 6, 7],
          }))
        }
        if (s.daily) {
          s.daily = s.daily.map((d) => ({ ...d, kind: d.kind ?? 'regular' }))
        }
        return s as AppState
      },
    },
  ),
)
