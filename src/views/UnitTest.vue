<script setup lang="ts">
import { computed, ref } from 'vue'
import { go, route } from '../router'
import { LEVELS, UNITS } from '../data/pinyin'
import { genTestQuestions } from '../quiz'
import { save } from '../store'
import QuizRunner from '../components/QuizRunner.vue'

const selUnit = computed(() => UNITS.find((u) => u.id === route.params.unit))
const backTo = computed(() => (route.params.back as string) || 'map')
const started = ref(false)

function unitLocked(u: number) {
  const r = UNITS.find((x) => x.id === u)!.range
  for (let i = r[0]; i <= r[1]; i++) if (!save.stars[i]) return false
  return true
}
function pickUnit(u: number) {
  if (!unitLocked(u)) return
  go('test', { unit: u, back: route.params.back })
  started.value = false
}
function backToList() {
  go('test', { back: route.params.back })
  started.value = false
}
function startTest() {
  started.value = true
}
</script>

<template>
  <QuizRunner
    v-if="started && selUnit"
    :title="`📝 ${selUnit.name}测试`"
    :gen="() => genTestQuestions(selUnit.id)"
    :unit="selUnit.id"
    :back-to="backTo"
    color="green"
  />

  <div v-else-if="selUnit" class="page">
    <div class="page-head green">
      <span class="hicon">{{ selUnit.icon }}</span>
      <div class="htext">
        <h2>{{ selUnit.name }}测试</h2>
        <p class="sub">共 10 题，满分 100。答题正确可得绿宝石 💎。</p>
      </div>
      <span class="hbadge">10 题 / 100 分</span>
    </div>

    <div class="zone green">
      <div class="zone-head"><span class="zicon">📌</span><span>测试信息</span><span class="zdesc">做好准备再开始</span></div>
      <div class="zone-body">
        <p><b>包含关卡：</b>
          {{ LEVELS.filter((l) => l.unit === selUnit.id).map((l) => `第${l.id}关 ${l.name}`).join('、') }}
        </p>
        <p v-if="save.testScores[selUnit.id]" class="mt">上次成绩：<b>{{ save.testScores[selUnit.id] }} 分</b></p>
        <div class="row mt center" style="justify-content: center;">
          <button class="btn gold" @click="startTest">🚀 开始测试</button>
          <button class="btn gray" @click="backToList">← 返回测试列表</button>
        </div>
      </div>
    </div>
  </div>

  <div v-else class="page">
    <div class="page-head green">
      <span class="hicon">📝</span>
      <div class="htext">
        <h2>单元测试</h2>
        <p class="sub">每个单元 10 题，满分 100。先通关本单元所有关卡才能解锁测试。</p>
      </div>
      <span class="hbadge">{{ Object.keys(save.testScores).length }}/{{ UNITS.length }} 已测</span>
    </div>
    <div class="zone green">
      <div class="zone-head"><span class="zicon">🗂️</span><span>选择单元</span><span class="zdesc">解锁后才能进入</span></div>
      <div class="zone-body">
        <div class="home-grid">
          <div v-for="u in UNITS" :key="u.id" class="home-tile green" :class="{ done: (save.testScores[u.id] || 0) >= 90 }" @click="pickUnit(u.id)">
            <span class="icon">{{ u.icon }}</span>
            <span class="label">{{ u.name }}测试</span>
            <span class="sub">
              {{ unitLocked(u.id) ? (save.testScores[u.id] ? `得分 ${save.testScores[u.id]}` : '点击开始') : '🔒 未解锁' }}
            </span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
