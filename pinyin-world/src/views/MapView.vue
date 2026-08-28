<script setup lang="ts">
// 成长区 · 闯关地图：21 天打卡计划地图（14 天学习 + 7 天巩固，21 天 = 21 关）
import { computed } from 'vue'
import { go } from '../router'
import { dayRec, save } from '../store'
import { FINAL_GROUPS, INITIALS, UNITS, ZHENGTI } from '../data/pinyin'
import { PLAN_21, PLAN_DAYS, PLAN_GROUPS } from '../data/plan'

const cur = computed(() => Math.min(Math.max(save.plan.startDay, 1), PLAN_DAYS))
const checkedToday = computed(() => dayRec(cur.value).checked)
const planDone = computed(() => Object.values(save.plan.days).filter((d) => d.checked).length)

// 字母点读进度（沿用原学习进度页）
const stats = computed(() => {
  const init = INITIALS.filter((s) => save.readLetters.includes(s.py)).length
  const fin = FINAL_GROUPS.flatMap((g) => g.items).filter((s) => save.readLetters.includes(s.py)).length
  const zheng = ZHENGTI.filter((s) => save.readLetters.includes(s.py)).length
  return { init, fin, zheng }
})

// 单元测试解锁：该单元全部关卡通关
function unitLocked(u: number) {
  const r = UNITS.find((x) => x.id === u)!.range
  for (let i = r[0]; i <= r[1]; i++) if (!save.stars[i]) return false
  return true
}
function goToday() { go('today', { back: 'map' }) }
</script>

<template>
  <div class="page">
    <div class="page-head purple">
      <span class="hicon">🗺️</span>
      <div class="htext">
        <h2>闯关地图</h2>
        <p class="sub">21 天打卡拿下拼音：14 天学习 + 7 天巩固，一天一关共 21 关！</p>
      </div>
      <span class="hbadge">已打卡 {{ planDone }}/{{ PLAN_DAYS }}</span>
    </div>

    <!-- 打卡进度 + 今日打卡状态（最上面） -->
    <div class="zone purple">
      <div class="zone-head">
        <span class="zicon">🧭</span>
        <span>冒险进度</span>
        <span class="zdesc">🔥 连续 {{ save.plan.streak }} 天</span>
      </div>
      <div class="zone-body">
        <div class="row" style="justify-content: space-between;">
          <b>当前第 {{ cur }}/{{ PLAN_DAYS }} 关 · {{ PLAN_21[cur - 1].icon }} {{ PLAN_21[cur - 1].title }}</b>
          <span class="muted">已打卡 {{ planDone }}/{{ PLAN_DAYS }} 天</span>
        </div>
        <div class="bar mt"><div :style="{ width: (planDone / PLAN_DAYS * 100) + '%' }"></div></div>
        <div class="center mt">
          <button v-if="checkedToday" class="btn green" style="width: min(100%, 420px); min-height: 52px; font-size: 1.1rem;" disabled>✅ 今日任务已完成 · 明天继续加油！</button>
          <button v-else class="btn gold" style="width: min(100%, 420px); min-height: 52px; font-size: 1.15rem;" @click="goToday">📋 去完成今日任务</button>
        </div>
      </div>
    </div>

    <!-- 按阶段划分的 21 关地图 -->
    <div v-for="g in PLAN_GROUPS" :key="g.id" class="zone purple">
      <div class="zone-head">
        <span class="zicon">{{ g.icon }}</span>
        <span>{{ g.name }}</span>
        <span class="zdesc">{{ g.desc }} · 第 {{ g.range[0] }}-{{ g.range[1] }} 天</span>
      </div>
      <div class="zone-body">
        <div class="level-map">
          <div
            v-for="p in PLAN_21.filter((x) => x.day >= g.range[0] && x.day <= g.range[1])" :key="p.day"
            class="level-node day-node"
            :class="{ ok: save.plan.days[p.day]?.checked, cur: p.day === cur, future: p.day > cur }"
            @click="goToday"
          >
            <span class="level-num">{{ p.day }}</span>
            <span class="icon">{{ p.icon }}</span>
            <span class="name">{{ p.title }}</span>
            <span class="day-state">
              {{ save.plan.days[p.day]?.checked ? '✅ 已打卡' : p.day === cur ? '📍 今天' : p.review ? '🎯 巩固关' : '🔒 待完成' }}
            </span>
          </div>
        </div>
      </div>
    </div>

    <!-- 字母点读进度 -->
    <div class="zone purple">
      <div class="zone-head"><span class="zicon">🔤</span><span>字母学习进度</span><span class="zdesc">63 个拼音全覆盖</span></div>
      <div class="zone-body">
        <div class="panel">
          <div class="row" style="justify-content: space-between;"><span>声母</span><span class="muted">{{ stats.init }}/23</span></div>
          <div class="bar"><div :style="{ width: (stats.init / 23 * 100) + '%' }"></div></div>
          <div class="row mt" style="justify-content: space-between;"><span>韵母</span><span class="muted">{{ stats.fin }}/24</span></div>
          <div class="bar"><div :style="{ width: (stats.fin / 24 * 100) + '%' }"></div></div>
          <div class="row mt" style="justify-content: space-between;"><span>整体认读</span><span class="muted">{{ stats.zheng }}/16</span></div>
          <div class="bar"><div :style="{ width: (stats.zheng / 16 * 100) + '%' }"></div></div>
        </div>
      </div>
    </div>

    <!-- 单元测试成绩 -->
    <div class="zone purple">
      <div class="zone-head"><span class="zicon">📝</span><span>单元测试成绩</span><span class="zdesc">满分 100 · 通关本单元关卡后解锁</span></div>
      <div class="zone-body">
        <div class="panel">
          <div v-for="u in UNITS" :key="u.id" class="row" style="justify-content: space-between; padding: 8px 0; flex-wrap: wrap;">
            <span>{{ u.icon }} {{ u.name }}（第 {{ u.range[0] }}-{{ u.range[1] }} 关）</span>
            <span style="display: inline-flex; gap: 10px; align-items: center;">
              <b>{{ save.testScores[u.id] ? save.testScores[u.id] + ' 分' : '未测试' }}</b>
              <button class="btn small gold" :disabled="!unitLocked(u.id)" @click="go('test', { unit: u.id, back: 'map' })">
                {{ unitLocked(u.id) ? '📝 去测试' : '🔒 未解锁' }}
              </button>
            </span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
