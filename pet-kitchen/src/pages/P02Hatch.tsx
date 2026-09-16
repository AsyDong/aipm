import { useEffect, useState } from 'react'
import { useStore } from '../store/useStore'
import Egg from '../components/Egg'
import PetAvatar from '../components/PetAvatar'
import { SPECIES } from '../data/content'
import { toast } from '../components/ui'

/** P02 破壳动画：晃动 → 裂纹（需点 3 下）→ 破壳，总时长 ≤ 4s */
export default function P02Hatch() {
  const pet = useStore((s) => s.pet)
  const hatchDone = useStore((s) => s.hatchDone)
  const [taps, setTaps] = useState(0)
  const [done, setDone] = useState(false)

  const species = pet?.species ?? 'baize'
  const def = SPECIES.find((s) => s.id === species)!

  useEffect(() => {
    if (taps < 3 || done) return
    setDone(true)
    const t = setTimeout(hatchDone, 1600)
    return () => clearTimeout(t)
  }, [taps, done, hatchDone])

  if (!pet) return null

  const cracks = Math.min(3, taps)

  return (
    <div className="flex min-h-full flex-col items-center justify-center px-6 pb-16">
      <button
        className="absolute right-5 top-5 text-[14px] font-bold text-muted"
        onClick={() => {
          toast('跳过啦')
          hatchDone()
        }}
      >
        跳过
      </button>

      <div className="relative h-[260px] w-full">
        {!done ? (
          <div className="flex h-full flex-col items-center justify-center" onClick={() => setTaps((t) => t + 1)}>
            <div className={taps < 3 ? 'animate-shake' : 'animate-jump'}>
              <Egg c1={def.c1} c2={def.c2} accent={def.accent} size={150} />
            </div>
            {cracks > 0 && (
              <svg className="pointer-events-none absolute" width="150" height="180" viewBox="0 0 100 120" style={{ top: 40 }}>
                {cracks >= 1 && <path d="M28 52 l 12 8 l -8 10 l 14 6" stroke="#7C8BA1" strokeWidth="2" fill="none" />}
                {cracks >= 2 && <path d="M70 44 l -10 12 l 12 8 l -6 12" stroke="#7C8BA1" strokeWidth="2" fill="none" />}
                {cracks >= 3 && <path d="M20 70 q 30 16 60 -4" stroke="#7C8BA1" strokeWidth="2.4" fill="none" />}
              </svg>
            )}
          </div>
        ) : (
          <div className="flex h-full flex-col items-center justify-center">
            <div className="animate-popin">
              <PetAvatar species={species} stage={1} body="normal" size={200} mood="happy" />
            </div>
            <div className="mt-2 animate-popin text-[20px] font-extrabold text-sky-600">哇！出来啦！</div>
          </div>
        )}
      </div>

      {!done && (
        <div className="mt-8 text-center">
          <div className="text-[18px] font-extrabold text-ink">
            {taps === 0 ? '蛋在动……' : taps < 3 ? `再点 ${3 - taps} 下帮它出来` : '快出来啦！'}
          </div>
          <div className="mt-1 text-[13px] text-muted">点一下蛋试试</div>
        </div>
      )}
    </div>
  )
}
