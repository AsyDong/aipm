<script setup lang="ts">
import { computed, ref } from 'vue'
import { CHAR_BANK, FINALS, INITIALS, LEVELS, ZHENGTI } from '../data/pinyin'
import { setTone } from '../quiz'
import { speak } from '../audio'

// 音节 → 汉字查找表（用于点读发音）
const CHAR_OF: Record<string, string> = {}
for (const s of [...CHAR_BANK, ...ZHENGTI]) if (!CHAR_OF[s.py]) CHAR_OF[s.py] = s.zh
for (const l of LEVELS) for (const w of l.words) if (!CHAR_OF[w.py]) CHAR_OF[w.py] = w.zh

const presets = LEVELS.flatMap((l) => l.blends)

const selInit = ref('b')
const selFin = ref('a')
const selTone = ref(1)

const result = computed(() => {
  // j q x y 与 ü 相拼时先去点再标调（如 j + ü + 1声 → jū）
  const base = ['j', 'q', 'x', 'y'].includes(selInit.value) && selFin.value.includes('ü')
    ? selFin.value.replace(/ü/g, 'u')
    : selFin.value
  const py = selInit.value + setTone(base, selTone.value)
  return { py, zh: CHAR_OF[py] || '' }
})

function playResult() {
  speak(result.value.zh || result.value.py)
}
</script>

<template>
  <div class="page">
    <div class="page-head blue">
      <span class="hicon">🧪</span>
      <div class="htext">
        <h2>拼读演示</h2>
        <p class="sub">选声母、韵母和声调，看看能拼出什么音节（纯文字演示）。</p>
      </div>
      <span class="hbadge">{{ presets.length }} 组示例</span>
    </div>

    <div class="zone blue">
      <div class="zone-head"><span class="zicon">🧩</span><span>我的拼拼乐</span><span class="zdesc">三步拼出音节</span></div>
      <div class="zone-body">
        <p class="muted">1️⃣ 选声母</p>
        <div class="chip-row">
          <span v-for="s in INITIALS" :key="s.py" class="chip" :class="{ active: selInit === s.py }" @click="selInit = s.py">{{ s.py }}</span>
        </div>
        <p class="muted">2️⃣ 选韵母</p>
        <div class="chip-row">
          <span v-for="s in FINALS" :key="s.py" class="chip" :class="{ active: selFin === s.py }" @click="selFin = s.py">{{ s.py }}</span>
        </div>
        <p class="muted">3️⃣ 选声调</p>
        <div class="chip-row">
          <span v-for="t in [1, 2, 3, 4]" :key="t" class="chip" :class="{ active: selTone === t }" @click="selTone = t">{{ ['—', 'ˊ', 'ˇ', 'ˋ'][t - 1] }} 第{{ t }}声</span>
        </div>
        <div class="center mt">
          <div class="blend-show">
            <span class="chip">{{ selInit }}</span>
            <span class="plus">+</span>
            <span class="chip">{{ selFin }}</span>
            <span class="plus">→</span>
            <span class="big-py">{{ result.py }}</span>
          </div>
          <div v-if="result.zh" class="big-zh">{{ result.zh }}</div>
          <button class="btn gold" @click="playResult">🔊 听一听</button>
        </div>
      </div>
    </div>

    <div class="zone blue">
      <div class="zone-head"><span class="zicon">💡</span><span>示例拼读</span><span class="zdesc">点 🔊 听发音</span></div>
      <div class="zone-body">
        <div class="spell-preset">
          <div v-for="(b, i) in presets" :key="i" class="spell-row">
            <span class="chip">{{ b.initial }}</span>
            <span>+</span>
            <span class="chip">{{ b.final }}</span>
            <span>→</span>
            <b>{{ b.py }}</b>
            <span class="muted">{{ b.zh }}</span>
            <button class="btn small blue" @click="speak(b.zh)">🔊</button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
