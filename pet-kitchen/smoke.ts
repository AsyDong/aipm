/* 冒烟脚本：在 Node 里跑一遍核心状态机，验证 PRD 规则是否被正确执行 */
import { useStore, dailyTaskVisible, templateAppliesOn, weekdayOf } from './src/store/useStore'
import * as rules from './src/engine/rules'
import { MATH_LEVELS, CHINESE_LEVELS, ENGLISH_LEVELS, levelById, bossRequires, buildLevelQuestions, variantsOf, questionOfKind, buildQuestion } from './src/engine/questions'
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
ok(s().templates.length === 5, `默认任务模板 ${s().templates.length} 条`)
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
ok(s().daily.length === 5, `今日任务 ${s().daily.length} 条`)
ok(s().daily.every((t) => t.day === s().activeDay), '任务 day 与 activeDay 一致')

console.log('== 4. 打卡 → 发食物 ==')
const t0 = s().daily[0]
s().submitTask(t0.id)
ok(s().daily.find((x) => x.id === t0.id)!.status === 'done', '客观类任务提交即完成')
ok(s().food === 1, `食物 = ${s().food}（期望 1）`, s().food)
ok(s().streak === 1, `连续天数 = ${s().streak}`)

for (const t of s().daily.filter((x) => x.status !== 'done')) s().submitTask(t.id)
ok(s().daily.filter((t) => t.status === 'pending').length === 2, '2 个主观任务进入待家长确认')
for (const t of s().daily.filter((x) => x.status === 'pending')) s().approveTask(t.id)
ok(s().food === 5, `5 个任务共得 ${s().food} 份食物（无全勤奖）`, s().food)
ok(s().todayTasksDone === 5, `todayTasksDone = ${s().todayTasksDone}`)

console.log('== 5. 喂养规则（1份=20，日上限5，硬上限120）==')
useStore.setState({ pet: { ...s().pet!, satiety: 0, fedToday: 0 } })
s().parentAdjustFood(10, '测试补发')
s().feed(3)
ok(s().pet!.satiety === 60, `喂 3 份 → 饱食度 ${s().pet!.satiety}（期望 60）`, s().pet?.satiety)
ok(s().food === 12, `食物剩余 ${s().food}（5+10-3）`, s().food)
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
ok(s().daily.length === 5, '新一天任务已重建')
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
  ok(CHINESE_LEVELS.length === 11 && ENGLISH_LEVELS.length === 9,
    `语文 ${CHINESE_LEVELS.length} 关 / 英语 ${ENGLISH_LEVELS.length} 关`)
  ok(!!levelById('m1') && !!levelById('c1') && !!levelById('e1'), 'levelById 三科都能找到')
  ok(bossRequires(CHINESE_LEVELS[5]).length === 5, 'Boss 解锁要求取自本 subject 的关卡列表')

  for (const level of [...CHINESE_LEVELS, ...ENGLISH_LEVELS]) {
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
    ok(bad === 0, `${level.name}：${qs.length} 题，选项/答案/重建 全部合法`, bad)
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

  console.log(`\n结果：${fail === 0 ? '全部通过 ✅' : fail + ' 项失败 ❌'}`)
  if (fail > 0) process.exit(1)
})()
