import { useState } from 'react'
import { useStore } from '../store/useStore'
import PetAvatar from '../components/PetAvatar'
import { NAME_POOL } from '../data/content'
import { toast } from '../components/ui'
import { checkName } from '../utils/sensitive'
import { pick } from '../utils/id'
import { speak } from '../utils/speech'

/** P03 取名：6 字内、敏感词过滤、支持随机；后续可不限次改名 */
export default function P03Name() {
  const pet = useStore((s) => s.pet)
  const setName = useStore((s) => s.setName)
  const readAloud = useStore((s) => s.settings.readAloud)
  const [name, setNameLocal] = useState('')

  if (!pet) return null
  const remain = 6 - name.length

  const commit = () => {
    const r = checkName(name)
    if (!r.ok) return toast(r.msg, 'warn')
    setName(name.trim())
    speak(`${name.trim()}，我们回家啦`, readAloud)
  }

  return (
    <div className="flex min-h-full flex-col px-6 pb-10 pt-12">
      <h1 className="text-center text-[24px] font-extrabold text-ink">给它取个名字吧</h1>

      <div className="mt-6 flex justify-center">
        <div className="animate-floaty">
          <PetAvatar species={pet.species} stage={1} body="normal" size={170} mood="idle" />
        </div>
      </div>

      <div className="mt-8">
        <input
          className="field text-center text-[20px] font-bold"
          value={name}
          maxLength={12}
          placeholder="写个名字"
          onChange={(e) => setNameLocal(e.target.value.slice(0, 6))}
        />
        <div className="mt-2 flex items-center justify-between px-1">
          <span className="text-[13px] text-muted">还可以写 {Math.max(0, remain)} 个字</span>
          <button
            className="text-[13px] font-bold text-sky-500"
            onClick={() => setNameLocal(pick(NAME_POOL))}
          >
            🎲 随机一个
          </button>
        </div>
      </div>

      <div className="mt-auto pt-10">
        <button className="btn-main" disabled={!name.trim()} onClick={commit}>
          一 起 回 家 ！
        </button>
      </div>
    </div>
  )
}
