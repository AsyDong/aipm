<script setup lang="ts">
import { computed } from 'vue'
import QuizRunner from '../components/QuizRunner.vue'
import { genListen, isPinyinLearned, shuffle } from '../quiz'
import { CHAR_BANK, LEVELS } from '../data/pinyin'
import { learnedLettersByDay, PLAN_21, PLAN_DAYS, reviewsForDay } from '../data/plan'
import { save } from '../store'
import { route } from '../router'

const all = [...LEVELS.flatMap((l) => l.words), ...CHAR_BANK]
const day = computed(() => Math.min(Math.max(save.plan.startDay, 1), PLAN_DAYS))
const learned = computed(() => learnedLettersByDay(day.value))
// 今日任务进入（scope=focus）：聚焦当天新学 + 到期复习字母；游戏区/首页进入：全部已学范围
const focus = route.params.scope === 'focus'
const scopeSet = computed(() => {
  if (!focus) return learned.value
  const s = new Set<string>(PLAN_21[day.value - 1].letters)
  for (const r of reviewsForDay(day.value)) for (const l of r.letters) s.add(l)
  return s
})
// 出题池：聚焦范围 → 已学范围 → 全部（素材不足时逐级回退）
const state = computed(() => {
  const scoped = all.filter((w) => isPinyinLearned(w.py, scopeSet.value))
  if (scoped.length >= 3) {
    return { pool: scoped, label: focus ? `今日聚焦（第 ${day.value} 天）：${[...scopeSet.value].join(' ')}` : `已学范围（第 ${day.value} 天）：共 ${learned.value.size} 个拼音` }
  }
  const lp = all.filter((w) => isPinyinLearned(w.py, learned.value))
  if (lp.length >= 3) return { pool: lp, label: `已学范围（第 ${day.value} 天）：共 ${learned.value.size} 个拼音` }
  return { pool: all, label: '自由模式 · 全部拼音' }
})

function gen() {
  const items = shuffle(state.value.pool).slice(0, 8)
  return items.map((w) => genListen(w, state.value.pool, '听力挑战'))
}
</script>

<template>
  <QuizRunner
    title="🎯 听力挑战"
    :sub="state.label"
    :gen="gen"
    :gems-per-correct="1"
    :back-to="(route.params.back as string) || 'home'"
    color="orange"
  />
</template>
