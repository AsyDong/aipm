// ============ 萌宠打卡 · 领域模型（对应 PRD v0.4 第 6 节） ============

export type PetSpecies = 'baize' | 'taotie' | 'qilin'
export type BodyType = 'thin' | 'normal' | 'fat'
export type Subject = 'math' | 'chinese' | 'english'

/** 任务类型：拍照/录音自动通过，主观需家长确认 */
export type TaskType = 'photo' | 'audio' | 'subjective'
export type TaskStatus = 'todo' | 'done' | 'pending' | 'rejected'

export interface TaskTemplate {
  id: string
  name: string
  icon: string
  type: TaskType
  /** 单任务食物值 1~3（D4 兜底：家长可调高，避免任务少导致宠物必然饿瘦） */
  foodValue: number
  enabled: boolean
  createdAt: number
}

export interface DailyTask {
  id: string
  /** 游戏日 YYYY-MM-DD（04:00 分界） */
  day: string
  templateId: string
  name: string
  icon: string
  type: TaskType
  foodValue: number
  status: TaskStatus
  /** 佐证 mediaId（IndexedDB），主观类才有 pending */
  mediaId?: string
  rejectReason?: string
  doneAt?: number
}

export type LedgerKind = 'food' | 'point'
export type FoodSource =
  | 'task' // 完成打卡任务
  | 'streak7' // 连续 7 天
  | 'streak30' // 连续 30 天
  | 'parent' // 家长手动调整
  | 'feed' // 喂养消耗
export type PointSource = 'battle' | 'spend' | 'exchange' | 'refund' | 'parent'

export interface LedgerEntry {
  id: string
  kind: LedgerKind
  /** 正数入账，负数出账 */
  delta: number
  balance: number
  source: FoodSource | PointSource
  note: string
  at: number
}

export interface Pet {
  species: PetSpecies
  nickname: string
  /** 1~6 进化阶段 */
  stage: number
  exp: number
  /** 0~120 */
  satiety: number
  body: BodyType
  /** 当日已投喂份数（04:00 重置） */
  fedToday: number
  /** 连续未投喂天数 */
  noFeedDays: number
  /** 连续顶格（结算饱食度 ≥100）天数 */
  fullDays: number
  attrs: Record<Subject, number>
  /** Q26：确认领养后不可更改种类 */
  locked: boolean
  bornAt: number
}

export interface LevelRecord {
  levelId: string
  subject: Subject
  bestStars: number
  cleared: boolean
  bestCorrect: number
  total: number
  lastAt: number
}

export interface WrongItem {
  id: string
  subject: Subject
  /** 题目规格，用于举一反三生成变式 */
  spec: QSpec
  text: string
  answer: number
  skill: string
  explain: string
  wrongCount: number
  /** 连续答对次数，≥3 判定掌握 */
  rightStreak: number
  mastered: boolean
  /** 下次复习的游戏日 */
  nextReviewDay: string
  createdAt: number
}

/** 题目生成规格 —— 持久化后可无损重建题目与变式 */
export interface QSpec {
  kind: string
  a: number
  b: number
  c?: number
  op: '+' | '-' | 'add3' | 'sub3'
}

export interface Question {
  text: string
  speech: string
  answer: number
  skill: string
  /** 提示：只给解题思路，不含答案 */
  hint: string
  explain: string
  spec: QSpec
  /**
   * 判分方式：numeric 本地精确比对（数学速算），open 需模型批改（语文英语开放题，预留）。
   * 缺省按 numeric 处理。
   */
  answerType?: 'numeric' | 'open'
}

export type PrizeState = 'available' | 'pending' | 'approved' | 'delivered' | 'rejected'

export interface Prize {
  id: string
  name: string
  points: number
  note?: string
}

export interface Redeem {
  id: string
  prizeId: string
  prizeName: string
  points: number
  state: Exclude<PrizeState, 'available'>
  at: number
  reviewedAt?: number
  deliveredAt?: number
  reason?: string
}

export interface ShopItem {
  id: string
  name: string
  points: number
  emoji: string
  /** 场景中的默认锚点百分比 */
  x: number
  y: number
}

export interface PlacedItem {
  uid: string
  itemId: string
  x: number
  y: number
}

export interface DailySnapshot {
  day: string
  satiety: number
  fed: number
  full: boolean
  body: BodyType
  streak: number
  tasksDone: number
  tasksTotal: number
  battles: number
  correctRate: number
  pointsEarned: number
  foodEarned: number
}

export interface Settings {
  sound: boolean
  readAloud: boolean
  parentPin: string
  pinChanged: boolean
  dailyBattleMinutes: number
}

export interface AppState {
  /** 引导阶段：adopt -> hatch -> name -> home */
  phase: 'adopt' | 'hatch' | 'name' | 'home'
  pet: Pet | null
  templates: TaskTemplate[]
  daily: DailyTask[]
  food: number
  points: number
  /** 冻结中的积分（兑换待审批，Q22 审批流：先冻结不扣） */
  frozenPoints: number
  foodLedger: LedgerEntry[]
  pointLedger: LedgerEntry[]
  streak: number
  longestStreak: number
  levels: LevelRecord[]
  wrong: WrongItem[]
  prizes: Prize[]
  redeems: Redeem[]
  owned: string[]
  placed: PlacedItem[]
  snapshots: DailySnapshot[]
  settings: Settings
  /** 计数器当前所属的游戏日；跨日时对其执行结算并推进 */
  activeDay: string
  /** 当日统计（用于成长报告） */
  todayBattles: number
  todayCorrect: number
  todayTotal: number
  todayPoints: number
  todayFoodEarned: number
  todayTasksDone: number
  wrongSolvedTotal: number
}
