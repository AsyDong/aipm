<script setup lang="ts">
import { computed, ref } from 'vue'
import { go, route } from '../router'
import { LEVELS } from '../data/pinyin'
import { genLevelQuestions, stripTone } from '../quiz'
import { speak } from '../audio'
import QuizRunner from '../components/QuizRunner.vue'

const level = computed(() => LEVELS.find((l) => l.id === route.params.id) || LEVELS[0])
const backTo = computed(() => (route.params.back as string) || 'today')
const started = ref(false)

function playLetter(p: string) {
  const w = level.value.words.find((x) => stripTone(x.py) === p)
    || level.value.blends.find((b) => stripTone(b.py) === p)
  speak(w ? w.zh : p)
}
</script>

<template>
  <QuizRunner
    v-if="started"
    :title="`🏰 关卡${level.id} · ${level.name}`"
    :gen="() => genLevelQuestions(level)"
    :level-id="level.id"
    :back-to="backTo"
    color="green"
  />
  <div v-else class="page">
    <div class="page-head green">
      <span class="hicon">{{ level.icon }}</span>
      <div class="htext">
        <h2>关卡 {{ level.id }}：{{ level.name }}</h2>
        <p class="sub">{{ level.tip }}</p>
      </div>
      <span class="hbadge">第 {{ level.id }}/{{ LEVELS.length }} 关</span>
    </div>

    <div class="zone green">
      <div class="zone-head"><span class="zicon">📌</span><span>本关要点</span><span class="zdesc">点标签听发音</span></div>
      <div class="zone-body">
        <p><b>本关要点：</b>{{ level.tip }}</p>
        <div v-if="level.letters.length" class="chip-row">
          <span v-for="p in level.letters" :key="p" class="chip" @click="playLetter(p)">{{ p }} 🔊</span>
        </div>
      </div>
    </div>

    <div class="zone green">
      <div class="zone-head"><span class="zicon">🎯</span><span>闯关说明</span><span class="zdesc">8 题三星制</span></div>
      <div class="zone-body">
        <p class="muted">共 8 题：听音选、看字选、拼一拼。答对越多星星越多！</p>
        <div class="row mt center" style="justify-content: center;">
          <button class="btn gold" @click="started = true">🚀 开始闯关</button>
          <button class="btn gray" @click="go(backTo)">← 返回</button>
        </div>
      </div>
    </div>
  </div>
</template>
