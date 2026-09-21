<script setup lang="ts">
import { asrSupported, recSupported, ttsSupported } from '../audio'
import { resetAll, save } from '../store'
import { showToast } from '../toast'

function doReset() {
  if (confirm('确定要清空所有学习进度吗？此操作不可恢复！')) {
    resetAll()
    showToast('已清空全部进度')
  }
}
</script>

<template>
  <div class="page">
    <div class="page-head gray">
      <span class="hicon">⚙️</span>
      <div class="htext">
        <h2>设置</h2>
        <p class="sub">调整发音、查看能力、管理数据。</p>
      </div>
    </div>

    <div class="zone gray">
      <div class="zone-head"><span class="zicon">🔊</span><span>发音</span><span class="zdesc">语速与能力检测</span></div>
      <div class="zone-body">
        <div class="panel">
          <div class="setting-row">
            <span>🔊 发音语速</span>
            <input type="range" min="0.5" max="1.5" step="0.05" v-model.number="save.settings.rate" />
            <b>{{ Math.round(save.settings.rate * 100) }}%</b>
          </div>
          <div class="setting-row">
            <span>🔉 发音音量</span>
            <input type="range" min="0" max="1" step="0.05" v-model.number="save.settings.volume" />
            <b>{{ Math.round(save.settings.volume * 100) }}%</b>
          </div>
          <div class="setting-row">
            <span>✨ 交互音效</span>
            <button class="btn small" :class="save.settings.effects ? 'green' : 'gray'" @click="save.settings.effects = !save.settings.effects">
              {{ save.settings.effects ? '已开启' : '已关闭' }}
            </button>
          </div>
          <div class="setting-row">
            <span>🗣️ 标准发音（TTS）</span>
            <b>{{ ttsSupported ? '✅ 可用' : '⚠️ 浏览器不支持' }}</b>
          </div>
          <div class="setting-row">
            <span>🎤 语音识别评分</span>
            <b>{{ asrSupported ? '✅ 可用' : '⚠️ 不支持（可用录音回放）' }}</b>
          </div>
          <div class="setting-row">
            <span>🎙️ 录音回放</span>
            <b>{{ recSupported ? '✅ 可用' : '⚠️ 不支持' }}</b>
          </div>
        </div>
      </div>
    </div>

    <div class="zone gray">
      <div class="zone-head"><span class="zicon">🗄️</span><span>数据</span><span class="zdesc">本地保存不上传</span></div>
      <div class="zone-body">
        <div class="panel">
          <p class="muted">学习进度保存在当前设备的浏览器里，不会上传到网络。清除浏览器数据会丢失进度。</p>
          <button class="btn red mt" @click="doReset">🗑️ 清空所有进度</button>
        </div>
      </div>
    </div>

    <div class="zone gray">
      <div class="zone-head"><span class="zicon">ℹ️</span><span>关于</span><span class="zdesc">版本信息</span></div>
      <div class="zone-body">
        <div class="panel">
          <p><b>拼音方块世界</b> v0.2（分块视觉升级）</p>
          <p class="muted">
            一年级拼音学习工作台 · 无账号 · 纯本地存储<br />
            内容按人教版一年级上册拼音单元顺序编排
          </p>
        </div>
      </div>
    </div>
  </div>
</template>
