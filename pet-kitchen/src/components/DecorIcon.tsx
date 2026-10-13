import type { ReactNode } from 'react'

/**
 * 家园装饰图标（ART-03）。
 *
 * 为什么用 SVG 而不是 AI 立绘：
 *   装饰在场景里只有 34–44px，缩小后矢量轮廓比位图干净得多、体量也小得多
 *   （一整套不到 4KB，不用占一张网络请求）。立绘留给大尺寸的宠物（见 PetAvatar）。
 * 风格对齐「糖果祥瑞」：马卡龙配色 + 深色描边 + 圆角，和宠物立绘放一起不违和。
 *
 * 每个图形只用基础形状（circle / rect / polygon / 简单 arc）拼，
 * 不用复杂贝塞尔 —— 保证任何尺寸下都不糊、不走形。
 */

const INK = '#2f3b4c'

const ART: Record<string, ReactNode> = {
  /* 小木屋 */
  hut: (
    <>
      <ellipse cx="20" cy="34" rx="12" ry="2.4" fill={INK} opacity="0.08" />
      <path d="M20 6 L34 18 H6 Z" fill="#ff9a9e" stroke={INK} strokeWidth="1.6" strokeLinejoin="round" />
      <rect x="10" y="18" width="20" height="14" rx="2" fill="#ffd9a0" stroke={INK} strokeWidth="1.6" />
      <rect x="16.5" y="23" width="7" height="9" rx="1.5" fill="#c98a5a" stroke={INK} strokeWidth="1.3" />
      <circle cx="21.6" cy="27.6" r="0.9" fill={INK} />
    </>
  ),

  /* 摇摇树 */
  tree: (
    <>
      <ellipse cx="20" cy="34" rx="10" ry="2.2" fill={INK} opacity="0.08" />
      <rect x="18" y="21" width="4" height="12" rx="1.6" fill="#c98a5a" stroke={INK} strokeWidth="1.4" />
      <circle cx="13.5" cy="19" r="6.2" fill="#a7e0ab" stroke={INK} strokeWidth="1.5" />
      <circle cx="26.5" cy="19" r="6.2" fill="#a7e0ab" stroke={INK} strokeWidth="1.5" />
      <circle cx="20" cy="13" r="7.6" fill="#bff0c2" stroke={INK} strokeWidth="1.5" />
    </>
  ),

  /* 云朵灯 */
  lamp: (
    <>
      <line x1="20" y1="4" x2="20" y2="11" stroke={INK} strokeWidth="1.4" strokeLinecap="round" />
      <circle cx="13" cy="19" r="5.4" fill="#ffe9a8" stroke={INK} strokeWidth="1.5" />
      <circle cx="27" cy="19" r="5.4" fill="#ffe9a8" stroke={INK} strokeWidth="1.5" />
      <circle cx="20" cy="15" r="6.6" fill="#fff5cc" stroke={INK} strokeWidth="1.5" />
      <rect x="11.5" y="18.5" width="17" height="6.5" rx="3.2" fill="#fff5cc" />
      <path d="M14 22.5 h12" stroke={INK} strokeWidth="1.2" strokeLinecap="round" opacity="0.35" />
    </>
  ),

  /* 小池塘 */
  pond: (
    <>
      <ellipse cx="20" cy="22" rx="15" ry="9" fill="#8ecbf5" stroke={INK} strokeWidth="1.6" />
      <ellipse cx="20" cy="22" rx="15" ry="9" fill="#ffffff" opacity="0.18" />
      <ellipse cx="15" cy="19" rx="3.4" ry="1.7" fill="#ffffff" opacity="0.55" />
      <ellipse cx="24" cy="25" rx="4.6" ry="1.9" fill="none" stroke="#ffffff" strokeWidth="1.2" opacity="0.6" />
      <circle cx="27" cy="18" r="1.8" fill="#9be6a6" stroke={INK} strokeWidth="1.1" />
    </>
  ),

  /* 彩虹桥 */
  bridge: (
    <>
      <g fill="none" strokeLinecap="round">
        <path d="M5 30 A15 15 0 0 1 35 30" stroke="#ff9a9e" strokeWidth="3.2" />
        <path d="M9 30 A11 11 0 0 1 31 30" stroke="#ffc46b" strokeWidth="3.2" />
        <path d="M13 30 A7 7 0 0 1 27 30" stroke="#ffe66b" strokeWidth="3.2" />
      </g>
      <rect x="3" y="29.6" width="34" height="3.4" rx="1.7" fill="#cfe9ff" stroke={INK} strokeWidth="1.3" />
    </>
  ),

  /* 星辰毯 */
  carpet: (
    <>
      <rect x="4" y="11" width="32" height="20" rx="4" fill="#b9a6f0" stroke={INK} strokeWidth="1.6" />
      <rect x="7.5" y="14.5" width="25" height="13" rx="2.6" fill="#cbbcf7" />
      <g fill="#fff8d6">
        <path d="M14 17 L15.2 20.2 L18.5 21 L15.2 21.8 L14 25 L12.8 21.8 L9.5 21 L12.8 20.2 Z" />
        <path d="M26 19 L26.9 21.4 L29.3 22 L26.9 22.6 L26 25 L25.1 22.6 L22.7 22 L25.1 21.4 Z" />
      </g>
      <circle cx="20" cy="22" r="1.3" fill="#fff8d6" />
    </>
  ),

  /* 石灯笼 */
  lantern: (
    <>
      <ellipse cx="20" cy="34" rx="9" ry="2.2" fill={INK} opacity="0.08" />
      <path d="M13 12 H27 L24 8 H16 Z" fill="#b9c6d4" stroke={INK} strokeWidth="1.5" strokeLinejoin="round" />
      <rect x="14" y="12" width="12" height="9" rx="1.6" fill="#eae3d2" stroke={INK} strokeWidth="1.5" />
      <circle cx="20" cy="16.5" r="2.6" fill="#ffd97d" stroke={INK} strokeWidth="1.2" />
      <rect x="15" y="21" width="10" height="3" rx="1.2" fill="#b9c6d4" stroke={INK} strokeWidth="1.3" />
      <rect x="16.5" y="24" width="7" height="8" rx="1.4" fill="#d5dde6" stroke={INK} strokeWidth="1.4" />
    </>
  ),

  /* 秋千 */
  swing: (
    <>
      <ellipse cx="20" cy="34" rx="12" ry="2.2" fill={INK} opacity="0.08" />
      <path d="M8 33 L16 9 L24 9 L32 33" stroke="#c98a5a" strokeWidth="3" strokeLinecap="round" fill="none" />
      <rect x="15" y="7.5" width="10" height="3" rx="1.5" fill="#c98a5a" stroke={INK} strokeWidth="1.2" />
      <line x1="17" y1="10.5" x2="17" y2="22" stroke={INK} strokeWidth="1.2" opacity="0.6" />
      <line x1="23" y1="10.5" x2="23" y2="22" stroke={INK} strokeWidth="1.2" opacity="0.6" />
      <rect x="14" y="21.5" width="12" height="3.6" rx="1.8" fill="#ffc46b" stroke={INK} strokeWidth="1.3" />
    </>
  ),
}

interface Props {
  id: string
  size?: number
}

/** 按商品 id 渲染装饰图标；未知 id 给一个中性占位（不空白、不报错） */
export default function DecorIcon({ id, size = 40 }: Props) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 40 40"
      aria-hidden="true"
      style={{ display: 'block' }}
    >
      {ART[id] ?? (
        <circle cx="20" cy="20" r="9" fill="#dbe7f3" stroke={INK} strokeWidth="1.6" />
      )}
    </svg>
  )
}
