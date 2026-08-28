<script setup lang="ts">
import { computed, ref } from 'vue'
import { save, removeWrong } from '../store'
import type { Question } from '../quiz'
import { wrongToQuestion } from '../quiz'
import { speak } from '../audio'
import QuizRunner from '../components/QuizRunner.vue'

const mode = ref<'list' | 'all' | 'one'>('list')
const oneQ = ref<Question | null>(null)

const gen = computed(() => {
  if (mode.value === 'one' && oneQ.value) return () => [oneQ.value!]
  if (mode.value === 'all') return () => save.wrongs.map(wrongToQuestion)
  return () => []
})

function startAll() {
  if (!save.wrongs.length) return
  mode.value = 'all'
}
function startOne(w: (typeof save.wrongs)[number]) {
  oneQ.value = wrongToQuestion(w)
  mode.value = 'one'
}
function exit() {
  mode.value = 'list'
  oneQ.value = null
}
function handleAnswer(q: Question, correct: boolean) {
  if (!correct) return
  const w = save.wrongs.find((x) => x.kind === q.kind && x.answer === q.answer && x.from === q.from)
  if (w) removeWrong(w)
}
function clearAll() {
  if (confirm('确定要清空全部错题吗？')) save.wrongs = []
}
</script>

<template>
  <QuizRunner
    v-if="mode !== 'list'"
    :title="mode === 'all' ? '🔁 错题重练' : '✏️ 单题重练'"
    :gen="gen"
    :gems-per-correct="1"
    :record-wrong="false"
    :on-answer="handleAnswer"
    back-to="wrong"
    color="purple"
  />

  <div v-else class="page">
    <div class="page-head purple">
      <span class="hicon">📖</span>
      <div class="htext">
        <h2>错题本</h2>
        <p class="sub">做错的题目都在这里，把它们全部消灭掉！</p>
      </div>
      <span class="hbadge">共 {{ save.wrongs.length }} 题</span>
    </div>

    <div class="zone purple">
      <div class="zone-head"><span class="zicon">⚔️</span><span>错题挑战</span><span class="zdesc">答对自动移除</span></div>
      <div class="zone-body">
        <div class="row">
          <button class="btn gold" :disabled="!save.wrongs.length" @click="startAll">🔁 全部重练</button>
          <button class="btn red" :disabled="!save.wrongs.length" @click="clearAll">🗑️ 清空</button>
        </div>

        <div class="mt">
          <div v-if="!save.wrongs.length" class="panel center">
            <div style="font-size: 3rem;">🎉</div>
            <p>没有错题，太棒了！</p>
          </div>
          <div v-for="(w, i) in save.wrongs" :key="i" class="wrong-item">
            <span class="q">
              <template v-if="w.kind === 'listen'">🔊 {{ w.audioZh }}</template>
              <template v-else-if="w.kind === 'char'">{{ w.q }}</template>
              <template v-else>🧩 {{ w.q }}</template>
              <span class="muted">（{{ w.from }}）</span>
            </span>
            <span class="ans">✅ {{ w.answer }}</span>
            <span class="pick">❌ {{ w.picked }}</span>
            <button class="btn small blue" @click="speak(w.audioZh)">🔊</button>
            <button class="btn small" @click="startOne(w)">再练一次</button>
            <button class="btn small gray" @click="removeWrong(w)">✓ 已会</button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
