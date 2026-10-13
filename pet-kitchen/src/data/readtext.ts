/*
 * 课本跟读内容库（沪教牛津版 一年级上册 Unit 1–6，词 → 短语 → 句 三级）
 *
 * 本文件由 tools/gen-readtext.mjs 从 reading-score-demo/content-grade1a.js 自动转录。
 * 不要手改 —— 改内容请改源文件后重跑脚本：
 *   node tools/gen-readtext.mjs
 *
 * 单词级约束（讯飞 read_word 要求，源库已校对）：一个单词一行；不支持 ? ! ; : , ；
 * 仅支持半角 . - ' ；单词语义 ≤ 32 字节。所以 queen bee 这类条目归在短语级。
 */

export interface ReadItem {
  /** 参考文本（发给引擎判分的标准答案） */
  en: string
  /** 中文释义（页面提示 + 家长看的） */
  cn: string
  /** 引擎题型：单词用 read_word（试卷标头 [word]），短语/句子用 read_sentence（[content]） */
  category: 'read_word' | 'read_sentence'
}

export interface ReadUnit {
  id: string
  title: string
  cn: string
  words: ReadItem[]
  phrases: ReadItem[]
  sentences: ReadItem[]
}

export type ReadTier = 'words' | 'phrases' | 'sentences'

export const READ_UNITS: ReadUnit[] = [
  {
    id: "u1",
    title: "Unit 1 · What is your family like?",
    cn: "你的家人是什么样的（家庭）",
    words: [
      { en: "ant", cn: "蚂蚁", category: "read_word" },
      { en: "bear", cn: "熊", category: "read_word" },
      { en: "cow", cn: "奶牛", category: "read_word" },
      { en: "dog", cn: "狗", category: "read_word" },
      { en: "grandma", cn: "（外）祖母；奶奶；外婆", category: "read_word" },
      { en: "grandpa", cn: "（外）祖父；爷爷；外公", category: "read_word" },
      { en: "dad", cn: "爸爸", category: "read_word" },
      { en: "mum", cn: "妈妈", category: "read_word" },
      { en: "brother", cn: "哥哥；弟弟", category: "read_word" },
      { en: "sister", cn: "姐姐；妹妹", category: "read_word" },
      { en: "family", cn: "家；家庭", category: "read_word" },
      { en: "magic", cn: "有魔力的", category: "read_word" },
      { en: "pot", cn: "锅；罐", category: "read_word" },
      { en: "noodles", cn: "面条", category: "read_word" },
      { en: "hungry", cn: "饥饿的", category: "read_word" },
      { en: "like", cn: "喜欢", category: "read_word" },
      { en: "help", cn: "帮助", category: "read_word" },
      { en: "stop", cn: "停止", category: "read_word" },
      { en: "cook", cn: "烹饪；煮", category: "read_word" },
      { en: "small", cn: "小的", category: "read_word" },
      { en: "big", cn: "大的", category: "read_word" },
      { en: "bye", cn: "再见", category: "read_word" },
    ],
    phrases: [
      { en: "my grandma", cn: "我的奶奶/外婆", category: "read_sentence" },
      { en: "my grandpa", cn: "我的爷爷/外公", category: "read_sentence" },
      { en: "magic pot", cn: "魔法锅", category: "read_sentence" },
      { en: "my family", cn: "我的家", category: "read_sentence" },
    ],
    sentences: [
      { en: "This is my mum.", cn: "这是我的妈妈。", category: "read_sentence" },
      { en: "This is my dad.", cn: "这是我的爸爸。", category: "read_sentence" },
      { en: "This is my family.", cn: "这是我的家。", category: "read_sentence" },
      { en: "This is my brother.", cn: "这是我的哥哥/弟弟。", category: "read_sentence" },
      { en: "This is my sister.", cn: "这是我的姐姐/妹妹。", category: "read_sentence" },
      { en: "This is my magic pot.", cn: "这是我的魔法锅。", category: "read_sentence" },
      { en: "I'm hungry.", cn: "我饿了。", category: "read_sentence" },
      { en: "I'm Linlin.", cn: "我是琳琳。", category: "read_sentence" },
      { en: "My family is small.", cn: "我的家很小。", category: "read_sentence" },
      { en: "Let's help.", cn: "我们来帮忙。", category: "read_sentence" },
      { en: "I like noodles.", cn: "我喜欢面条。", category: "read_sentence" },
      { en: "Thank you!", cn: "谢谢！", category: "read_sentence" },
    ],
  },
  {
    id: "u2",
    title: "Unit 2 · How are you today?",
    cn: "你今天怎么样（状态与关心）",
    words: [
      { en: "elephant", cn: "大象", category: "read_word" },
      { en: "frog", cn: "青蛙", category: "read_word" },
      { en: "giraffe", cn: "长颈鹿", category: "read_word" },
      { en: "hen", cn: "母鸡", category: "read_word" },
      { en: "cold", cn: "冷的", category: "read_word" },
      { en: "hot", cn: "热的", category: "read_word" },
      { en: "thirsty", cn: "口渴的", category: "read_word" },
      { en: "hungry", cn: "饿的", category: "read_word" },
      { en: "tired", cn: "累了", category: "read_word" },
      { en: "juice", cn: "果汁", category: "read_word" },
      { en: "fan", cn: "风扇", category: "read_word" },
      { en: "trousers", cn: "裤子", category: "read_word" },
      { en: "robot", cn: "机器人", category: "read_word" },
      { en: "tortoise", cn: "乌龟", category: "read_word" },
      { en: "rabbit", cn: "兔子", category: "read_word" },
      { en: "tall", cn: "高", category: "read_word" },
      { en: "short", cn: "低；矮", category: "read_word" },
      { en: "win", cn: "赢；胜利", category: "read_word" },
    ],
    phrases: [
      { en: "on the farm", cn: "在农场", category: "read_sentence" },
      { en: "some orange juice", cn: "一些橙汁", category: "read_sentence" },
      { en: "an apple", cn: "一个苹果", category: "read_sentence" },
      { en: "a fan", cn: "一个风扇", category: "read_sentence" },
      { en: "my trousers", cn: "我的裤子", category: "read_sentence" },
      { en: "look out", cn: "小心", category: "read_sentence" },
    ],
    sentences: [
      { en: "I'm cold.", cn: "我冷了。", category: "read_sentence" },
      { en: "I'm hot.", cn: "我热了。", category: "read_sentence" },
      { en: "I'm hungry.", cn: "我饿了。", category: "read_sentence" },
      { en: "I'm thirsty.", cn: "我口渴了。", category: "read_sentence" },
      { en: "I'm tired.", cn: "我累了。", category: "read_sentence" },
      { en: "I'm hot and thirsty.", cn: "我又热又渴。", category: "read_sentence" },
      { en: "An apple for you, Julie.", cn: "朱莉，给你一个苹果。", category: "read_sentence" },
      { en: "A fan for you, John.", cn: "约翰，给你一个风扇。", category: "read_sentence" },
      { en: "Some orange juice for you, Ann.", cn: "安，给你一些橙汁。", category: "read_sentence" },
      { en: "Hello, Aunt Li!", cn: "你好，李阿姨！", category: "read_sentence" },
      { en: "How are you?", cn: "你好吗？", category: "read_sentence" },
      { en: "Welcome to my farm.", cn: "欢迎来到我的农场。", category: "read_sentence" },
    ],
  },
  {
    id: "u3",
    title: "Unit 3 · What do you take to school?",
    cn: "你带什么去学校（数字与文具）",
    words: [
      { en: "insect", cn: "昆虫", category: "read_word" },
      { en: "jellyfish", cn: "水母", category: "read_word" },
      { en: "kangaroo", cn: "袋鼠", category: "read_word" },
      { en: "lion", cn: "狮子", category: "read_word" },
      { en: "one", cn: "一", category: "read_word" },
      { en: "two", cn: "二", category: "read_word" },
      { en: "three", cn: "三", category: "read_word" },
      { en: "four", cn: "四", category: "read_word" },
      { en: "eraser", cn: "橡皮", category: "read_word" },
      { en: "ruler", cn: "直尺", category: "read_word" },
      { en: "pencil", cn: "铅笔", category: "read_word" },
      { en: "pen", cn: "钢笔", category: "read_word" },
      { en: "crayon", cn: "蜡笔", category: "read_word" },
      { en: "bag", cn: "包；袋", category: "read_word" },
      { en: "door", cn: "门", category: "read_word" },
      { en: "school", cn: "学校", category: "read_word" },
      { en: "everyone", cn: "大家", category: "read_word" },
      { en: "draw", cn: "画画", category: "read_word" },
      { en: "see", cn: "看见", category: "read_word" },
      { en: "where", cn: "哪里", category: "read_word" },
      { en: "have", cn: "有", category: "read_word" },
      { en: "use", cn: "使用", category: "read_word" },
      { en: "them", cn: "他们", category: "read_word" },
      { en: "fly", cn: "飞", category: "read_word" },
      { en: "swim", cn: "游泳", category: "read_word" },
      { en: "head", cn: "头", category: "read_word" },
      { en: "sorry", cn: "对不起", category: "read_word" },
    ],
    phrases: [
      { en: "pencil case", cn: "铅笔盒", category: "read_sentence" },
      { en: "coloured pencil", cn: "彩色铅笔", category: "read_sentence" },
      { en: "one pencil case", cn: "一个铅笔盒", category: "read_sentence" },
      { en: "two erasers", cn: "两块橡皮", category: "read_sentence" },
      { en: "three pencils", cn: "三支铅笔", category: "read_sentence" },
      { en: "four rulers", cn: "四把直尺", category: "read_sentence" },
      { en: "look at", cn: "看", category: "read_sentence" },
      { en: "at the door", cn: "在门边", category: "read_sentence" },
    ],
    sentences: [
      { en: "I see one pencil case.", cn: "我看见一个铅笔盒。", category: "read_sentence" },
      { en: "I see three pencils.", cn: "我看见三支铅笔。", category: "read_sentence" },
      { en: "I see two erasers.", cn: "我看见两块橡皮。", category: "read_sentence" },
      { en: "I see four rulers.", cn: "我看见四把直尺。", category: "read_sentence" },
      { en: "How many pencils?", cn: "有多少支铅笔？", category: "read_sentence" },
      { en: "How many erasers?", cn: "有多少块橡皮？", category: "read_sentence" },
      { en: "Is that my pencil case?", cn: "那是我的铅笔盒吗？", category: "read_sentence" },
      { en: "Is that my pencil?", cn: "那是我的铅笔吗？", category: "read_sentence" },
      { en: "Good morning, everyone.", cn: "大家早上好。", category: "read_sentence" },
      { en: "Let's draw.", cn: "让我们画画吧。", category: "read_sentence" },
      { en: "Where's my pencil case?", cn: "我的铅笔盒在哪里？", category: "read_sentence" },
      { en: "I have three pencils.", cn: "我有三支铅笔。", category: "read_sentence" },
      { en: "Who's at the door?", cn: "谁在门口？", category: "read_sentence" },
      { en: "It's Mary's dad.", cn: "是玛丽的爸爸。", category: "read_sentence" },
      { en: "Mary, this is your pencil case.", cn: "玛丽，这是你的铅笔盒。", category: "read_sentence" },
      { en: "Sorry, everybody!", cn: "对不起，各位。", category: "read_sentence" },
    ],
  },
  {
    id: "u4",
    title: "Unit 4 · What can you do?",
    cn: "你会做什么（能力）",
    words: [
      { en: "monkey", cn: "猴子", category: "read_word" },
      { en: "nightingale", cn: "夜莺", category: "read_word" },
      { en: "ox", cn: "公牛", category: "read_word" },
      { en: "pig", cn: "猪", category: "read_word" },
      { en: "draw", cn: "画画", category: "read_word" },
      { en: "write", cn: "写字；书写", category: "read_word" },
      { en: "read", cn: "阅读", category: "read_word" },
      { en: "sing", cn: "唱（歌）", category: "read_word" },
      { en: "dance", cn: "跳舞", category: "read_word" },
      { en: "violin", cn: "小提琴", category: "read_word" },
      { en: "bike", cn: "自行车", category: "read_word" },
      { en: "run", cn: "跑", category: "read_word" },
      { en: "jump", cn: "跳跃", category: "read_word" },
      { en: "work", cn: "工作；劳动", category: "read_word" },
      { en: "animal", cn: "动物", category: "read_word" },
      { en: "bird", cn: "鸟", category: "read_word" },
      { en: "fish", cn: "鱼", category: "read_word" },
      { en: "frog", cn: "青蛙", category: "read_word" },
      { en: "sleep", cn: "睡觉", category: "read_word" },
      { en: "dream", cn: "梦；梦想", category: "read_word" },
    ],
    phrases: [
      { en: "play the violin", cn: "弹奏小提琴", category: "read_sentence" },
      { en: "ride a bike", cn: "骑自行车", category: "read_sentence" },
      { en: "talent show", cn: "才艺表演", category: "read_sentence" },
    ],
    sentences: [
      { en: "What can you do?", cn: "你会做什么？", category: "read_sentence" },
      { en: "What can Jim do?", cn: "吉姆会做什么？", category: "read_sentence" },
      { en: "What can animals do?", cn: "动物们都会什么？", category: "read_sentence" },
      { en: "I can draw.", cn: "我会画画。", category: "read_sentence" },
      { en: "I can write.", cn: "我会写字。", category: "read_sentence" },
      { en: "I can ride a bike.", cn: "我会骑自行车。", category: "read_sentence" },
      { en: "I can play the violin.", cn: "我会弹小提琴。", category: "read_sentence" },
      { en: "My grandpa can sing.", cn: "我爷爷会唱歌。", category: "read_sentence" },
      { en: "Jim can write and read.", cn: "吉姆会写字和阅读。", category: "read_sentence" },
      { en: "My sister can dance.", cn: "我姐姐会跳舞。", category: "read_sentence" },
      { en: "It can fly. It can't swim.", cn: "它会飞。它不会游泳。", category: "read_sentence" },
      { en: "It can swim. It can't run.", cn: "它会游泳。它不会跑。", category: "read_sentence" },
      { en: "Can you help me, Grandpa?", cn: "爷爷，你能帮我吗？", category: "read_sentence" },
      { en: "Sure.", cn: "当然。", category: "read_sentence" },
      { en: "It's a fish.", cn: "它是一条鱼。", category: "read_sentence" },
      { en: "It's a bird.", cn: "它是一只鸟。", category: "read_sentence" },
      { en: "It's a frog.", cn: "它是一只青蛙。", category: "read_sentence" },
    ],
  },
  {
    id: "u5",
    title: "Unit 5 · What is your favourite animal?",
    cn: "你最喜欢的动物是什么",
    words: [
      { en: "rabbit", cn: "兔子", category: "read_word" },
      { en: "snake", cn: "蛇", category: "read_word" },
      { en: "tiger", cn: "老虎", category: "read_word" },
      { en: "dog", cn: "狗", category: "read_word" },
      { en: "cat", cn: "猫", category: "read_word" },
      { en: "fish", cn: "鱼", category: "read_word" },
      { en: "bird", cn: "鸟", category: "read_word" },
      { en: "hamster", cn: "仓鼠", category: "read_word" },
      { en: "tortoise", cn: "龟", category: "read_word" },
      { en: "garden", cn: "花园", category: "read_word" },
      { en: "baby", cn: "宝宝", category: "read_word" },
      { en: "nest", cn: "鸟巢", category: "read_word" },
      { en: "queen", cn: "女王；王后", category: "read_word" },
      { en: "king", cn: "国王", category: "read_word" },
      { en: "lovely", cn: "可爱的", category: "read_word" },
      { en: "careful", cn: "小心；注意", category: "read_word" },
      { en: "little", cn: "小的", category: "read_word" },
      { en: "around", cn: "在周围，环绕", category: "read_word" },
    ],
    phrases: [
      { en: "queen bee", cn: "蜂后", category: "read_sentence" },
      { en: "a baby bird", cn: "一只幼鸟", category: "read_sentence" },
      { en: "help the bird", cn: "帮助小鸟", category: "read_sentence" },
      { en: "in the nest", cn: "在鸟巢里", category: "read_sentence" },
      { en: "a big fish", cn: "一条大鱼", category: "read_sentence" },
      { en: "go fishing", cn: "去钓鱼", category: "read_sentence" },
    ],
    sentences: [
      { en: "It's a bird.", cn: "它是一只鸟。", category: "read_sentence" },
      { en: "It's a baby bird.", cn: "它是一只幼鸟。", category: "read_sentence" },
      { en: "It's a hamster.", cn: "它是一只仓鼠。", category: "read_sentence" },
      { en: "It's a lovely hamster.", cn: "它是一只可爱的仓鼠。", category: "read_sentence" },
      { en: "What's that, Grandpa?", cn: "爷爷，那是什么？", category: "read_sentence" },
      { en: "What's this, Mum?", cn: "妈妈，这是什么？", category: "read_sentence" },
      { en: "Let's help the bird.", cn: "让我们帮助小鸟。", category: "read_sentence" },
      { en: "Let's go fishing.", cn: "让我们去钓鱼吧。", category: "read_sentence" },
      { en: "Let's put the bird in the nest.", cn: "让我们把鸟送回鸟巢。", category: "read_sentence" },
      { en: "Be careful, Grandpa!", cn: "爷爷，小心！", category: "read_sentence" },
      { en: "Where's Little Cat?", cn: "小猫在哪里？", category: "read_sentence" },
      { en: "I'm sorry, Mum.", cn: "对不起，妈妈。", category: "read_sentence" },
      { en: "Well done!", cn: "做得好！", category: "read_sentence" },
    ],
  },
  {
    id: "u6",
    title: "Unit 6 · What colours can you see?",
    cn: "你能看到什么颜色",
    words: [
      { en: "duck", cn: "鸭子", category: "read_word" },
      { en: "dove", cn: "鸽子", category: "read_word" },
      { en: "swan", cn: "天鹅", category: "read_word" },
      { en: "fox", cn: "狐狸", category: "read_word" },
      { en: "yak", cn: "牦牛", category: "read_word" },
      { en: "zebra", cn: "斑马", category: "read_word" },
      { en: "red", cn: "红色", category: "read_word" },
      { en: "white", cn: "白色", category: "read_word" },
      { en: "yellow", cn: "黄色", category: "read_word" },
      { en: "green", cn: "绿色", category: "read_word" },
      { en: "blue", cn: "蓝色", category: "read_word" },
      { en: "black", cn: "黑色", category: "read_word" },
      { en: "grey", cn: "灰色", category: "read_word" },
      { en: "park", cn: "公园", category: "read_word" },
      { en: "game", cn: "游戏", category: "read_word" },
      { en: "something", cn: "某物", category: "read_word" },
      { en: "chameleon", cn: "变色龙", category: "read_word" },
      { en: "kite", cn: "风筝", category: "read_word" },
      { en: "find", cn: "发现；找", category: "read_word" },
      { en: "children", cn: "儿童们", category: "read_word" },
      { en: "favourite", cn: "最喜欢的", category: "read_word" },
      { en: "hurt", cn: "受伤；疼", category: "read_word" },
      { en: "nice", cn: "漂亮的", category: "read_word" },
      { en: "hospital", cn: "医院", category: "read_word" },
      { en: "colourful", cn: "多彩的", category: "read_word" },
      { en: "plant", cn: "植物", category: "read_word" },
      { en: "tree", cn: "树", category: "read_word" },
      { en: "branch", cn: "枝干", category: "read_word" },
      { en: "zoo", cn: "动物园", category: "read_word" },
    ],
    phrases: [
      { en: "in the park", cn: "在公园", category: "read_sentence" },
      { en: "play a game", cn: "玩一个游戏", category: "read_sentence" },
      { en: "go to hospital", cn: "去医院", category: "read_sentence" },
      { en: "a green tree", cn: "一棵绿色的树", category: "read_sentence" },
      { en: "a green frog", cn: "一只绿色的青蛙", category: "read_sentence" },
      { en: "a white bird", cn: "一只白色的鸟", category: "read_sentence" },
      { en: "a white duck", cn: "一只白色的鸭子", category: "read_sentence" },
      { en: "two yellow flowers", cn: "两朵黄色的花", category: "read_sentence" },
      { en: "in the zoo", cn: "在动物园", category: "read_sentence" },
    ],
    sentences: [
      { en: "What colour is it?", cn: "它是什么颜色？", category: "read_sentence" },
      { en: "What colour is the kite?", cn: "这个风筝是什么颜色？", category: "read_sentence" },
      { en: "What colours can you see?", cn: "你能看到什么颜色？", category: "read_sentence" },
      { en: "What colours are the chameleons and plants?", cn: "这些变色龙和植物都是什么颜色？", category: "read_sentence" },
      { en: "It's blue, green, yellow and black.", cn: "它是蓝色、绿色、黄色和黑色。", category: "read_sentence" },
      { en: "This is a cat. It's black.", cn: "这是一只猫。它是黑色的。", category: "read_sentence" },
      { en: "The plant is yellow.", cn: "植物是黄色的。", category: "read_sentence" },
      { en: "The chameleon is yellow too.", cn: "变色龙也是黄色的。", category: "read_sentence" },
      { en: "The ground is grey.", cn: "地面是灰色的。", category: "read_sentence" },
      { en: "The chameleon is grey too.", cn: "变色龙也是灰色的。", category: "read_sentence" },
      { en: "The tree is red.", cn: "树是红色的。", category: "read_sentence" },
      { en: "The chameleon is red too.", cn: "变色龙也是红色的。", category: "read_sentence" },
      { en: "The branch is green.", cn: "树枝是绿色的。", category: "read_sentence" },
      { en: "The chameleon is green too.", cn: "变色龙也是绿色的。", category: "read_sentence" },
      { en: "Children, let's play a game!", cn: "孩子们，我们来玩个游戏吧！", category: "read_sentence" },
      { en: "Find something green.", cn: "找一些绿色的东西。", category: "read_sentence" },
      { en: "One for you, and one for me.", cn: "一个给你，一个给我。", category: "read_sentence" },
      { en: "Good job!", cn: "干得好！", category: "read_sentence" },
      { en: "They're nice!", cn: "它们很漂亮！", category: "read_sentence" },
      { en: "It hurts!", cn: "很疼！", category: "read_sentence" },
      { en: "Let's go to the hospital!", cn: "我们去医院吧！", category: "read_sentence" },
    ],
  },
]

/** 三档的决定性元数据：后缀 → 档位 / 引擎题型 / 中文名 */
export const TIER_META: Record<string, { tier: ReadTier; category: ReadItem['category']; label: string }> = {
  w: { tier: 'words', category: 'read_word', label: '单词' },
  p: { tier: 'phrases', category: 'read_sentence', label: '短语' },
  s: { tier: 'sentences', category: 'read_sentence', label: '句子' },
}

export function readUnit(unitId: string): ReadUnit | undefined {
  return READ_UNITS.find((u) => u.id === unitId)
}

/**
 * 跟读关 id 约定：rd-<unitId>-<档位后缀>，例如 rd-u1-w / rd-u1-p / rd-u1-s。
 * 返回该关的素材；id 不认识时返回 undefined（调用方负责兜底）。
 */
export function readItemsOf(levelId: string): { unit: ReadUnit; tier: ReadTier; items: ReadItem[] } | undefined {
  const m = /^rd-(u\d+)-([wps])$/.exec(levelId)
  if (!m) return undefined
  const unit = readUnit(m[1])
  const meta = TIER_META[m[2]]
  if (!unit || !meta) return undefined
  return { unit, tier: meta.tier, items: unit[meta.tier] }
}
