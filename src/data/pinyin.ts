// 拼音基础数据：声母 / 韵母 / 整体认读 / 关卡 / 字库
// py = 拼音展示形式（含声调）; zh = 代表汉字（TTS 发音用）

export interface SoundItem { py: string; zh: string }
export interface BlendItem { initial: string; final: string; py: string; zh: string }
export interface LevelDef {
  id: number
  name: string
  icon: string
  unit: number
  letters: string[]
  words: SoundItem[]
  blends: BlendItem[]
  tip: string
}

// ---------- 23 个声母（zh 为名称音代表字） ----------
export const INITIALS: SoundItem[] = [
  { py: 'b', zh: '波' }, { py: 'p', zh: '坡' }, { py: 'm', zh: '摸' }, { py: 'f', zh: '佛' },
  { py: 'd', zh: '得' }, { py: 't', zh: '特' }, { py: 'n', zh: '讷' }, { py: 'l', zh: '勒' },
  { py: 'g', zh: '哥' }, { py: 'k', zh: '科' }, { py: 'h', zh: '喝' },
  { py: 'j', zh: '基' }, { py: 'q', zh: '欺' }, { py: 'x', zh: '希' },
  { py: 'zh', zh: '知' }, { py: 'ch', zh: '吃' }, { py: 'sh', zh: '诗' }, { py: 'r', zh: '日' },
  { py: 'z', zh: '资' }, { py: 'c', zh: '雌' }, { py: 's', zh: '思' },
  { py: 'y', zh: '医' }, { py: 'w', zh: '乌' },
]

// ---------- 24 个韵母（按类别分组） ----------
export interface FinalGroup { name: string; items: SoundItem[] }
export const FINAL_GROUPS: FinalGroup[] = [
  {
    name: '单韵母（6个）',
    items: [
      { py: 'a', zh: '啊' }, { py: 'o', zh: '喔' }, { py: 'e', zh: '鹅' },
      { py: 'i', zh: '衣' }, { py: 'u', zh: '乌' }, { py: 'ü', zh: '鱼' },
    ],
  },
  {
    name: '复韵母（9个）',
    items: [
      { py: 'ai', zh: '爱' }, { py: 'ei', zh: '诶' }, { py: 'ui', zh: '威' },
      { py: 'ao', zh: '奥' }, { py: 'ou', zh: '欧' }, { py: 'iu', zh: '优' },
      { py: 'ie', zh: '耶' }, { py: 'üe', zh: '约' }, { py: 'er', zh: '耳' },
    ],
  },
  {
    name: '前鼻韵母（5个）',
    items: [
      { py: 'an', zh: '安' }, { py: 'en', zh: '恩' }, { py: 'in', zh: '因' },
      { py: 'un', zh: '温' }, { py: 'ün', zh: '晕' },
    ],
  },
  {
    name: '后鼻韵母（4个）',
    items: [
      { py: 'ang', zh: '昂' }, { py: 'eng', zh: '亨' }, { py: 'ing', zh: '英' }, { py: 'ong', zh: '嗡' },
    ],
  },
]

export const FINALS: SoundItem[] = FINAL_GROUPS.flatMap((g) => g.items)

// ---------- 16 个整体认读音节 ----------
export const ZHENGTI: SoundItem[] = [
  { py: 'zhi', zh: '知' }, { py: 'chi', zh: '吃' }, { py: 'shi', zh: '诗' }, { py: 'ri', zh: '日' },
  { py: 'zi', zh: '字' }, { py: 'ci', zh: '次' }, { py: 'si', zh: '四' },
  { py: 'yi', zh: '一' }, { py: 'wu', zh: '五' }, { py: 'yu', zh: '鱼' },
  { py: 'ye', zh: '叶' }, { py: 'yue', zh: '月' }, { py: 'yuan', zh: '元' },
  { py: 'yin', zh: '音' }, { py: 'yun', zh: '云' }, { py: 'ying', zh: '英' },
]

// ---------- 15 个关卡（按人教版一年级上册拼音单元顺序） ----------
export const LEVELS: LevelDef[] = [
  {
    id: 1, name: '单韵母 a o e i u ü', icon: '🥚', unit: 1,
    letters: ['a', 'o', 'e', 'i', 'u', 'ü'],
    words: [
      { py: 'ā', zh: '啊' }, { py: 'ō', zh: '喔' }, { py: 'é', zh: '鹅' },
      { py: 'ī', zh: '衣' }, { py: 'ū', zh: '乌' }, { py: 'ǖ', zh: '鱼' },
    ],
    blends: [],
    tip: '张大嘴巴 a a a，圆圆嘴巴 o o o，扁扁嘴巴 e e e！',
  },
  {
    id: 2, name: '声母 b p m f', icon: '📻', unit: 1,
    letters: ['b', 'p', 'm', 'f'],
    words: [
      { py: 'bā', zh: '八' }, { py: 'pá', zh: '爬' }, { py: 'mā', zh: '妈' }, { py: 'fā', zh: '发' },
    ],
    blends: [
      { initial: 'b', final: 'a', py: 'bā', zh: '八' },
      { initial: 'p', final: 'a', py: 'pá', zh: '爬' },
      { initial: 'm', final: 'a', py: 'mā', zh: '妈' },
      { initial: 'f', final: 'a', py: 'fā', zh: '发' },
    ],
    tip: '前音轻短后音重，两音相连猛一碰！',
  },
  {
    id: 3, name: '声母 d t n l', icon: '🥁', unit: 1,
    letters: ['d', 't', 'n', 'l'],
    words: [
      { py: 'dà', zh: '大' }, { py: 'tā', zh: '他' }, { py: 'ná', zh: '拿' }, { py: 'lù', zh: '路' },
    ],
    blends: [
      { initial: 'd', final: 'a', py: 'dà', zh: '大' },
      { initial: 't', final: 'a', py: 'tā', zh: '他' },
      { initial: 'n', final: 'a', py: 'ná', zh: '拿' },
      { initial: 'l', final: 'u', py: 'lù', zh: '路' },
    ],
    tip: '听一听：d 和 t，一个不送气，一个要送气！',
  },
  {
    id: 4, name: '声母 g k h', icon: '🕊️', unit: 1,
    letters: ['g', 'k', 'h'],
    words: [
      { py: 'gē', zh: '哥' }, { py: 'kě', zh: '可' }, { py: 'hē', zh: '喝' },
    ],
    blends: [
      { initial: 'g', final: 'e', py: 'gē', zh: '哥' },
      { initial: 'k', final: 'e', py: 'kě', zh: '可' },
      { initial: 'h', final: 'e', py: 'hē', zh: '喝' },
    ],
    tip: '鸽子鸽子 g g g，一只鸽子 gē gē gē！',
  },
  {
    id: 5, name: '声母 j q x', icon: '🐔', unit: 2,
    letters: ['j', 'q', 'x'],
    words: [
      { py: 'jī', zh: '鸡' }, { py: 'qī', zh: '七' }, { py: 'xī', zh: '西' },
      { py: 'jū', zh: '居' }, { py: 'qū', zh: '曲' }, { py: 'xū', zh: '需' },
    ],
    blends: [
      { initial: 'j', final: 'i', py: 'jī', zh: '鸡' },
      { initial: 'q', final: 'i', py: 'qī', zh: '七' },
      { initial: 'x', final: 'i', py: 'xī', zh: '西' },
      { initial: 'j', final: 'ü', py: 'jū', zh: '居' },
      { initial: 'q', final: 'ü', py: 'qū', zh: '曲' },
      { initial: 'x', final: 'ü', py: 'xū', zh: '需' },
    ],
    tip: '小 ü 见了 j q x，去掉两点还读 ü！',
  },
  {
    id: 6, name: '声母 z c s', icon: '🐝', unit: 2,
    letters: ['z', 'c', 's'],
    words: [
      { py: 'zì', zh: '字' }, { py: 'cì', zh: '次' }, { py: 'sì', zh: '四' },
      { py: 'cā', zh: '擦' }, { py: 'sǎ', zh: '洒' },
    ],
    blends: [
      { initial: 'z', final: 'i', py: 'zì', zh: '字' },
      { initial: 'c', final: 'i', py: 'cì', zh: '次' },
      { initial: 's', final: 'i', py: 'sì', zh: '四' },
      { initial: 'c', final: 'a', py: 'cā', zh: '擦' },
      { initial: 's', final: 'a', py: 'sǎ', zh: '洒' },
    ],
    tip: '平舌音：舌尖平平地抵住下齿背！',
  },
  {
    id: 7, name: '声母 zh ch sh r', icon: '🦜', unit: 2,
    letters: ['zh', 'ch', 'sh', 'r'],
    words: [
      { py: 'zhī', zh: '知' }, { py: 'chī', zh: '吃' }, { py: 'shī', zh: '诗' },
      { py: 'rì', zh: '日' }, { py: 'chá', zh: '茶' }, { py: 'shā', zh: '沙' },
    ],
    blends: [
      { initial: 'zh', final: 'i', py: 'zhī', zh: '知' },
      { initial: 'ch', final: 'i', py: 'chī', zh: '吃' },
      { initial: 'sh', final: 'i', py: 'shī', zh: '诗' },
      { initial: 'r', final: 'i', py: 'rì', zh: '日' },
    ],
    tip: '翘舌音：舌尖翘起来，顶住上齿龈！',
  },
  {
    id: 8, name: '声母 y w + 整体认读', icon: '🎅', unit: 2,
    letters: ['y', 'w'],
    words: [
      { py: 'yī', zh: '一' }, { py: 'wǔ', zh: '五' }, { py: 'yǔ', zh: '雨' },
      { py: 'yè', zh: '叶' }, { py: 'yuè', zh: '月' },
    ],
    blends: [],
    tip: 'yi wu yu 不用拼，直接整体读出来！',
  },
  {
    id: 9, name: '复韵母 ai ei ui', icon: '🌵', unit: 3,
    letters: ['ai', 'ei', 'ui'],
    words: [
      { py: 'bái', zh: '白' }, { py: 'hēi', zh: '黑' }, { py: 'shuǐ', zh: '水' }, { py: 'duì', zh: '对' },
    ],
    blends: [
      { initial: 'b', final: 'ai', py: 'bái', zh: '白' },
      { initial: 'h', final: 'ei', py: 'hēi', zh: '黑' },
      { initial: 'sh', final: 'ui', py: 'shuǐ', zh: '水' },
      { initial: 'd', final: 'ui', py: 'duì', zh: '对' },
    ],
    tip: '复韵母发音口形要滑动：a 滑向 i，读"爱"！',
  },
  {
    id: 10, name: '复韵母 ao ou iu', icon: '🐱', unit: 3,
    letters: ['ao', 'ou', 'iu'],
    words: [
      { py: 'māo', zh: '猫' }, { py: 'gǒu', zh: '狗' }, { py: 'niú', zh: '牛' }, { py: 'dāo', zh: '刀' },
    ],
    blends: [
      { initial: 'm', final: 'ao', py: 'māo', zh: '猫' },
      { initial: 'g', final: 'ou', py: 'gǒu', zh: '狗' },
      { initial: 'n', final: 'iu', py: 'niú', zh: '牛' },
      { initial: 'd', final: 'ao', py: 'dāo', zh: '刀' },
    ],
    tip: '标调有规则：iu 并列标在后，niú 的帽子给 u！',
  },
  {
    id: 11, name: '复韵母 ie üe er', icon: '🍂', unit: 3,
    letters: ['ie', 'üe', 'er'],
    words: [
      { py: 'jiě', zh: '姐' }, { py: 'xuě', zh: '雪' }, { py: 'ěr', zh: '耳' }, { py: 'yé', zh: '爷' },
    ],
    blends: [
      { initial: 'j', final: 'ie', py: 'jiě', zh: '姐' },
      { initial: 'x', final: 'üe', py: 'xuě', zh: '雪' },
    ],
    tip: 'er 是个特殊韵母，自己就能成音节，不用拼！',
  },
  {
    id: 12, name: '前鼻韵母 an en in un ün', icon: '🏔️', unit: 4,
    letters: ['an', 'en', 'in', 'un', 'ün'],
    words: [
      { py: 'shān', zh: '山' }, { py: 'mén', zh: '门' }, { py: 'lín', zh: '林' },
      { py: 'chūn', zh: '春' }, { py: 'tiān', zh: '天' },
    ],
    blends: [
      { initial: 'sh', final: 'an', py: 'shān', zh: '山' },
      { initial: 'm', final: 'en', py: 'mén', zh: '门' },
      { initial: 'l', final: 'in', py: 'lín', zh: '林' },
      { initial: 'ch', final: 'un', py: 'chūn', zh: '春' },
    ],
    tip: '前鼻音：读完舌尖要顶住上齿龈，像轻轻说"恩"！',
  },
  {
    id: 13, name: '后鼻韵母 ang eng ing ong', icon: '🔔', unit: 4,
    letters: ['ang', 'eng', 'ing', 'ong'],
    words: [
      { py: 'yáng', zh: '羊' }, { py: 'dēng', zh: '灯' }, { py: 'míng', zh: '明' }, { py: 'zhōng', zh: '中' },
    ],
    blends: [
      { initial: 'sh', final: 'ang', py: 'shàng', zh: '上' },
      { initial: 'd', final: 'eng', py: 'dēng', zh: '灯' },
      { initial: 'm', final: 'ing', py: 'míng', zh: '明' },
      { initial: 'zh', final: 'ong', py: 'zhōng', zh: '中' },
    ],
    tip: '后鼻音：读完舌根抬起来堵住气流，像小铃铛"ang"！',
  },
  {
    id: 14, name: '整体认读音节总复习', icon: '🏆', unit: 4,
    letters: [],
    words: ZHENGTI,
    blends: [],
    tip: '16 个整体认读音节不用拼，看到就整体读！',
  },
  {
    id: 15, name: '综合大挑战', icon: '👑', unit: 4,
    letters: [],
    words: [
      { py: 'sì', zh: '四' }, { py: 'shì', zh: '是' }, { py: 'zì', zh: '字' }, { py: 'zhǐ', zh: '纸' },
      { py: 'shān', zh: '山' }, { py: 'shàng', zh: '上' }, { py: 'mén', zh: '门' },
      { py: 'mèng', zh: '梦' }, { py: 'lín', zh: '林' }, { py: 'líng', zh: '铃' },
    ],
    blends: [],
    tip: '平舌翘舌分得清，前鼻后鼻辨得明，你就是拼音大王！',
  },
]

export const UNITS = [
  { id: 1, name: '第一单元', range: [1, 4], icon: '🌱' },
  { id: 2, name: '第二单元', range: [5, 8], icon: '🌿' },
  { id: 3, name: '第三单元', range: [9, 11], icon: '🌳' },
  { id: 4, name: '第四单元', range: [12, 15], icon: '🍎' },
]

// ---------- 看字选拼音字库（一年级常见字） ----------
export const CHAR_BANK: SoundItem[] = [
  { py: 'yī', zh: '一' }, { py: 'èr', zh: '二' }, { py: 'sān', zh: '三' }, { py: 'sì', zh: '四' },
  { py: 'wǔ', zh: '五' }, { py: 'liù', zh: '六' }, { py: 'qī', zh: '七' }, { py: 'bā', zh: '八' },
  { py: 'jiǔ', zh: '九' }, { py: 'shí', zh: '十' },
  { py: 'tiān', zh: '天' }, { py: 'dì', zh: '地' }, { py: 'rén', zh: '人' }, { py: 'nǐ', zh: '你' },
  { py: 'wǒ', zh: '我' }, { py: 'tā', zh: '他' }, { py: 'dà', zh: '大' }, { py: 'xiǎo', zh: '小' },
  { py: 'shàng', zh: '上' }, { py: 'xià', zh: '下' },
  { py: 'rì', zh: '日' }, { py: 'yuè', zh: '月' }, { py: 'shuǐ', zh: '水' }, { py: 'huǒ', zh: '火' },
  { py: 'shān', zh: '山' }, { py: 'shí', zh: '石' }, { py: 'tián', zh: '田' }, { py: 'hé', zh: '禾' },
  { py: 'mǎ', zh: '马' }, { py: 'niǎo', zh: '鸟' }, { py: 'chóng', zh: '虫' },
  { py: 'bái', zh: '白' }, { py: 'hēi', zh: '黑' }, { py: 'yún', zh: '云' }, { py: 'yǔ', zh: '雨' },
  { py: 'fēng', zh: '风' }, { py: 'fēi', zh: '飞' }, { py: 'mén', zh: '门' }, { py: 'mèng', zh: '梦' },
  { py: 'kǒu', zh: '口' }, { py: 'ěr', zh: '耳' }, { py: 'mù', zh: '目' }, { py: 'shǒu', zh: '手' },
  { py: 'zú', zh: '足' }, { py: 'māo', zh: '猫' }, { py: 'gǒu', zh: '狗' }, { py: 'niú', zh: '牛' },
]

// ---------- 跟读字库（字音清晰、适合朗读评分） ----------
export const FOLLOW_BANK: SoundItem[] = [
  { py: 'bā', zh: '八' }, { py: 'mā', zh: '妈' }, { py: 'dà', zh: '大' }, { py: 'mǎ', zh: '马' },
  { py: 'tǔ', zh: '土' }, { py: 'tù', zh: '兔' }, { py: 'hé', zh: '河' }, { py: 'gē', zh: '哥' },
  { py: 'jī', zh: '鸡' }, { py: 'yú', zh: '鱼' }, { py: 'yī', zh: '一' }, { py: 'wǔ', zh: '五' },
  { py: 'shí', zh: '十' }, { py: 'zhī', zh: '知' }, { py: 'chī', zh: '吃' }, { py: 'shī', zh: '诗' },
  { py: 'shān', zh: '山' }, { py: 'shuǐ', zh: '水' }, { py: 'huǒ', zh: '火' }, { py: 'tiān', zh: '天' },
  { py: 'māo', zh: '猫' }, { py: 'gǒu', zh: '狗' }, { py: 'niú', zh: '牛' }, { py: 'yáng', zh: '羊' },
  { py: 'yuè', zh: '月' }, { py: 'xuě', zh: '雪' }, { py: 'huā', zh: '花' }, { py: 'cǎo', zh: '草' },
]

// 全部可发音素材的查找表（字母表点读等）
export const ALL_SOUNDS: SoundItem[] = [...INITIALS, ...FINALS, ...ZHENGTI]

export function soundOf(py: string): SoundItem | undefined {
  return ALL_SOUNDS.find((s) => s.py === py)
}
