// ============ 金币（SVG 组件） ============
//
// 为什么不用 🪙 emoji：macOS 下它渲染成银色硬币（Apple 的 coin 字符就是银色设计），
// 与「金币」的语义和整体暖色 UI 都不搭，且各端观感不一致。
// SVG 在所有平台像素级一致，还能随意改尺寸、做掉落动画。

export default function Coin({ size = 20, className = '' }: { size?: number; className?: string }) {
  return (
    <svg
      viewBox="0 0 64 64"
      width={size}
      height={size}
      className={`inline-block ${className}`}
      role="img"
      aria-label="金币"
    >
      <defs>
        <linearGradient id="coin-gold" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#FFDF60" />
          <stop offset="1" stopColor="#F5B50F" />
        </linearGradient>
      </defs>
      {/* 外缘（深金）+ 币面（亮金渐变）+ 内圈压痕 */}
      <circle cx="32" cy="32" r="30" fill="#DB9A06" />
      <circle cx="32" cy="32" r="26" fill="url(#coin-gold)" />
      <circle cx="32" cy="32" r="19.5" fill="none" stroke="#DB9A06" strokeWidth="2.5" opacity="0.55" />
      {/* 币面五角星浮雕 */}
      <path
        d="M32 17.5l4.4 8.9 9.8 1.4-7.1 6.9 1.7 9.7L32 39.8l-8.8 4.6 1.7-9.7-7.1-6.9 9.8-1.4z"
        fill="#C77F00"
        opacity="0.85"
      />
      {/* 左上高光 */}
      <ellipse cx="22" cy="18" rx="8" ry="4.5" fill="#FFFFFF" opacity="0.35" transform="rotate(-35 22 18)" />
    </svg>
  )
}
