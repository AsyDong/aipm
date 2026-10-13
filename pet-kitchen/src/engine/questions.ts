import type { EnglishTrack, PlayKind, QSpec, Question, Section, Subject } from '../types'
import { rnd, shuffle } from '../utils/id'
import {
  CHAR_BANK, EN_UNITS, EN_ZH, FC_BY_NO, FC_NO_BY_WORD, FC_UNITS, finalParts, PINYIN_BANKS, PINYIN_UNITS, POEMS,
  type CharItem, type EnWord, type PinyinBankItem,
} from '../data/courses'
import { READ_UNITS, TIER_META } from '../data/readtext'
import { PW_LEVELS } from '../pinyin/data'

// ============ 数学题库：学而思一年级速算体系（程序化生成，Q25） ============

export interface LevelDef {
  id: string
  subject: Subject
  /** 闯关版块（P07 版块中心的入口分组） */
  section: Section
  /**
   * 版块内序号。**必须在本 section 内唯一且连续**——
   * Boss 解锁（bossRequires）和结算页的「下一关」（P08Battle）都按它找。
   */
  index: number
  name: string
  skill: string
  boss?: boolean
  /** PvE Boss 关（Q23） */
  kinds: string[]
  unlockAttr: number
  /** 英语版块下的两条线：课本 / 牛津树（其它版块为空） */
  track?: EnglishTrack
  /** 玩法：缺省 quiz（选择题闯关 P08）；read = 跟读评分（P18） */
  play?: PlayKind
  /**
   * 本关最多注入几道未掌握错题。缺省 WRONG_INJECT(2)；
   * 综合版块的「错题复习」把它调大，让整关基本由错题组成。
   */
  wrongInject?: number
}

/** 关卡定义的主体：section 由下面按版块批量补，免得 60 多个关卡每个都手写一遍 */
type LevelBody = Omit<LevelDef, 'section'>
const bySection = (section: Section) => (l: LevelBody): LevelDef => ({ ...l, section })

/** 版块元数据：P07 版块中心的卡片就按这个渲染 */
export interface SectionMeta {
  id: Section
  name: string
  emoji: string
  desc: string
  /** Tailwind 类：卡片底色 / 边框 */
  tint: string
  ring: string
}

/**
 * 闯关 5 版块（2026-10-12 改版：原「数学/语文/英语」三 tab → 五版块）。
 * 顺序就是孩子看到的顺序：拼音 → 数学 → 英语 → 识字 → 综合。
 */
export const SECTIONS: SectionMeta[] = [
  { id: 'pinyin', name: '拼音', emoji: '🅰️', desc: '声母韵母 · 拼读 · 发音擂台', tint: 'bg-emerald-50', ring: 'ring-emerald-100' },
  { id: 'math', name: '数学', emoji: '🔢', desc: '速算 · 凑十破十 · Boss 挑战', tint: 'bg-sky-50', ring: 'ring-sky-100' },
  { id: 'english', name: '英语', emoji: '🔤', desc: '课本跟读 · 牛津树闪卡', tint: 'bg-violet-50', ring: 'ring-violet-100' },
  { id: 'literacy', name: '识字', emoji: '📖', desc: '看字标音 · 看音识字 · 古诗', tint: 'bg-amber-50', ring: 'ring-amber-100' },
  { id: 'mixed', name: '综合', emoji: '🎲', desc: '混合抽题 · 错题复习', tint: 'bg-rose-50', ring: 'ring-rose-100' },
]

export const SECTION_LABEL: Record<Section, string> = {
  pinyin: '拼音',
  math: '数学',
  english: '英语',
  literacy: '识字',
  mixed: '综合',
}

/** 英语版块的两条线（P07 的二级分栏） */
export const TRACK_LABEL: Record<EnglishTrack, string> = {
  textbook: '课本',
  oxford: '牛津树',
}

/**
 * 版块挂靠的属性维度：决定用哪个属性算解锁门槛、给谁加成长。
 * 拼音 / 识字都归语文力（两者本来就是语文的两条线）；综合关没有自己的属性，用三科均值。
 */
export const SECTION_ATTR: Record<Section, Subject> = {
  pinyin: 'chinese',
  math: 'math',
  english: 'english',
  literacy: 'chinese',
  mixed: 'mixed',
}

const RAW_MATH: LevelBody[] = [
  { id: 'm1', subject: 'math', index: 1, name: '10以内加法', skill: '数的组成', kinds: ['add10'], unlockAttr: 0 },
  { id: 'm2', subject: 'math', index: 2, name: '10以内减法', skill: '想加算减', kinds: ['sub10'], unlockAttr: 3 },
  { id: 'm3', subject: 'math', index: 3, name: '凑十法', skill: '凑十法', kinds: ['cou10'], unlockAttr: 6 },
  { id: 'm4', subject: 'math', index: 4, name: '破十法', skill: '破十法', kinds: ['po10'], unlockAttr: 9 },
  { id: 'm5', subject: 'math', index: 5, name: '平十法', skill: '平十法', kinds: ['ping10'], unlockAttr: 12 },
  { id: 'mb1', subject: 'math', index: 6, name: '速算大挑战·壹', skill: '综合', kinds: ['mix'], unlockAttr: 15, boss: true },
  { id: 'm6', subject: 'math', index: 7, name: '20以内进位加', skill: '进位加法', kinds: ['carry20'], unlockAttr: 18 },
  { id: 'm7', subject: 'math', index: 8, name: '20以内退位减', skill: '退位减法', kinds: ['back20'], unlockAttr: 21 },
  { id: 'm8', subject: 'math', index: 9, name: '整十数加减', skill: '整十数', kinds: ['ten100'], unlockAttr: 24 },
  { id: 'm9', subject: 'math', index: 10, name: '100以内加减', skill: '两位数', kinds: ['noCarry100'], unlockAttr: 27 },
  { id: 'm10', subject: 'math', index: 11, name: '连加连减', skill: '连加连减', kinds: ['chain'], unlockAttr: 30 },
  { id: 'mb2', subject: 'math', index: 12, name: '速算大挑战·终', skill: '综合', kinds: ['mix'], unlockAttr: 33, boss: true },
]

export const MATH_LEVELS: LevelDef[] = RAW_MATH.map(bySection('math'))

/** Boss 解锁：需其之前 5 关全部 ≥2 星（在**同一版块**里往前数） */
export function bossRequires(level: LevelDef): string[] {
  if (!level.boss) return []
  const list = LEVELS_BY_SECTION[level.section]
  const idx = list.findIndex((l) => l.id === level.id)
  return list.slice(Math.max(0, idx - 5), idx)
    .filter((l) => !l.boss)
    .map((l) => l.id)
}

/**
 * Boss 名录（山海经，与宠物同源；设计建议 v0.1 §4.4）。
 * 立绘未做（ART 待排期，先 3 个验证）前用 emoji 代位 —— 换图只动这里。
 */
export const BOSS_META: Record<string, { name: string; emoji: string }> = {
  mb1: { name: '饕餮', emoji: '🦁' }, // 贪吃的饕餮把数字吞进肚子，喂它正确的数
  mb2: { name: '穷奇', emoji: '🐯' }, // 爱拆东西的穷奇，把算式拆开再算
  cb1: { name: '混沌', emoji: '🐻' }, // 没有面目的混沌，分不清 b p / d q
  cb2: { name: '梼杌', emoji: '🐗' }, // 顽凶梼杌把词句搅得一团糟
  eb1: { name: '毕方', emoji: '🦅' }, // 独脚火鸟毕方，只肯说一个单词
  eb2: { name: '九婴', emoji: '🐉' }, // 九个脑袋的九婴，问什么都会
}

// ============ 拼音关卡（历史存档，不进闯关地图） ============
//
// 2026-10-12 二次改版：拼音版块改由本应用内的「拼音方块世界」承载
// （见 P20PinyinHub / P24PinyinMap，数据源 src/pinyin/），不再走 iframe 子应用。
// 本应用这套旧拼音题不再出现在地图里 —— 但**定义必须留着**：
// 老存档的 level_records 与错题本里还挂着 c1…c20，levelById 仍要能解析出来，
// 否则那些记录会在结算页 / 错题本里退化成「找不到关卡」。
// 题型：py_unit 看拼音选字（学音）/ py_rep 认字读音（学音）/ py_blend 声韵拼读。

const RAW_PINYIN: LevelBody[] = [
  { id: 'c1', subject: 'chinese', index: 1, name: '单韵母', skill: 'a o e i u ü', kinds: ['py_unit:u1', 'py_rep:u1'], unlockAttr: 0 },
  { id: 'c2', subject: 'chinese', index: 2, name: '声母一', skill: 'b p m f d', kinds: ['py_unit:u2', 'py_rep:u2'], unlockAttr: 0 },
  { id: 'c4', subject: 'chinese', index: 3, name: '声母二', skill: 't n l g k', kinds: ['py_unit:u3', 'py_rep:u3'], unlockAttr: 0 },
  { id: 'c6', subject: 'chinese', index: 4, name: '声母三', skill: 'h j q x', kinds: ['py_unit:u4', 'py_rep:u4'], unlockAttr: 0 },
  { id: 'c7', subject: 'chinese', index: 5, name: '声母四', skill: 'zh ch sh r z', kinds: ['py_unit:u5', 'py_rep:u5'], unlockAttr: 0 },
  { id: 'c9', subject: 'chinese', index: 6, name: '声母五', skill: 'c s y w', kinds: ['py_unit:u6', 'py_rep:u6'], unlockAttr: 0 },
  { id: 'c10', subject: 'chinese', index: 7, name: '拼读练习一', skill: '声母+韵母', kinds: ['py_blend:u6', 'py_word:u6'], unlockAttr: 0 },
  { id: 'c11', subject: 'chinese', index: 8, name: '复韵母一', skill: 'ai ei ui ao ou', kinds: ['py_unit:u7', 'py_rep:u7'], unlockAttr: 0 },
  { id: 'c13', subject: 'chinese', index: 9, name: '复韵母二', skill: 'iu ie üe er', kinds: ['py_unit:u8', 'py_rep:u8'], unlockAttr: 0 },
  { id: 'c14', subject: 'chinese', index: 10, name: '鼻韵母一', skill: 'an en in un ün', kinds: ['py_unit:u9', 'py_rep:u9'], unlockAttr: 0 },
  { id: 'c16', subject: 'chinese', index: 11, name: '鼻韵母二', skill: 'ang eng ing ong', kinds: ['py_unit:u10', 'py_rep:u10'], unlockAttr: 0 },
  { id: 'cb1', subject: 'chinese', index: 12, name: '拼音小状元', skill: '拼读综合', kinds: ['py_unit:u10', 'py_rep:u10', 'py_blend:u10', 'py_word:u10'], unlockAttr: 0, boss: true },
  { id: 'c17', subject: 'chinese', index: 13, name: '整体认读一', skill: 'zhi chi shi ri zi ci', kinds: ['py_unit:u11', 'py_rep:u11'], unlockAttr: 0 },
  { id: 'c18', subject: 'chinese', index: 14, name: '整体认读二', skill: 'si yi wu yu ye yue', kinds: ['py_unit:u12', 'py_rep:u12'], unlockAttr: 0 },
  { id: 'c20', subject: 'chinese', index: 15, name: '整体认读三', skill: 'yuan yin yun ying', kinds: ['py_unit:u13', 'py_rep:u13'], unlockAttr: 0 },
]
/** 历史拼音关卡（c1…c20）：已从地图下架，但老存档的 level_records / 错题仍挂这些 id，levelById 要能解析 */
export const PINYIN_LEVELS: LevelDef[] = RAW_PINYIN.map(bySection('pinyin'))

// ============ 拼音方块世界关卡（拼音版块，2026-10-12 整体搬进本应用） ============
//
// 玩法不是选择题引擎（P08），而是拼音世界自己的答题页（P24PinyinMap → P23PinyinGame）：
// 听音选拼音 / 看字选拼音 / 声韵拼装，所以 kinds 留空、play 标记为 'pinyin'。
// 关卡内容（15 关）来自 src/pinyin/data.ts 的 PW_LEVELS，与 pinyin-world 保持一致。
// 解锁门槛统一为 0：拼音是入门内容，保持原应用「自由闯关」的体验。
export const PINYIN_WORLD_LEVELS: LevelDef[] = PW_LEVELS.map((l, i): LevelDef => ({
  id: `py${l.id}`,
  subject: 'chinese',
  section: 'pinyin',
  play: 'pinyin',
  index: i + 1,
  name: l.name,
  skill: l.tip,
  kinds: [],
  unlockAttr: 0,
}))

// ============ 识字关卡（识字版块） ============
//
// 从原「语文」里拆出来的识字线：只考「已学音拼得出来」的字，外加古诗课文。
// unlockAttr 重排过 —— 原来识字关穿插在拼音关之间，靠拼音关攒的语文力解锁；
// 拼音搬去子应用后，识字线必须能靠自己解锁，于是按「每关 +3」重排为 0/3/6/…/21。
// 题型：char_py 看字标音 / py_word 看音识字 / py_blend 声韵拼读 / poem_next 古诗对句。

const RAW_LITERACY: LevelBody[] = [
  { id: 'c3', subject: 'chinese', index: 1, name: '识字一', skill: '已学音拼读', kinds: ['char_py:u2', 'py_word:u2', 'py_blend:u2'], unlockAttr: 0 },
  { id: 'c5', subject: 'chinese', index: 2, name: '识字二', skill: '已学音拼读', kinds: ['char_py:u3', 'py_word:u3', 'py_blend:u3'], unlockAttr: 3 },
  { id: 'c8', subject: 'chinese', index: 3, name: '识字三', skill: '已学音拼读', kinds: ['char_py:u5', 'py_word:u5', 'py_blend:u5'], unlockAttr: 6 },
  { id: 'c12', subject: 'chinese', index: 4, name: '识字四', skill: '已学音拼读', kinds: ['char_py:u7', 'py_word:u7', 'py_blend:u7'], unlockAttr: 9 },
  { id: 'c15', subject: 'chinese', index: 5, name: '识字五', skill: '已学音拼读', kinds: ['char_py:u9', 'py_word:u9', 'py_blend:u9'], unlockAttr: 12 },
  { id: 'c19', subject: 'chinese', index: 6, name: '识字六', skill: '已学音拼读', kinds: ['char_py:u12', 'py_word:u12', 'py_blend:u12'], unlockAttr: 15 },
  { id: 'c21', subject: 'chinese', index: 7, name: '古诗对句', skill: '必背古诗文', kinds: ['poem_next'], unlockAttr: 18 },
  { id: 'cb2', subject: 'chinese', index: 8, name: '识字大挑战', skill: '综合', kinds: ['py_word:u13', 'char_py:u13', 'py_blend:u13', 'poem_next'], unlockAttr: 21, boss: true },
]
export const LITERACY_LEVELS: LevelDef[] = RAW_LITERACY.map(bySection('literacy'))

// ============ 英语关卡（英语版块 = 课本 + 牛津树） ============
//
// 课本（沪教牛津版 一年级上册）：
//   ① 跟读评分关 —— 每个单元三档「单词 → 短语 → 句子」，就是孩子要求的循序渐进。
//      素材与引擎题型来自 reading-score-demo（见 src/data/readtext.ts），
//      关卡 id 约定 rd-<unit>-<档位>，玩法走 P18FollowRead，不进 P08Battle。
//   ② 认读选择题关 —— 原来那批单元词汇/句型关，作为课本的巩固练习留下（内容未改）。
// 牛津树（剑桥《Power Up Start Smart》预备级电子闪卡）：原「闪卡速记」关卡，
//   内容与玩法**保持不变**，只是从「任务专用、不进地图」改成挂到英语版块下能被找到。

/** 跟读档位顺序：词 → 短语 → 句，"循序渐进"的推进顺序就是它 */
const READ_TIERS = ['w', 'p', 's'] as const

/** 课本·跟读关：6 个单元 × 3 档 = 18 关 */
export const EN_READ_LEVELS: LevelDef[] = READ_UNITS.flatMap((u, ui) =>
  READ_TIERS.map((suf, ti): LevelDef => {
    const meta = TIER_META[suf]
    const unitLabel = u.title.split('·')[0].trim() || u.id.toUpperCase()
    return {
      id: `rd-${u.id}-${suf}`,
      subject: 'english',
      section: 'english',
      track: 'textbook',
      play: 'read',
      index: ui * READ_TIERS.length + ti + 1,
      name: `${unitLabel} · ${meta.label}`,
      skill: `跟读${meta.label} · ${u.cn}`,
      kinds: [],
      // 单元之间每单元 +3：跟读关本身也给英语力，正常读下来正好一路解锁
      unlockAttr: ui * 3,
    }
  }),
)

const RAW_EN_QUIZ: LevelBody[] = [
  { id: 'e1', subject: 'english', track: 'textbook', index: 19, name: 'My Family', skill: '家人词汇', kinds: ['en_pic:family', 'en_wp:family', 'en_meaning:family'], unlockAttr: 0 },
  { id: 'e2', subject: 'english', track: 'textbook', index: 20, name: 'How Are You?', skill: '感受与情绪', kinds: ['en_pic:feeling', 'en_wp:feeling', 'en_meaning:feeling'], unlockAttr: 3 },
  { id: 'e3', subject: 'english', track: 'textbook', index: 21, name: 'School Things', skill: '文具与数字', kinds: ['en_pic:school', 'en_wp:school', 'en_meaning:school'], unlockAttr: 6 },
  { id: 'e4', subject: 'english', track: 'textbook', index: 22, name: 'I Can…', skill: '能力与动作', kinds: ['en_pic:ability', 'en_wp:ability', 'en_meaning:ability'], unlockAttr: 9 },
  { id: 'e5', subject: 'english', track: 'textbook', index: 23, name: 'Animals', skill: '动物词汇', kinds: ['en_pic:animal', 'en_wp:animal', 'en_meaning:animal'], unlockAttr: 12 },
  { id: 'e6', subject: 'english', track: 'textbook', index: 24, name: 'Colours', skill: '颜色词汇', kinds: ['en_pic:colour', 'en_wp:colour', 'en_meaning:colour'], unlockAttr: 15 },
  { id: 'eb1', subject: 'english', track: 'textbook', index: 25, name: '期中挑战', skill: 'U1–U3 综合', kinds: ['en_word:family', 'en_meaning:family', 'en_word:feeling', 'en_meaning:feeling', 'en_word:school', 'en_meaning:school'], unlockAttr: 18, boss: true },
  { id: 'e7', subject: 'english', track: 'textbook', index: 26, name: '句型闯关', skill: '核心句型', kinds: ['en_sentence:family', 'en_sentence:feeling', 'en_sentence:school', 'en_sentence:ability', 'en_sentence:animal', 'en_sentence:colour'], unlockAttr: 21 },
  { id: 'eb2', subject: 'english', track: 'textbook', index: 27, name: '期末大挑战', skill: '综合', kinds: ['en_word:animal', 'en_meaning:colour', 'en_sentence:family', 'en_sentence:ability', 'en_word:family', 'en_sentence:animal'], unlockAttr: 24, boss: true },
]
export const EN_QUIZ_LEVELS: LevelDef[] = RAW_EN_QUIZ.map(bySection('english'))

/** 课本线（跟读 + 认读），P07 英语版块「课本」分栏取这个 */
export const EN_TEXTBOOK_LEVELS: LevelDef[] = [...EN_READ_LEVELS, ...EN_QUIZ_LEVELS]

// ============ 牛津树关卡（剑桥预备级电子闪卡） ============
// 预备级电子闪卡 PDF 切的 115 张卡，按 FC_UNITS 一单元一关；进度记在 levels（fc-uN）。

export const EN_OXFORD_LEVELS: LevelDef[] = FC_UNITS.map((u, i): LevelDef => ({
  id: `fc-${u.id}`,
  subject: 'english',
  section: 'english',
  track: 'oxford',
  index: 19 + RAW_EN_QUIZ.length + i,
  name: `闪卡速记·${u.name}`,
  skill: '看图认词',
  kinds: [`fc_pic:${u.id}`, `fc_wp:${u.id}`],
  unlockAttr: 0,
}))

/** 英语版块全量（课本 + 牛津树），index 在版块内连续 */
export const EN_LEVELS: LevelDef[] = [...EN_TEXTBOOK_LEVELS, ...EN_OXFORD_LEVELS]

/** 兼容旧引用名（牛津树闪卡关） */
export const FC_LEVELS = EN_OXFORD_LEVELS

// ============ 综合关卡（综合版块） ============
//
// 混合抽题：从 数学 / 识字 / 课本英语 / 牛津树 四路随机取材（genSpec 的 mix_all）。
// 错题复习：把 wrongInject 调大，整关基本由错题本里未掌握的题拼成。

const RAW_MIXED: LevelBody[] = [
  { id: 'mx1', subject: 'mixed', index: 1, name: '混合大乱斗', skill: '四科混合抽题', kinds: ['mix_all'], unlockAttr: 0 },
  { id: 'mx2', subject: 'mixed', index: 2, name: '错题复习', skill: '错题本 · 跨科巩固', kinds: ['mix_all'], unlockAttr: 0, wrongInject: 10 },
]
export const MIXED_LEVELS: LevelDef[] = RAW_MIXED.map(bySection('mixed'))

/** 版块 → 关卡列表（P07 版块地图按这个取数） */
export const LEVELS_BY_SECTION: Record<Section, LevelDef[]> = {
  pinyin: PINYIN_WORLD_LEVELS,
  math: MATH_LEVELS,
  english: EN_LEVELS,
  literacy: LITERACY_LEVELS,
  mixed: MIXED_LEVELS,
}

/** 学科 → 关卡列表（服务端出题、结算页「下一关」、Boss 解锁统计用） */
export const LEVELS_BY_SUBJECT: Record<Subject, LevelDef[]> = {
  math: MATH_LEVELS,
  chinese: LITERACY_LEVELS,
  english: EN_LEVELS,
  mixed: MIXED_LEVELS,
}

/** 关卡所属的版块列表：结算页找「下一关」、Boss 解锁往前数 5 关都用它 */
export function levelsOf(level: LevelDef): LevelDef[] {
  return LEVELS_BY_SECTION[level.section]
}

/**
 * 关卡该打开哪个页面：跟读关（play==='read'）走 P18FollowRead，其余走 P08Battle。
 * 收在这里而不是散在各页面里，是为了「下一关」和地图入口不会走岔。
 */
export function pageOfLevel(level: LevelDef): string {
  if (level.play === 'read') return 'follow'
  if (level.play === 'pinyin') return 'pyplay'
  return 'play'
}

export function levelById(id: string): LevelDef | undefined {
  for (const list of Object.values(LEVELS_BY_SECTION)) {
    const hit = list.find((l) => l.id === id)
    if (hit) return hit
  }
  // 老存档兜底：拼音历史关卡（c1…c20）已从地图下架，
  // 但 level_records / 错题本里还挂着这些 id，不能解析不到
  return PINYIN_LEVELS.find((l) => l.id === id)
}

const ri = (min: number, max: number) => min + rnd(max - min + 1)

// ============ 语文 / 英语题库（docs/courses 教材内容，四选一认读题） ============
//
// 内容题与数学题共用 spec 回放链路（错题本 / 服务端 jsonb / 举一反三）：
// 答案与干扰项全部进 spec，任何一端用同一 spec 都能重建出同构的题。
// kind 采用「题型：素材组」的写法（如 py_pick_char:single），genSpec 据此取材。

export type ContentKind =
  | 'py_pick_char' // 看拼音选汉字（按韵母组取材，老关卡回放用）
  | 'py_unit' // 看拼音选汉字（按学习单元取材）
  | 'py_rep' // 认读音节：代表字选读音
  | 'char_py' // 看汉字选读音（unit 组 = 已学字池，char 组 = 全字库）
  | 'py_word' // 看音节选汉字（识字）
  | 'py_blend' // 声母+韵母拼一拼选汉字
  | 'poem_next' // 古诗课文对句
  | 'en_word' // 看英文选中文
  | 'en_meaning' // 看中文选英文
  | 'en_pic' // 看词选图
  | 'en_wp' // 看图选词
  | 'en_sentence' // 句型填空
  | 'fc_pic' // 闪卡速记：看图选词（spec.a = 卡片编号）
  | 'fc_wp' // 闪卡速记：看词选图
  // —— 拼音方块世界（2026-10-12 搬进本应用）的三种玩法 ——
  // 与上面 py_* 的区别：答案统一是「拼音音节」（上面那组混着汉字答案），
  // 所以单独开 kind，避免题面/答案对不上。spec.prompt 存题面（汉字或 声母|韵母）。
  | 'pyw_listen' // 听音选拼音（题面 = 发音汉字）
  | 'pyw_char' // 看字选拼音（题面 = 汉字）
  | 'pyw_blend' // 声韵拼装选音节（题面 = 声母|韵母）
  // —— 跟读纠音（FE-08）：跟读关读不好的词回灌错题本时的题型 ——
  // 与 en_word 同分支（题面 = 英文词，答案 = 中文释义），单独开 kind 是为了能
  // 反查「这条错题是读出来的」：跟读关再次开练时优先复习它们（见 engine/readwrong.ts）。
  | 'rd_word'

const CONTENT_KINDS = new Set<string>([
  'py_pick_char', 'py_unit', 'py_rep', 'char_py', 'py_word', 'py_blend',
  'poem_next', 'en_word', 'en_meaning', 'en_pic', 'en_wp', 'en_sentence',
  'fc_pic', 'fc_wp',
  'pyw_listen', 'pyw_char', 'pyw_blend',
  'rd_word',
])

// ============ 综合版块的混合抽题 ============
//
// `mix_all` 不是一种题型，而是「先摇一路素材，再交给那一路的题型去生成」。
// 四路等概率，先摇路线再摇题，避免直接铺平题型池导致题量占比失衡
//（英语的题型数量远多于识字，直接铺平会被英语刷屏）。

/** 每一路的候选 kind（都是 genSpec 认识的完整写法） */
const MIX_ROUTES: string[][] = [
  // 数学速算
  ['add10', 'sub10', 'cou10', 'po10', 'carry20', 'back20'],
  // 识字（u13 = 全册学完的已学音池，字最全）
  ['char_py:u13', 'py_word:u13', 'py_blend:u13', 'poem_next'],
  // 课本英语（单元词汇 + 句型）
  Object.keys(EN_UNITS).flatMap((g) => [`en_pic:${g}`, `en_wp:${g}`, `en_meaning:${g}`, `en_sentence:${g}`]),
  // 牛津树闪卡
  FC_UNITS.map((u) => `fc_pic:${u.id}`),
]

/** kind → 学科。综合关里每道题按自己的 kind 归科，错题本才不会被一股脑塞进「综合」 */
export function subjectOfKind(kind: string): Subject {
  const base = kind.split(':')[0] ?? ''
  if (base.startsWith('py_') || base.startsWith('pyw_') || base === 'char_py' || base === 'poem_next') {
    return 'chinese'
  }
  if (base.startsWith('en_') || base.startsWith('fc_') || base === 'rd_word') return 'english'
  return 'math'
}

const MIX_PY: PinyinBankItem[] = [
  ...PINYIN_BANKS.single, ...PINYIN_BANKS.compound, ...PINYIN_BANKS.nasal,
  ...PINYIN_BANKS.zhengti, ...PINYIN_BANKS.initial,
]

function bankOf(group: string): PinyinBankItem[] {
  return group === 'mixpy' ? MIX_PY : PINYIN_BANKS[group as keyof typeof PINYIN_BANKS] ?? MIX_PY
}

// ---------- 拼音单元 / 已学音把关 ----------

const UNIT_BY_ID = new Map(PINYIN_UNITS.map((u) => [u.id, u]))

/** 学到 unitId 为止（含）累计出现的所有拼音 */
function learnedOf(unitId: string): Set<string> {
  const upto = PINYIN_UNITS.findIndex((u) => u.id === unitId)
  const units = upto < 0 ? PINYIN_UNITS : PINYIN_UNITS.slice(0, upto + 1)
  return new Set(units.flatMap((u) => u.items.map((i) => i.py)))
}

/** 已学音能拼出来的字：声母已学、韵母各部分已学（零声母/整体认读只看韵母部分） */
export function charPool(unitId: string): CharItem[] {
  const learned = learnedOf(unitId)
  return CHAR_BANK.filter(
    (c) => (c.initial === '' || learned.has(c.initial)) && finalParts(c.final).every((p) => learned.has(p)),
  )
}

/** 从池子里挑 n 个不等于答案、互不重复的干扰项 */
function pickDistractors<T>(pool: T[], exclude: T, key: (x: T) => string, n = 3): T[] {
  return shuffle(pool.filter((x) => key(x) !== key(exclude))).slice(0, n)
}

function genContentSpec(kind: string): QSpec {
  const [base, group] = kind.split(':')
  switch (base) {
    // 拼音方块世界的听音 / 看字题：答案都是拼音音节（供错题回放与将来的混合路由）
    case 'pyw_listen':
    case 'pyw_char': {
      const item = MIX_PY[rnd(MIX_PY.length)]
      const opts = pickDistractors(MIX_PY, item, (s) => s.py)
      return { kind: base, a: 0, b: 0, prompt: item.zh, ans: item.py, opts: opts.map((o) => o.py) }
    }
    case 'py_pick_char': {
      const bank = group === 'char' ? CHAR_BANK : bankOf(group)
      const item = bank[rnd(bank.length)]
      // 按音节排除干扰项：石和十同音，问「shí」时不能同时出现两个正确答案
      const opts = pickDistractors(bank, item, (s) => s.py)
      return { kind: base, a: 0, b: 0, prompt: item.py, ans: item.zh, opts: opts.map((o) => o.zh) }
    }
    case 'py_unit': {
      const unit = UNIT_BY_ID.get(group) ?? PINYIN_UNITS[0]
      const item = unit.items[rnd(unit.items.length)]
      const opts = pickDistractors(unit.items, item, (s) => s.zh)
      return { kind: base, a: 0, b: 0, prompt: item.py, ans: item.zh, opts: opts.map((o) => o.zh) }
    }
    case 'py_rep': {
      const unit = UNIT_BY_ID.get(group) ?? PINYIN_UNITS[0]
      const item = unit.items[rnd(unit.items.length)]
      const opts = pickDistractors(unit.items, item, (s) => s.py)
      return { kind: base, a: 0, b: 0, prompt: item.zh, ans: item.py, opts: opts.map((o) => o.py) }
    }
    case 'py_word': {
      const pool = charPool(group)
      const item = pool[rnd(pool.length)]
      const opts = pickDistractors(pool, item, (s) => s.py)
      return { kind: base, a: 0, b: 0, prompt: item.py, ans: item.zh, opts: opts.map((o) => o.zh) }
    }
    case 'py_blend': {
      const pool = charPool(group).filter((c) => c.initial !== '')
      const item = pool[rnd(pool.length)]
      const opts = pickDistractors(pool, item, (s) => s.py)
      return {
        kind: base, a: 0, b: 0,
        prompt: `${item.initial}|${item.py.slice(item.initial.length)}`,
        ans: item.zh, opts: opts.map((o) => o.zh),
      }
    }
    case 'char_py': {
      const pool = group.startsWith('u') ? charPool(group) : CHAR_BANK
      const item = pool[rnd(pool.length)]
      const opts = pickDistractors(pool, item, (s) => s.py)
      return { kind: base, a: 0, b: 0, prompt: item.zh, ans: item.py, opts: opts.map((o) => o.py) }
    }
    case 'poem_next': {
      const poem = POEMS[rnd(POEMS.length)]
      const i = rnd(poem.lines.length - 2) // 保证有下一句
      const opts = pickDistractors(POEMS.flatMap((p) => p.lines), poem.lines[i + 1], (l) => l)
      return {
        kind: base, a: 0, b: 0,
        prompt: `${poem.title}|${poem.lines[i]}`,
        ans: poem.lines[i + 1], opts: opts.map((o) => o),
      }
    }
    case 'en_word':
    case 'rd_word': {
      const unit = EN_UNITS[group] ?? EN_UNITS.family
      const w: EnWord = unit.words[rnd(unit.words.length)]
      const opts = pickDistractors(unit.words, w, (x) => x.en)
      return { kind: base, a: 0, b: 0, prompt: w.en, ans: w.zh, opts: opts.map((o) => o.zh) }
    }
    // 图词题：答案与干扰项都是单词（渲染层映射成图片），spec 回放链路与文字题一致
    case 'en_pic':
    case 'en_wp': {
      const unit = EN_UNITS[group] ?? EN_UNITS.family
      const w: EnWord = unit.words[rnd(unit.words.length)]
      const opts = pickDistractors(unit.words, w, (x) => x.en)
      return { kind: base, a: 0, b: 0, prompt: w.en, ans: w.en, opts: opts.map((o) => o.en) }
    }
    case 'en_meaning': {
      const unit = EN_UNITS[group] ?? EN_UNITS.family
      const w: EnWord = unit.words[rnd(unit.words.length)]
      const opts = pickDistractors(unit.words, w, (x) => x.en)
      return { kind: base, a: 0, b: 0, prompt: w.zh, ans: w.en, opts: opts.map((o) => o.en) }
    }
    // 闪卡速记：spec.a 存卡片编号（图按编号取），prompt/ans/opts 存单词文本
    case 'fc_pic':
    case 'fc_wp': {
      const unit = FC_UNITS.find((u) => u.id === group) ?? FC_UNITS[0]
      const w = unit.words[rnd(unit.words.length)]
      const opts = pickDistractors(unit.words, w, (x) => x.en)
      return { kind: base, a: w.no, b: 0, prompt: w.en, ans: w.en, opts: opts.map((o) => o.en) }
    }
    default: {
      // en_sentence
      const unit = EN_UNITS[group] ?? EN_UNITS.family
      const sent = unit.sentences?.[rnd(unit.sentences.length)] ?? { before: 'Hello', after: '!', answer: 'Hi', distractors: ['Bye'] }
      return { kind: 'en_sentence', a: 0, b: 0, prompt: `${sent.before}|${sent.after}`, ans: sent.answer, opts: sent.distractors.slice(0, 3) }
    }
  }
}

/** 带调拼音 → 朗读用近似音（TTS 对带调字母支持不稳，先抹掉声调符号） */
function plainPy(py: string): string {
  const map: Record<string, string> = {
    'ā': 'a', 'á': 'a', 'ǎ': 'a', 'à': 'a',
    'ē': 'e', 'é': 'e', 'ě': 'e', 'è': 'e',
    'ī': 'i', 'í': 'i', 'ǐ': 'i', 'ì': 'i',
    'ō': 'o', 'ó': 'o', 'ǒ': 'o', 'ò': 'o',
    'ū': 'u', 'ú': 'u', 'ǔ': 'u', 'ù': 'u',
    'ǖ': 'ü', 'ǘ': 'ü', 'ǚ': 'ü', 'ǜ': 'ü',
  }
  return py.replace(/./g, (c) => map[c] ?? c)
}

const CONTENT_SKILL: Record<string, string> = {
  py_pick_char: '拼音认读',
  py_unit: '拼音认读',
  py_rep: '拼音认读',
  py_word: '拼音识字',
  py_blend: '声韵拼读',
  char_py: '识字标音',
  poem_next: '古诗课文',
  en_word: '英语词汇',
  rd_word: '跟读纠音',
  en_meaning: '英语词汇',
  en_pic: '英语词汇',
  en_wp: '英语词汇',
  en_sentence: '英语句型',
  fc_pic: '闪卡速记',
  fc_wp: '闪卡速记',
  pyw_listen: '拼音听辨',
  pyw_char: '拼音认读',
  pyw_blend: '声韵拼读',
}

/** 由 spec 重建内容题（顺序重新洗牌没关系，正确性由 ans 决定） */
function buildContentQuestion(spec: QSpec): Question {
  const ans = spec.ans ?? ''
  const options = shuffle([ans, ...(spec.opts ?? []).filter((o) => o && o !== ans)])
  const base = {
    answer: Math.max(0, options.indexOf(ans)),
    options,
    answerType: 'choice' as const,
    skill: CONTENT_SKILL[spec.kind] ?? '认读',
    spec,
  }
  const zhHint = '先想一想再选，选错了没关系'
  switch (spec.kind) {
    case 'py_pick_char':
    case 'py_unit':
    case 'py_word': {
      const py = spec.prompt ?? ''
      return {
        ...base,
        text: `哪个字读「${py}」？`,
        speech: `想一想，哪个字读${plainPy(py)}`,
        hint: '先自己拼一拼，再从下面选',
        explain: `「${py}」对应的字是「${ans}」`,
      }
    }
    case 'py_rep':
    case 'char_py': {
      const zh = spec.prompt ?? ''
      return {
        ...base,
        text: `「${zh}」的读音是？`,
        speech: zh,
        hint: zhHint,
        explain: `「${zh}」读作「${ans}」`,
      }
    }
    case 'py_blend': {
      const [ini, fin] = (spec.prompt ?? '|').split('|')
      return {
        ...base,
        text: `把 ${ini} 和 ${fin} 拼起来，是哪个字？`,
        speech: `声母${ini}，韵母${plainPy(fin ?? '')}，拼一拼，是哪个字`,
        hint: `前音轻短后音重，两音相连猛一碰：${ini}——${plainPy(fin ?? '')}`,
        explain: `${ini} + ${fin} 拼出「${ans}」`,
      }
    }
    case 'poem_next': {
      const [title, line] = (spec.prompt ?? '|').split('|')
      return {
        ...base,
        text: `《${title}》「${line}」的下一句是？`,
        speech: `《${title}》，${line}，的下一句是`,
        hint: '一句一句往下背，回忆课文顺序',
        explain: `《${title}》的下一句是「${ans}」`,
      }
    }
    case 'en_word':
    case 'rd_word': {
      const en = spec.prompt ?? ''
      return {
        ...base,
        speechLang: 'en-US',
        text: `${en} 是什么意思？`,
        speech: en,
        hint: '听听发音，再想想意思',
        explain: `${en} = ${ans}`,
      }
    }
    case 'en_pic': {
      const en = spec.prompt ?? ''
      return {
        ...base,
        speechLang: 'en-US',
        pictureOptions: true,
        text: `${en} 是哪幅图？`,
        speech: en,
        hint: '听听发音，想想它的意思，找到那张图',
        explain: `${en} = ${EN_ZH[en] ?? ans}`,
      }
    }
    case 'en_wp': {
      const en = spec.prompt ?? ''
      return {
        ...base,
        promptImg: en,
        text: '这幅图是哪个单词？',
        speech: '看图想一想，选出对应的单词',
        hint: '看图回想：这个用英语怎么说？',
        explain: `图里是${EN_ZH[en] ?? ''}，英语说 ${ans}`,
      }
    }
    case 'en_meaning': {
      const zh = spec.prompt ?? ''
      return {
        ...base,
        text: `「${zh}」的英文是？`,
        speech: `选出${zh}的英文`,
        hint: zhHint,
        explain: `${zh} = ${ans}`,
      }
    }
    case 'fc_pic': {
      const w = FC_BY_NO.get(spec.a)
      return {
        ...base,
        promptImg: String(spec.a),
        text: '这幅图用英语怎么说？',
        speech: `看图想一想，${w?.zh ?? ''}用英语怎么说`,
        hint: '看图回想：这个用英语怎么说？',
        explain: `图里是${w?.zh ?? ''}，英语说 ${ans}`,
      }
    }
    case 'fc_wp': {
      const en = spec.prompt ?? ''
      const zh = FC_BY_NO.get(FC_NO_BY_WORD[en] ?? -1)?.zh
      return {
        ...base,
        speechLang: 'en-US',
        pictureOptions: true,
        text: `${en} 是哪幅图？`,
        speech: en,
        hint: '听听发音，想想它的意思，找到那张图',
        explain: `${en} = ${zh ?? ans}`,
      }
    }
    // —— 拼音方块世界三种玩法（答案都是拼音音节） ——
    case 'pyw_listen': {
      const zh = spec.prompt ?? ''
      return {
        ...base,
        text: `听一听「${zh}」，选出正确的拼音`,
        speech: zh,
        hint: '先听清楚，再想想是哪个拼音',
        explain: `「${zh}」读作「${ans}」`,
      }
    }
    case 'pyw_char': {
      const zh = spec.prompt ?? ''
      return {
        ...base,
        text: `「${zh}」的拼音是？`,
        speech: zh,
        hint: zhHint,
        explain: `「${zh}」读作「${ans}」`,
      }
    }
    case 'pyw_blend': {
      const [ini, fin] = (spec.prompt ?? '|').split('|')
      return {
        ...base,
        text: `把 ${ini} 和 ${fin} 拼起来，是哪个音节？`,
        speech: `声母${ini}，韵母${plainPy(fin ?? '')}，拼一拼，是哪个音节`,
        hint: `前音轻短后音重，两音相连猛一碰：${ini}——${plainPy(fin ?? '')}`,
        explain: `${ini} + ${fin} 拼出「${ans}」`,
      }
    }
    default: {
      const [before, after] = (spec.prompt ?? '|').split('|')
      return {
        ...base,
        text: `补全句子：${before} ___ ${after}`,
        speech: `把句子补充完整`,
        hint: '把单词放进去读一读，通顺吗？',
        explain: `${before}${ans}${after}`,
      }
    }
  }
}

function genSpec(kind: string): QSpec {
  // 综合关：先摇路线，再让那一路的题型自己生成（拿到的 spec.kind 已是具体题型，
  // 所以综合关的题会正常进错题本、也能举一反三）
  if (kind === 'mix_all') {
    const route = MIX_ROUTES[rnd(MIX_ROUTES.length)]
    return genSpec(route[rnd(route.length)])
  }
  if (CONTENT_KINDS.has(kind.split(':')[0] ?? '')) return genContentSpec(kind)
  switch (kind) {
    case 'add10': {
      const a = ri(1, 9)
      return { kind, a, b: ri(1, 10 - a), op: '+' }
    }
    case 'sub10': {
      const a = ri(2, 10)
      return { kind, a, b: ri(1, a), op: '-' }
    }
    case 'cou10': {
      // 凑十法：9/8/7/6 加几，和为 11~18
      const a = ri(6, 9)
      const minB = 11 - a
      return { kind, a, b: ri(minB, 9), op: '+' }
    }
    case 'po10': {
      // 破十法：十几减几，个位不够减
      const a = ri(11, 18)
      const unit = a % 10
      return { kind, a, b: ri(unit + 1, 9), op: '-' }
    }
    case 'ping10': {
      // 平十法：先减到 10，再减剩下的
      const a = ri(13, 18)
      const unit = a % 10
      return { kind, a, b: ri(unit + 1, Math.min(9, unit + 5)), op: '-' }
    }
    case 'carry20': {
      /**
       * 20 以内进位加：**个位相加必须满十**（这才是「进位」），且和不超过 20。
       * 旧写法按「和 > 10」取材（a ∈ [11−b, 20−b]），会出 14+3 这种没进位的题 ——
       * 形式上在二十以内，却完全用不上「满十进一」，CNT-04 抽检把它挑了出来。
       */
      const b = ri(2, 9)
      const u = ri(Math.max(1, 10 - b), 9) // 个位至少 10−b 才凑得满十
      const a = rnd(2) === 0 || u + 10 > 20 - b ? u : u + 10 // 一半是十几（13+7），和仍 ≤ 20
      return { kind, a, b, op: '+' }
    }
    case 'back20': {
      // a 取 12~18：a=19 时个位是 9，没有比它大的个位数可减，凑不出真正的退位题
      const a = ri(12, 18)
      const unit = a % 10
      return { kind, a, b: ri(unit + 1, 9), op: '-' }
    }
    case 'ten100': {
      const a = ri(1, 8) * 10
      const b = ri(1, 9 - a / 10) * 10
      return rnd(2) === 0
        ? { kind, a, b, op: '+' }
        : { kind, a: a + b, b: a, op: '-' }
    }
    case 'noCarry100': {
      /**
       * 100 以内加减（本关的定位是「不进位加 / 不退位减」——个位单独算就行）。
       * 旧写法先摇两个数、个位会进位时改写成减法，却没检查减法是否退位，
       * 于是 65−39 这类退位题混了进来（CNT-04 抽检：本关 1274/3000 违规）。
       * 现在改成**先定十位与个位**，直接把不进位 / 不退位写进取材条件。
       */
      if (rnd(2) === 0) {
        // 加法：十位之和 ≤ 8（和 ≤ 99）、个位之和 ≤ 9（不进位）
        const ta = ri(1, 7)
        const ua = ri(1, 9)
        const tb = ri(1, 8 - ta)
        const ub = ri(0, 9 - ua)
        return { kind, a: ta * 10 + ua, b: tb * 10 + ub, op: '+' }
      }
      // 减法：个位够减（不退位）、十位比减数大（结果为正）
      const tb = ri(1, 8)
      const ub = ri(0, 9)
      const ta = ri(tb + 1, 9)
      const ua = ri(ub, 9)
      return { kind, a: ta * 10 + ua, b: tb * 10 + ub, op: '-' }
    }
    case 'chain': {
      /**
       * 连加连减：三个数连算，全程留在「20 以内」。
       * 旧写法两个分支都越界（连加第三个数能取到 18、连减被减数取到 40），
       * CNT-04 抽检 1798/3000 违规 —— 一年级上册的连加连减只到 20 以内。
       */
      if (rnd(2) === 0) {
        const a = ri(1, 9)
        const b = ri(1, 9)
        return { kind, a, b, c: ri(1, Math.max(1, 20 - a - b)), op: 'add3' }
      }
      const a = ri(12, 20)
      const b = ri(1, Math.min(9, a - 2))
      return { kind, a, b, c: ri(1, Math.max(1, a - b - 1)), op: 'sub3' }
    }
    default: {
      const pool = ['add10', 'sub10', 'cou10', 'po10', 'carry20', 'back20', 'ten100', 'noCarry100']
      return genSpec(pool[rnd(pool.length)])
    }
  }
}

function calc(spec: QSpec): number {
  if (spec.op === '+') return spec.a + spec.b
  if (spec.op === '-') return spec.a - spec.b
  if (spec.op === 'add3') return spec.a + spec.b + (spec.c ?? 0)
  return spec.a - spec.b - (spec.c ?? 0)
}

function render(spec: QSpec): { text: string; speech: string } {
  const cn = ['零', '一', '二', '三', '四', '五', '六', '七', '八', '九']
  const say = (n: number) =>
    n < 10
      ? cn[n]
      : n < 20
        ? `十${n % 10 ? cn[n % 10] : ''}`
        : `${cn[Math.floor(n / 10)]}十${n % 10 ? cn[n % 10] : ''}`
  if (spec.op === '+') {
    return { text: `${spec.a} + ${spec.b} = ?`, speech: `${say(spec.a)}加${say(spec.b)}等于几` }
  }
  if (spec.op === '-') {
    return { text: `${spec.a} − ${spec.b} = ?`, speech: `${say(spec.a)}减${say(spec.b)}等于几` }
  }
  if (spec.op === 'add3') {
    return {
      text: `${spec.a} + ${spec.b} + ${spec.c} = ?`,
      speech: `${say(spec.a)}加${say(spec.b)}加${say(spec.c ?? 0)}等于几`,
    }
  }
  return {
    text: `${spec.a} − ${spec.b} − ${spec.c} = ?`,
    speech: `${say(spec.a)}减${say(spec.b)}减${say(spec.c ?? 0)}等于几`,
  }
}

function explainOf(spec: QSpec, ans: number): string {
  const { a, b, c, op } = spec
  switch (spec.kind) {
    case 'cou10': {
      const need = 10 - a
      return `凑十法：${a} 差 ${need} 就满十，把 ${b} 分成 ${need} 和 ${b - need}；${a}+${need}=10，10+${b - need}=${ans}`
    }
    case 'po10': {
      const unit = a % 10
      return `破十法：把 ${a} 分成 10 和 ${unit}；10−${b}=${10 - b}，${10 - b}+${unit}=${ans}`
    }
    case 'ping10': {
      const unit = a % 10
      return `平十法：先减到十，${a}−${unit}=10；再减剩下的 ${b - unit}，10−${b - unit}=${ans}`
    }
    case 'carry20':
      return `进位加：个位 ${a % 10}+${b}=${(a % 10) + b}，满十进一，结果是 ${ans}`
    case 'back20': {
      const unit = a % 10
      return `退位减：个位 ${unit} 不够减 ${b}，从十位借一当十，${10 + unit}−${b}=${10 + unit - b}，结果是 ${ans}`
    }
    case 'ten100':
      return op === '+'
        ? `整十数相加：${Math.floor(a / 10)} 个十加 ${Math.floor(b / 10)} 个十 = ${ans / 10} 个十`
        : `整十数相减：${Math.floor(a / 10)} 个十减 ${Math.floor(b / 10)} 个十 = ${ans / 10} 个十`
    case 'noCarry100':
      return op === '+'
        ? `两位数相加：先算个位 ${a % 10}+${b % 10}=${(a % 10) + (b % 10)}，再算十位，结果是 ${ans}`
        : `两位数相减：先算个位 ${a % 10}−${b % 10}=${(a % 10) - (b % 10)}，再算十位，结果是 ${ans}`
    case 'chain':
      return op === 'add3'
        ? `连加：${a}+${b}=${a + b}，${a + b}+${c}=${ans}`
        : `连减：${a}−${b}=${a - b}，${a - b}−${c}=${ans}`
    case 'sub10':
      return `想加算减：${ans}+${b}=${a}，所以 ${a}−${b}=${ans}`
    default:
      return `正确答案是 ${ans}`
  }
}

/**
 * 提示：只给「怎么想」，不泄露答案。
 * 约束（smoke 自动校验）：提示里出现、而题干里没有的数字，不得等于最终答案。
 */
function hintOf(spec: QSpec): string {
  const { a, b, op } = spec
  switch (spec.kind) {
    case 'add10':
      return `数的组成：从 ${a} 开始，往后数 ${b} 个`
    case 'sub10':
      return `想加算减：想一想，几加 ${b} 等于 ${a}？`
    case 'cou10': {
      const need = 10 - a
      return `凑十法：${a} 差 ${need} 就凑成 10，把 ${b} 分成 ${need} 和剩下的，先凑十，再加上剩下的`
    }
    case 'po10':
      return `破十法：把 ${a} 分成 10 和 ${a % 10}，先用 10 减 ${b}，再加上那个个位数`
    case 'ping10':
      return `平十法：先把 ${a} 减到 10（减掉 ${a % 10}），再减剩下的部分`
    case 'carry20':
      return `进位加：个位 ${a % 10} 加 ${b} 满十了，先凑十，个位留下多出来的数，十位别忘了进 1`
    case 'back20':
      return `退位减：个位 ${a % 10} 不够减 ${b}，从十位借 1 当 10，先用 10 减 ${b}`
    case 'ten100':
      return op === '+'
        ? `整十数相加：${a / 10} 个十 加 ${b / 10} 个十，一共几个十？`
        : `整十数相减：${a / 10} 个十 减 ${b / 10} 个十，还剩几个十？`
    case 'noCarry100':
      return op === '+' ? '两位数相加：先算个位，再算十位' : '两位数相减：先算个位，再算十位'
    case 'chain':
      return op === 'add3'
        ? `连加：一步一步来，先算 ${a} + ${b}`
        : `连减：一步一步来，先算 ${a} − ${b}`
    default:
      return '一步一步算，别着急'
  }
}

const SKILL_LABEL: Record<string, string> = {
  add10: '10以内加法',
  sub10: '10以内减法',
  cou10: '凑十法',
  po10: '破十法',
  ping10: '平十法',
  carry20: '20以内进位加',
  back20: '20以内退位减',
  ten100: '整十数加减',
  noCarry100: '100以内加减',
  chain: '连加连减',
  mix: '综合速算',
}

/** 题目唯一键：错题本 / 重做追踪都用它判等（fc_pic 等内容题 text 恒定，不能拿 text 当身份） */
export function specKey(s: QSpec): string {
  return `${s.kind}|${s.a}|${s.b}|${s.c ?? ''}|${s.op ?? ''}|${s.prompt ?? ''}`
}

export function buildQuestion(spec: QSpec): Question {
  if (CONTENT_KINDS.has(spec.kind)) return buildContentQuestion(spec)
  const ans = calc(spec)
  const { text, speech } = render(spec)
  return {
    text,
    speech,
    answer: ans,
    skill: SKILL_LABEL[spec.kind] ?? '速算',
    hint: hintOf(spec),
    explain: explainOf(spec, ans),
    spec,
  }
}

export function questionOfKind(kind: string): Question {
  return buildQuestion(genSpec(kind))
}

/** 内容题变式用的默认素材组 */
const CONTENT_VARIANT_KIND: Record<string, string> = {
  py_pick_char: 'py_pick_char:mixpy',
  py_unit: 'py_unit:u6',
  py_rep: 'py_rep:u6',
  char_py: 'char_py:char',
  py_word: 'py_word:u6',
  py_blend: 'py_blend:u6',
  poem_next: 'poem_next',
  en_word: 'en_word:family',
  // 跟读纠音（FE-08）：变式换个单词再出，仍走英语词汇题，与 en_word 同一池子
  rd_word: 'en_word:family',
  en_meaning: 'en_meaning:family',
  en_pic: 'en_pic:family',
  en_wp: 'en_wp:family',
  en_sentence: 'en_sentence:family',
  // fc_pic / fc_wp 不配默认组：spec.kind 自带 ：uN，举一反三就该在原单元出（回表反而错单元）
}

/** 举一反三：3 道变式题（数学换数字/逆运算，内容题换素材再出一道） */
export function variantsOf(spec: QSpec): Question[] {
  const out: Question[] = []
  if (CONTENT_KINDS.has(spec.kind)) {
    const kind = CONTENT_VARIANT_KIND[spec.kind] ?? spec.kind
    out.push(buildQuestion(genSpec(kind)), buildQuestion(genSpec(kind)), buildQuestion(genSpec(kind)))
    return out
  }
  if (spec.op === '+' || spec.op === '-') {
    const sum = spec.op === '+' ? spec.a + spec.b : spec.a
    const other = spec.op === '+' ? spec.a : spec.b
    out.push(
      buildQuestion({
        kind: spec.kind,
        a: sum,
        b: other,
        op: spec.op === '+' ? '-' : '+',
      }),
    )
  }
  out.push(buildQuestion(genSpec(spec.kind)))
  out.push(buildQuestion(genSpec(spec.kind)))
  return out.slice(0, 3)
}

/** 生成本关题目（含未掌握错题注入，线框 P08）。按 spec 去重：同一 spec 只出一次 */
export function buildLevelQuestions(level: LevelDef, inject: QSpec[], n: number): Question[] {
  const qs: Question[] = inject.slice(0, n).map(buildQuestion)
  const seen = new Set(qs.map((q) => JSON.stringify(q.spec)))
  let guard = 0
  while (qs.length < n && guard < 400) {
    const kind = level.kinds[rnd(level.kinds.length)]
    const spec = genSpec(kind)
    const key = JSON.stringify(spec)
    if (!seen.has(key)) {
      seen.add(key)
      qs.push(buildQuestion(spec))
    }
    guard += 1
  }
  return shuffle(qs)
}
