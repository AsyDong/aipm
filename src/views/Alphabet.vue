<script setup lang="ts">
import { computed, ref } from 'vue'
import { FINAL_GROUPS, INITIALS, ZHENGTI } from '../data/pinyin'
import { markLetterRead, save } from '../store'
import { speak } from '../audio'

const tab = ref<'init' | 'fin' | 'zheng'>('init')
const readCount = (list: { py: string }[]) => list.filter((s) => save.readLetters.includes(s.py)).length
const counts = computed(() => ({
  init: readCount(INITIALS),
  fin: readCount(FINAL_GROUPS.flatMap((g) => g.items)),
  zheng: readCount(ZHENGTI),
}))

function tap(py: string, zh: string) {
  speak(zh)
  markLetterRead(py)
}
</script>

<template>
  <div class="page">
    <div class="page-head blue">
      <span class="hicon">🔤</span>
      <div class="htext">
        <h2>拼音字母表</h2>
        <p class="sub">点一点方块，听标准发音；读过的会变绿哦！</p>
      </div>
      <span class="hbadge">{{ counts.init + counts.fin + counts.zheng }}/63 已读</span>
    </div>

    <div class="zone blue">
      <div class="zone-head">
        <span class="zicon">🗂️</span>
        <span>选择类别</span>
        <span class="zdesc">点击切换</span>
      </div>
      <div class="zone-body">
        <div class="tabs" style="margin: 0;">
          <button class="tab-btn" :class="{ active: tab === 'init' }" @click="tab = 'init'">声母 {{ counts.init }}/23</button>
          <button class="tab-btn" :class="{ active: tab === 'fin' }" @click="tab = 'fin'">韵母 {{ counts.fin }}/24</button>
          <button class="tab-btn" :class="{ active: tab === 'zheng' }" @click="tab = 'zheng'">整体认读 {{ counts.zheng }}/16</button>
        </div>
      </div>
    </div>

    <template v-if="tab === 'init'">
      <div class="zone blue">
        <div class="zone-head"><span class="zicon">🔊</span><span>声母（23 个）</span><span class="zdesc">点击发声</span></div>
        <div class="zone-body">
          <div class="block-grid">
            <div v-for="s in INITIALS" :key="s.py" class="py-block" :class="{ read: save.readLetters.includes(s.py) }" @click="tap(s.py, s.zh)">
              <span>{{ s.py }}</span>
              <span class="zh">{{ s.zh }}</span>
            </div>
          </div>
        </div>
      </div>
    </template>

    <template v-else-if="tab === 'fin'">
      <div v-for="g in FINAL_GROUPS" :key="g.name" class="zone blue">
        <div class="zone-head"><span class="zicon">🎵</span><span>{{ g.name }}</span><span class="zdesc">点击发声</span></div>
        <div class="zone-body">
          <div class="block-grid">
            <div v-for="s in g.items" :key="s.py" class="py-block" :class="{ read: save.readLetters.includes(s.py) }" @click="tap(s.py, s.zh)">
              <span>{{ s.py }}</span>
              <span class="zh">{{ s.zh }}</span>
            </div>
          </div>
        </div>
      </div>
    </template>

    <template v-else>
      <div class="zone blue">
        <div class="zone-head"><span class="zicon">🌟</span><span>整体认读音节（16 个）</span><span class="zdesc">点击发声</span></div>
        <div class="zone-body">
          <div class="block-grid">
            <div v-for="s in ZHENGTI" :key="s.py" class="py-block" :class="{ read: save.readLetters.includes(s.py) }" @click="tap(s.py, s.zh)">
              <span>{{ s.py }}</span>
              <span class="zh">{{ s.zh }}</span>
            </div>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>
