<script setup lang="ts">
import { computed, ref } from 'vue'
import { ALL_SOUNDS, CHAR_BANK, FOLLOW_BANK, LEVELS, soundOf } from '../data/pinyin'
import { asrSupported, Recorder, recSupported, recognizeOnce, speak, ttsSupported } from '../audio'
import { refreshBadges, save } from '../store'
import { showToast } from '../toast'
import { isPinyinLearned, stripTone } from '../quiz'
import { learnedLettersByDay, PLAN_21, PLAN_DAYS } from '../data/plan'
import { go, route } from '../router'

// 汉字 → 拼音 查找表（用于跟读评分）
const PY_MAP: Record<string, string> = {}
for (const s of [...CHAR_BANK, ...FOLLOW_BANK, ...ALL_SOUNDS]) if (!PY_MAP[s.zh]) PY_MAP[s.zh] = s.py
for (const l of LEVELS) for (const w of l.words) if (!PY_MAP[w.zh]) PY_MAP[w.zh] = w.py

// 跟读素材：今日任务进入（scope=focus）聚焦当天新学 + 到期复习字母；游戏区/首页进入按已学范围
const day = Math.min(Math.max(save.plan.startDay, 1), PLAN_DAYS)
const learned = learnedLettersByDay(day)
const focus = route.params.scope === 'focus'
const scopeSet = new Set<string>(focus ? [] : learned)
if (focus) {
  for (const l of PLAN_21[day - 1].letters) scopeSet.add(l)
  for (const r of reviewsForDay(day)) for (const l of r.letters) scopeSet.add(l)
}
const dayBank: { py: string; zh: string }[] = []
for (const s of [...FOLLOW_BANK, ...CHAR_BANK]) {
  if (!dayBank.some((x) => x.zh === s.zh) && isPinyinLearned(s.py, scopeSet)) dayBank.push({ py: s.py, zh: s.zh })
}
if (focus) {
  for (const l of PLAN_21[day - 1].letters) {
    const s = soundOf(l)
    if (s && !dayBank.some((x) => x.zh === s.zh)) dayBank.push({ py: l, zh: s.zh })
  }
}
// 回退：聚焦范围 → 已学范围 → 全部跟读字
const learnedBank = [...new Map([...FOLLOW_BANK, ...CHAR_BANK].filter((s) => isPinyinLearned(s.py, learned)).map((s) => [s.zh, s])).values()]
const allBank = [...new Map([...FOLLOW_BANK, ...CHAR_BANK].map((s) => [s.zh, s])).values()]
const bank = dayBank.length >= 3 ? dayBank : learnedBank.length >= 3 ? learnedBank : allBank
const subLabel = dayBank.length >= 3
  ? (focus ? `今日聚焦（第 ${day} 天）：${[...scopeSet].join(' ')}` : `已学范围（第 ${day} 天）：共 ${learned.size} 个拼音`)
  : learnedBank.length >= 3
    ? `已学范围（第 ${day} 天）：共 ${learned.size} 个拼音`
    : '自由模式 · 全部跟读字'

const idx = ref(0)
const cur = computed(() => bank[idx.value % bank.length])
const scoreMsg = ref('')
const scoreStars = ref(0)
const listening = ref(false)
const recording = ref(false)
const recUrl = ref('')
const recorder = new Recorder()

function playStd() { speak(cur.value.zh) }

async function follow() {
  if (listening.value) return
  playStd()
  if (!asrSupported) { showToast('当前浏览器不支持语音识别，试试 Chrome/Edge'); return }
  listening.value = true
  scoreMsg.value = '🎧 请跟读……'
  const text = await recognizeOnce()
  listening.value = false
  if (text == null) { scoreMsg.value = '😅 没听清，再试一次'; scoreStars.value = 0; return }
  if (text.includes(cur.value.zh)) {
    scoreStars.value = 3
    scoreMsg.value = '🌟 读得非常准！'
    save.stats.followFull++
    refreshBadges()
  } else {
    let two = false
    for (const ch of text) {
      const p = PY_MAP[ch]
      if (p && stripTone(p) === stripTone(cur.value.py)) { two = true; break }
    }
    if (two) { scoreStars.value = 2; scoreMsg.value = '👍 音读对了，声调再练练！' }
    else { scoreStars.value = 1; scoreMsg.value = '🤔 再听一遍标准音试试' }
  }
}

async function toggleRec() {
  if (!recSupported) { showToast('当前浏览器不支持录音，试试 Chrome/Edge'); return }
  if (recording.value) {
    const url = await recorder.stop()
    recording.value = false
    if (url) { recUrl.value = url; showToast('已录好，点 ▶ 播放') }
  } else {
    try { await recorder.start(); recording.value = true } catch { showToast('无法使用麦克风，请检查权限') }
  }
}

function nextWord() {
  idx.value = (idx.value + 1) % bank.length
  scoreMsg.value = ''
  scoreStars.value = 0
  recUrl.value = ''
  setTimeout(playStd, 150)
}
</script>

<template>
  <div class="page">
    <div class="page-head orange">
      <span class="hicon">🎤</span>
      <div class="htext">
        <h2>🎤 发音擂台</h2>
        <p class="sub">{{ subLabel }}</p>
      </div>
      <span class="hbadge">第 {{ idx + 1 }} / {{ bank.length }} 个</span>
    </div>

    <div class="zone orange">
      <div class="zone-head">
        <span class="zicon">🗣️</span>
        <span>跟读练习</span>
        <span class="zdesc">读得准，星星多</span>
      </div>
      <div class="zone-body">
        <div class="panel follow-card">
          <div class="big-zh">{{ cur.zh }}</div>
          <div class="py">{{ cur.py }}</div>
          <div class="stars">
            <span v-for="i in 3" :key="i" :class="{ off: i > scoreStars }">⭐</span>
          </div>
          <div class="row center" style="justify-content: center;">
            <button class="btn blue" @click="playStd">🔊 标准音</button>
            <button class="btn gold" :disabled="listening" @click="follow">{{ listening ? '🎧 正在听…' : '🎤 我来读' }}</button>
          </div>
          <p class="muted" style="min-height: 1.4em; text-align: center;">{{ scoreMsg }}</p>
          <div class="row center" style="justify-content: center;">
            <button class="btn small gray" @click="toggleRec">{{ recording ? '⏹ 停止录音' : '🎙️ 录音' }}</button>
            <button class="btn small gray" :disabled="!recUrl" @click="recUrl && new Audio(recUrl).play()">▶️ 播放我的录音</button>
            <button class="btn small" @click="nextWord">下一个 ➡</button>
          </div>
        </div>
        <div class="panel mt">
          <p class="muted">
            语音识别：{{ asrSupported ? '✅ 可用' : '⚠️ 不支持（仅可录音回放）' }} ·
            录音：{{ recSupported ? '✅ 可用' : '⚠️ 不支持' }} ·
            发音：{{ ttsSupported ? '✅ 可用' : '⚠️ 不支持' }}
          </p>
        </div>
        <div class="center mt">
          <button class="btn gray" @click="go(route.params.back || 'home')">◀ 返回</button>
        </div>
      </div>
    </div>
  </div>
</template>
