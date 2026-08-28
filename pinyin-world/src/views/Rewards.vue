<script setup lang="ts">
import { computed } from 'vue'
import { BADGES, save } from '../store'
import { LEVELS } from '../data/pinyin'

// 总览（原学习进度页的统计）
const stats = computed(() => {
  const levelDone = Object.keys(save.stars).length
  const totalStars = Object.values(save.stars).reduce((a, b) => a + b, 0)
  const acc = save.stats.answered ? Math.round((save.stats.correct / save.stats.answered) * 100) : 0
  return { levelDone, totalStars, acc }
})

// 绿宝石获取方式一览
const gemGuide = [
  { icon: '📋', act: '每日完成今日任务并打卡', val: '+5 💎' },
  { icon: '🕹️', act: '小游戏每答对 1 题', val: '+1 💎' },
  { icon: '⚡', act: '综合挑战每答对 1 题（更难）', val: '+2 💎' },
  { icon: '🏰', act: '闯关每颗星（一次三星 +6）', val: '+2 💎' },
  { icon: '📝', act: '单元测试每答对 1 题', val: '+1 💎' },
  { icon: '🎤', act: '综合挑战终极跟读（每词最高 3 星）', val: '+3 💎' },
  { icon: '🏆', act: '解锁一枚新徽章', val: '+10 💎' },
]
</script>

<template>
  <div class="page">
    <div class="page-head purple">
      <span class="hicon">🏆</span>
      <div class="htext">
        <h2>我的奖励</h2>
        <p class="sub">努力学习的收获都在这里！</p>
      </div>
      <span class="hbadge">💎 {{ save.gems }}</span>
    </div>

    <div class="zone purple">
      <div class="zone-head"><span class="zicon">💎</span><span>绿宝石仓库</span><span class="zdesc">答题、闯关、打卡都能赚</span></div>
      <div class="zone-body">
        <div class="panel center">
          <div style="font-size: 3rem;">💎</div>
          <div class="big-py">{{ save.gems }}</div>
          <p class="muted">绿宝石：答题、闯关、打卡都能赚到！</p>
        </div>
      </div>
    </div>

    <div class="zone purple">
      <div class="zone-head"><span class="zicon">💡</span><span>绿宝石怎么获得</span><span class="zdesc">多做任务多赚宝石</span></div>
      <div class="zone-body">
        <div class="panel">
          <div v-for="g in gemGuide" :key="g.act" class="guide-row">
            <span>{{ g.icon }} {{ g.act }}</span>
            <span class="g-val">{{ g.val }}</span>
          </div>
        </div>
      </div>
    </div>

    <div class="zone purple">
      <div class="zone-head"><span class="zicon">🏅</span><span>总览</span><span class="zdesc">所有成绩一览</span></div>
      <div class="zone-body">
        <div class="stat-grid">
          <div class="panel stat-card"><div class="num">💎 {{ save.gems }}</div><div class="lbl">绿宝石</div></div>
          <div class="panel stat-card"><div class="num">⭐ {{ stats.totalStars }}</div><div class="lbl">星星总数</div></div>
          <div class="panel stat-card"><div class="num">🗺️ {{ stats.levelDone }}/{{ LEVELS.length }}</div><div class="lbl">通关关卡</div></div>
          <div class="panel stat-card"><div class="num">🏆 {{ save.badges.length }}/{{ BADGES.length }}</div><div class="lbl">徽章</div></div>
          <div class="panel stat-card"><div class="num">{{ stats.acc }}%</div><div class="lbl">正确率（{{ save.stats.correct }}/{{ save.stats.answered }}）</div></div>
          <div class="panel stat-card"><div class="num">🎤 {{ save.stats.followFull }}</div><div class="lbl">跟读 3 星次数</div></div>
        </div>
      </div>
    </div>

    <div class="zone purple">
      <div class="zone-head"><span class="zicon">🎖️</span><span>徽章墙（{{ save.badges.length }}/{{ BADGES.length }}）</span><span class="zdesc">每枚徽章 +10 💎</span></div>
      <div class="zone-body">
        <div class="badge-grid">
          <div v-for="b in BADGES" :key="b.id" class="badge" :class="{ locked: !save.badges.includes(b.id) }">
            <span class="icon">{{ b.icon }}</span>
            <span class="name">{{ b.name }}</span>
            <span class="desc">{{ b.desc }}</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
