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

/** 单词 → 中文（图片加载失败时的文字兜底，也用于题面解释） */
export const EN_ZH: Record<string, string> = {}
for (const u of Object.values(EN_UNITS)) for (const w of u.words) EN_ZH[w.en] = w.zh

/** 单词配图路径（public/img/en/<word>.png，AI 批量生成；缺失时 UI 有文字兜底） */
export function enImgSrc(word: string): string {
  const base = import.meta.env?.BASE_URL ?? '/'
  return `${base}img/en/${word.replace(/ /g, '-')}.png`
}

/** 英语关卡的学习单元：关卡所有题型同组时才有（用于闯关前的闪卡预习），boss / 句型关没有 */
export function enUnitOf(kinds: string[]): string | undefined {
  const gs = kinds.map((k) => k.split(':')[1] ?? '')
  return gs.length > 0 && gs.every((g) => g === gs[0]) && EN_UNITS[gs[0]] ? gs[0] : undefined
}
