<script setup lang="ts">
import { computed } from 'vue'
import { go } from '../router'
import { save, dayRec } from '../store'
import { PLAN_21, PLAN_DAYS, newDoneOf, reviewsForDay } from '../data/plan'

// 今日任务摘要
const today = computed(() => {
  const d = Math.min(Math.max(save.plan.startDay, 1), PLAN_DAYS)
  const p = PLAN_21[d - 1]
  const rec = dayRec(d)
  const reviews = reviewsForDay(d)
  const newDone = rec.newDone || newDoneOf(p)
  const wrongDone = rec.wrongDone || save.wrongs.length === 0
  const total = 1 + reviews.length + 1
  const done = (newDone ? 1 : 0) + reviews.filter((r) => rec.reviewsDone.includes(r.day)).length + (wrongDone ? 1 : 0)
  return { d, p, checked: rec.checked, streak: save.plan.streak, total, done, percent: total ? Math.round((done / total) * 100) : 0 }
})

const zones = [
  {
    cls: 'purple', icon: '🏆', name: '成长区', desc: '见证进步',
    tiles: [
      { page: 'map', icon: '🗺️', label: '闯关地图', sub: `${PLAN_DAYS} 天计划 · 一天一关` },
      { page: 'wrong', icon: '📖', label: '错题本', sub: '把错题变对题' },
      { page: 'rewards', icon: '🎖️', label: '我的奖励', sub: '绿宝石 · 徽章 · 总览' },
    ],
  },
  {
    cls: 'green', icon: '🎮', name: '游戏区', desc: '综合挑战 + 4 大小游戏',
    tiles: [
      { page: 'mixed', icon: '⚡', label: '综合挑战', sub: '混合 4 大游戏 · 更难' },
      { page: 'listen', icon: '🎯', label: '听力挑战', sub: '听真人发音选拼音' },
      { page: 'char', icon: '📖', label: '识字挑战', sub: '看汉字选拼音' },
      { page: 'blend', icon: '🧩', label: '拼装工坊', sub: '声母+韵母拼音节' },
      { page: 'follow', icon: '🎤', label: '发音擂台', sub: '大声跟读拿三星' },
    ],
  },
  {
    cls: 'blue', icon: '📖', name: '学习区', desc: '先认识拼音',
    tiles: [
      { page: 'alphabet', icon: '🔤', label: '拼音字母表', sub: '声母 · 韵母 · 整体认读' },
      { page: 'lesson', icon: '📚', label: '学习讲堂', sub: '拼音规则全知道' },
      { page: 'spell', icon: '🧪', label: '拼读演示', sub: '声母 + 韵母 = 音节' },
    ],
  },
]
</script>

<template>
  <div class="page">
    <div class="hero">
      <span class="sun">🌞</span>
      <h1>⛏️ 拼音方块世界</h1>
      <p class="sub">一年级小朋友的拼音乐园，点一点、听一听、读一读！</p>
      <div class="grass">🌱 🌿 🌾 🌼 🌱 🌿 🌾 🌼</div>
    </div>

    <!-- 今日任务卡（置顶醒目） -->
    <div class="today-card" @click="go('today')">
      <div class="tc-left">
        <span class="tc-icon">📋</span>
        <div>
          <b>今日任务</b>
          <span class="tc-sub">第 {{ today.d }}/{{ PLAN_DAYS }} 天 · {{ today.p.icon }} {{ today.p.title }}</span>
        </div>
      </div>
      <div class="tc-mid">
        <div class="bar"><div :style="{ width: today.percent + '%' }"></div></div>
        <span class="muted mt">{{ today.done }}/{{ today.total }} 项完成 · 打卡 +5💎</span>
      </div>
      <div class="tc-right">
        <span v-if="today.checked" class="tc-badge ok">✅ 已打卡</span>
        <span v-else class="tc-badge">🔥 连续 {{ today.streak }} 天</span>
        <span class="tc-go">去完成 ▶</span>
      </div>
    </div>

    <div v-for="z in zones" :key="z.name" class="zone" :class="z.cls">
      <div class="zone-head">
        <span class="zicon">{{ z.icon }}</span>
        <span>{{ z.name }}</span>
        <span class="zdesc">{{ z.desc }}</span>
      </div>
      <div class="zone-body">
        <div class="home-grid">
          <div v-for="t in z.tiles" :key="t.page" class="home-tile" :class="z.cls" @click="go(t.page)">
            <span class="icon">{{ t.icon }}</span>
            <span class="label">{{ t.label }}</span>
            <span class="sub">{{ t.sub }}</span>
          </div>
        </div>
      </div>
    </div>

    <p class="muted center mt" style="padding-bottom: 16px;">⚙️ 设置在右上角 · 进度保存在本设备</p>
  </div>
</template>
