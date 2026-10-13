import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import { useStore } from './store/useStore'
import { useNav } from './store/nav'
import { configureProvider, providerConfig, providerStats } from './engine/provider'
import {
  configureSync, dropQueue, flushSync, pendingCount, syncConfig, syncStats,
} from './store/sync'
import './index.css'

// 后端地址：配了 VITE_API_BASE_URL 才走远端出题/批改，留空即纯本地模式。
// VITE_PREFER_REMOTE=0 可强制走本地出题（零延迟、零成本），此时仍能用
// VITE_SYNC_URL 单独开同步 —— 出题与同步是两件事，不该被同一个地址绑死。
const apiBaseUrl = (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? ''
const preferRemote = (import.meta.env.VITE_PREFER_REMOTE as string | undefined) !== '0'
if (apiBaseUrl && preferRemote) configureProvider({ apiBaseUrl, preferRemote: true })

// 数据同步：地址与令牌**两个都要有**才开启。
// 缺任一个 → 同步整体关闭，一行不写、一个请求不发，行为与接线前完全一致。
// 地址优先取 VITE_SYNC_URL（同域部署时填域名，走 nginx 反代），没填则复用 apiBaseUrl。
// 注意 VITE_ 变量会被打进 bundle，这个令牌等同于「半公开」的写入凭证：
// 它只用于 /api/sync（只写），/api/report（可读全量数据）刻意不开放给前端。
const syncToken = (import.meta.env.VITE_SYNC_TOKEN as string | undefined) ?? ''
const syncUrl = (import.meta.env.VITE_SYNC_URL as string | undefined) ?? apiBaseUrl
if (syncUrl && syncToken) configureSync({ apiBaseUrl: syncUrl, token: syncToken })

// 开发期调试入口：控制台可用 __pet.getState() / __nav.getState() 查看与驱动状态
if (import.meta.env.DEV) {
  const w = window as unknown as Record<string, unknown>
  w.__pet = useStore
  w.__nav = useNav
  w.__provider = { configure: configureProvider, config: providerConfig, stats: providerStats }
  w.__sync = {
    configure: configureSync,
    config: syncConfig,
    stats: syncStats,
    flush: flushSync,
    pending: pendingCount,
    drop: dropQueue,
  }
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
