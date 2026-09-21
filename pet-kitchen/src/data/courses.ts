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

// ---------- 看字选音 / 听音选字 字库（一年级常见字，音形兼具） ----------
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
  { py: 'fēng', zh: '风' }, { py: 'fēi', zh: '飞' }, { py: 'mén', zh: '门' }, { py: 'mù', zh: '目' },
  { py: 'kǒu', zh: '口' }, { py: 'ěr', zh: '耳' }, { py: 'shǒu', zh: '手' }, { py: 'zú', zh: '足' },
  { py: 'māo', zh: '猫' }, { py: 'gǒu', zh: '狗' }, { py: 'niú', zh: '牛' }, { py: 'yáng', zh: '羊' },
]

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
