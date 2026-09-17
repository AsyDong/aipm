import { useEffect, useState } from 'react'
import type { PetSpecies } from '../types'
import { SPECIES } from '../data/content'

interface Props {
  species: PetSpecies
  stage: number
  size?: number
  mood?: 'idle' | 'happy' | 'sad' | 'eat'
}

/**
 * 宠物立绘 —— 2026-09-17 接入「糖果祥瑞」AI 立绘。
 *
 * 资产：public/pets/pet_{species}_s0{1-6}.png（3 宠 × 6 阶 = 18 张，512×512 透明底 PNG-24），
 * 风格基准见「糖果祥瑞」设计哲学与《山海经宠物_立绘风格基准板 v1.0》。
 *
 * 行为：
 * - 立绘加载成功 → 显示真实插画，mood（idle/happy/sad/eat）用 CSS 动效表达
 * - 立绘加载中失败 → 回退到参数化 SVG（VectorPet），孵化页与离线场景不空白
 *
 * 调用方签名 {species, stage, size, mood} 未变（9 处调用点零改动），
 * 符合事项 rr5GKG 验收标准「替换 PetAvatar 组件即可，其它代码不用动」。
 */
export default function PetAvatar({ species, stage, size = 180, mood = 'idle' }: Props) {
  const def = SPECIES.find((s) => s.id === species) ?? SPECIES[0]
  const s = Math.min(6, Math.max(1, stage))
  const src = `/pets/pet_${species}_s0${s}.png`
  const [artOk, setArtOk] = useState(true)

  // 换阶段 / 换物种时重置加载态
  useEffect(() => {
    setArtOk(true)
  }, [src])

  const moodFx =
    mood === 'happy' ? 'pet-anim-happy'
    : mood === 'sad' ? 'pet-anim-sad'
    : mood === 'eat' ? 'pet-anim-eat'
    : 'pet-anim-idle'

  return (
    <div
      className="pet-avatar"
      style={{ width: size, height: size }}
      role="img"
      aria-label={`山海经萌宠${def.name}，${s} 阶`}
    >
      {artOk ? (
        <img
          className={`pet-avatar-img ${moodFx}`}
          src={src}
          alt=""
          width={size}
          height={size}
          draggable={false}
          onError={() => setArtOk(false)}
        />
      ) : (
        <VectorPet species={species} stage={stage} size={size} mood={mood} />
      )}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* 参数化 SVG 兜底（立绘不可用时仍可完整运行，零网络依赖）              */
/* ------------------------------------------------------------------ */

function VectorPet({ species, stage, size = 180, mood = 'idle' }: Props) {
  const def = SPECIES.find((s) => s.id === species) ?? SPECIES[0]
  const s = Math.min(6, Math.max(1, stage))

  const bw = 58 + s * 7
  const bh = 52 + s * 6.5
  const cx = 100
  const cy = 118
  const headR = 30 + s * 2.6
  const headY = cy - bh * 0.42
  const hornLen = 10 + s * 4
  const eyeY = headY + 2
  const eyeDx = headR * 0.42
  const eyeR = 4.6 + s * 0.25
  const blush = s >= 2

  const gid = `g_${species}_${s}`

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

      {/* 额间纹样：1 阶一道，3 阶起三道（朏朏特征） */}
      <g fill={def.accent}>
        <path d={`M ${cx} ${headY - headR + 2} q ${-5} ${-hornLen} ${-2 - s * 0.4} ${-hornLen - 4} q ${7} ${hornLen * 0.5} ${7} ${hornLen + 4} z`} />
        {s >= 3 && (
          <path d={`M ${cx + 12} ${headY - headR + 6} q ${10} ${-hornLen * 0.8} ${12 + s * 0.4} ${-hornLen * 0.9} q ${-8} ${hornLen * 0.5} ${-6} ${hornLen * 0.95} z`} opacity="0.9" />
        )}
      </g>

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
