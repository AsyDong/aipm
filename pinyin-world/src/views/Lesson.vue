<script setup lang="ts">
import { RULE_SECTIONS } from '../data/rules'
import { speak } from '../audio'
</script>

<template>
  <div class="page">
    <div class="page-head blue">
      <span class="hicon">📚</span>
      <div class="htext">
        <h2>学习讲堂</h2>
        <p class="sub">点开每一课，把拼音规则读一读；绿色小标签可以点读发音。</p>
      </div>
      <span class="hbadge">{{ RULE_SECTIONS.length }} 课</span>
    </div>

    <div class="zone blue">
      <div class="zone-head"><span class="zicon">📖</span><span>拼音规则分类</span><span class="zdesc">点击展开</span></div>
      <div class="zone-body">
        <details v-for="(sec, i) in RULE_SECTIONS" :key="i" class="lesson-item" :open="i === 0">
          <summary>{{ sec.icon }} {{ sec.title }}</summary>
          <div class="body">
            <p v-for="(p, j) in sec.paragraphs" :key="j" v-html="p"></p>
            <div v-if="sec.chips.length" class="chip-row">
              <span v-for="c in sec.chips" :key="c.py" class="chip" @click="speak(c.zh || c.py)">
                {{ c.py }} <span v-if="c.zh">({{ c.zh }})</span> 🔊
              </span>
            </div>
          </div>
        </details>
      </div>
    </div>
  </div>
</template>
