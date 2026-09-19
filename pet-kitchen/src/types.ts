// ============ 萌宠打卡 · 领域模型（对应 PRD v0.4 第 6 节） ============

export type PetSpecies = 'feifei' | 'dangkang' | 'tianguo'
export type Subject = 'math' | 'chinese' | 'english'

/** 任务类型：拍照/录音自动通过，主观需家长确认 */
export type TaskType = 'photo' | 'audio' | 'subjective'
export type TaskStatus = 'todo' | 'done' | 'pending' | 'rejected'

/** 任务种类：常规（按星期重复出现）/ 今日（仅发布当天，完成后即消失） */
export type TaskKind = 'regular' | 'once'

export interface TaskTemplate {
  id: string
  name: string
  icon: string
  type: TaskType
  /** 给孩子看的说明（任务页展示，带朗读按钮）；选填 */
  note?: string
  /** 任务种类，缺省 = 常规（兼容历史存档） */
  kind?: TaskKind
  /** 常规任务每周出现的日子（1=周一 … 7=周日）；缺省 = 每天 */
  weekdays?: number[]
  /** 今日任务限定的游戏日 YYYY-MM-DD；仅 kind==='once' 有效 */
  onceDay?: string
  /** 单任务食物值 1~3（D4 兜底：家长可调高，避免任务少导致宠物必然饿瘦） */
  foodValue: number
  enabled: boolean
  createdAt: number
}

export interface DailyTask {
  id: string
  /** 游戏日 YYYY-MM-DD（0 点分界） */
  day: string
  templateId: string
  name: string
  icon: string
  type: TaskType
  /** 从模板带来的说明（任务页展示 + 朗读） */
  note?: string
  /** 从模板带来的种类（今日任务完成后首页不再展示） */
  kind?: TaskKind
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
  /** 当日已投喂份数（0 点重置） */
  fedToday: number
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
  /** 累计游玩次数（同步到服务端 level_records.play_count，用于观察重复练习） */
  playCount?: number
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
  op?: '+' | '-' | 'add3' | 'sub3'
  // —— 语文 / 英语题载荷（math 不用）——
  // 干扰项与答案都进 spec：无论本地生成还是从库里回放，同一 spec 重建出的题目完全一致
  /** 题面主体：要认读的汉字 / 拼音 / 英文句型（含 ___ 空位） */
  prompt?: string
  /** 正确答案文本（选项之一） */
  ans?: string
  /** 干扰项文本（与 ans 合成选项） */
  opts?: string[]
}

export interface Question {
  text: string
  speech: string
  /** numeric = 答案数值；choice = 正确选项下标 */
  answer: number
  skill: string
  /** 提示：只给解题思路，不含答案 */
  hint: string
  explain: string
  spec: QSpec
  /**
   * 判分方式：numeric 本地精确比对（数学速算），choice 本地选项比对（语文英语认读题），
   * open 需模型批改（开放题，预留）。缺省按 numeric 处理。
   */
  answerType?: 'numeric' | 'open' | 'choice'
  /** choice 题的选项文本（answer 为下标） */
  options?: string[]
  /** 朗读语言（英语题用 en-US），缺省 zh-CN */
  speechLang?: 'zh-CN' | 'en-US'
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

/**
 * 孩子档案（对应服务端 `children` 表）。
 *
 * 注意这是**孩子**的信息，不是宠物的 —— 宠物昵称在 `Pet` 里。
 * 默认昵称取「宝贝」而非真名：PRD 明确要求昵称非真名（未成年人信息合规）。
 *
 * 本地此前没有任何采集入口，v1.3 补上数据结构；UI 入口（P13「我的」）待加，
 * 在此之前这几个字段都是默认值。
 */
export interface ChildProfile {
  /** 昵称（非真名）→ children.name */
  name: string
  /** 年级，如 'g1' / 'g2' → children.grade */
  grade: string
  /** 教材版本，如「统编版」→ children.textbookVer（可空） */
  textbookVer: string
}

export interface AppState {
  /** 引导阶段：adopt -> hatch -> name -> home */
  phase: 'adopt' | 'hatch' | 'name' | 'home'
  pet: Pet | null
  /** 孩子本人的档案（与宠物档案分开） */
  child: ChildProfile
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
