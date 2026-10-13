/* 冒烟脚本：在 Node 里跑一遍核心状态机，验证 PRD 规则是否被正确执行 */
import { useStore, dailyTaskVisible, templateAppliesOn, weekdayOf } from './src/store/useStore'
import { checkName } from './src/utils/sensitive'
import * as rules from './src/engine/rules'
import {
  MATH_LEVELS, PINYIN_LEVELS, PINYIN_WORLD_LEVELS, LITERACY_LEVELS, MIXED_LEVELS,
  EN_LEVELS, EN_READ_LEVELS, EN_QUIZ_LEVELS, EN_TEXTBOOK_LEVELS, EN_OXFORD_LEVELS,
  SECTIONS, SECTION_ATTR, LEVELS_BY_SECTION, LEVELS_BY_SUBJECT, levelsOf, pageOfLevel, subjectOfKind,
  levelById, bossRequires, buildLevelQuestions, variantsOf, questionOfKind, buildQuestion, charPool, specKey,
} from './src/engine/questions'
import { INITIALS, FINALS, ZHENGTI, PW_LEVELS, PW_UNITS } from './src/pinyin/data'
import { genLevelQuestions, genTestQuestions, stripTone, setTone, isPinyinLearned } from './src/pinyin/quiz'
import { specOf, toAppQuestion } from './src/pinyin/toApp'
import { learnedLettersByDay } from './src/pinyin/plan'
import { CHAR_BANK, FC_UNITS } from './src/data/courses'
import { READ_UNITS } from './src/data/readtext'
import { alignScores } from './src/engine/follow'
import {
  READ_WRONG_KIND, isReadWord, reviewItemsOf, weakWordsOf, wrongQuestionOf, wrongSpecOf,
} from './src/engine/readwrong'
import * as limits from './src/engine/limits'
import { advanceQueue, firstCorrectCount } from './src/engine/queue'
import { toDay, addDays, nowDay, DAY_START_HOUR } from './src/engine/time'
import { gradeLocally, needsModel, normalizeNumeric } from './src/engine/grading'
import {
  activeProvider, configureProvider, generateQuestions, generateVariants, gradeAnswer,
  isThenable, localProvider, providerStats, resetProviderConfig, resetProviderStats,
} from './src/engine/provider'
import {
  configureSync, dropQueue, flushSync, pendingCount, resetSync, syncStats,
} from './src/store/sync'
import { applyOp } from './server/ops'
import { newMediaKey, openBytes, sealBytes } from './src/utils/media'
import { ACHIEVEMENTS, unlockedCount } from './src/data/achievements'

let fail = 0
function ok(cond: boolean, msg: string, extra?: unknown) {
  if (cond) console.log('  PASS  ', msg)
  else {
    fail++
    console.log('  FAIL  ', msg, extra ?? '')
  }
}

const s = () => useStore.getState()

/** 模拟"过了一天"：把 activeDay 回拨一天，再让 ensureDay 结算推进回来。
 *  daily 一并清空 —— 结算现在只清「被结算那天」的实例（给跨设备拉取留路），
 *  回拨出来的旧行不属于被结算日，得靠这里模拟真实跨天时「当日行就是被结算行」。 */
function nextDay() {
  useStore.setState({ activeDay: addDays(s().activeDay, -1), daily: [] })
  s().ensureDay()
}

console.log('== 1. 初始化 ==')
s().bootstrap()
ok(!s().pet, '初始没有宠物')
ok(s().templates.length === 6, `默认任务模板 ${s().templates.length} 条（5 默认 + 闪卡速记补种）`)
ok(s().prizes.length > 0, `默认现实奖品 ${s().prizes.length} 个`)

console.log('== 2. 领养 / 破壳 / 取名 ==')
s().adopt('feifei')
ok(!!s().pet, '领养成功')
ok(s().phase === 'hatch', `phase = ${s().phase}`)
ok(s().pet!.satiety === 60 && s().pet!.stage === 1, '初始饱食度 60 / stage 1')
s().hatchDone()
ok(s().phase === 'name', `phase = ${s().phase}`)
s().setName('小闪电')
ok(s().pet!.nickname === '小闪电' && s().pet!.locked, '取名成功并锁定（Q26 不可换宠）')
ok(s().phase === 'home', '进入家园')

console.log('== 3. 每日任务生成 ==')
ok(s().daily.length === 6, `今日任务 ${s().daily.length} 条`)
ok(s().daily.every((t) => t.day === s().activeDay), '任务 day 与 activeDay 一致')

console.log('== 4. 打卡 → 发食物 ==')
const t0 = s().daily[0]
s().submitTask(t0.id)
ok(s().daily.find((x) => x.id === t0.id)!.status === 'done', '客观类任务提交即完成')
ok(s().food === 1, `食物 = ${s().food}（期望 1）`, s().food)
ok(s().streak === 1, `连续天数 = ${s().streak}`)

for (const t of s().daily.filter((x) => x.status !== 'done')) s().submitTask(t.id)
ok(s().daily.filter((t) => t.status === 'pending').length === 3, '3 个主观任务进入待家长确认')
for (const t of s().daily.filter((x) => x.status === 'pending')) s().approveTask(t.id)
ok(s().food === 6, `6 个任务共得 ${s().food} 份食物（无全勤奖）`, s().food)
ok(s().todayTasksDone === 6, `todayTasksDone = ${s().todayTasksDone}`)

console.log('== 5. 喂养规则（1份=20，日上限5，硬上限120）==')
useStore.setState({ pet: { ...s().pet!, satiety: 0, fedToday: 0 } })
s().parentAdjustFood(10, '测试补发')
s().feed(3)
ok(s().pet!.satiety === 60, `喂 3 份 → 饱食度 ${s().pet!.satiety}（期望 60）`, s().pet?.satiety)
ok(s().food === 13, `食物剩余 ${s().food}（6+10-3）`, s().food)
ok(s().pet!.exp === 30, `经验 ${s().pet!.exp}（3×10）`, s().pet?.exp)
s().feed(2)
ok(s().pet!.satiety === 100, `再喂 2 份 → ${s().pet!.satiety}（期望 100，恰好顶格）`, s().pet?.satiety)
ok(s().pet!.fedToday === 5, `当日已喂 ${s().pet!.fedToday} 份 = 日上限`)
const feedRes = s().feed(1)
ok(!feedRes.ok, `第 6 份被日上限拒绝：${feedRes.msg}`)

// 硬上限仍生效：从 110 起喂 3 份只能补 1 份到 120（room 夹紧）
useStore.setState({ pet: { ...s().pet!, satiety: 110, fedToday: 0 } })
s().feed(3)
ok(s().pet!.satiety === 120, `从 110 喂 3 份 → ${s().pet!.satiety}（硬上限夹紧）`, s().pet?.satiety)
// 体型机制已移除：喂满也不再产生任何体型状态
ok(!('body' in s().pet!), '宠物对象已不含 body 字段（体型机制已移除）')
ok(!('noFeedDays' in s().pet!) && !('fullDays' in s().pet!), '宠物对象已不含连续未喂/连续顶格计数')

console.log('== 6. 跨日结算（-60 衰减 / 计数器重置）==')
nextDay()
ok(s().pet!.satiety === 60, `120 - 60 = ${s().pet!.satiety}（期望 60）`, s().pet?.satiety)
ok(s().pet!.fedToday === 0, 'fedToday 已重置')
ok(s().todayTasksDone === 0, 'todayTasksDone 已重置')
ok(s().daily.length === 6, '新一天任务已重建')
ok(s().snapshots.length >= 1, `快照已写入 ${s().snapshots.length} 条`)

console.log('== 7. 连续 7 天额外 +1 / 30 天 +5 ==')
{
  let day7Gain = -1
  for (let i = 0; i < 7; i++) {
    nextDay()
    const before = s().food
    s().submitTask(s().daily[0].id)
    if (s().streak === 7) day7Gain = s().food - before
  }
  ok(s().streak === 7, `连续 ${s().streak} 天`)
  ok(day7Gain === 2, `第 7 天产出 = ${day7Gain}（1 基础 + 1 连续奖励）`, day7Gain)

  // 直接把 streak 拨到 29，再过一天打第一个任务，验证第 30 天 +5
  nextDay()
  useStore.setState({ streak: 29 })
  const before30 = s().food
  s().submitTask(s().daily[0].id)
  ok(s().streak === 30, `连续 ${s().streak} 天`)
  ok(s().food === before30 + 6, `第 30 天产出 = ${s().food - before30}（1 基础 + 5 奖励）`, s().food - before30)
}

console.log('== 8. 断签清零 ==')
nextDay() // 结算第 30 天（有完成任务，streak 保留）
 nextDay() // 这天一个任务都不做 → 结算时 streak 清零
ok(s().streak === 0, `断签后 streak = ${s().streak}（期望 0）`, s().streak)
ok(s().longestStreak >= 30, `最长连续记录保留 = ${s().longestStreak}`)

console.log('== 9. 三天不喂 → 饱食度归零（不再有体型变化）==')
{
  useStore.setState({ pet: { ...s().pet!, satiety: 100 } })
  nextDay()
  nextDay()
  nextDay()
  ok(s().pet!.satiety === 0, `饱食度归零 ${s().pet!.satiety}`)
  ok(!('body' in s().pet!), '连续未喂不再改变体型（体型机制已移除）')
}

console.log('== 10. 出题引擎（12 关 × 10 题）==')
{
  let total = 0
  let bad = 0
  /** 提示泄露答案的次数（提示里的数字若在题干中没有出现，则不得等于答案） */
  const leak: string[] = []
  const seen = new Set<string>()
  for (const lv of MATH_LEVELS) {
    const qs = buildLevelQuestions(lv, [], rules.QUESTIONS_PER_LEVEL)
    total += qs.length
    for (const q of qs) {
      if (typeof q.answer !== 'number' || Number.isNaN(q.answer)) bad++
      if (q.answer < 0 || q.answer > 99) bad++ // 答案必须落在两位数可输入范围
      if (!q.text) bad++
      if (!q.hint) bad++
      if (!q.explain) bad++
      const inText = new Set(q.text.match(/\d+/g) ?? [])
      if ((q.hint.match(/\d+/g) ?? []).some((n) => !inText.has(n) && Number(n) === q.answer)) {
        leak.push(`${q.text} → 答案 ${q.answer} ｜ 提示：${q.hint}`)
      }
      seen.add(q.text)
    }
  }
  ok(bad === 0, `${MATH_LEVELS.length} 关共 ${total} 题，异常 ${bad} 处`)
  ok(leak.length === 0, `${total} 题提示均未泄露答案`, leak.length)
  if (leak.length) console.log(leak.slice(0, 3).map((s) => `        泄露样例：${s}`).join('\n'))
  ok(total === MATH_LEVELS.length * rules.QUESTIONS_PER_LEVEL, `每关 ${rules.QUESTIONS_PER_LEVEL} 题`)
  ok(seen.size > total * 0.7, `去重后 ${seen.size}/${total} 题，重复率可接受`)

  const q1 = questionOfKind('cou10')
  const vs = variantsOf(q1.spec)
  ok(vs.length === 3, `举一反三生成 ${vs.length} 道变式`)
  ok(vs.every((v) => typeof v.answer === 'number' && v.explain && v.hint), '变式含答案、提示与讲解')

  // 错题注入：上关错过的题必须出现在本关题面里
  const injectSpecs = [q1.spec]
  const withInject = buildLevelQuestions(MATH_LEVELS[2], injectSpecs, 10)
  ok(withInject.length === 10, '注入后仍为 10 题')
  ok(
    new Set(withInject.map((q) => q.text)).size === 10,
    '注入后无重复题',
  )
  const injectQ = buildQuestion(q1.spec)
  ok(withInject.some((q) => q.text === injectQ.text), '错题已注入本关')
  ok(withInject.every((q) => typeof q.answer === 'number' && !!q.hint), '注入题含答案与提示')
}

console.log('== 10.5 语文 / 英语关卡内容（拼音 / 识字 / 古诗 / 英语单元）==')
{
  // 2026-10-12 改版：「语文」拆成拼音线 + 识字线。
  // 注意这里跑的是**历史拼音题**（c1…c20，本应用出题，能出选择题）；
  // 现役拼音版块（PINYIN_WORLD_LEVELS）走拼音世界玩法、kinds 为空，不在这一节跑。
  const chinese = [...PINYIN_LEVELS, ...LITERACY_LEVELS]
  ok(chinese.length === 23 && EN_QUIZ_LEVELS.length === 9,
    `历史语文 ${chinese.length} 关（拼音存档 ${PINYIN_LEVELS.length} + 识字 ${LITERACY_LEVELS.length}）/ 英语认读 ${EN_QUIZ_LEVELS.length} 关`)
  ok(!!levelById('m1') && !!levelById('c1') && !!levelById('e1'), 'levelById 三科都能找到')
  ok(bossRequires(LITERACY_LEVELS.find((l) => l.boss)!).length === 5, 'Boss 解锁要求取自本版块的关卡列表')

  // 只跑「选择题关」：跟读关（play==='read'、kinds 为空）不出选择题，走 P18
  for (const level of [...chinese, ...EN_QUIZ_LEVELS]) {
    const qs = buildLevelQuestions(level, [], rules.QUESTIONS_PER_LEVEL)
    let bad = 0
    for (const q of qs) {
      if (q.answerType !== 'choice') bad++
      else {
        const opts = q.options ?? []
        if (opts.length !== 4 || new Set(opts).size !== 4) bad++
        if (opts[q.answer] === undefined) bad++
        // spec 重建：答案文本必须仍在重建题的选项里（同 spec 同构）
        const rebuilt = buildQuestion(q.spec)
        if (rebuilt.options?.[rebuilt.answer] !== opts[q.answer]) bad++
      }
    }
    ok(qs.length > 0 && bad === 0, `${level.name}：${qs.length} 题，选项/答案/重建 全部合法`, bad)
  }

  // 题面样例抽查
  const py = questionOfKind('py_pick_char:single')
  ok(py.text.includes('读') && (py.options?.length ?? 0) === 4, `看拼音选汉字题面：${py.text}`)
  const en = questionOfKind('en_word:family')
  ok(en.speechLang === 'en-US', `英语题朗读语言 en-US：${en.text}`)
  const poem = questionOfKind('poem_next')
  ok(poem.text.includes('下一句'), `古诗对句题面：${poem.text}`)

  // choice 判分走本地（不打模型）
  const q1 = questionOfKind('char_py:char')
  const right = q1.options?.[q1.answer] ?? ''
  const wrongOpt = (q1.options ?? []).find((o) => o !== right) ?? ''
  ok(gradeLocally(q1, right).correct, 'choice 题：选对 → 本地判对')
  ok(!gradeLocally(q1, wrongOpt).correct, 'choice 题：选错 → 本地判错')
  ok(!needsModel(q1), 'choice 题不需要模型')

  // 拼音重排 + 图词题新题型抽查
  const blend = questionOfKind('py_blend:u6')
  ok((blend.spec.prompt ?? '').includes('|') && (blend.options?.length ?? 0) === 4, `声韵拼读题面：${blend.text}`)
  const rep = questionOfKind('py_rep:u11')
  ok(rep.text.includes('的读音'), `认读音节题面：${rep.text}`)
  const pic = questionOfKind('en_pic:family')
  ok(pic.pictureOptions === true && pic.speechLang === 'en-US' && (pic.options ?? []).every((o) => o === pic.spec.ans || (pic.spec.opts ?? []).includes(o)), `看词选图：${pic.text}`)
  const wp = questionOfKind('en_wp:animal')
  ok(!!wp.promptImg && wp.pictureOptions !== true, `看图选词：${wp.text}`)

  // 已学音把关：识字关只会出「声母韵母都学过」的字（马 b+a 在 u2 后；猫 m+ao 要等 u7）
  ok(charPool('u2').some((c) => c.zh === '马') && !charPool('u2').some((c) => c.zh === '猫'), 'u2 后会拼「马」还不会拼「猫」')
  ok(charPool('u7').some((c) => c.zh === '猫') && !charPool('u7').some((c) => c.zh === '三'), 'u7 后会拼「猫」，「三」要等鼻韵母')
  ok(charPool('u13').length === CHAR_BANK.length, '全部拼音学完后字库全解锁')
}

console.log('== 10.6 闯关 5 版块结构（拼音 / 数学 / 英语 / 识字 / 综合）==')
{
  ok(SECTIONS.length === 5, `版块 ${SECTIONS.length} 个：${SECTIONS.map((s) => s.name).join(' / ')}`)
  ok(
    SECTIONS.map((s) => s.id).join(',') === 'pinyin,math,english,literacy,mixed',
    '版块顺序 拼音 → 数学 → 英语 → 识字 → 综合',
  )

  // 每个版块：关卡 index 必须在本版块内连续（Boss 解锁与「下一关」都按它找）
  for (const meta of SECTIONS) {
    const list = LEVELS_BY_SECTION[meta.id]
    ok(list.every((l) => l.section === meta.id), `${meta.name}版块：${list.length} 关，section 全部归属正确`)
    const idx = list.map((l) => l.index)
    ok(idx.every((n, i) => n === i + 1), `${meta.name}版块：index 连续 ${idx[0]}…${idx[idx.length - 1]}`)
  }

  // 拼音版块：现役 15 关（拼音方块世界，玩法 play=pinyin → P24PinyinGame）
  ok(PINYIN_WORLD_LEVELS.length === 15 && LEVELS_BY_SECTION.pinyin === PINYIN_WORLD_LEVELS,
    `拼音版块 ${PINYIN_WORLD_LEVELS.length} 关（拼音方块世界已整体搬进本应用）`)
  ok(
    PINYIN_WORLD_LEVELS.every((l) => l.play === 'pinyin' && pageOfLevel(l) === 'pyplay'),
    '拼音关：play=pinyin → 路由到 pyplay（P24PinyinGame）',
  )
  // 历史拼音存档（c1…c20）已下架，但 levelById 仍要认得 —— 老存档的 level_records / 错题靠它解析
  ok(PINYIN_LEVELS.length === 15 && levelById('c1')?.id === 'c1',
    `历史拼音存档 ${PINYIN_LEVELS.length} 关，levelById 仍能解析（老存档兼容）`)

  // 英语 = 课本（跟读 18 + 认读 9）+ 牛津树（闪卡）
  ok(EN_READ_LEVELS.length === 18, `课本跟读关 ${EN_READ_LEVELS.length} 关（6 单元 × 词/短语/句）`)
  ok(EN_TEXTBOOK_LEVELS.length === 27, `课本线共 ${EN_TEXTBOOK_LEVELS.length} 关（18 跟读 + 9 认读）`)
  ok(EN_OXFORD_LEVELS.length === FC_UNITS.length, `牛津树 ${EN_OXFORD_LEVELS.length} 关（= FC_UNITS 单元数）`)
  ok(EN_LEVELS.length === 27 + FC_UNITS.length, `英语版块合计 ${EN_LEVELS.length} 关`)
  ok(EN_READ_LEVELS.every((l) => l.track === 'textbook' && l.play === 'read' && pageOfLevel(l) === 'follow'),
    '跟读关：track=textbook / play=read → 路由到 follow（P18）')
  ok(EN_QUIZ_LEVELS.every((l) => pageOfLevel(l) === 'play'), '认读关：路由到 play（P08）')
  ok(EN_OXFORD_LEVELS.every((l) => l.track === 'oxford'), '牛津树关 track=oxford（原闪卡速记内容不变）')
  ok(EN_OXFORD_LEVELS.every((l) => l.kinds.every((k) => k.startsWith('fc_'))), '牛津树关只出闪卡题（fc_*）')

  // 综合版块：混合抽题 + 错题复习
  ok(MIXED_LEVELS.length === 2, `综合版块 ${MIXED_LEVELS.length} 关：${MIXED_LEVELS.map((l) => l.name).join(' / ')}`)
  ok(MIXED_LEVELS.every((l) => SECTION_ATTR.mixed === l.subject && l.subject === 'mixed'), '综合关 subject=mixed')
  ok((MIXED_LEVELS[1].wrongInject ?? 0) === 10, `错题复习关 wrongInject=${MIXED_LEVELS[1].wrongInject}（整关基本由错题组成）`)

  // 综合关出题：题面合法、且四路都摇得到（多摇几轮，避免偶发全落在同一路）
  {
    const qs = buildLevelQuestions(MIXED_LEVELS[0], [], 10)
    ok(qs.length === 10, `混合大乱斗出 ${qs.length} 题`)
    ok(qs.every((q) => !!q.text && !!q.hint && !!q.explain), '混合题面/提示/讲解齐全')
    ok(qs.every((q) => q.spec.kind !== 'mix_all'), '混合题落地为具体题型（可行错题本、举一反三）')

    const subjects = new Set<string>()
    for (let i = 0; i < 60; i++) subjects.add(subjectOfKind(questionOfKind('mix_all').spec.kind))
    ok(subjects.size >= 3, `综合关能摇出多科题目（60 次样本命中 ${subjects.size} 科：${[...subjects].join('/')}）`)
    ok(subjectOfKind('cou10') === 'math', '归科：数学题 → math')
    ok(subjectOfKind('char_py:u13') === 'chinese' && subjectOfKind('poem_next') === 'chinese', '归科：识字/古诗 → chinese')
    ok(subjectOfKind('en_pic:family') === 'english' && subjectOfKind('fc_pic:u3') === 'english', '归科：课本/闪卡 → english')
  }

  // 学科 → 关卡列表 与 版块列表 一一对上（服务端出题、结算页取数都靠它）
  ok(LEVELS_BY_SUBJECT.math === MATH_LEVELS, '学科 math → 数学版块')
  ok(LEVELS_BY_SUBJECT.chinese === LITERACY_LEVELS, '学科 chinese → 识字线（拼音版块按 section 走，不在 subject 表里）')
  ok(LEVELS_BY_SUBJECT.english === EN_LEVELS && LEVELS_BY_SUBJECT.mixed === MIXED_LEVELS, '学科 english / mixed 对得上')
  ok(levelsOf(EN_OXFORD_LEVELS[0]).length === EN_LEVELS.length, 'levelsOf 取整条英语版块（Boss 往前数 5 关用）')
  for (const meta of SECTIONS) {
    const list = LEVELS_BY_SECTION[meta.id]
    const last = list[list.length - 1]
    ok(levelsOf(last).find((l) => l.index === last.index + 1) === undefined, `${meta.name}版块最后一关（${last.name}）没有「下一关」`)
  }
}

console.log('== 10.7 拼音方块世界（数据 / 出题 / 错题桥接）==')
{
  ok(INITIALS.length === 23 && FINALS.length === 24 && ZHENGTI.length === 16,
    `拼音字母：声母 ${INITIALS.length} / 韵母 ${FINALS.length} / 整体认读 ${ZHENGTI.length}`)
  ok(PW_LEVELS.length === 15 && PW_UNITS.length === 4, `拼音关卡 ${PW_LEVELS.length} 关 / ${PW_UNITS.length} 个单元`)
  ok(
    PW_UNITS.every((u) => PW_LEVELS.filter((l) => l.unit === u.id).length === u.range[1] - u.range[0] + 1),
    '单元区间与关卡分布对得上',
  )

  // 关卡出题：选项不少于 4 个，且正确答案只出现一次
  for (const lv of PW_LEVELS) {
    const qs = genLevelQuestions(lv)
    const bad = qs.filter((q) => q.options.length < 4 || q.options.filter((o) => o === q.answer).length !== 1).length
    ok(bad === 0 && qs.length > 0, `关卡${lv.id}「${lv.name}」出 ${qs.length} 题，选项合法`, bad)
  }

  for (const u of PW_UNITS) {
    const qs = genTestQuestions(u.id)
    ok(qs.length === 10, `第${u.id}单元测试出 ${qs.length} 题`)
  }

  ok(stripTone('mā') === 'ma' && stripTone('zhōng') === 'zhong', '去声调')
  ok(setTone('ma', 1) === 'mā' && setTone('liu', 2) === 'liú' && setTone('hao', 3) === 'hǎo', '按标调规则加声调')
  ok(isPinyinLearned('mā', learnedLettersByDay(2)) === false && isPinyinLearned('ā', learnedLettersByDay(2)) === true,
    '已学范围能正确把关（第 2 天只学了 a o e i u ü）')

  // 错题桥接：三种题型都能转成主应用 spec，归语文、且能从 spec 无损重建
  {
    const qs = genLevelQuestions(PW_LEVELS[1])
    const kinds = new Set(qs.map((q) => q.kind))
    ok(kinds.size >= 2, `拼音题覆盖 ${kinds.size} 种题型：${[...kinds].join('/')}`)
    let bad = 0
    for (const q of qs) {
      const spec = specOf(q)
      const app = toAppQuestion(q)
      const rebuilt = buildQuestion(spec)
      if (subjectOfKind(spec.kind) !== 'chinese') bad++
      if (rebuilt.options?.[rebuilt.answer] !== q.answer) bad++
      if (!app.spec.kind.startsWith('pyw_')) bad++
    }
    ok(bad === 0, '拼音错题 → 主应用 spec：归语文 / 无损重建 全部通过', bad)
  }
}

console.log('== 11. 闯关结算（首次通关双倍 / 星级 / 属性）==')
{
  const lv = MATH_LEVELS[0]
  const beforeP = s().points
  const beforeAttr = s().pet!.attrs.math
  const res = s().finishBattle('math', lv.id, 10, 10, [])
  const expected = 3 + rules.FIRST_CLEAR_BONUS
  ok(res.stars === 3, `10/10 → ${res.stars} 星`)
  ok(res.firstClear, '首次通关')
  ok(res.points === expected, `积分 +${res.points}（3 星 + 首通 1 = ${expected}）`, res.points)
  ok(s().points === beforeP + expected, `总积分 ${beforeP} → ${s().points}`)
  ok(s().pet!.attrs.math === beforeAttr + res.attr, `数学属性 +${res.attr}`)
  const rec = s().levels.find((l) => l.levelId === lv.id)!
  ok(rec && rec.cleared && rec.bestStars === 3, '关卡记录已写入')

  // 二周目：星星照记，金币封顶 1 枚（2026-09-19 规则）
  const before2 = s().points
  const res2 = s().finishBattle('math', lv.id, 10, 10, [])
  ok(!res2.firstClear && res2.points === 1, `二周目金币 ${res2.points}（重复闯关封顶 1 枚）`)

  // 低于 50% 正确率 = 0 星 = 未通关，不给分不记通关
  const before3 = s().points
  const res3 = s().finishBattle('math', MATH_LEVELS[1].id, 4, 10, [])
  ok(res3.stars === 0 && res3.points === 0, `4/10 → ${res3.stars} 星 / ${res3.points} 分`)
  ok(s().points === before3, '未通关不涨积分')
  ok(!s().levels.some((l) => l.levelId === MATH_LEVELS[1].id), '未通关不写通关记录')
  ok(rules.starsOf(5, 10) === 1 && rules.starsOf(7, 10) === 2 && rules.starsOf(9, 10) === 3, '星级门槛 50/70/90%')

  // 快速通关：限时内通关 → 基础星 +1（数学 2 分钟 / 语文英语 5 分钟，总最高 4 星）
  ok(rules.starsOf(10, 10, rules.FAST_CLEAR_MS.math, 'math') === 4, '全对 + 2分钟内 → 4 星')
  ok(rules.starsOf(10, 10, rules.FAST_CLEAR_MS.math + 1) === 3, '全对但超 2 分钟 → 3 星')
  ok(rules.starsOf(9, 10, 30_000, 'math') === 4, '9/10 限时内 → 3+1 = 4 星')
  ok(rules.starsOf(9, 10, 120_001, 'math') === 3, '9/10 超时 → 3 星')
  ok(rules.starsOf(5, 10, 60_000, 'math') === 2, '5/10 限时内 → 1+1 = 2 星')
  ok(rules.starsOf(6, 10, 4 * 60_000, 'chinese') === 2, '语文 5 分钟内 → +1 星')
  ok(rules.starsOf(6, 10, 5 * 60_000 + 1, 'chinese') === 1, '语文超 5 分钟 → 无奖励')
  const before4 = s().points
  const res4 = s().finishBattle('math', lv.id, 10, 10, [], rules.FAST_CLEAR_MS.math)
  ok(res4.stars === 4, `全对快通 → ${res4.stars} 星`)
  ok(res4.points === 1, `4 星金币 ${res4.points}（非首通封顶 1 枚，bestStars 仍记 4）`)
  ok(s().points === before4 + res4.points, '4 星金币已入账')
  ok(s().levels.find((l) => l.levelId === lv.id)!.bestStars === 4, 'bestStars 记为 4')
}

console.log('== 12. 错题本（入库 / 复习 / 掌握）==')
{
  const lv = MATH_LEVELS[2]
  const qs = buildLevelQuestions(lv, [], 4)
  s().finishBattle('math', lv.id, 2, 4, [qs[0], qs[1]])
  ok(s().wrong.length === 2, `错题入库 ${s().wrong.length} 条`)
  ok(s().wrong.every((w) => w.spec && w.explain), '错题保留 spec（可无损重建）')
  ok(s().wrong.every((w) => w.nextReviewDay > nowDay()), '已排到未来复习日')

  const w0 = s().wrong[0]
  s().reviewWrong(w0.id, true)
  ok(s().wrong.find((x) => x.id === w0.id)!.rightStreak === 1, '答对 → 连续正确 1')
  s().reviewWrong(w0.id, false)
  ok(s().wrong.find((x) => x.id === w0.id)!.rightStreak === 0, '答错 → 归零')
  s().reviewWrong(w0.id, true)
  s().reviewWrong(w0.id, true)
  s().reviewWrong(w0.id, true)
  ok(s().wrong.find((x) => x.id === w0.id)!.mastered, '连续答对 3 次 → 掌握')
  ok(s().wrongSolvedTotal === 1, `已攻克计数 ${s().wrongSolvedTotal}`)
}

console.log('== 12.5 Boss 对战（设计建议 v0.1 §4/§5：血量上限 / 伤害倍率 / 每日首胜 / 温和失败）==')
{
  // §4.2 数值：HP 基础 5、属性加成封顶 7；提示封顶 3；伤害倍率 0.8~2.0×
  ok(rules.baseHp(0) === 5 && rules.baseHp(10) === 6 && rules.baseHp(99) === 7, `HP = 5 + 属性/10，封顶 7（${rules.baseHp(0)}/${rules.baseHp(10)}/${rules.baseHp(99)}）`)
  ok(rules.hintCount(0) === 1 && rules.hintCount(99) === 3, '提示 1 次 + 属性加成，封顶 3')
  ok(rules.bossDamageMult(0) === 0.8 && rules.bossDamageMult(30) === 2 && rules.bossDamageMult(300) === 2, '伤害倍率 0.8~2.0×（属性 ≥30 封顶）')
  ok(rules.bossDamage(10) === Math.round(rules.BOSS_HIT * rules.bossDamageMult(10)), `属性 10 → 单击 ${rules.bossDamage(10)} 伤害`)

  // ③ 每日 Boss 首胜：当天第一场 Boss 胜利积分 ×1.5
  const lv = MATH_LEVELS.find((l) => l.id === 'mb1')!
  const before = s().points
  const res = s().finishBattle('math', lv.id, 10, 10, [])
  ok(res.firstClear && res.dailyBossWin === true, 'Boss 首通 = 当日首胜')
  ok(res.points === Math.round((3 + rules.FIRST_CLEAR_BONUS) * rules.DAILY_BOSS_BONUS),
    `Boss 首通 + 首胜加成 = ${res.points} 分（4 × 1.5）`, res.points)
  ok(s().points === before + res.points, '积分已入账')
  ok(s().lastBossWinDay === nowDay(), 'lastBossWinDay 已记录今天')

  // 当天第二场 Boss 胜：不再加成
  const res2 = s().finishBattle('math', 'mb2', 10, 10, [])
  ok(res2.dailyBossWin !== true && res2.points === 3 + rules.FIRST_CLEAR_BONUS, `同日第二场 Boss 首通 ${res2.points} 分（无加成）`)

  // 复刷 Boss：无加成（复刷封顶 1 ≈ 首通 30% 衰减）
  const res3 = s().finishBattle('math', lv.id, 10, 10, [])
  ok(res3.points === 1 && res3.dailyBossWin !== true, `Boss 复刷 ${res3.points} 分`)

  // 跨天后首胜恢复：复刷 1 分 × 1.5 = 2（把上次首胜记到昨天来模拟跨天）
  useStore.setState({ lastBossWinDay: addDays(nowDay(), -1) })
  const res4 = s().finishBattle('math', lv.id, 9, 10, [])
  ok(res4.dailyBossWin === true && res4.points === Math.round(1 * rules.DAILY_BOSS_BONUS), `跨天 Boss 首胜 ${res4.points} 分（1 × 1.5）`, res4.points)
  ok(s().lastBossWinDay === nowDay(), 'lastBossWinDay 推进到新的一天')

  // 温和失败（P2）：只记错题与练习量，积分/星级/属性/通关一律不发
  const beforeF = s().points
  const beforeAttr = s().pet!.attrs.chinese
  const qs = buildLevelQuestions(MATH_LEVELS[0], [], 3)
  const resF = s().finishBattle('chinese', 'cb1', 1, 3, [qs[0]], undefined, { failed: true })
  ok(resF.points === 0 && resF.stars === 0 && resF.attr === 0 && !resF.firstClear, 'Boss 战失败：零积分零星零属性')
  ok(s().points === beforeF && s().pet!.attrs.chinese === beforeAttr, '失败不扣不发')
  ok(!s().levels.some((l) => l.levelId === 'cb1'), '失败不写通关记录')
  ok(s().wrong.some((w) => w.subject === 'chinese'), '失败后错题照常进错题本')
  ok(s().todayBattles >= 1 && s().todayTotal >= 3, '失败照记练习量')
}

console.log('== 13. 商店 & 家园布置 ==')
{
  s().parentGrantPoints(500, '测试发放')
  const before = s().points
  ok(s().buyItem('tree', 999999) === false, '积分不足时购买失败')
  ok(s().buyItem('tree', 60), '购买小树成功')
  ok(s().owned.includes('tree'), '进入已拥有列表')
  ok(s().points === before - 60, `积分 ${before} → ${s().points}`)
  s().placeItem('tree', 30, 40)
  ok(s().placed.length === 1, '放置到家园')
  s().movePlaced(s().placed[0].uid, 60, 70)
  ok(s().placed[0].x === 60 && s().placed[0].y === 70, '拖动生效')
  s().removePlaced(s().placed[0].uid)
  ok(s().placed.length === 0, '移除生效')
}

console.log('== 14. 现实奖品：冻结 → 审批 → 扣分 / 拒绝退款 ==')
{
  const prize = s().prizes[0]
  s().parentGrantPoints(prize.points, '补足测试积分')
  const before = s().points
  ok(s().redeem(prize.id), '兑换申请创建成功')
  const r = s().redeems[0]
  ok(s().points === before - prize.points, `积分冻结：${before} → ${s().points}`)
  ok(s().frozenPoints === prize.points, `冻结池 = ${s().frozenPoints}`)
  s().approveRedeem(r.id)
  ok(s().redeems[0].state === 'approved', '审批通过')
  ok(s().points === before - prize.points, '通过后不二次扣分')
  ok(s().frozenPoints === 0, '冻结解除')
  s().deliverRedeem(r.id)
  ok(s().redeems[0].state === 'delivered', '已兑现')

  s().parentGrantPoints(prize.points, '补足测试积分')
  const before2 = s().points
  s().redeem(prize.id)
  const r2 = s().redeems.find((x) => x.state === 'pending')!
  s().rejectRedeem(r2.id, '这次不算')
  ok(s().points === before2, `拒绝后退款 → ${s().points}`)
  ok(s().redeems.find((x) => x.id === r2.id)!.state === 'rejected', '状态 rejected')
}

console.log('== 15. 家长任务管理（中途新增 / 主观审批 / foodValue）==')
{
  const id = s().addTemplate({ name: '练字 10 分钟', icon: '✍️', type: 'subjective', foodValue: 2, enabled: true })
  s().ensureDay()
  ok(s().daily.some((t) => t.templateId === id), '当天新增任务立刻出现在今日列表')
  const nt = s().daily.find((t) => t.templateId === id)!
  s().submitTask(nt.id, 'media-1')
  ok(s().daily.find((t) => t.id === nt.id)!.status === 'pending', '主观任务进入待家长确认')
  const before = s().food
  s().approveTask(nt.id)
  ok(s().food === before + 2, `foodValue=2 生效 ${before} → ${s().food}`, s().food)
  s().removeTemplate(id)
  ok(!s().templates.some((t) => t.id === id), '删除模板成功')

  const id2 = s().addTemplate({ name: '早读', icon: '🌅', type: 'audio', foodValue: 1, enabled: true })
  s().ensureDay()
  const t2 = s().daily.find((t) => t.templateId === id2)!
  s().submitTask(t2.id)
  s().rejectTask(t2.id, '今天没读')
  ok(s().daily.find((t) => t.id === t2.id)!.status === 'rejected', '家长可驳回')
  s().removeTemplate(id2)
}

console.log('== 15.5 任务排期（常规按星期 / 今日一次性 / 说明字段）==')
{
  const today = nowDay()
  const todayWd = weekdayOf(today)
  const otherWd = todayWd === 1 ? 2 : 1

  // 常规任务：只在指定星期出现
  const wdOnly = s().addTemplate({
    name: '周末大扫除', icon: '🧹', type: 'subjective', foodValue: 2, enabled: true,
    kind: 'regular', weekdays: [otherWd],
  })
  ok(!s().daily.some((t) => t.templateId === wdOnly), `今天周${todayWd}，排期只有周${otherWd} → 今天不生成实例`)
  ok(templateAppliesOn(s().templates.find((t) => t.id === wdOnly)!, addDays(today, otherWd - todayWd)), '到排期那天会生成')

  // 每周全选 → 每天
  const everyDay = s().addTemplate({
    name: '阅读 20 分钟', icon: '📚', type: 'subjective', foodValue: 1, enabled: true,
    kind: 'regular', weekdays: [1, 2, 3, 4, 5, 6, 7],
  })
  ok(s().daily.some((t) => t.templateId === everyDay), '排期含今天 → 立即出现在今日列表（无需 ensureDay）')
  const readInst = s().daily.find((t) => t.templateId === everyDay)!

  // 停用 → 今天的 todo 实例立即撤下（家长改完首页马上刷新）
  s().updateTemplate(everyDay, { enabled: false })
  ok(!s().daily.some((t) => t.templateId === everyDay && t.status === 'todo'), '停用后今日实例立即移除')
  s().updateTemplate(everyDay, { enabled: true, note: '读给爸爸妈妈听' })
  ok(s().daily.some((t) => t.templateId === everyDay && t.note === '读给爸爸妈妈听'), '重新启用 + 说明字段立即生效')

  // 今日任务：完成后从列表消失（驳回的还要重做，保留展示）
  const onceId = s().addTemplate({
    name: '给奶奶打电话', icon: '📞', type: 'subjective', foodValue: 1, enabled: true,
    kind: 'once', onceDay: today,
  })
  ok(s().daily.some((t) => t.templateId === onceId), '今日任务当天生成')
  ok(!templateAppliesOn(s().templates.find((t) => t.id === onceId)!, addDays(today, 1)), '今日任务明天不再出现')
  const onceInst = s().daily.find((t) => t.templateId === onceId)!
  s().submitTask(onceInst.id, 'media-9')
  ok(s().daily.find((t) => t.id === onceInst.id)!.status === 'pending', '已提交待确认')
  ok(!dailyTaskVisible(s().daily.find((t) => t.id === onceInst.id)!), '今日任务提交后即从孩子列表消失')
  s().rejectTask(onceInst.id, '再打一次吧')
  ok(dailyTaskVisible(s().daily.find((t) => t.id === onceInst.id)!), '驳回后重新可见（要重做）')

  // 清理
  s().removeTemplate(wdOnly)
  s().removeTemplate(everyDay)
  s().removeTemplate(onceId)
}

console.log('== 16. 家长手动调整 / 发积分 ==')
{
  const before = s().food
  s().parentAdjustFood(-1, '扣一份')
  ok(s().food === Math.max(0, before - 1), `食物 ${before} → ${s().food}`)
  s().parentAdjustFood(10, '补发')
  ok(s().food === Math.max(0, before - 1) + 10, '补发生效')
  const bp = s().points
  s().parentGrantPoints(50, '表现好')
  ok(s().points === bp + 50, '家长发积分生效')
  ok(s().pointLedger[0].source === 'parent', '账本记录来源正确')
}

console.log('== 17. 时间工具（0 点分界）==')
{
  const mk = (y: number, m: number, d: number, h: number) => new Date(y, m - 1, d, h, 0, 0).getTime()
  ok(toDay(mk(2026, 9, 15, 23)) === '2026-09-15', '晚上 11 点归属当天')
  ok(toDay(mk(2026, 9, 16, 0)) === '2026-09-16', '0 点整起归属新的一天')
  ok(addDays('2026-09-30', 1) === '2026-10-01', `跨月 ${addDays('2026-09-30', 1)}`)
  ok(addDays('2026-12-31', 1) === '2027-01-01', `跨年 ${addDays('2026-12-31', 1)}`)
  ok(DAY_START_HOUR === 0, '分界点为 0 点')
}

console.log('== 18. 数值常量复核 ==')
ok(rules.FOOD_PER_SATIETY === 20, '1 份 = 20 饱食度')
ok(rules.DAILY_DECAY === 60, '每日衰减 60')
ok(rules.FEED_LIMIT === 5, '日投喂上限 5（体型机制移除后由 6 下调，恰为顶格线所需份数）')
ok(rules.SATIETY_MAX === 120, '饱食度上限 120')
ok(
  (rules as unknown as Record<string, unknown>).THIN_DAYS === undefined &&
    (rules as unknown as Record<string, unknown>).FAT_FULL_DAYS === undefined &&
    (rules as unknown as Record<string, unknown>).BODY_LABEL === undefined,
  '体型相关常量（THIN_DAYS / FAT_FULL_DAYS / BODY_LABEL）已删除',
)
ok(rules.STREAK_7_FOOD === 1 && rules.STREAK_30_FOOD === 5, '连续 7 天 +1 / 30 天 +5')
ok(rules.FIRST_CLEAR_BONUS === 1, '首通额外 +1 积分')

console.log('== 19. 答题队列循环（写对为止）==')
{
  // 答对出队；答错/跳过回队尾，直到每道题都做对
  const qs = ['a', 'b', 'c', 'd']
  ok(advanceQueue(qs, true).join('') === 'bcd', '答对 → 出队')
  ok(advanceQueue(qs, false).join('') === 'bcda', '答错 → 回到队尾')
  ok(advanceQueue([], true).length === 0, '空队列安全')

  /** 第 1 轮就答错 2 次的题：b 错 2 次、d 错 1 次，其余一次答对 */
  const wrongLeft: Record<string, number> = { b: 2, d: 1 }
  const missed = new Set<string>()
  let queue = qs.slice()
  let guard = 0
  while (queue.length > 0 && guard < 100) {
    const head = queue[0]
    const miss = (wrongLeft[head] ?? 0) > 0
    if (miss) {
      wrongLeft[head] -= 1
      missed.add(head)
    }
    queue = advanceQueue(queue, !miss)
    guard += 1
  }
  ok(queue.length === 0, `循环直到每题都做对（走了 ${guard} 步）`)
  ok(missed.size === 2, `只有 b、d 需要重做（${[...missed].join('、')}）`)
  ok([...missed].every((t) => qs.includes(t)), '重做的题都在原题里')
  ok(firstCorrectCount(qs.length, missed.size) === 2, '第一次就答对 2 / 4')
  ok(rules.starsOf(2, 4) === 1, '2/4 = 50% → 1 星')
  ok(rules.starsOf(3, 4) === 2, '3/4 = 75% → 2 星')
  ok(rules.starsOf(1, 4) === 0, '1/4 = 25% → 0 星（要再来一次）')
  ok(firstCorrectCount(10, 12) === 0, '错得比题还多也不会算出负数')

  // 首次全对：练习题只有「第一次就全做对」才算复习通过
  ok(firstCorrectCount(3, 0) === 3, '一次全对 → 复习通过')
  ok(firstCorrectCount(3, 1) === 2, '有一道重做才对的 → 复习不算通过')
}

console.log('== 20. 判分归一化与路由 ==')
{
  ok(normalizeNumeric('5') === '5', '纯数字原样')
  ok(normalizeNumeric('０５') === '5', '全角数字 + 前导 0 归一化')
  ok(normalizeNumeric(' 12 ') === '12', '去空格')
  ok(normalizeNumeric('') === null, '空输入判为非法')
  ok(normalizeNumeric('abc') === null, '非数字判为非法')
  ok(normalizeNumeric('1e3') === null, '科学计数法不算数字')
  ok(normalizeNumeric('12345') === null, '超过 4 位判为非法')

  const q = buildQuestion({ kind: 'add10', a: 7, b: 8, op: '+' })
  ok(gradeLocally(q, '15').correct, '答对判正确')
  ok(!gradeLocally(q, '14').correct, '答错判错误')
  ok(!gradeLocally(q, '一五').correct, '乱填判错误')
  ok(!needsModel(q), '数学题不需要模型')

  const gMath = gradeAnswer(q, '15')
  ok(!isThenable(gMath) && gMath.correct && gMath.by === 'local', '答案唯一的题同步判定，不产生任何网络请求')

  // 开放题：本地判分器判不了，才是模型的用武之地
  const open = { ...q, answerType: 'open' as const }
  ok(needsModel(open), '开放答案的题才需要模型')
  const gOpen = gradeAnswer(open, '随便写点什么')
  ok(!isThenable(gOpen) && gOpen.deferred === true, '本地模式下开放题标记 deferred（断网不算孩子错）')
}

console.log('== 21. 出题契约（本地实现） ==')
{
  ok(activeProvider().name === 'local', '默认走本地实现')
  const gen = localProvider.generate({ subject: 'math', levelId: 'm1', count: 10 })
  ok(gen.questions.length === 10, `本地出题 ${gen.questions.length} 道`)
  ok(gen.source === 'local', '来源标记 local')
  ok(gen.questions.every((x) => typeof x.answer === 'number' && x.hint && x.explain), '题目字段完整')
  const vs = localProvider.variants(questionOfKind('sub10'), 3)
  ok(vs.questions.length === 3, `变式 ${vs.questions.length} 道`)

  // 注入的错题必须出现在题目里，且不重复
  const seed = questionOfKind('cou10')
  const injected = localProvider.generate({
    subject: 'math', levelId: 'm1', count: 10, inject: [seed.spec],
  })
  ok(injected.questions.some((x) => x.text === seed.text), '注入的错题出现在题目里')
  ok(new Set(injected.questions.map((x) => x.text)).size === injected.questions.length, '注入后无重复题')
}

// 远端路径：指向必然连不上的地址，验证降级
void (async () => {
  console.log('== 22. 远端不可用 → 自动降级本地 ==')
  resetProviderStats()
  configureProvider({ apiBaseUrl: 'http://127.0.0.1:1', preferRemote: true, timeoutMs: 500 })
  ok(activeProvider().name === 'remote', '配了后端地址后走远端实现')

  const r = await generateQuestions({ subject: 'math', levelId: 'm1', count: 10 })
  ok(r.questions.length === 10, `降级后仍有 ${r.questions.length} 道题（后端挂了孩子也得能玩）`)
  ok(r.degraded === true, '打了 degraded 标记')
  const st = providerStats()
  ok(st.degraded === 1 && st.remoteCalls === 0, `统计：降级 ${st.degraded} 次 / 远端成功 ${st.remoteCalls} 次`)
  ok(st.lastError !== '', `记录了错误：${st.lastError.slice(0, 40)}`)

  const v = await generateVariants(questionOfKind('sub10'), 3)
  ok(v.questions.length === 3 && v.degraded === true, '变式同样降级可用')

  resetProviderConfig()
  resetProviderStats()
  ok(activeProvider().name === 'local', '复位后回到本地实现')

  console.log('== 23. 数据同步（队列 / 幂等 / 降级） ==')
  {
    const calls: { url: string; headers: Record<string, string>; body: any }[] = []
    let reply: () => { status: number; body?: unknown } = () => ({
      status: 200, body: { applied: 1, serverVersion: 1 },
    })
    const realFetch = globalThis.fetch
    globalThis.fetch = (async (url: unknown, init: any) => {
      calls.push({
        url: String(url),
        headers: (init?.headers ?? {}) as Record<string, string>,
        body: JSON.parse(String(init?.body)),
      })
      const r = reply()
      return {
        ok: r.status >= 200 && r.status < 300,
        status: r.status,
        json: async () => r.body ?? {},
      } as unknown as Response
    }) as typeof fetch

    try {
      resetSync()
      configureSync({ apiBaseUrl: '', token: '' })

      // 1) 纯本地模式：一个请求都不发、一条都不攒（与接线之前行为完全一致）
      s().parentGrantPoints(10, '未启用时的奖励')
      ok(pendingCount() === 0, '未启用同步时队列保持为空（零开销）')

      // 2) 启用后业务动作真的入队 —— 验证埋点确实接上了
      configureSync({ apiBaseUrl: 'http://127.0.0.1:8787', token: 'test-token' })
      s().parentGrantPoints(10, '启用后的奖励')
      ok(pendingCount() >= 1, `启用后账本 op 入队 ${pendingCount()} 条`)

      // 3) 推送成功 → 出队，且请求带齐 childId / ops / 令牌
      const r1 = await flushSync()
      ok(r1.ok && r1.pushed >= 1, `推送成功 ${r1.pushed} 条`)
      ok(pendingCount() === 0, '推送成功后队列清空')
      const sent = calls[calls.length - 1]
      ok(sent.url.endsWith('/api/sync'), '打到 /api/sync')
      ok(sent.headers['x-sync-token'] === 'test-token', '带上了同步令牌')
      ok(!!sent.body.childId, `childId 已自动生成：${String(sent.body.childId).slice(0, 12)}…`)
      ok(sent.body.ops.every((o: any) => !!o.opId), '每条 op 都带幂等键 opId')
      ok(new Set(sent.body.ops.map((o: any) => o.opId)).size === sent.body.ops.length, 'opId 无重复')
      ok(sent.body.ops.some((o: any) => o.kind === 'ledger'), '账本 op 类型正确')

      // 4) 网络/5xx 失败 → 数据留在本地等下次，不能丢
      reply = () => ({ status: 500 })
      s().parentGrantPoints(5, '网络差时的奖励')
      const before = pendingCount()
      const r2 = await flushSync()
      ok(!r2.ok && pendingCount() === before, `失败后 ${pendingCount()} 条仍在本地（下次再推）`)

      // 5) 403 → 判定令牌被拒并暂停，别把队列刷爆
      reply = () => ({ status: 403 })
      const r3 = await flushSync()
      ok(r3.forbidden === true, '403 判定为令牌被拒')
      const nCalls = calls.length
      await flushSync()
      ok(calls.length === nCalls, '暂停后不再发请求（不刷屏也不费流量）')
      ok(pendingCount() > 0, '数据仍安全留在本地')

      // 6) 换成新令牌 → 同步自愈，不用重装
      configureSync({ token: 'new-token' })
      reply = () => ({ status: 200, body: { applied: 1, serverVersion: 2 } })
      const r4 = await flushSync()
      ok(r4.ok && pendingCount() === 0, '换令牌后同步恢复且队列清空')
      ok(syncStats().serverVersion === 2, `记录服务端版本号 ${syncStats().serverVersion}`)

      // 7) 4xx（这批数据服务端不认）→ 丢弃并记账，否则会永久堵住队头
      reply = () => ({ status: 400 })
      s().parentGrantPoints(3, '坏数据')
      const r5 = await flushSync()
      ok(!r5.ok && pendingCount() === 0, '4xx 丢弃这批，避免堵住后续数据')
      ok(syncStats().rejected >= 1, `记账 rejected=${syncStats().rejected}`)

      // 8) 家长端「清空待同步数据」入口可用
      s().parentGrantPoints(1, '待清空的奖励')
      ok(dropQueue() >= 1 && pendingCount() === 0, 'dropQueue 清空本地队列')
    } finally {
      globalThis.fetch = realFetch
      resetSync()
      configureSync({ apiBaseUrl: '', token: '' })
    }
  }

  console.log('== 24. 实体同步 op（孩子档案 / 宠物 / 任务 / 奖品 / 兑换）==')
  {
    const calls: { body: any }[] = []
    let reply: () => { status: number; body?: unknown } = () => ({
      status: 200, body: { applied: 1, failed: 0, serverVersion: 9 },
    })
    const realFetch = globalThis.fetch
    globalThis.fetch = (async (_url: unknown, init: any) => {
      calls.push({ body: JSON.parse(String(init?.body)) })
      const r = reply()
      return {
        ok: r.status >= 200 && r.status < 300,
        status: r.status,
        json: async () => r.body ?? {},
      } as unknown as Response
    }) as typeof fetch

    try {
      resetSync()
      configureSync({ apiBaseUrl: 'http://127.0.0.1:8787', token: 'test-token' })

      // 孩子档案：本地原本根本没有这个数据源
      s().setChildProfile({ name: '豆豆', grade: 'g2', textbookVer: '统编版' })

      // 宠物：改名 / 投喂 都应产生 pet op
      s().renamePet('小闪电')
      s().parentAdjustFood(6, '实体埋点测试')
      s().feed(2)

      // 任务模板：新增 → 改（含停用）→ 删
      const tid = s().addTemplate({ name: '练字 10 分钟', icon: '✍️', type: 'subjective', foodValue: 2, enabled: true })
      s().updateTemplate(tid, { foodValue: 3, enabled: false })
      s().removeTemplate(tid)

      // 奖品：新增 → 删
      s().addPrize('测试奖品：贴纸', 10, '备注')
      const pz = s().prizes.find((p) => p.name === '测试奖品：贴纸')!

      // 兑换流转：pending → approved → delivered
      s().parentGrantPoints(pz.points, '测试积分')
      s().redeem(pz.id)
      const rd = s().redeems[0]
      s().approveRedeem(rd.id)
      s().deliverRedeem(rd.id)
      s().removePrize(pz.id)

      // 跨日结算应同时产生 snapshot 与 pet
      nextDay()

      const r = await flushSync()
      ok(r.ok, `实体 op 推送成功 ${r.pushed} 条`)
      ok(pendingCount() === 0, '队列已清空')

      const ops = calls[calls.length - 1].body.ops as any[]
      const byKind = (k: string) => ops.filter((o) => o.kind === k)
      const keys = (o: any) => Object.keys(o.data).sort().join(',')

      // 字段名必须和表列对得上 —— 服务端 server/ops.ts 就是直接吃这些名字的
      const childOp = byKind('child').pop()
      ok(!!childOp, `child op 已产生（${byKind('child').length} 条）`)
      ok(keys(childOp) === 'grade,name,textbookVer', `child op 字段：${keys(childOp)}`)
      ok(childOp.data.name === '豆豆' && childOp.data.grade === 'g2', '孩子昵称与年级同步正确')

      const petOp = byKind('pet').pop()
      ok(!!petOp, `pet op 已产生（${byKind('pet').length} 条）`)
      ok(keys(petOp) === 'attrs,body,exp,fedToday,name,satiety,species,stage', `pet op 字段：${keys(petOp)}`)
      ok(petOp.data.name === '小闪电' && petOp.data.species === 'feifei', '宠物昵称与种类同步正确')
      ok(!!petOp.data.attrs && typeof petOp.data.attrs.math === 'number', '三科属性以对象同步（服务端写 jsonb）')

      const tplOps = byKind('task_template')
      ok(tplOps.length === 3, `task_template op ${tplOps.length} 条（新增 / 修改 / 删除）`)
      ok(keys(tplOps[0]) === 'active,enabled,foodValue,icon,id,kind,name,note,onceDay,subject,type,weekdays', `task_template op 字段：${keys(tplOps[0])}`)
      ok(tplOps[0].data.active === true && tplOps[2].data.active === false, '模板新增 active:true → 启用/删除 active:false')

      const dtOps = byKind('daily_task')
      ok(dtOps.length > 0, `daily_task op ${dtOps.length} 条（每日实例）`)
      ok(keys(dtOps[0]) === 'at,day,id,mediaKey,note,status,templateId', `daily_task op 字段：${keys(dtOps[0])}`)

      const prizeOps = byKind('prize')
      ok(prizeOps.length === 2, `prize op ${prizeOps.length} 条（新增 / 删除）`)
      ok(keys(prizeOps[0]) === 'active,id,name,note,points', `prize op 字段：${keys(prizeOps[0])}`)
      ok(prizeOps[0].data.active === true && prizeOps[1].data.active === false, '奖品新增 active:true → 删除 active:false（软删）')

      const rdOps = byKind('redeem')
      const flow = rdOps.map((o: any) => o.data.status).join('→')
      ok(rdOps.length === 3, `redeem op ${rdOps.length} 条`)
      ok(flow === 'pending→approved→delivered', `兑换状态流转 ${flow}`)
      ok(keys(rdOps[0]) === 'createdAt,decidedAt,id,points,prizeId,prizeName,status', `redeem op 字段：${keys(rdOps[0])}`)

      ok(ops.every((o) => !!o.opId), '队列里每条 op 仍带 opId（排查用）')

      // 服务端逐条上报失败时，队列要照常前进 —— 不能被一条坏数据永久堵死
      reply = () => ({
        status: 200,
        body: { applied: 0, failed: 1, errors: ['task_template: op 缺少必填字段 id'], serverVersion: 10 },
      })
      const rejectedBefore = syncStats().rejected
      s().parentGrantPoints(7, '坏数据测试')
      const r2 = await flushSync()
      ok(r2.ok && pendingCount() === 0, '服务端报 failed 时队列照常清空（不堵队头）')
      ok(syncStats().rejected === rejectedBefore + 1, `rejected 记账 +1（${rejectedBefore} → ${syncStats().rejected}）`)
      ok(syncStats().lastError.includes('拒绝'), `错误已记录：${syncStats().lastError.slice(0, 40)}`)
    } finally {
      globalThis.fetch = realFetch
      resetSync()
      configureSync({ apiBaseUrl: '', token: '' })
    }
  }

  console.log('== 25. 服务端 op → SQL（假 pg：验表名 / 冲突键 / 占位符个数）==')
  {
    const seen: { sql: string; params: unknown[] }[] = []
    const fakePg = async (sql: string, params: unknown[] = []) => {
      seen.push({ sql, params })
      return []
    }
    /** 数 SQL 里出现了几个不同的 $n —— 与参数个数对不上，生产环境才会炸 */
    const placeholders = (sql: string) => new Set(sql.match(/\$\d+/g) ?? []).size

    // [op 类型, data, 期望写入的表, 期望的冲突键]
    const cases: Array<[string, Record<string, unknown>, string, string]> = [
      ['child', { name: '豆豆', grade: 'g1', textbookVer: '' }, 'children', '(id)'],
      ['pet', { species: 'feifei', name: '小闪电', stage: 2, exp: 30, satiety: 80, fedToday: 1, body: 'normal', attrs: { math: 3, chinese: 0, english: 0 } }, 'pets', '(child_id)'],
      ['task_template', { id: 't1', name: '练字', type: 'subjective', foodValue: 2, active: true }, 'task_templates', '(id)'],
      ['daily_task', { id: 'd1', day: '2026-09-16', templateId: 't1', status: 'todo' }, 'daily_tasks', '(id)'],
      ['prize', { id: 'p1', name: '贴纸', points: 10, note: '', active: true }, 'prizes', '(id)'],
      ['redeem', { id: 'r1', prizeId: 'p1', prizeName: '贴纸', points: 10, status: 'pending', createdAt: '2026-09-16T02:00:00.000Z' }, 'redeems', '(id)'],
      ['attempt', { day: '2026-09-16', subject: 'math', questionText: '1+1', correct: true }, 'attempts', '(op_id)'],
      ['ledger', { kind: 'point', delta: 2, balance: 10, source: 'battle' }, 'ledgers', '(op_id)'],
      ['snapshot', { day: '2026-09-16', satiety: 80 }, 'daily_snapshots', '(child_id, day)'],
      ['level_record', { levelId: 'm1', bestStars: 3, cleared: true, playCount: 1 }, 'level_records', '(child_id, level_id)'],
      ['wrong_item', { subject: 'math', questionText: '1+1' }, 'wrong_items', '(child_id, question_text)'],
    ]

    let bad = 0
    for (const [kind, data, table, conflict] of cases) {
      seen.length = 0
      await applyOp(fakePg, 'c-test', { opId: 'op-1', kind, data })
      const { sql, params } = seen[seen.length - 1]
      const okTable = sql.includes(`INTO ${table} `)
      const okConflict = sql.includes(`ON CONFLICT ${conflict}`)
      const n = placeholders(sql)
      if (!okTable || !okConflict || n !== params.length) {
        bad++
        console.log(`  FAIL  ${kind}: 表名=${okTable} 冲突键=${okConflict} 占位符 ${n} vs 参数 ${params.length}`)
      }
    }
    ok(bad === 0, `${cases.length} 种 op 的表名 / 冲突键 / 参数个数全部对得上`)

    // children.id 必须取自 childId —— op 里再带一个 id 会造出第二个孩子
    seen.length = 0
    await applyOp(fakePg, 'c-from-sync', { kind: 'child', data: { id: 'HACK', name: '豆豆' } })
    ok(seen[0].params[0] === 'c-from-sync', `children.id 取自 childId（${String(seen[0].params[0])}）`)

    // food_value 越界会被库的 CHECK 拒绝 → 服务端先夹紧，别让它变成整批失败
    seen.length = 0
    await applyOp(fakePg, 'c-test', { kind: 'task_template', data: { id: 't9', name: 'x', foodValue: 99 } })
    ok(seen[0].params[5] === 3, `foodValue 99 → 夹到 ${String(seen[0].params[5])}（库 CHECK 是 1~3）`)

    // 坏数据要抛 transient=false 的 PgError：服务端据此记 failed 而不是整批 500
    const expectBad = async (kind: string, data: Record<string, unknown>, why: string) => {
      seen.length = 0
      try {
        await applyOp(fakePg, 'c-test', { opId: 'op-bad', kind, data })
        ok(false, `应拒绝但没拒绝：${why}`)
      } catch (e) {
        const err = e as { name?: string; transient?: boolean; message?: string }
        ok(err.name === 'PgError' && err.transient === false, `拒绝「${why}」→ ${err.message}`)
      }
    }
    await expectBad('task_template', { name: '缺 id' }, '缺必填字段 id')
    await expectBad('redeem', { id: 'r1', status: '不存在的状态' }, '兑换状态非法')
    await expectBad('ledger', { kind: 'gold', delta: 1, source: 'x' }, 'ledgers.kind 非法')
    await expectBad('snapshot', { day: '2026/09/16' }, 'day 格式不对')
    await expectBad('并不存在的类型', {}, '未知 op 类型')

    // 幂等手段的差别：流水靠 opId，实体靠主键
    seen.length = 0
    await applyOp(fakePg, 'c-test', { kind: 'child', data: {} })
    ok(seen.length === 1, '实体 op 不带 opId 也能写入（按主键 upsert，天然幂等）')
    try {
      // 注意这里**不能**走 expectBad：它会顺手补上 opId，就测不出「缺 opId」了
      await applyOp(fakePg, 'c-test', { kind: 'ledger', data: { kind: 'point', delta: 1, source: 'x' } })
      ok(false, '流水 op 缺 opId 应被拒绝（没有它就无从去重）')
    } catch (e) {
      const err = e as { name?: string; transient?: boolean }
      ok(err.name === 'PgError' && err.transient === false, '流水 op 缺 opId → 判为坏数据（非 transient）')
    }
  }

  // == 26. 闪卡速记（预备级 115 词：unit 定义 / 出题 / 关卡解析） ==
  {
    console.log('\n== 26. 闪卡速记 ==')
    const totalWords = FC_UNITS.reduce((n, u) => n + u.words.length, 0)
    ok(totalWords === 115, `FC_UNITS 共 ${totalWords} 词（应为 115）`)
    const nos = new Set(FC_UNITS.flatMap((u) => u.words.map((w) => w.no)))
    ok(nos.size === 115, `卡片编号无重复（${nos.size} 个唯一 no）`)

    const fcq = questionOfKind('fc_pic:u3')
    ok(!!fcq && fcq.answerType === 'choice' && (fcq.options?.length ?? 0) === 4, 'fc_pic 出 4 选 1 看图选词')
    ok(!!fcq && /^\d+$/.test(String(fcq.spec.a)), `fc_pic 题干图是卡号（${fcq?.spec.a}）`)
    const rebuilt = fcq ? buildQuestion(fcq.spec) : null
    // 重建时选项会重新洗牌，正确性由答案文本定位（与 10.5 节同款校验）
    ok(!!rebuilt && rebuilt.options?.[rebuilt.answer] === fcq!.options?.[fcq!.answer], 'fc_pic spec 无损重建（答案文本不变）')

    const fcwp = questionOfKind('fc_wp:u0')
    ok(!!fcwp && fcwp.pictureOptions === true && (fcwp.options?.length ?? 0) === 4, 'fc_wp 出 4 选 1 看词选图')
    ok(!!fcwp && fcwp.speechLang === 'en-US', 'fc_wp 朗读用 en-US')

    // 错题本/重做追踪靠 specKey 判等：同题重建键一致，不同词键不同（fc_pic 的 text 恒定）
    ok(specKey(fcq!.spec) === specKey(buildQuestion(fcq!.spec).spec), '重建题 specKey 一致（错题判等依据）')
    const fcq2 = questionOfKind('fc_pic:u3')
    ok(specKey(fcq!.spec) !== specKey(fcq2.spec) || fcq!.spec.a === fcq2.spec.a, '不同 fc 题不撞键')

    const fcLevel = levelById('fc-u4')
    ok(!!fcLevel && fcLevel.subject === 'english' && fcLevel.kinds.length === 2, 'levelById 解析 fc-u4（english, 2 kinds）')
    const batch = buildLevelQuestions(fcLevel!, [], 10)
    ok(batch.length === 10 && batch.every((x) => x.spec.kind.startsWith('fc_')), '按 fc 关卡出 10 题，全是闪卡题')
  }

  // == 27. 跟读纠音回灌错题本（FE-08：读不好的词 → 错题本 → 下次开练先补它） ==
  {
    console.log('\n== 27. 跟读纠音回灌 ==')

    // ① 逐词对齐 → 挑该回灌的词：漏读优先，且只收课本实词（this / is / my 这类挡在门外）
    const toks = ['This', 'is', 'my', 'sister']
    const rows = alignScores(toks, [
      { word: 'This', score: 96, dp_message: 0 },
      { word: 'is', score: 58, dp_message: 0 },
      { word: 'my', score: 95, dp_message: 0 },
      // sister 引擎压根没给分 → 视为漏读
    ])
    const weak = weakWordsOf(toks, rows, 3)
    ok(weak.includes('sister') && !weak.includes('this'),
      `读不好的词只收课本实词（${weak.join(' / ') || '空'}）`)
    ok(isReadWord('sister') && !isReadWord('this'), 'isReadWord：课本词放行、虚词挡掉')

    // ② 纠音题：题面 = 英文词，答案 = 中文释义，四选一
    const spec = wrongSpecOf('sister')
    ok(!!spec && spec.kind === READ_WRONG_KIND && spec.ans === '姐姐；妹妹',
      `纠音 spec：${spec?.kind}「${spec?.prompt}」→ ${spec?.ans}`)
    ok(!!spec && (spec.opts?.length ?? 0) === 3 && !spec.opts!.includes(spec.ans ?? ''),
      '干扰项 3 个，且不与答案重复')
    ok(wrongSpecOf('this') === null, '查不到释义的词（this）不入库')

    const q = wrongQuestionOf('sister')
    ok(!!q && q.answerType === 'choice' && (q.options?.length ?? 0) === 4,
      `纠音题出 4 选 1（题面：${q?.text}）`)
    ok(!!q && q.options?.[q.answer] === q.spec.ans, '正确答案文本与 spec.ans 一致')
    ok(!!q && q.speechLang === 'en-US' && q.skill === '跟读纠音', '朗读用 en-US、知识点标「跟读纠音」')
    ok(subjectOfKind(READ_WRONG_KIND) === 'english', '纠音题归英语科（错题本按英语筛得到）')

    // ③ 举一反三：换个单词再出（复用英语词汇题）
    const vs = variantsOf(spec!)
    ok(vs.length === 3 && vs.every((v) => v.spec.kind === 'en_word' && v.answerType === 'choice'),
      '举一反三 3 道，全是英语词汇选择题')

    // ④ 回灌：走主应用 finishBattle 那条既有链路（入库 / 去重 / 遗忘曲线）
    const before = s().wrong.length
    const lv = 'rd-e1-w'
    const res = s().finishBattle('english', lv, 1, 10, [q!], 60_000)
    ok(res.stars === 0 && res.points === 0, '1/10 未通关：不发分不发星（错题照收）')
    const added = s().wrong.filter((w) => w.spec.kind === READ_WRONG_KIND)
    ok(s().wrong.length === before + 1 && added.length === 1, `错题本新增 1 条纠音错题（共 ${s().wrong.length}）`)
    ok(added[0]?.subject === 'english' && added[0]?.wrongCount === 1 && added[0]?.mastered === false,
      '学科 = english / 错 1 次 / 未掌握')
    ok(added[0]?.nextReviewDay === addDays(nowDay(), 1), `排进遗忘曲线（下次复习 ${added[0]?.nextReviewDay}）`)

    // 同一个词再错一次：不新增行，只累计次数
    s().finishBattle('english', lv, 1, 10, [wrongQuestionOf('sister')!], 60_000)
    const added2 = s().wrong.filter((w) => w.spec.kind === READ_WRONG_KIND)
    ok(added2.length === 1 && added2[0].wrongCount === 2, `同一个词再错只累计次数（错 ${added2[0]?.wrongCount} 次）`)

    // ⑤ 反向：到了复习日 → 词转回跟读素材，下一关开练先补它
    const today = nowDay()
    ok(reviewItemsOf(s().wrong, today).length === 0, '还没到复习日 → 不注入跟读关')
    useStore.setState({
      wrong: s().wrong.map((w) => (w.spec.kind === READ_WRONG_KIND ? { ...w, nextReviewDay: today } : w)),
    })
    const rev = reviewItemsOf(s().wrong, today)
    ok(rev.length === 1 && rev[0].en === 'sister' && rev[0].category === 'read_word',
      `到复习日 → 注入跟读素材 ${rev[0]?.en}（${rev[0]?.cn}）`)
    ok(reviewItemsOf(s().wrong, today, 0).length === 0, 'limit 生效（0 条 → 不注入）')

    // ⑥ 词表一致性：注入的词必须是课本跟读素材里真有的（否则跟读关会读到一个陌生的词）
    const allWords = new Set(READ_UNITS.flatMap((u) => u.words.map((w) => w.en.toLowerCase())))
    ok(allWords.has('sister') && allWords.has('noodles'), '课本词表覆盖 sister / noodles')

    // 清掉本组造的错题，别影响后面的断言
    useStore.setState({ wrong: s().wrong.filter((w) => w.spec.kind !== READ_WRONG_KIND) })
  }

  // == 28. 拼音练习量与打卡合并计数（FE-09：拼音那份进度汇进主应用） ==
  {
    console.log('\n== 28. 拼音练习量与打卡合并 ==')

    // 干净的起点：连击 5 天、今天还什么都没做
    useStore.setState({ streak: 5, longestStreak: 5, todayTasksDone: 0, todayPinyin: 0, todayPinyinChecked: false })

    // ① 练习量累加（点读 / 答题 / 发音评测都走这里）
    s().notePinyinPractice(1)
    s().notePinyinPractice(2)
    ok(s().todayPinyin === 3, `拼音练习量累加（今天练了 ${s().todayPinyin} 个音）`)
    s().notePinyinPractice(0)
    ok(s().todayPinyin === 3, 'notePinyinPractice(0) 不计数')

    // ② 拼音打卡撑起连击：今天没做家务任务也能续上
    ok(s().notePinyinCheckIn() === true, '拼音打卡成功（今天首次）')
    ok(s().streak === 6, `连击合并计数：5 → ${s().streak}`)
    ok(s().notePinyinCheckIn() === false && s().streak === 6, '同一天重复拼音打卡不再 +1')

    // ③ 任务侧去重：今天已因拼音打过卡 → 第一个任务完成也不再 +1
    useStore.setState({ daily: [] })
    s().ensureDay()
    const todoTask = s().daily.find((d) => d.status === 'todo' && d.type !== 'subjective')
    ok(!!todoTask, '重建出今天的待办任务（用于验证任务侧去重）')
    if (todoTask) {
      s().submitTask(todoTask.id)
      ok(s().todayTasksDone === 1, '任务照常完成并计数')
      ok(s().streak === 6, `同一天两个来源只算一次连击（仍 ${s().streak}）`)
    }

    // ④ 反方向：今天先做完任务，再去拼音打卡，也不该 +1
    useStore.setState({ streak: 5, todayTasksDone: 1, todayPinyinChecked: false, daily: [] })
    ok(s().notePinyinCheckIn() === false && s().streak === 5, '今天已因任务加过连击 → 拼音打卡不再 +1')
    ok(s().todayPinyinChecked === true, '但去重标记已置位（挡住任务侧再 +1）')

    // ⑤ 跨日：练习量进当日快照、今日计数归零、连击按「今天有没有学过」结算
    useStore.setState({ todayTasksDone: 0, todayPinyinChecked: true, todayPinyin: 3, streak: 6 })
    nextDay()
    const pySnap = s().snapshots[s().snapshots.length - 1]
    ok(pySnap?.pinyin === 3, `当日快照留下拼音练习量（${pySnap?.pinyin} 个音）`)
    ok(s().todayPinyin === 0 && s().todayPinyinChecked === false, '跨日：今日拼音量与打卡标记归零')
    ok(s().streak === 6, `只在拼音里学过也算今天学过（连击保留 ${s().streak}）`)

    // ⑥ 反例：一整天什么都没做 → 断签
    nextDay()
    ok(s().streak === 0, `没做任务、也没碰拼音 → 连击清零（${s().streak}）`)
  }

  // == 29. 防沉迷：每日闯关上限 + 可用时段（FE-01，PRD §8） ==
  {
    console.log('\n== 29. 防沉迷（每日上限 / 可用时段） ==')

    // 固定一个「今天」，把边界时刻造出来（不依赖跑冒烟时的真实时间）
    const at = (h: number, m: number) => limits.atClock(2026, 10, 13, h, m)

    // 干净起点：不限场次、不限时段、今天已玩 2 场
    useStore.setState({
      todayBattles: 2,
      settings: { ...s().settings, dailyBattleLimit: 0, allowFrom: '', allowTo: '' },
    })

    // ① 默认什么都不限制
    ok(limits.limitOf(s(), at(10, 0)).blocked === false, '默认（0 场 / 空时段）不拦任何一场')
    ok(limits.limitOf(s(), at(3, 0)).blocked === false, '没设时段时凌晨 3 点也放行')

    // ② 每日上限（含边界：正好玩满就拦）
    s().setLimits({ dailyBattleLimit: 3 })
    ok(s().settings.dailyBattleLimit === 3, '家长设「每天 3 场」已写入 settings')
    ok(limits.limitOf(s(), at(10, 0)).blocked === false, '已玩 2/3 场 → 放行（还剩 1 场）')
    useStore.setState({ todayBattles: 3 })
    const r3 = limits.limitOf(s(), at(10, 0))
    ok(r3.blocked && r3.overCount, '正好玩满 3 场 → 拦下（>= 判定，边界不漏）')
    ok(r3.reason.includes('3 场'), `拦截提示带上限数字：「${r3.reason}」`)
    useStore.setState({ todayBattles: 9 })
    ok(limits.limitOf(s(), at(10, 0)).blocked, '超出上限当然也拦')

    // ③ 上限归零 / 脏值
    s().setLimits({ dailyBattleLimit: 0 })
    ok(limits.limitOf(s(), at(10, 0)).blocked === false, '上限设回 0 = 不限场次')
    s().setLimits({ dailyBattleLimit: -5 })
    ok(s().settings.dailyBattleLimit === 0, '负数夹到 0（家长手滑不会把孩子锁死）')

    // ④ 可用时段：含起点、不含终点
    useStore.setState({ todayBattles: 0 })
    s().setLimits({ allowFrom: '08:00', allowTo: '20:00' })
    ok(limits.inWindow(at(8, 0), '08:00', '20:00') === true, '时段起点那一刻放行（含左端）')
    ok(limits.inWindow(at(12, 0), '08:00', '20:00') === true, '时段中间放行')
    ok(limits.inWindow(at(19, 59), '08:00', '20:00') === true, '终点前一分钟仍放行')
    ok(limits.inWindow(at(20, 0), '08:00', '20:00') === false, '终点那一刻就拦（不含右端）')
    ok(limits.inWindow(at(7, 59), '08:00', '20:00') === false, '起点前一分钟仍拦')
    const out = limits.limitOf(s(), at(7, 0))
    ok(out.outsideWindow && out.blocked, '时段外进入被拦下')
    ok(out.reason.includes('08:00'), `时段外提示里带出可玩时段：「${out.reason}」`)
    ok(limits.limitOf(s(), at(9, 0)).blocked === false, '回到时段内立刻放行')

    // ⑤ 跨零点时段（20:00–07:00）
    ok(limits.inWindow(at(23, 0), '20:00', '07:00') === true, '跨零点：23:00 放行')
    ok(limits.inWindow(at(3, 0), '20:00', '07:00') === true, '跨零点：次日 03:00 放行')
    ok(limits.inWindow(at(7, 0), '20:00', '07:00') === false, '跨零点：07:00 收口')
    ok(limits.inWindow(at(12, 0), '20:00', '07:00') === false, '跨零点：白天拦')

    // ⑥ 只填一端 / 填错
    ok(limits.inWindow(at(9, 0), '08:00', '') === true, '只填起点：其后都放行')
    ok(limits.inWindow(at(7, 0), '08:00', '') === false, '只填起点：之前仍拦')
    ok(limits.inWindow(at(21, 0), '', '20:00') === false, '只填终点：其后拦')
    ok(limits.inWindow(at(9, 0), '垃圾', '数据') === true, '两端都是非法值 → 当没填（不锁死）')
    ok(limits.inWindow(at(9, 0), '09:00', '09:00') === true, '起止相同视作不限（填错的兜底）')

    // ⑦ 时段优先于场次：两条都命中时提示的是时段
    useStore.setState({ todayBattles: 99 })
    s().setLimits({ dailyBattleLimit: 3 })
    const both = limits.limitOf(s(), at(2, 0))
    ok(both.overCount && both.outsideWindow, '场次与时段同时命中')
    ok(both.reason.includes('休息时间'), '两条都命中 → 提示时段原因（更硬的那条优先）')

    // ⑧ 老存档兜底：settings 里根本没有这三个字段
    const legacy = { settings: { sound: true } as never, todayBattles: 1 }
    const lr = limits.limitOf(legacy as never, at(10, 0))
    ok(lr.blocked === false && lr.limit === 0, '老存档缺字段 → 当作不限制（不会把孩子锁在外面）')

    // ⑨ 家长端摘要文案
    ok(
      limits.limitSummary(3, '08:00', '20:00') === '每天 3 场 · 08:00–20:00 可玩',
      `摘要：${limits.limitSummary(3, '08:00', '20:00')}`,
    )
    ok(limits.limitSummary(0, '', '') === '场次不限', '什么都不限时摘要只有一句')

    // 复位（本组是最后一组，但保持状态干净总没坏处）
    s().setLimits({ dailyBattleLimit: 0, allowFrom: '', allowTo: '' })
    useStore.setState({ todayBattles: 0 })
  }

  // ==========================================================================
  console.log('== 30. 佐证加密存储（FE-02）==')
  {
    const plain = new TextEncoder().encode('fake-jpeg-bytes-\u0001\u0002\u0003').buffer as ArrayBuffer
    const pb = new Uint8Array(plain)
    const key = await newMediaKey()

    // ① 密钥性质：AES-GCM 256、不可导出
    ok(key.algorithm.name === 'AES-GCM', `密钥算法 ${key.algorithm.name}`)
    ok((key.algorithm as AesKeyAlgorithm).length === 256, '密钥长度 256 位')
    ok(key.extractable === false, '密钥 extractable=false（导不出原始字节）')
    let exportThrew = false
    try { await crypto.subtle.exportKey('raw', key) } catch { exportThrew = true }
    ok(exportThrew, '尝试导出密钥字节会抛错')

    // ② 加密：密文 ≠ 明文；长度 = 明文 + 16（GCM 认证标签）
    const sealed = await sealBytes(plain, key)
    const cipher = new Uint8Array(sealed.data)
    ok(cipher.length === pb.length + 16, `密文 ${cipher.length} 字节 = 明文 ${pb.length} + 16`)
    ok(sealed.iv.length === 12, `iv ${sealed.iv.length} 字节（GCM 标准）`)
    ok(!cipher.every((b, i) => b === pb[i]), '密文与明文不同（确实加密了，不是原样存）')

    // ③ 解密还原
    const back = new Uint8Array(await openBytes(sealed, key))
    ok(back.length === pb.length && back.every((b, i) => b === pb[i]), '解密后与原文逐字节一致')

    // ④ iv 随机：同一明文两次结果不同
    const sealed2 = await sealBytes(plain, key)
    ok(sealed2.iv.join(',') !== sealed.iv.join(','), '两次加密 iv 不同（同明文不产出相同密文）')

    // ⑤ 完整性：动过就解不开（AES-GCM 自带认证）
    const badIv = { iv: new Uint8Array(sealed.iv), data: sealed.data }
    badIv.iv[0] ^= 0xff
    let ivThrew = false
    try { await openBytes(badIv, key) } catch { ivThrew = true }
    ok(ivThrew, '改 iv → 解密失败')

    const badData = new Uint8Array(sealed.data)
    badData[badData.length - 1] ^= 0x01
    let dataThrew = false
    try { await openBytes({ iv: sealed.iv, data: badData.buffer }, key) } catch { dataThrew = true }
    ok(dataThrew, '改密文 → 解密失败')

    // ⑥ 换密钥解不开
    const key2 = await newMediaKey()
    let wrongThrew = false
    try { await openBytes(sealed, key2) } catch { wrongThrew = true }
    ok(wrongThrew, '换一把密钥解不开（拿不到密钥就拿不到原图）')
  }

  // ==========================================================================
  console.log('== 31. 养成节奏数值（NUM-01）==')
  {
    ok(rules.STAGE_EXP.length === 6, `6 阶门槛共 ${rules.STAGE_EXP.length} 项`)
    ok(rules.STAGE_EXP[0] === 0, 'Lv1 起点为 0')
    const last = rules.STAGE_EXP[5]
    ok(last === 2700, `满阶门槛 ${last} 经验`)

    // 每阶增量递增 —— 越往后越慢，前期给足成就感
    const steps = rules.STAGE_EXP.slice(1).map((v, i) => v - rules.STAGE_EXP[i])
    ok(
      steps.every((v, i) => i === 0 || v > steps[i - 1]),
      `每阶增量递增：${steps.join(' / ')}`,
    )

    // 推导口径：饱食度决定每天最多 3 份 → 30 经验/天
    const perDay = 3 * rules.EXP_PER_FOOD
    ok(perDay === 30, `每天产出 ${perDay} 经验（3 份 × ${rules.EXP_PER_FOOD}）`)
    const days = Math.round(last / perDay)
    ok(days >= 85 && days <= 95, `满阶约 ${days} 天（目标「约 3 个月」）`)

    // 阶段边界：达线即升阶，超限封顶
    ok(rules.stageOf(0) === 1, '0 经验 = Lv1')
    ok(rules.stageOf(199) === 1, '199 经验仍在 Lv1')
    ok(rules.stageOf(200) === 2, '200 经验升 Lv2')
    ok(rules.stageOf(2699) === 5, '2699 经验仍在 Lv5')
    ok(rules.stageOf(2700) === 6, '2700 经验满阶 Lv6（神兽）')
    ok(rules.stageOf(99999) === 6, '远超门槛也封顶 Lv6，不越界')
  }

  // ==========================================================================
  console.log('== 32. 成就判定（FE-06）==')
  {
    // 造一个判定上下文，只覆盖关心的字段
    const ctx = (o: Record<string, unknown>) =>
      ({ levels: [], owned: [], stage: 1, longestStreak: 0, wrongSolvedTotal: 0, ...o }) as never
    const lv = (id: string, cleared = true, bestStars = 3) => ({
      levelId: id, subject: 'math', bestStars, cleared, bestCorrect: 8, total: 10, lastAt: 0, playCount: 1,
    })
    const byId = (id: string) => ACHIEVEMENTS.find((a) => a.id === id)!
    const hit = (id: string, c: unknown) => byId(id).test(c as never)

    ok(ACHIEVEMENTS.length >= 12, `成就共 ${ACHIEVEMENTS.length} 个`)
    ok(new Set(ACHIEVEMENTS.map((a) => a.id)).size === ACHIEVEMENTS.length, '成就 id 无重复')

    // 入门线
    ok(hit('first_battle', ctx({ levels: [] })) === false, '没打过关卡 → 未解锁「初次出征」')
    ok(hit('first_battle', ctx({ levels: [lv('m1')] })) === true, '打了 1 关 → 解锁「初次出征」')
    ok(hit('stars_4', ctx({ levels: [lv('m1', true, 3)] })) === false, '3 星不算「满分小将」')
    ok(hit('stars_4', ctx({ levels: [lv('m1', true, 4)] })) === true, '4 星达标')

    // 中程线：通关计数只看 cleared
    const nine = Array.from({ length: 9 }, (_, i) => lv(`m${i + 1}`))
    const ten = [...nine, lv('m10')]
    ok(hit('clear_10', ctx({ levels: nine })) === false, '9 关未达「十关通」')
    ok(hit('clear_10', ctx({ levels: ten })) === true, '10 关解锁「十关通」')
    ok(hit('clear_10', ctx({ levels: ten.map((l) => ({ ...l, cleared: false })) })) === false, '没过关的不计数')

    // Boss 线：靠关卡定义里的 boss 标记判定，不是硬编码 id 前缀
    ok(hit('boss_1', ctx({ levels: [lv('m1')] })) === false, '普通关不算首领关')
    ok(hit('boss_1', ctx({ levels: [lv('mb1')] })) === true, 'mb1 是首领关 → 解锁「首领克星」')
    ok(hit('boss_3', ctx({ levels: [lv('mb1'), lv('cb1'), lv('eb1')] })) === true, '三个首领关 → 「三战三捷」')

    // 长线：取历史最长，断签不清零（成就一旦拿到不回收）
    ok(hit('streak_7', ctx({ longestStreak: 6 })) === false, '连续 6 天未达「一周坚持」')
    ok(hit('streak_7', ctx({ longestStreak: 7 })) === true, '连续 7 天达标')
    ok(hit('streak_30', ctx({ longestStreak: 30 })) === true, '连续 30 天达标')

    // 养成线
    ok(hit('stage_6', ctx({ stage: 5 })) === false, '5 阶未满阶')
    ok(hit('stage_6', ctx({ stage: 6 })) === true, '6 阶解锁「神兽降临」')
    const fourDecor = ['hut', 'tree', 'lamp', 'pond']
    ok(hit('decor_5', ctx({ owned: fourDecor })) === false, '4 件装饰不够')
    ok(hit('decor_5', ctx({ owned: [...fourDecor, 'bridge'] })) === true, '5 件装饰达标')
    ok(hit('wrong_10', ctx({ wrongSolvedTotal: 10 })) === true, '掌握 10 道错题达标')

    // 进度显示
    const [cur, target] = byId('clear_10').progress(ctx({ levels: [lv('m1'), lv('m2'), lv('m3')] }))
    ok(cur === 3 && target === 10, `「十关通」进度显示 ${cur}/${target}`)
    const [capped] = byId('streak_30').progress(ctx({ longestStreak: 99 }))
    ok(capped === 30, '超出的进度会被夹到目标值（99 天显示 30/30）')

    // 已点亮计数
    ok(unlockedCount(['streak_3', 'streak_7']) === 2, 'unlockedCount 数已解锁个数')
    ok(unlockedCount(['不存在的 id']) === 0, '未知 id 不计入')
  }

  // == 33. 取名校验（FE-04：口径 = PRD「6 字内，支持后改」）==
  {
    console.log('== 33. 取名校验（FE-04）==')
    ok(checkName('小朏朏').ok === true, '正常名字通过')
    ok(checkName('  小朏朏  ').ok === true, '首尾空格会被 trim')
    ok(checkName('').ok === false, '空名拒绝')
    ok(checkName('   ').ok === false, '纯空格拒绝')
    ok(checkName('一二三四五六七').ok === false, '7 个字拒绝（上限 6）')
    ok(checkName('一二三四五六').ok === true, '恰好 6 个字通过')
    ok(checkName('小朏2号').ok === false, '含数字拒绝')
    ok(checkName('Tom猫').ok === false, '含英文字母拒绝')
    ok(checkName('小笨蛋').ok === false, '脏话拒绝')
    ok(checkName('王小明同学').ok === false, '疑似真实姓名（姓氏开头 ≥3 字）拒绝')
    ok(checkName('王小小').ok === false, '三字姓氏开头仍拒绝')
    ok(checkName('朏朏').ok === true, '两字名通过')
  }

  console.log(`\n结果：${fail === 0 ? '全部通过 ✅' : fail + ' 项失败 ❌'}`)
  if (fail > 0) process.exit(1)
})()
