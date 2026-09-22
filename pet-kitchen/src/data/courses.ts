// ============ 教材内容库（一年级上册） ============
//
// 拼音数据参考 pinyin-world（人教版一年级上册拼音单元）；
// 写字/识字表与必背古诗文取自 docs/courses/1-1-yuwen.md；
// 英语单元词汇取自 docs/courses/1-1-english.md。
// 所有题目的干扰项都从同类别里取，保证「看起来像」——不是随便凑四个字。

export interface SoundItem {
  /** 拼音展示形式（含声调） */
  py: string
  /** 代表汉字（TTS 发音 / 题面用） */
  zh: string
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

// ---------- 24 个韵母（按类别） ----------
export const FINALS_SINGLE: SoundItem[] = [
  { py: 'a', zh: '啊' }, { py: 'o', zh: '喔' }, { py: 'e', zh: '鹅' },
  { py: 'i', zh: '衣' }, { py: 'u', zh: '乌' }, { py: 'ü', zh: '鱼' },
]
export const FINALS_COMPOUND: SoundItem[] = [
  { py: 'ai', zh: '爱' }, { py: 'ei', zh: '诶' }, { py: 'ui', zh: '威' },
  { py: 'ao', zh: '奥' }, { py: 'ou', zh: '欧' }, { py: 'iu', zh: '优' },
  { py: 'ie', zh: '耶' }, { py: 'üe', zh: '约' }, { py: 'er', zh: '耳' },
]
export const FINALS_NASAL: SoundItem[] = [
  { py: 'an', zh: '安' }, { py: 'en', zh: '恩' }, { py: 'in', zh: '因' },
  { py: 'un', zh: '温' }, { py: 'ün', zh: '晕' },
  { py: 'ang', zh: '昂' }, { py: 'eng', zh: '亨' }, { py: 'ing', zh: '英' }, { py: 'ong', zh: '嗡' },
]
export const FINALS = [...FINALS_SINGLE, ...FINALS_COMPOUND, ...FINALS_NASAL]

// ---------- 16 个整体认读音节 ----------
export const ZHENGTI: SoundItem[] = [
  { py: 'zhi', zh: '知' }, { py: 'chi', zh: '吃' }, { py: 'shi', zh: '诗' }, { py: 'ri', zh: '日' },
  { py: 'zi', zh: '字' }, { py: 'ci', zh: '次' }, { py: 'si', zh: '四' },
  { py: 'yi', zh: '一' }, { py: 'wu', zh: '五' }, { py: 'yu', zh: '鱼' },
  { py: 'ye', zh: '叶' }, { py: 'yue', zh: '月' }, { py: 'yuan', zh: '元' },
  { py: 'yin', zh: '音' }, { py: 'yun', zh: '云' }, { py: 'ying', zh: '英' },
]

/** 拼音关卡可用的字音素材（每个素材带所属关卡组，干扰项从同组取更迷惑） */
export interface PinyinBankItem extends SoundItem {
  /** 组别：干扰项只从同组取（形近音近才算真考拼音） */
  group: 'initial' | 'final-single' | 'final-compound' | 'final-nasal' | 'zhengti'
}

export const PINYIN_BANKS: Record<'initial' | 'single' | 'compound' | 'nasal' | 'zhengti', PinyinBankItem[]> = {
  initial: INITIALS.map((s) => ({ ...s, group: 'initial' })),
  single: FINALS_SINGLE.map((s) => ({ ...s, group: 'final-single' })),
  compound: FINALS_COMPOUND.map((s) => ({ ...s, group: 'final-compound' })),
  nasal: FINALS_NASAL.map((s) => ({ ...s, group: 'final-nasal' })),
  zhengti: ZHENGTI.map((s) => ({ ...s, group: 'zhengti' })),
}

// ---------- 拼音学习单元（每关 ~5 个，按人教一上教学顺序累积） ----------
// 关卡按单元排布：先单个认音，学到的音立刻拿去拼字（识字关只出「已学音拼得出来」的字）。

export interface PinyinUnit {
  id: string
  label: string
  items: PinyinBankItem[]
}

const UNIT_DEFS: Array<{ id: string; label: string; pys: string[] }> = [
  { id: 'u1', label: '单韵母', pys: ['a', 'o', 'e', 'i', 'u', 'ü'] },
  { id: 'u2', label: '声母一', pys: ['b', 'p', 'm', 'f', 'd'] },
  { id: 'u3', label: '声母二', pys: ['t', 'n', 'l', 'g', 'k'] },
  { id: 'u4', label: '声母三', pys: ['h', 'j', 'q', 'x'] },
  { id: 'u5', label: '声母四', pys: ['zh', 'ch', 'sh', 'r', 'z'] },
  { id: 'u6', label: '声母五', pys: ['c', 's', 'y', 'w'] },
  { id: 'u7', label: '复韵母一', pys: ['ai', 'ei', 'ui', 'ao', 'ou'] },
  { id: 'u8', label: '复韵母二', pys: ['iu', 'ie', 'üe', 'er'] },
  { id: 'u9', label: '鼻韵母一', pys: ['an', 'en', 'in', 'un', 'ün'] },
  { id: 'u10', label: '鼻韵母二', pys: ['ang', 'eng', 'ing', 'ong'] },
  { id: 'u11', label: '整体认读一', pys: ['zhi', 'chi', 'shi', 'ri', 'zi', 'ci'] },
  { id: 'u12', label: '整体认读二', pys: ['si', 'yi', 'wu', 'yu', 'ye', 'yue'] },
  { id: 'u13', label: '整体认读三', pys: ['yuan', 'yin', 'yun', 'ying'] },
]

const SOUND_BY_PY = new Map(Object.values(PINYIN_BANKS).flat().map((i) => [i.py, i]))

export const PINYIN_UNITS: PinyinUnit[] = UNIT_DEFS.map((u) => ({
  id: u.id,
  label: u.label,
  items: u.pys.map((p) => SOUND_BY_PY.get(p)).filter((i): i is PinyinBankItem => !!i),
}))

// ---------- 看字选音 / 听音选音 字库（一年级常见字，音形兼具） ----------
// initial/final 是该字读音的声韵分解：initial '' = 零声母或整体认读。
// 识字关用它们做「已学音把关」：一个字只有当声母和韵母各部分都学过才会出。

export interface CharItem extends SoundItem {
  /** 声母（'' = 零声母 / 整体认读） */
  initial: string
  /** 韵母（可含 i/u/ü 介音，如 iao；整体认读字存整个音节，如 yi） */
  final: string
}

export const CHAR_BANK: CharItem[] = [
  { py: 'yī', zh: '一', initial: '', final: 'yi' }, { py: 'èr', zh: '二', initial: '', final: 'er' },
  { py: 'sān', zh: '三', initial: 's', final: 'an' }, { py: 'sì', zh: '四', initial: '', final: 'si' },
  { py: 'wǔ', zh: '五', initial: '', final: 'wu' }, { py: 'liù', zh: '六', initial: 'l', final: 'iu' },
  { py: 'qī', zh: '七', initial: 'q', final: 'i' }, { py: 'bā', zh: '八', initial: 'b', final: 'a' },
  { py: 'jiǔ', zh: '九', initial: 'j', final: 'iu' }, { py: 'shí', zh: '十', initial: '', final: 'shi' },
  { py: 'tiān', zh: '天', initial: 't', final: 'ian' }, { py: 'dì', zh: '地', initial: 'd', final: 'i' },
  { py: 'rén', zh: '人', initial: 'r', final: 'en' }, { py: 'nǐ', zh: '你', initial: 'n', final: 'i' },
  { py: 'wǒ', zh: '我', initial: 'w', final: 'o' }, { py: 'tā', zh: '他', initial: 't', final: 'a' },
  { py: 'dà', zh: '大', initial: 'd', final: 'a' }, { py: 'xiǎo', zh: '小', initial: 'x', final: 'iao' },
  { py: 'shàng', zh: '上', initial: 'sh', final: 'ang' }, { py: 'xià', zh: '下', initial: 'x', final: 'ia' },
  { py: 'rì', zh: '日', initial: '', final: 'ri' }, { py: 'yuè', zh: '月', initial: '', final: 'yue' },
  { py: 'shuǐ', zh: '水', initial: 'sh', final: 'ui' }, { py: 'huǒ', zh: '火', initial: 'h', final: 'uo' },
  { py: 'shān', zh: '山', initial: 'sh', final: 'an' }, { py: 'shí', zh: '石', initial: '', final: 'shi' },
  { py: 'tián', zh: '田', initial: 't', final: 'ian' }, { py: 'hé', zh: '禾', initial: 'h', final: 'e' },
  { py: 'mǎ', zh: '马', initial: 'm', final: 'a' }, { py: 'niǎo', zh: '鸟', initial: 'n', final: 'iao' },
  { py: 'chóng', zh: '虫', initial: 'ch', final: 'ong' },
  { py: 'bái', zh: '白', initial: 'b', final: 'ai' }, { py: 'hēi', zh: '黑', initial: 'h', final: 'ei' },
  { py: 'yún', zh: '云', initial: '', final: 'yun' }, { py: 'yǔ', zh: '雨', initial: '', final: 'yu' },
  { py: 'fēng', zh: '风', initial: 'f', final: 'eng' }, { py: 'fēi', zh: '飞', initial: 'f', final: 'ei' },
  { py: 'mén', zh: '门', initial: 'm', final: 'en' }, { py: 'mù', zh: '目', initial: 'm', final: 'u' },
  { py: 'kǒu', zh: '口', initial: 'k', final: 'ou' }, { py: 'ěr', zh: '耳', initial: '', final: 'er' },
  { py: 'shǒu', zh: '手', initial: 'sh', final: 'ou' }, { py: 'zú', zh: '足', initial: 'z', final: 'u' },
  { py: 'māo', zh: '猫', initial: 'm', final: 'ao' }, { py: 'gǒu', zh: '狗', initial: 'g', final: 'ou' },
  { py: 'niú', zh: '牛', initial: 'n', final: 'iu' }, { py: 'yáng', zh: '羊', initial: 'y', final: 'ang' },
]

/** 韵母拆成「已学音」集合：iao → [i, ao]；已在韵母表里的（如 iu / üe / er）整串算一个 */
export function finalParts(f: string): string[] {
  if (FINALS.some((x) => x.py === f)) return [f]
  const head = f[0]
  const rest = f.slice(1)
  if ((head === 'i' || head === 'u' || head === 'ü') && FINALS.some((x) => x.py === rest)) {
    return [head, rest]
  }
  return [f] // 整体认读音节等：整串当一个音看待
}

// ---------- 必背古诗文 & 课文（docs/courses/1-1-yuwen.md）----------
export interface PoemDef {
  title: string
  lines: string[]
}

export const POEMS: PoemDef[] = [
  { title: '金木水火土', lines: ['一二三四五', '金木水火土', '天地分上下', '日月照今古'] },
  { title: '对韵歌', lines: ['云对雨，雪对风', '花对树，鸟对虫', '山清对水秀', '柳绿对桃红'] },
  { title: '画', lines: ['远看山有色', '近听水无声', '春去花还在', '人来鸟不惊'] },
  { title: '悯农', lines: ['锄禾日当午', '汗滴禾下土', '谁知盘中餐', '粒粒皆辛苦'] },
  { title: '古朗月行（节选）', lines: ['小时不识月', '呼作白玉盘', '又疑瑶台镜', '飞在青云端'] },
  { title: '风', lines: ['解落三秋叶', '能开二月花', '过江千尺浪', '入竹万竿斜'] },
  { title: '咏鹅', lines: ['鹅，鹅，鹅', '曲项向天歌', '白毛浮绿水', '红掌拨清波'] },
  { title: '小小的船', lines: ['弯弯的月儿小小的船', '小小的船儿两头尖', '我在小小的船里坐', '只看见闪闪的星星蓝蓝的天'] },
]

// ---------- 英语（docs/courses/1-1-english.md 单词表）----------
export interface EnWord {
  en: string
  zh: string
}

export interface EnUnitDef {
  /** 所属关卡组（干扰项同组取） */
  group: string
  words: EnWord[]
  /** 句型填空：「I can ___」→ 前半 / 后半 + 候选词 */
  sentences?: Array<{ before: string; after: string; answer: string; distractors: string[] }>
}

export const EN_UNITS: Record<string, EnUnitDef> = {
  family: {
    group: 'family',
    words: [
      { en: 'grandma', zh: '奶奶；外婆' }, { en: 'grandpa', zh: '爷爷；外公' },
      { en: 'dad', zh: '爸爸' }, { en: 'mum', zh: '妈妈' },
      { en: 'brother', zh: '哥哥；弟弟' }, { en: 'sister', zh: '姐姐；妹妹' },
    ],
    sentences: [
      { before: 'This is my', after: '.', answer: 'mum', distractors: ['dad', 'sister', 'cat'] },
      { before: 'This is my', after: ', Tim.', answer: 'brother', distractors: ['sister', 'mum', 'dog'] },
      { before: 'This is my', after: '. She is kind.', answer: 'grandma', distractors: ['grandpa', 'dad', 'bird'] },
    ],
  },
  feeling: {
    group: 'feeling',
    words: [
      { en: 'cold', zh: '冷的' }, { en: 'hot', zh: '热的' },
      { en: 'thirsty', zh: '口渴的' }, { en: 'hungry', zh: '饿的' },
    ],
    sentences: [
      { before: 'How are you? I\'m', after: '.', answer: 'cold', distractors: ['hot', 'hungry', 'singing'] },
      { before: 'I\'m', after: '. I want some water.', answer: 'thirsty', distractors: ['hungry', 'cold', 'hot'] },
      { before: 'I\'m', after: '. I want a cake.', answer: 'hungry', distractors: ['thirsty', 'hot', 'cold'] },
    ],
  },
  school: {
    group: 'school',
    words: [
      { en: 'one', zh: '一' }, { en: 'two', zh: '二' }, { en: 'three', zh: '三' }, { en: 'four', zh: '四' },
      { en: 'pencil', zh: '铅笔' }, { en: 'pencil case', zh: '铅笔盒' },
      { en: 'eraser', zh: '橡皮' }, { en: 'ruler', zh: '直尺' },
    ],
    sentences: [
      { before: 'I see', after: 'pencils.', answer: 'three', distractors: ['two', 'four', 'ruler'] },
      { before: 'I see two', after: '.', answer: 'erasers', distractors: ['rulers', 'pencil', 'cat'] },
      { before: 'I see one', after: '.', answer: 'pencil case', distractors: ['ruler', 'eraser', 'book'] },
    ],
  },
  ability: {
    group: 'ability',
    words: [
      { en: 'draw', zh: '画画' }, { en: 'write', zh: '写字' },
      { en: 'read', zh: '阅读' }, { en: 'sing', zh: '唱歌' }, { en: 'dance', zh: '跳舞' },
    ],
    sentences: [
      { before: 'I can', after: 'a rainbow.', answer: 'draw', distractors: ['write', 'read', 'sing'] },
      { before: 'I can', after: 'Chinese.', answer: 'write', distractors: ['draw', 'dance', 'read'] },
      { before: 'I can', after: 'a song.', answer: 'sing', distractors: ['dance', 'draw', 'write'] },
    ],
  },
  animal: {
    group: 'animal',
    words: [
      { en: 'dog', zh: '狗' }, { en: 'cat', zh: '猫' }, { en: 'fish', zh: '鱼' },
      { en: 'bird', zh: '鸟' }, { en: 'hamster', zh: '仓鼠' }, { en: 'tortoise', zh: '龟' },
    ],
    sentences: [
      { before: 'It\'s a', after: '. Woof!', answer: 'dog', distractors: ['cat', 'bird', 'fish'] },
      { before: 'It\'s a', after: '. Tweet!', answer: 'bird', distractors: ['dog', 'cat', 'tortoise'] },
      { before: 'It\'s a lovely', after: '.', answer: 'hamster', distractors: ['tortoise', 'fish', 'dad'] },
    ],
  },
  colour: {
    group: 'colour',
    words: [
      { en: 'red', zh: '红色' }, { en: 'white', zh: '白色' }, { en: 'yellow', zh: '黄色' },
      { en: 'green', zh: '绿色' }, { en: 'blue', zh: '蓝色' }, { en: 'black', zh: '黑色' },
    ],
    sentences: [
      { before: 'This is a cat. It\'s', after: '.', answer: 'black', distractors: ['red', 'blue', 'ruler'] },
      { before: 'This is a pencil. It\'s', after: '.', answer: 'yellow', distractors: ['white', 'green', 'grandma'] },
      { before: 'This is a fish. It\'s', after: '.', answer: 'red', distractors: ['blue', 'black', 'hot'] },
    ],
  },
}

/** 单词 → 中文（图片加载失败时的文字兜底，也用于题面解释）；闪卡词表在下方并入 */
export const EN_ZH: Record<string, string> = {}
for (const u of Object.values(EN_UNITS)) for (const w of u.words) EN_ZH[w.en] = w.zh

/** 单词配图路径（public/img/en/<word>.jpg，AI 批量生成；缺失时 UI 有文字兜底） */
export function enImgSrc(word: string): string {
  const base = import.meta.env?.BASE_URL ?? '/'
  return `${base}img/en/${word.replace(/ /g, '-')}.jpg`
}

/** 英语关卡的学习单元：关卡所有题型同组时才有（用于闯关前的闪卡预习），boss / 句型关没有 */
export function enUnitOf(kinds: string[]): string | undefined {
  const gs = kinds.map((k) => k.split(':')[1] ?? '')
  return gs.length > 0 && gs.every((g) => g === gs[0]) && EN_UNITS[gs[0]] ? gs[0] : undefined
}

// ---------- 闪卡速记（任务「闪卡速记」专用词库） ----------
// 来源：《Power Up Start Smart》预备级电子闪卡（剑桥 2019），家长课件 PDF 115 张卡
// （tools/cut-fc-pdf.py 切图）。卡片编号 = PDF 卡片序号，图按编号存 public/img/fc/<no>.jpg，
// 避免同名词冲突（orange 颜色 / 水果、人物照片两张版本）。

export interface FcWord {
  /** 卡片编号 = 图片文件名 */
  no: number
  en: string
  zh: string
}

export interface FcUnitDef {
  id: string
  name: string
  words: FcWord[]
}

export const FC_UNITS: FcUnitDef[] = [
  {
    id: 'u0', name: 'Hello',
    words: [
      { no: 1, en: 'blue', zh: '蓝色' }, { no: 2, en: 'red', zh: '红色' },
      { no: 3, en: 'green', zh: '绿色' }, { no: 4, en: 'yellow', zh: '黄色' },
      { no: 5, en: 'orange', zh: '橙色' }, { no: 6, en: 'purple', zh: '紫色' },
      { no: 7, en: 'one', zh: '一' }, { no: 8, en: 'two', zh: '二' },
      { no: 9, en: 'three', zh: '三' }, { no: 10, en: 'four', zh: '四' },
      { no: 11, en: 'five', zh: '五' }, { no: 12, en: 'six', zh: '六' },
      { no: 13, en: 'Jim', zh: '吉姆' }, { no: 14, en: 'Jenny', zh: '珍妮' },
      { no: 15, en: 'Anna', zh: '安娜' }, { no: 16, en: 'Matt', zh: '马特' },
      { no: 17, en: 'Mrs Friendly', zh: 'Friendly 太太' }, { no: 18, en: 'Mr Friendly', zh: 'Friendly 先生' },
      { no: 19, en: 'Cameron', zh: '卡梅伦' }, { no: 20, en: 'Frida', zh: '弗里达' },
      { no: 21, en: 'cat', zh: '猫' }, { no: 22, en: 'boat', zh: '小船' },
      { no: 23, en: 'bird', zh: '鸟' }, { no: 24, en: 'book', zh: '书' },
      { no: 25, en: 'bus', zh: '公交车' },
    ],
  },
  {
    id: 'u1', name: 'My Family',
    words: [
      { no: 26, en: 'boy', zh: '男孩' }, { no: 27, en: 'family', zh: '家庭' },
      { no: 28, en: 'girl', zh: '女孩' }, { no: 29, en: 'man', zh: '男人' },
      { no: 30, en: 'woman', zh: '女人' }, { no: 31, en: 'brother', zh: '哥哥；弟弟' },
      { no: 32, en: 'dad', zh: '爸爸' }, { no: 33, en: 'mum', zh: '妈妈' },
      { no: 34, en: 'pet', zh: '宠物' }, { no: 35, en: 'sister', zh: '姐姐；妹妹' },
    ],
  },
  {
    id: 'u2', name: 'My School',
    words: [
      { no: 36, en: 'bag', zh: '书包' }, { no: 37, en: 'classroom', zh: '教室' },
      { no: 38, en: 'pencil', zh: '铅笔' }, { no: 39, en: 'playground', zh: '操场' },
      { no: 40, en: 'teacher', zh: '老师' }, { no: 41, en: 'board', zh: '黑板' },
      { no: 42, en: 'bookcase', zh: '书柜' }, { no: 43, en: 'chair', zh: '椅子' },
      { no: 44, en: 'cupboard', zh: '橱柜' }, { no: 45, en: 'table', zh: '桌子' },
    ],
  },
  {
    id: 'u3', name: 'Food',
    words: [
      { no: 46, en: 'apple', zh: '苹果' }, { no: 47, en: 'banana', zh: '香蕉' },
      { no: 48, en: 'grapes', zh: '葡萄' }, { no: 49, en: 'orange', zh: '橙子' },
      { no: 50, en: 'watermelon', zh: '西瓜' }, { no: 51, en: 'beans', zh: '豆角' },
      { no: 52, en: 'burger', zh: '汉堡' }, { no: 53, en: 'carrot', zh: '胡萝卜' },
      { no: 54, en: 'egg', zh: '鸡蛋' }, { no: 55, en: 'rice', zh: '米饭' },
    ],
  },
  {
    id: 'u4', name: 'My House',
    words: [
      { no: 56, en: 'bed', zh: '床' }, { no: 57, en: 'clock', zh: '时钟' },
      { no: 58, en: 'computer', zh: '电脑' }, { no: 59, en: 'lamp', zh: '台灯' },
      { no: 60, en: 'mirror', zh: '镜子' }, { no: 61, en: 'bathroom', zh: '浴室' },
      { no: 62, en: 'bedroom', zh: '卧室' }, { no: 63, en: 'garden', zh: '花园' },
      { no: 64, en: 'kitchen', zh: '厨房' }, { no: 65, en: 'living room', zh: '客厅' },
    ],
  },
  {
    id: 'u5', name: 'My Body',
    words: [
      { no: 66, en: 'ears', zh: '耳朵' }, { no: 67, en: 'eyes', zh: '眼睛' },
      { no: 68, en: 'hair', zh: '头发' }, { no: 69, en: 'mouth', zh: '嘴巴' },
      { no: 70, en: 'legs', zh: '腿' }, { no: 71, en: 'beautiful', zh: '漂亮的' },
      { no: 72, en: 'big', zh: '大的' }, { no: 73, en: 'long', zh: '长的' },
      { no: 74, en: 'short', zh: '短的' }, { no: 75, en: 'small', zh: '小的' },
    ],
  },
  {
    id: 'u6', name: 'Toys',
    words: [
      { no: 76, en: 'board game', zh: '桌游' }, { no: 77, en: 'camera', zh: '相机' },
      { no: 78, en: 'doll', zh: '玩偶' }, { no: 79, en: 'teddy', zh: '泰迪熊' },
      { no: 80, en: 'train', zh: '火车' }, { no: 81, en: 'ball', zh: '球' },
      { no: 82, en: 'balloon', zh: '气球' }, { no: 83, en: 'bike', zh: '自行车' },
      { no: 84, en: 'car', zh: '小汽车' }, { no: 85, en: 'plane', zh: '飞机' },
    ],
  },
  {
    id: 'u7', name: 'I Can',
    words: [
      { no: 86, en: 'climb', zh: '爬' }, { no: 87, en: 'jump', zh: '跳' },
      { no: 88, en: 'run', zh: '跑' }, { no: 89, en: 'swim', zh: '游泳' },
      { no: 90, en: 'walk', zh: '走' }, { no: 91, en: 'catch a ball', zh: '接球' },
      { no: 92, en: 'fly a plane', zh: '开飞机' }, { no: 93, en: 'play basketball', zh: '打篮球' },
      { no: 94, en: 'play football', zh: '踢足球' }, { no: 95, en: 'play the piano', zh: '弹钢琴' },
    ],
  },
  {
    id: 'u8', name: 'Every Day',
    words: [
      { no: 96, en: 'clean', zh: '打扫' }, { no: 97, en: 'drink', zh: '喝' },
      { no: 98, en: 'eat', zh: '吃' }, { no: 99, en: 'sleep', zh: '睡觉' },
      { no: 100, en: 'take a photo', zh: '拍照' }, { no: 101, en: 'beach', zh: '海滩' },
      { no: 102, en: 'flower', zh: '花' }, { no: 103, en: 'sea', zh: '大海' },
      { no: 104, en: 'sun', zh: '太阳' }, { no: 105, en: 'tree', zh: '树' },
    ],
  },
  {
    id: 'u9', name: 'Farm & Clothes',
    words: [
      { no: 106, en: 'jacket', zh: '夹克' }, { no: 107, en: 'jeans', zh: '牛仔裤' },
      { no: 108, en: 'shoes', zh: '鞋子' }, { no: 109, en: 'socks', zh: '袜子' },
      { no: 110, en: 'T-shirt', zh: 'T恤' }, { no: 111, en: 'dog', zh: '狗' },
      { no: 112, en: 'duck', zh: '鸭子' }, { no: 113, en: 'goat', zh: '山羊' },
      { no: 114, en: 'horse', zh: '马' }, { no: 115, en: 'sheep', zh: '绵羊' },
    ],
  },
]

/** 卡片编号 → 单词 */
export const FC_BY_NO = new Map<number, FcWord>()
for (const u of FC_UNITS) for (const w of u.words) FC_BY_NO.set(w.no, w)

/** 单词 → 首个卡片编号（看词选图的选项渲染；orange 颜色/水果共用第一个图） */
export const FC_NO_BY_WORD: Record<string, number> = {}
for (const u of FC_UNITS) for (const w of u.words) if (!(w.en in FC_NO_BY_WORD)) FC_NO_BY_WORD[w.en] = w.no

// 闪卡词表并入 EN_ZH（放在 FC_NO_BY_WORD 之后：FC_UNITS 声明在这里才可见）
for (const u of FC_UNITS) for (const w of u.words) if (!(w.en in EN_ZH)) EN_ZH[w.en] = w.zh

/** 闪卡配图路径（public/img/fc/<编号>.jpg，PDF 切图） */
export function fcImgSrc(no: number | string): string {
  const base = import.meta.env?.BASE_URL ?? '/'
  return `${base}img/fc/${no}.jpg`
}

/** 单词 → 配图：闪卡库优先（预备级词与教材词有重叠），回退 AI 生图 */
export function wordImgSrc(word: string): string {
  const no = FC_NO_BY_WORD[word]
  return no === undefined ? enImgSrc(word) : fcImgSrc(no)
}
