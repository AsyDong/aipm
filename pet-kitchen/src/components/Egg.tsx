interface Props {
  c1: string
  c2: string
  accent: string
  size?: number
  locked?: boolean
  shake?: boolean
}

export default function Egg({ c1, c2, accent, size = 110, locked, shake }: Props) {
  return (
    <svg width={size} height={size * 1.2} viewBox="0 0 100 120" className={shake ? 'animate-shake' : ''}>
      <defs>
        <radialGradient id={`e_${accent}`} cx="38%" cy="28%" r="80%">
          <stop offset="0%" stopColor={c1} />
          <stop offset="70%" stopColor={c2} />
          <stop offset="100%" stopColor={accent} stopOpacity="0.7" />
        </radialGradient>
      </defs>
      <ellipse cx="50" cy="108" rx="26" ry="6" fill="#2f3b4c" opacity="0.10" />
      <path
        d="M50 6 C 76 6, 88 40, 88 66 C 88 92, 71 110, 50 110 C 29 110, 12 92, 12 66 C 12 40, 24 6, 50 6 Z"
        fill={locked ? '#E6EAF0' : `url(#e_${accent})`}
        stroke={locked ? '#C9D2DE' : accent}
        strokeOpacity="0.5"
        strokeWidth="2.5"
      />
      {!locked && (
        <>
          <ellipse cx="36" cy="44" rx="9" ry="12" fill="#fff" opacity="0.55" transform="rotate(-18 36 44)" />
          <path d="M26 62 q 10 8 20 0" stroke={accent} strokeOpacity="0.55" strokeWidth="3" fill="none" strokeLinecap="round" />
          <path d="M56 58 q 10 8 20 0" stroke={accent} strokeOpacity="0.55" strokeWidth="3" fill="none" strokeLinecap="round" />
          <circle cx="62" cy="84" r="4" fill={accent} opacity="0.45" />
          <circle cx="38" cy="92" r="3" fill={accent} opacity="0.35" />
        </>
      )}
      {locked && <text x="50" y="70" textAnchor="middle" fontSize="26">🔒</text>}
    </svg>
  )
}
