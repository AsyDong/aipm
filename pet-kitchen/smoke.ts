/* 冒烟脚本：在 Node 里跑一遍核心状态机，验证 PRD 规则是否被正确执行 */
import { useStore } from './src/store/useStore'
import * as rules from './src/engine/rules'
import { MATH_LEVELS, buildLevelQuestions, variantsOf, questionOfKind, buildQuestion } from './src/engine/questions'
import { advanceQueue, firstCorrectCount } from './src/engine/queue'
import { toDay, addDays, nowDay, DAY_START_HOUR } from './src/engine/time'
import { gradeLocally, needsModel, normalizeNumeric } from './src/engine/grading'
import {
  activeProvider, configureProvider, generateQuestions, generateVariants, gradeAnswer,
  isThenable, localProvider, providerStats, resetProviderConfig, resetProviderStats,
} from './src/engine/provider'

let fail = 0
function ok(cond: boolean, msg: string, extra?: unknown) {
  if (cond) console.log('  PASS  ', msg)
  else {
    fail++
    console.log('  FAIL  ', msg, extra ?? '')
  }
}

const s = () => useStore.getState()

/** 模拟"过了一天"：把 activeDay 回拨一天，再让 ensureDay 结算推进回来 */
function nextDay() {
  useStore.setState({ activeDay: addDays(s().activeDay, -1) })
  s().ensureDay()
}

console.log('== 1. 初始化 ==')
s().bootstrap()
ok(!s().pet, '初始没有宠物')
ok(s().templates.length === 5, `默认任务模板 ${s().templates.length} 条`)
ok(s().prizes.length > 0, `默认现实奖品 ${s().prizes.length} 个`)

console.log('== 2. 领养 / 破壳 / 取名 ==')
s().adopt('baize')
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

console.log('== 5. 喂养规则（1份=20，日上限6，上限120）==')
useStore.setState({ pet: { ...s().pet!, satiety: 0, fedToday: 0, body: 'normal' } })
s().parentAdjustFood(10, '测试补发')
s().feed(3)
ok(s().pet!.satiety === 60, `喂 3 份 → 饱食度 ${s().pet!.satiety}（期望 60）`, s().pet?.satiety)
ok(s().food === 12, `食物剩余 ${s().food}（5+10-3）`, s().food)
ok(s().pet!.exp === 30, `经验 ${s().pet!.exp}（3×10）`, s().pet?.exp)
s().feed(2)
ok(s().pet!.satiety === 100, `再喂 2 份 → ${s().pet!.satiety}（期望 100）`, s().pet?.satiety)
ok(s().pet!.fedToday === 5, `当日已喂 ${s().pet!.fedToday} 份`)
s().feed(1)
ok(s().pet!.satiety === 120, `第 6 份 → ${s().pet!.satiety}（硬上限 120）`, s().pet?.satiety)
ok(s().pet!.body === 'fat', `第 6 份触发肥胖：${s().pet!.body}`)
const feedRes = s().feed(1)
ok(!feedRes.ok, `超过日上限被拒绝：${feedRes.msg}`)

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

console.log('== 9. 三天不喂 → 变瘦 ==')
{
  useStore.setState({ pet: { ...s().pet!, satiety: 100, noFeedDays: 0, body: 'normal' } })
  nextDay()
  nextDay()
  nextDay()
  ok(s().pet!.body === 'thin', `连续 3 天没吃 → ${s().pet!.body}`, s().pet?.body)
  ok(s().pet!.satiety === 0, `饱食度归零 ${s().pet!.satiety}`)
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

console.log('== 11. 闯关结算（首次通关双倍 / 星级 / 属性）==')
{
  const lv = MATH_LEVELS[0]
  const beforeP = s().points
  const beforeAttr = s().pet!.attrs.math
  const res = s().finishBattle('math', lv.id, 10, 10, [])
  const expected = (10 * rules.POINT_PER_CORRECT + rules.STAR_BONUS[3]) * 2
  ok(res.stars === 3, `10/10 → ${res.stars} 星`)
  ok(res.firstClear, '首次通关')
  ok(res.points === expected, `积分 +${res.points}（期望 ${expected}）`, res.points)
  ok(s().points === beforeP + expected, `总积分 ${beforeP} → ${s().points}`)
  ok(s().pet!.attrs.math === beforeAttr + res.attr, `数学属性 +${res.attr}`)
  const rec = s().levels.find((l) => l.levelId === lv.id)!
  ok(rec && rec.cleared && rec.bestStars === 3, '关卡记录已写入')

  // 二周目不再双倍
  const before2 = s().points
  const res2 = s().finishBattle('math', lv.id, 10, 10, [])
  ok(!res2.firstClear && res2.points === expected / 2, `二周目积分 ${res2.points}（无双倍）`)

  // 低于 50% 正确率 = 0 星 = 未通关，不给分不记通关
  const before3 = s().points
  const res3 = s().finishBattle('math', MATH_LEVELS[1].id, 4, 10, [])
  ok(res3.stars === 0 && res3.points === 0, `4/10 → ${res3.stars} 星 / ${res3.points} 分`)
  ok(s().points === before3, '未通关不涨积分')
  ok(!s().levels.some((l) => l.levelId === MATH_LEVELS[1].id), '未通关不写通关记录')
  ok(rules.starsOf(5, 10) === 1 && rules.starsOf(7, 10) === 2 && rules.starsOf(9, 10) === 3, '星级门槛 50/70/90%')
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

console.log('== 17. 时间工具（04:00 分界）==')
{
  const mk = (y: number, m: number, d: number, h: number) => new Date(y, m - 1, d, h, 0, 0).getTime()
  ok(toDay(mk(2026, 9, 15, 3)) === toDay(mk(2026, 9, 14, 5)), '凌晨 3 点归属前一天')
  ok(toDay(mk(2026, 9, 15, 5)) === '2026-09-15', '早上 5 点归属当天')
  ok(addDays('2026-09-30', 1) === '2026-10-01', `跨月 ${addDays('2026-09-30', 1)}`)
  ok(addDays('2026-12-31', 1) === '2027-01-01', `跨年 ${addDays('2026-12-31', 1)}`)
  ok(DAY_START_HOUR === 4, '分界点为 04:00')
}

console.log('== 18. 数值常量复核 ==')
ok(rules.FOOD_PER_SATIETY === 20, '1 份 = 20 饱食度')
ok(rules.DAILY_DECAY === 60, '每日衰减 60')
ok(rules.FEED_LIMIT === 6, '日投喂上限 6')
ok(rules.SATIETY_MAX === 120, '饱食度上限 120')
ok(rules.FAT_FULL_DAYS === 7 && rules.THIN_DAYS === 3, '连续 7 天顶格变胖 / 3 天没吃变瘦')
ok(rules.STREAK_7_FOOD === 1 && rules.STREAK_30_FOOD === 5, '连续 7 天 +1 / 30 天 +5')
ok(rules.POINT_PER_CORRECT === 2, '每题 2 积分')

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

  console.log(`\n结果：${fail === 0 ? '全部通过 ✅' : fail + ' 项失败 ❌'}`)
  if (fail > 0) process.exit(1)
})()
