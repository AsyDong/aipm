import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import { useStore } from './store/useStore'
import { useNav } from './store/nav'
import { configureProvider, providerConfig, providerStats } from './engine/provider'
import './index.css'

// 后端地址：配了 VITE_API_BASE_URL 才走远端出题/批改，留空即纯本地模式
const apiBaseUrl = (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? ''
if (apiBaseUrl) configureProvider({ apiBaseUrl, preferRemote: true })

// 开发期调试入口：控制台可用 __pet.getState() / __nav.getState() 查看与驱动状态
if (import.meta.env.DEV) {
  const w = window as unknown as Record<string, unknown>
  w.__pet = useStore
  w.__nav = useNav
  w.__provider = { configure: configureProvider, config: providerConfig, stats: providerStats }
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
