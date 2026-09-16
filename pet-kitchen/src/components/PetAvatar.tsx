import type { BodyType, PetSpecies } from '../types'
import { SPECIES } from '../data/content'

interface Props {
  species: PetSpecies
  stage: number
  body: BodyType
  size?: number
  mood?: 'idle' | 'happy' | 'sad' | 'eat'
}

/**
 * 参数化 SVG 萌宠（6 阶段 × 3 体型）。
 * MVP 用矢量保证风格一致、零加载；后续可整批替换为 AI 生成插画（同命名规则直接换 src）。
 */
export default function PetAvatar({ species, stage, body, size = 180, mood = 'idle' }: Props) {
  const def = SPECIES.find((s) => s.id === species) ?? SPECIES[0]
  const s = Math.min(6, Math.max(1, stage))
  const wRatio = body === 'thin' ? 0.82 : body === 'fat' ? 1.24 : 1
  const hRatio = body === 'thin' ? 0.94 : body === 'fat' ? 0.96 : 1

  const bw = (58 + s * 7) * wRatio
  const bh = (52 + s * 6.5) * hRatio
  const cx = 100
  const cy = 118
  const headR = (30 + s * 2.6) * (body === 'fat' ? 1.06 : body === 'thin' ? 0.94 : 1)
  const headY = cy - bh * 0.42
  const hornLen = 10 + s * 4
  const eyeY = headY + 2
  const eyeDx = headR * 0.42
  const eyeR = 4.6 + s * 0.25
  const blush = s >= 2

  const gid = `g_${species}_${s}_${body}`

  return (
    <svg width={size} height={size} viewBox="0 0 200 200" role="img" aria-label="宠物">
      <defs>
        <radialGradient id={gid} cx="38%" cy="30%" r="78%">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="55%" stopColor={def.c2} />
          <stop offset="100%" stopColor={def.accent} stopOpacity="0.55" />
        </radialGradient>
        <linearGradient id={`${gid}_h`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="100%" stopColor={def.accent} />
        </linearGradient>
      </defs>

      {/* 影子 */}
      <ellipse cx={cx} cy={cy + bh * 0.62} rx={bw * 0.72} ry={7} fill="#2f3b4c" opacity="0.10" />

      {/* 神兽光环（5 阶起） */}
      {s >= 5 && (
        <circle
          cx={cx}
          cy={cy}
          r={bw * 0.92}
          fill="none"
          stroke={def.accent}
          strokeWidth="2"
          strokeDasharray="5 9"
          opacity="0.5"
        >
          <animateTransform attributeName="transform" type="rotate" from={`0 ${cx} ${cy}`} to={`360 ${cx} ${cy}`} dur="14s" repeatCount="indefinite" />
        </circle>
      )}

      {/* 尾巴（2 阶起） */}
      {s >= 2 && (
        <path
          d={`M ${cx + bw * 0.72} ${cy + bh * 0.18} q ${18 + s * 3} ${-14 - s * 2} ${6 + s} ${-30 - s * 2}`}
          stroke={def.c2}
          strokeWidth={8 + s}
          strokeLinecap="round"
          fill="none"
        />
      )}

      {/* 身体 */}
      <ellipse cx={cx} cy={cy} rx={bw / 2} ry={bh / 2} fill={`url(#${gid})`} stroke={def.accent} strokeOpacity="0.45" strokeWidth="2" />

      {/* 肚皮 */}
      <ellipse cx={cx} cy={cy + bh * 0.16} rx={bw * 0.3} ry={bh * 0.28} fill="#ffffff" opacity="0.65" />

      {/* 前爪 */}
      <ellipse cx={cx - bw * 0.26} cy={cy + bh * 0.42} rx={bw * 0.14} ry={bh * 0.1} fill={def.c1} stroke={def.accent} strokeOpacity="0.3" />
      <ellipse cx={cx + bw * 0.26} cy={cy + bh * 0.42} rx={bw * 0.14} ry={bh * 0.1} fill={def.c1} stroke={def.accent} strokeOpacity="0.3" />

      {/* 头 */}
      <circle cx={cx} cy={headY} r={headR} fill={`url(#${gid}_h)`} stroke={def.accent} strokeOpacity="0.45" strokeWidth="2" />

      {/* 角：1 阶单角，3 阶起双角，5 阶起更大 */}
      <g fill={def.accent}>
        <path d={`M ${cx} ${headY - headR + 2} q ${-5} ${-hornLen} ${-2 - s * 0.4} ${-hornLen - 4} q ${7} ${hornLen * 0.5} ${7} ${hornLen + 4} z`} />
        {s >= 3 && (
          <path d={`M ${cx + 12} ${headY - headR + 6} q ${10} ${-hornLen * 0.8} ${12 + s * 0.4} ${-hornLen * 0.9} q ${-8} ${hornLen * 0.5} ${-6} ${hornLen * 0.95} z`} opacity="0.9" />
        )}
      </g>

      {/* 额间第三只眼（白泽特征，4 阶起） */}
      {s >= 4 && (
        <g>
          <ellipse cx={cx} cy={headY - headR * 0.42} rx="6" ry="4.4" fill="#fff" stroke={def.accent} strokeWidth="1.4" />
          <circle cx={cx} cy={headY - headR * 0.42} r="2" fill="#2f3b4c" />
        </g>
      )}

      {/* 眼睛 */}
      {mood === 'sad' ? (
        <>
          <path d={`M ${cx - eyeDx - 5} ${eyeY + 3} q 5 -6 10 0`} stroke="#2f3b4c" strokeWidth="2.6" fill="none" strokeLinecap="round" />
          <path d={`M ${cx + eyeDx - 5} ${eyeY + 3} q 5 -6 10 0`} stroke="#2f3b4c" strokeWidth="2.6" fill="none" strokeLinecap="round" />
        </>
      ) : mood === 'happy' ? (
        <>
          <path d={`M ${cx - eyeDx - 5} ${eyeY + 2} q 5 -7 10 0`} stroke="#2f3b4c" strokeWidth="2.8" fill="none" strokeLinecap="round" />
          <path d={`M ${cx + eyeDx - 5} ${eyeY + 2} q 5 -7 10 0`} stroke="#2f3b4c" strokeWidth="2.8" fill="none" strokeLinecap="round" />
        </>
      ) : (
        <>
          <circle cx={cx - eyeDx} cy={eyeY} r={eyeR} fill="#2f3b4c" />
          <circle cx={cx + eyeDx} cy={eyeY} r={eyeR} fill="#2f3b4c" />
          <circle cx={cx - eyeDx + 1.6} cy={eyeY - 1.6} r={eyeR * 0.34} fill="#fff" />
          <circle cx={cx + eyeDx + 1.6} cy={eyeY - 1.6} r={eyeR * 0.34} fill="#fff" />
        </>
      )}

      {/* 腮红 */}
      {blush && (
        <>
          <ellipse cx={cx - eyeDx - 6} cy={eyeY + 9} rx="6" ry="3.6" fill="#ff9db1" opacity="0.55" />
          <ellipse cx={cx + eyeDx + 6} cy={eyeY + 9} rx="6" ry="3.6" fill="#ff9db1" opacity="0.55" />
        </>
      )}

      {/* 嘴 */}
      {mood === 'eat' ? (
        <ellipse cx={cx} cy={eyeY + 13} rx="6" ry="5" fill="#c05070" />
      ) : (
        <path
          d={`M ${cx - 4} ${eyeY + 11} q 4 ${mood === 'sad' ? -4 : 5} 8 0`}
          stroke="#2f3b4c"
          strokeWidth="2.2"
          fill="none"
          strokeLinecap="round"
        />
      )}

      {/* 云纹（6 阶，神兽） */}
      {s >= 6 && (
        <g opacity="0.75">
          <path d={`M ${cx - bw * 0.5} ${cy + bh * 0.05} q -12 -6 -4 -12 q -8 -8 4 -10`} stroke={def.accent} strokeWidth="2.6" fill="none" strokeLinecap="round" />
          <path d={`M ${cx + bw * 0.5} ${cy + bh * 0.05} q 12 -6 4 -12 q 8 -8 -4 -10`} stroke={def.accent} strokeWidth="2.6" fill="none" strokeLinecap="round" />
        </g>
      )}
    </svg>
  )
}
