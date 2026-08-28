<script setup lang="ts">
import { computed } from 'vue'
import { go } from '../router'
import { PLAN_21, PLAN_DAYS, newDoneOf, reviewsForDay } from '../data/plan'
import { checkInToday, dayRec, save, setNewDone, setWrongDone, toggleReview } from '../store'
import { speak } from '../audio'
import { showToast } from '../toast'

const day = computed(() => Math.min(Math.max(save.plan.startDay, 1), PLAN_DAYS))
const plan = computed(() => PLAN_21[day.value - 1])
const rec = computed(() => dayRec(day.value))
const reviews = computed(() => reviewsForDay(day.value).map((p) => ({ ...p, done: rec.value.reviewsDone.includes(p.day) })))
const newDone = computed(() => rec.value.newDone || newDoneOf(plan.value))
const wrongDone = computed(() => rec.value.wrongDone || save.wrongs.length === 0)
const taskCount = computed(() => 1 + reviews.value.length + 1)
const taskDone = computed(() => (newDone.value ? 1 : 0) + reviews.value.filter((r) => r.done).length + (wrongDone.value ? 1 : 0))
const allDone = computed(() => taskDone.value >= taskCount.value)
const progress = computed(() => (taskCount.value ? Math.round((taskDone.value / taskCount.value) * 100) : 0))

function checkIn() {
  if (!allDone.value) { showToast(`还剩 ${taskCount.value - taskDone.value} 项任务没完成`); return }
  if (checkInToday()) showToast('🎉 打卡成功！+5 💎')
  else showToast('今天已经打过卡啦')
}
function markNew() { setNewDone(day.value, true) }
function markWrong() { setWrongDone(day.value, true) }
function toggleReviewDay(d: number) { toggleReview(day.value, d) }
function changeDay(n: number) {
  save.plan.startDay = Math.min(Math.max(n, 1), PLAN_DAYS)
}
function onDayChange(e: Event) {
  changeDay(+(e.target as HTMLSelectElement).value)
}
</script>

<template>
  <div class="page">
    <div class="page-head gold">
      <span class="hicon">📋</span>
      <div class="htext">
        <h2>今日任务</h2>
        <p class="sub">第 {{ day }}/{{ PLAN_DAYS }} 天 · {{ plan.title }} · 学完新知识，再按遗忘曲线复习旧知识</p>
      </div>
      <span class="hbadge">{{ rec.checked ? '✅ 已打卡' : `🔥 连续 ${save.plan.streak} 天` }}</span>
    </div>

    <!-- 打卡总进度 -->
    <div class="zone gold">
      <div class="zone-head">
        <span class="zicon">⛏️</span>
        <span>今日打卡进度</span>
        <span class="zdesc">{{ taskDone }}/{{ taskCount }} 项完成</span>
      </div>
      <div class="zone-body">
        <div class="row" style="justify-content: space-between;">
          <b>第 {{ day }} 天 · {{ plan.icon }} {{ plan.title }}</b>
          <span class="muted">🔥 连续打卡 {{ save.plan.streak }} 天</span>
        </div>
        <div class="bar mt"><div :style="{ width: progress + '%' }"></div></div>
        <p class="muted mt">全部完成就能打卡，每天 +5 💎！</p>
      </div>
    </div>

    <!-- 新知识 -->
    <div class="zone gold">
      <div class="zone-head">
        <span class="zicon">📚</span>
        <span>新知识 · 今天学</span>
        <span class="zdesc">{{ newDone ? '✅ 已完成' : plan.levelIds.length ? '去点读 + 闯关' : '点读字母 + 玩小游戏' }}</span>
      </div>
      <div class="zone-body">
        <div class="task-item" :class="{ done: newDone }">
          <div class="task-check" :class="{ on: newDone }">✓</div>
          <div class="task-main">
            <b>{{ plan.icon }} {{ plan.title }}</b>
            <p class="muted">{{ plan.desc }} <span v-if="plan.ruleHint">（规则：{{ plan.ruleHint }}）</span></p>
            <div class="chip-row" style="margin-top: 6px;">
              <template v-if="plan.letters.length">
                <span v-for="p in plan.letters" :key="p" class="chip" @click="speak(p)">{{ p }} 🔊</span>
              </template>
              <template v-else>
                <span class="chip gold">🎯 巩固日 · 不学新字母</span>
              </template>
            </div>
          </div>
          <div class="task-actions">
            <button v-if="plan.levelIds.length" class="btn small blue" @click="go('levelplay', { id: plan.levelIds[0], back: 'today' })">
              🏰 闯关{{ plan.levelIds.length > 1 ? `（${plan.levelIds.length}关）` : '' }}
            </button>
            <button v-else class="btn small gray" disabled title="第 1 关明天解锁">🗺️ 第 1 关明日解锁</button>
            <button class="btn small blue" @click="go('alphabet', { back: 'today' })">🔤 字母表</button>
            <button v-for="g in plan.games" :key="g.id" class="btn small gold" @click="go(g.id, { back: 'today', scope: 'focus' })">{{ g.icon }} {{ g.label }}</button>
            <button v-if="!newDone" class="btn small gray" @click="markNew">✓ 标记完成</button>
          </div>
        </div>
      </div>
    </div>

    <!-- 遗忘曲线复习 -->
    <div class="zone gold">
      <div class="zone-head">
        <span class="zicon">🔁</span>
        <span>遗忘曲线复习 · 巩固旧知识</span>
        <span class="zdesc">{{ reviews.filter((r) => r.done).length }}/{{ reviews.length }} 完成</span>
      </div>
      <div class="zone-body">
        <p v-if="!reviews.length" class="muted">今天没有到期的复习，专心学新知识吧！</p>
        <div v-for="r in reviews" :key="r.day" class="task-item" :class="{ done: r.done }">
          <div class="task-check" :class="{ on: r.done }" @click="toggleReviewDay(r.day)">✓</div>
          <div class="task-main">
            <b>{{ r.icon }} 第 {{ r.day }} 天 · {{ r.title }}</b>
            <p class="muted">按遗忘曲线今天该复习啦，读一读、闯一闯记得更牢！</p>
          </div>
          <div class="task-actions">
            <button class="btn small blue" @click="go('alphabet', { back: 'today' })">🔤 读一读</button>
            <button v-if="r.levelIds.length" class="btn small green" @click="go('levelplay', { id: r.levelIds[0], back: 'today' })">🎯 重玩关卡</button>
          </div>
        </div>
      </div>
    </div>

    <!-- 错题巩固 -->
    <div class="zone gold">
      <div class="zone-head">
        <span class="zicon">📖</span>
        <span>错题巩固</span>
        <span class="zdesc">{{ save.wrongs.length ? save.wrongs.length + ' 道待消灭' : '✅ 没有错题' }}</span>
      </div>
      <div class="zone-body">
        <div class="task-item" :class="{ done: wrongDone }">
          <div class="task-check" :class="{ on: wrongDone }">✓</div>
          <div class="task-main">
            <b>{{ save.wrongs.length ? `把做错的 ${save.wrongs.length} 道题再练一遍` : '错题本已经清空啦' }}</b>
            <p class="muted">错过的题再练一次，保证下次不再错！</p>
          </div>
          <div class="task-actions">
            <button class="btn small red" :disabled="!save.wrongs.length" @click="go('wrong', { back: 'today' })">📖 去错题本</button>
            <button v-if="!wrongDone" class="btn small gray" @click="markWrong">✓ 标记完成</button>
          </div>
        </div>
      </div>
    </div>

    <!-- 打卡按钮 -->
    <div class="center mt">
      <button class="btn gold big-check" :class="{ ready: allDone }" @click="checkIn">
        {{ rec.checked ? '✅ 今天已经打过卡啦' : allDone ? '🎉 完成今日打卡 +5💎' : `⛏️ 还差 ${taskCount - taskDone} 项任务` }}
      </button>
    </div>

    <!-- 计划控制（家长/老师用） -->
    <div class="zone gray">
      <div class="zone-head">
        <span class="zicon">📅</span>
        <span>计划控制</span>
        <span class="zdesc">家长/老师可手动切换天数</span>
      </div>
      <div class="zone-body">
        <div class="row" style="justify-content: center;">
          <button class="btn small gray" @click="changeDay(day - 1)" :disabled="day <= 1">◀ 前一天</button>
          <select class="day-select" :value="day" @change="onDayChange">
            <option v-for="i in PLAN_DAYS" :key="i" :value="i">第 {{ i }} 天：{{ PLAN_21[i - 1].title }}</option>
          </select>
          <button class="btn small gray" @click="changeDay(day + 1)" :disabled="day >= PLAN_DAYS">后一天 ▶</button>
        </div>
        <p class="muted center mt">建议按顺序每天完成一天：前 14 天学完新知识，后 7 天巩固复习，第 {{ PLAN_DAYS }} 天毕业典礼后即「拼音毕业」🎓</p>
      </div>
    </div>
  </div>
</template>
