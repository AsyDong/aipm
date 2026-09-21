<script setup lang="ts">
// 通用答题引擎：听音选 / 看字选 / 组合游戏 / 闯关 / 单元测试 / 错题重练 共用
import { computed, ref } from 'vue'
import type { Question } from '../quiz'
import { questionToWrong } from '../quiz'
import { addGems, addWrong, recordAnswer, refreshBadges, save, setLevelStars } from '../store'
import { speak, speakParts } from '../audio'
import { go } from '../router'

const props = withDefaults(defineProps<{
  title: string
  gen: () => Question[]
  gemsPerCorrect?: number
  levelId?: number
  unit?: number
  recordWrong?: boolean
  backTo?: string
  color?: string
  sub?: string
  onAnswer?: (q: Question, correct: boolean) => void
  onDone?: (correct: number, total: number) => void
  onNext?: () => void   // 结果页"继续"按钮（综合挑战接续终极跟读用）
  nextLabel?: string
}>(), { gemsPerCorrect: 0, recordWrong: true, backTo: 'home', color: 'orange', sub: '答对得分，认真听哦！', nextLabel: '继续 ▶' })

const questions = ref<Question[]>([])
const idx = ref(0)
const phase = ref<'q' | 'done'>('q')
const picked = ref('')
const locked = ref(false)
const results = ref<{ q: Question; picked: string; correct: boolean }[]>([])
const correctCount = ref(0)
const starsGained = ref(0)
const earnedGems = ref(0)
const combo = ref(0)        // 连击：连续答对次数
const bestCombo = ref(0)

const q = computed(() => questions.value[idx.value])
const score = computed(() => correctCount.value * 10)
const face = computed(() => {
  const total = questions.value.length || 1
  const r = correctCount.value / total
  if (r >= 0.9) return '🏆'
  if (r >= 0.6) return '😄'
  if (r >= 0.3) return '🙂'
  return '💪'
})

function autoSpeak() {
  if (q.value && (q.value.kind === 'listen' || q.value.kind === 'char')) speak(q.value.audioZh)
}

function start() {
  questions.value = props.gen() || []
  idx.value = 0
  phase.value = 'q'
  picked.value = ''
  locked.value = false
  results.value = []
  correctCount.value = 0
  starsGained.value = 0
  earnedGems.value = 0
  combo.value = 0
  bestCombo.value = 0
  setTimeout(autoSpeak, 150)
}

function replay() {
  if (!q.value) return
  if (q.value.kind === 'blend') {
    const parts = q.value.q.split(' + ').map((s) => s.trim())
    speakParts(parts)
    return
  }
  speak(q.value.audioZh)
}

function choose(opt: string) {
  if (locked.value || !q.value) return
  locked.value = true
  picked.value = opt
  const right = opt === q.value.answer
  results.value.push({ q: q.value, picked: opt, correct: right })
  recordAnswer(right)
  if (right) {
    correctCount.value++
    combo.value++
    if (combo.value > bestCombo.value) bestCombo.value = combo.value
    if (props.gemsPerCorrect) { addGems(props.gemsPerCorrect); earnedGems.value += props.gemsPerCorrect }
  } else {
    combo.value = 0
    if (props.recordWrong) {
      addWrong(questionToWrong(q.value, opt))
    }
  }
  props.onAnswer?.(q.value, right)
}

function next() {
  if (idx.value < questions.value.length - 1) {
    idx.value++
    picked.value = ''
    locked.value = false
    setTimeout(autoSpeak, 90)
  } else {
    finish()
  }
}

function finish() {
  phase.value = 'done'
  const total = questions.value.length
  if (props.levelId != null) {
    const s = correctCount.value >= total ? 3
      : correctCount.value >= Math.ceil(total * 0.75) ? 2
      : correctCount.value >= Math.ceil(total * 0.5) ? 1 : 0
    starsGained.value = s
    if (s > 0) {
      setLevelStars(props.levelId, s)
      const g = s * 2
      addGems(g)
      earnedGems.value += g
    }
  }
  if (props.unit != null) {
    const sc = correctCount.value * 10
    if (sc > (save.testScores[props.unit] || 0)) save.testScores[props.unit] = sc
    addGems(correctCount.value)
    earnedGems.value += correctCount.value
  }
  refreshBadges()
  props.onDone?.(correctCount.value, total)
}

function restart() { start() }
function leave() { go(props.backTo) }

start()
</script>

<template>
  <div class="page">
    <template v-if="phase === 'q' && q">
      <div class="page-head" :class="props.color">
        <span class="hicon">{{ props.title.split(' ')[0] }}</span>
        <div class="htext">
          <h2>{{ props.title }}</h2>
          <p class="sub">{{ props.sub }}</p>
        </div>
        <span class="hbadge">第 {{ idx + 1 }} / {{ questions.length }} 题<span v-if="combo >= 2" class="combo-fire"> 🔥x{{ combo }}</span></span>
      </div>

      <div class="zone" :class="props.color">
        <div class="zone-head">
          <span class="zicon">🎯</span>
          <span>进度</span>
          <span class="zdesc">{{ results.filter((r) => r.correct).length }} 对 / {{ results.length }} 已答<span v-if="combo >= 2" class="combo-fire"> · 🔥 连击 x{{ combo }}</span></span>
        </div>
        <div class="zone-body">
          <div class="q-dots">
            <span v-for="(r, i) in results" :key="'r' + i" class="q-dot" :class="r.correct ? 'ok' : 'no'"></span>
            <span v-for="i in questions.length - results.length" :key="'p' + i" class="q-dot"></span>
          </div>
        </div>
      </div>

      <div class="zone" :class="props.color">
        <div class="zone-head">
          <span class="zicon">❓</span>
          <span>听一听，选一选</span>
          <span class="zdesc">点喇叭可重听</span>
        </div>
        <div class="zone-body">
          <div class="center">
            <template v-if="q.kind === 'listen'">
              <button class="big-speaker" @click="replay">🔊</button>
              <p class="muted">听一听，选出正确的拼音</p>
            </template>
            <template v-else-if="q.kind === 'char'">
              <div class="big-zh">{{ q.q }}</div>
              <button class="btn small blue" @click="replay">🔊 再听一遍</button>
            </template>
            <template v-else>
              <div class="blend-show">
                <span class="chip">{{ q.q.split(' + ')[0] }}</span>
                <span class="plus">+</span>
                <span class="chip">{{ q.q.split(' + ')[1] }}</span>
              </div>
              <p class="muted">拼一拼，选出正确的音节</p>
              <button class="btn small blue" @click="replay">🔊 听一听</button>
            </template>
          </div>

          <div class="options">
            <button
              v-for="opt in q.options" :key="opt"
              class="option-btn"
              :class="{ right: locked && opt === q.answer, wrong: locked && opt === picked && opt !== q.answer }"
              :disabled="locked"
              @click="choose(opt)"
            >{{ opt }}</button>
          </div>

          <div v-if="locked" class="center mt">
            <div class="feedback" :class="picked === q.answer ? 'ok' : 'no'">
              <template v-if="picked === q.answer">✅ 太棒了！<span v-if="gemsPerCorrect">+{{ gemsPerCorrect }} 💎</span></template>
              <template v-else>❌ 正确答案是 <b>{{ q.answer }}</b> <button class="btn small blue" @click="speak(q.audioZh)">🔊</button></template>
            </div>
            <button class="btn gold" @click="next">{{ idx === questions.length - 1 ? '🎉 看结果' : '下一题 ▶' }}</button>
          </div>
        </div>
      </div>
    </template>

    <template v-else>
      <div class="page-head" :class="props.color">
        <span class="hicon">{{ face }}</span>
        <div class="htext">
          <h2>挑战完成！</h2>
          <p class="sub">继续加油，把拼音学得更棒！</p>
        </div>
      </div>
      <div class="zone" :class="props.color">
        <div class="zone-head">
          <span class="zicon">📊</span>
          <span>本次成绩</span>
          <span class="zdesc">获得 💎 × {{ earnedGems }}</span>
        </div>
        <div class="zone-body">
          <div class="result-hero">
            <div class="face">{{ face }}</div>
            <div v-if="levelId != null" class="stars mt">
              <span v-for="i in 3" :key="i" :class="{ off: i > starsGained }">⭐</span>
            </div>
            <h2 v-else-if="unit != null" class="mt">得分：{{ score }} / 100</h2>
            <h2 v-else class="mt">答对 {{ correctCount }} / {{ questions.length }}</h2>
            <p class="muted" v-if="bestCombo >= 2">🔥 最佳连击 x{{ bestCombo }}</p>
          </div>
          <div class="row mt center" style="justify-content: center;">
            <button v-if="props.onNext" class="btn gold" @click="props.onNext?.()">{{ props.nextLabel }}</button>
            <button v-if="props.onNext" class="btn blue" @click="restart">🔄 再玩一次</button>
            <button v-else class="btn blue" @click="restart">🔄 再玩一次</button>
            <button class="btn" @click="leave">🏠 返回</button>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>
