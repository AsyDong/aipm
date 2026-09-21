<script setup lang="ts">
// 游戏区 · 综合挑战：混合听力/识字/拼装三种题型（6 选项更难）+ 终极跟读，全部按已学范围出题
import { computed, ref } from 'vue'
import QuizRunner from '../components/QuizRunner.vue'
import { genMixed, isPinyinLearned, shuffle, stripTone } from '../quiz'
import { ALL_SOUNDS, CHAR_BANK, FOLLOW_BANK, LEVELS } from '../data/pinyin'
import { learnedLettersByDay, PLAN_DAYS } from '../data/plan'
import { addGems, refreshBadges, save } from '../store'
import { asrSupported, recognizeOnce, speak } from '../audio'
import { showToast } from '../toast'
import { go, route } from '../router'

const backTo = (route.params.back as string) || 'home'
const day = computed(() => Math.min(Math.max(save.plan.startDay, 1), PLAN_DAYS))
const learned = computed(() => learnedLettersByDay(day.value))
const syllPool = [...new Set(LEVELS.flatMap((l) => l.words).map((w) => w.py))]

// 混合题素材：按已学范围过滤；不足则回退自由模式
const state = computed(() => {
  const words = [...LEVELS.flatMap((l) => l.words), ...CHAR_BANK].filter((w) => isPinyinLearned(w.py, learned.value))
  const blends = LEVELS.flatMap((l) => l.blends).filter((b) => isPinyinLearned(b.py, learned.value))
  if (words.length >= 6 && blends.length >= 3) {
    return { words, blends, label: `已学范围（第 ${day.value} 天）：共 ${learned.value.size} 个拼音 · 12 题混合 · 6 选项更烧脑` }
  }
  return {
    words: [...LEVELS.flatMap((l) => l.words), ...CHAR_BANK],
    blends: LEVELS.flatMap((l) => l.blends),
    label: '自由模式 · 全部拼音 · 12 题混合 · 6 选项更烧脑',
  }
})
function gen() { return genMixed(state.value.words, state.value.blends, syllPool, '综合挑战') }
function onQuizDone(c: number) { quizCorrect.value = c }

// ---------- 三阶段：混合答题 → 终极跟读 → 总成绩 ----------
const stage = ref<'quiz' | 'follow' | 'final'>('quiz')
const quizCorrect = ref(0)
const followGems = ref(0)
const followStarsSum = ref(0)

// 汉字 → 拼音 查找表（跟读同音评分用）
const PY_MAP: Record<string, string> = {}
for (const s of [...CHAR_BANK, ...FOLLOW_BANK, ...ALL_SOUNDS]) if (!PY_MAP[s.zh]) PY_MAP[s.zh] = s.py
for (const l of LEVELS) for (const w of l.words) if (!PY_MAP[w.zh]) PY_MAP[w.zh] = w.py

// 终极跟读：从已学范围挑 2 个词
const followWords = computed(() => {
  const bank = [...FOLLOW_BANK, ...CHAR_BANK].filter((w) => isPinyinLearned(w.py, learned.value))
  const pool = bank.length >= 2 ? bank : [...FOLLOW_BANK]
  return shuffle(pool).slice(0, 2)
})
const fIdx = ref(0)
const fStars = ref(0)
const fMsg = ref('')
const listening = ref(false)

function playStd() { speak(followWords.value[fIdx.value].zh) }

function toFollow() {
  stage.value = 'follow'
  setTimeout(playStd, 200)
}

async function follow() {
  if (listening.value) return
  playStd()
  if (!asrSupported) { showToast('当前浏览器不支持语音识别，试试 Chrome/Edge'); return }
  listening.value = true
  fMsg.value = '🎧 请跟读……'
  const text = await recognizeOnce()
  listening.value = false
  const curW = followWords.value[fIdx.value]
  if (text == null) { fMsg.value = '😅 没听清，再试一次'; fStars.value = 0; return }
  let stars = 1
  if (text.includes(curW.zh)) {
    stars = 3
    fMsg.value = '🌟 读得非常准！'
    save.stats.followFull++
  } else {
    let two = false
    for (const ch of text) {
      const p = PY_MAP[ch]
      if (p && stripTone(p) === stripTone(curW.py)) { two = true; break }
    }
    if (two) { stars = 2; fMsg.value = '👍 音读对了，声调再练练！' }
    else { fMsg.value = '🤔 再听一遍标准音试试' }
  }
  fStars.value = stars
  if (stars >= 3) refreshBadges()
}

// 每词结算绿宝石：3 星 +3、2 星 +2、1 星 +1
function settleWord() {
  const g = fStars.value || 1
  addGems(g)
  followGems.value += g
  followStarsSum.value += fStars.value
  fStars.value = 0
  fMsg.value = ''
}

function nextWord() {
  settleWord()
  if (fIdx.value < followWords.value.length - 1) {
    fIdx.value++
    setTimeout(playStd, 150)
  } else {
    stage.value = 'final'
  }
}
function skipFollow() {
  stage.value = 'final'
}

function restart() {
  quizCorrect.value = 0
  followGems.value = 0
  followStarsSum.value = 0
  fIdx.value = 0
  stage.value = 'quiz'
}
</script>

<template>
  <!-- 阶段一：混合答题 -->
  <QuizRunner
    v-if="stage === 'quiz'"
    title="⚡ 综合挑战"
    :sub="state.label"
    :gen="gen"
    :gems-per-correct="2"
    :back-to="backTo"
    color="green"
    :on-done="onQuizDone"
    :on-next="toFollow"
    next-label="🎤 进入终极跟读 ▶"
  />

  <!-- 阶段二：终极跟读 -->
  <div v-else-if="stage === 'follow'" class="page">
    <div class="page-head green">
      <span class="hicon">🎤</span>
      <div class="htext">
        <h2>终极跟读关</h2>
        <p class="sub">综合挑战最后一关：大声读出这个词，3 星 +3 💎！</p>
      </div>
      <span class="hbadge">第 {{ fIdx + 1 }} / {{ followWords.length }} 词</span>
    </div>
    <div class="zone green">
      <div class="zone-head"><span class="zicon">🗣️</span><span>跟读大挑战</span><span class="zdesc">读得准，宝石多</span></div>
      <div class="zone-body">
        <div class="panel follow-card">
          <div class="big-zh">{{ followWords[fIdx].zh }}</div>
          <div class="py">{{ followWords[fIdx].py }}</div>
          <div class="stars">
            <span v-for="i in 3" :key="i" :class="{ off: i > fStars }">⭐</span>
          </div>
          <div class="row center" style="justify-content: center;">
            <button class="btn blue" @click="playStd">🔊 标准音</button>
            <button class="btn gold" :disabled="listening" @click="follow">{{ listening ? '🎧 正在听…' : '🎤 我来读' }}</button>
          </div>
          <p class="muted" style="min-height: 1.4em; text-align: center;">{{ fMsg }}</p>
          <div class="row center" style="justify-content: center;">
            <button class="btn gold" @click="nextWord">{{ fIdx < followWords.length - 1 ? '结算 ➡ 下一词' : '🏁 完成挑战' }}</button>
            <button class="btn small gray" @click="skipFollow">跳过跟读</button>
          </div>
        </div>
      </div>
    </div>
  </div>

  <!-- 阶段三：总成绩 -->
  <div v-else class="page">
    <div class="page-head green">
      <span class="hicon">🏆</span>
      <div class="htext">
        <h2>综合挑战完成！</h2>
        <p class="sub">混合题 + 终极跟读，能都拿下可不容易！</p>
      </div>
    </div>
    <div class="zone green">
      <div class="zone-head"><span class="zicon">📊</span><span>总成绩</span><span class="zdesc">获得 💎 × {{ quizCorrect * 2 + followGems }}</span></div>
      <div class="zone-body">
        <div class="result-hero">
          <div class="face">🏆</div>
          <h2 class="mt">混合题答对 {{ quizCorrect }} / 12</h2>
          <p class="muted">🎤 终极跟读：{{ followGems ? `${followStarsSum} 颗星，+${followGems} 💎` : '已跳过' }}</p>
        </div>
        <div class="row mt center" style="justify-content: center;">
          <button class="btn gold" @click="restart">🔄 再来一次</button>
          <button class="btn" @click="go(backTo)">🏠 返回</button>
        </div>
      </div>
    </div>
  </div>
</template>
