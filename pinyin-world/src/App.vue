<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { go, route } from './router'
import { refreshBadges, save } from './store'
import { showToast, toast } from './toast'
import Home from './views/Home.vue'
import Alphabet from './views/Alphabet.vue'
import Lesson from './views/Lesson.vue'
import Spell from './views/Spell.vue'
import ListenQuiz from './views/ListenQuiz.vue'
import CharQuiz from './views/CharQuiz.vue'
import BlendGame from './views/BlendGame.vue'
import FollowRead from './views/FollowRead.vue'
import MixedQuiz from './views/MixedQuiz.vue'
import MapView from './views/MapView.vue'
import LevelPlay from './views/LevelPlay.vue'
import UnitTest from './views/UnitTest.vue'
import WrongBook from './views/WrongBook.vue'
import Rewards from './views/Rewards.vue'
import Settings from './views/Settings.vue'
import TodayTask from './views/TodayTask.vue'

const VIEWS: Record<string, any> = {
  home: Home, alphabet: Alphabet, lesson: Lesson, spell: Spell,
  mixed: MixedQuiz, listen: ListenQuiz, char: CharQuiz, blend: BlendGame, follow: FollowRead,
  map: MapView, levelplay: LevelPlay, test: UnitTest,
  wrong: WrongBook, rewards: Rewards, settings: Settings,
  today: TodayTask,
}
const TITLES: Record<string, string> = {
  home: '拼音方块世界', alphabet: '拼音字母表', lesson: '学习讲堂', spell: '拼读演示',
  mixed: '综合挑战', listen: '听力挑战', char: '识字挑战', blend: '拼装工坊', follow: '发音擂台',
  map: '闯关地图', levelplay: '闯关', test: '单元测试',
  wrong: '错题本', rewards: '我的奖励', settings: '设置',
  today: '今日任务',
}
const view = computed(() => VIEWS[route.page] || Home)
const title = computed(() => TITLES[route.page] || '拼音方块世界')
const canBack = computed(() => route.page !== 'home')
const fullscreen = ref(false)
function toggleFullscreen() {
  const action = document.fullscreenElement ? document.exitFullscreen?.() : document.documentElement.requestFullscreen?.()
  Promise.resolve(action).finally(() => { fullscreen.value = !!document.fullscreenElement })
}
function goBack() {
  // 从哪来回哪去：优先使用进入页面时携带的 back 参数
  if (route.params.back) { go(route.params.back); return }
  if (route.page === 'levelplay') go('today')
  else if (route.page === 'test') go('map')
  else go('home')
}

// 徽章自动刷新与获得提示
watch(save, () => {
  const newly = refreshBadges()
  if (newly.length) showToast(`🏆 获得徽章：${newly.join('、')}`)
}, { deep: true })
</script>

<template>
  <header class="topbar">
    <button v-if="canBack" class="btn small gray" @click="goBack">◀ 返回</button>
    <span class="title">{{ title }}</span>
    <span class="gem-chip">💎 {{ save.gems }}</span>
    <button class="btn small gray top-fullscreen" :title="fullscreen ? '退出全屏' : '全屏'" @click="toggleFullscreen">⛶</button>
    <button class="btn small gray top-gear" title="设置" @click="go('settings')">⚙</button>
  </header>

  <component :is="view" />

  <transition name="fade">
    <div v-if="toast.visible" class="toast">{{ toast.msg }}</div>
  </transition>
</template>
