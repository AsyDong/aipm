import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// PWA：安卓 Chrome「安装应用」/ iOS Safari「添加到主屏幕」，装完有图标、全屏、
// 离线启动（workbox 预缓存构建产物）。业务数据本就离线优先 + 同步队列，
// SW 只补「应用外壳」这层，域名打不开时娃也进得了家。
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icons/apple-touch-icon.png'],
      manifest: {
        lang: 'zh-CN',
        name: '萌宠打卡',
        short_name: '萌宠打卡',
        description: '打卡得食物喂养萌宠，闯关得积分兑换现实奖品。',
        theme_color: '#7FD1E8',
        background_color: '#FFFFFF',
        display: 'standalone',
        orientation: 'portrait',
        start_url: './',
        scope: './',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
        ],
      },
    }),
  ],
  base: './',
  server: { port: 5173 },
})
