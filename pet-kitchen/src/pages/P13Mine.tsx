import { useState } from 'react'
import { useStore } from '../store/useStore'
import { useNav } from '../store/nav'
import PetAvatar from '../components/PetAvatar'
import { Confirm, Modal, toast } from '../components/ui'
import { SPECIES } from '../data/content'
import { ATTR_LABEL, BODY_LABEL, STAGE_EXP, STAGE_TITLE } from '../engine/rules'
import { fmtDate } from '../engine/time'
import { checkName } from '../utils/sensitive'
import type { LedgerEntry } from '../types'

function LedgerList({ entries }: { entries: LedgerEntry[] }) {
  if (entries.length === 0) return <div className="py-8 text-center text-[14px] text-muted">还没有记录</div>
  return (
    <div className="max-h-[50vh] overflow-y-auto">
      {entries.slice(0, 60).map((e) => (
        <div key={e.id} className="flex items-center justify-between border-b border-sky-50 py-2.5 last:border-0">
          <div>
            <div className="text-[14px] font-bold text-ink">{e.note}</div>
            <div className="text-[11px] text-muted">{fmtDate(e.at)}</div>
          </div>
          <div className="text-right">
            <div className={`text-[15px] font-extrabold ${e.delta >= 0 ? 'text-ok' : 'text-danger'}`}>
              {e.delta >= 0 ? '+' : ''}
              {e.delta}
            </div>
            <div className="text-[11px] text-muted">余额 {e.balance}</div>
          </div>
        </div>
      ))}
    </div>
  )
}

/** P13 我的 */
export default function P13Mine() {
  const nav = useNav()
  const s = useStore()
  const pet = s.pet
  const [profile, setProfile] = useState(false)
  const [rename, setRename] = useState('')
  const [ledger, setLedger] = useState<'food' | 'point' | null>(null)
  const [askParent, setAskParent] = useState(false)

  if (!pet) return null
  const def = SPECIES.find((x) => x.id === pet.species)!
  const expNext = STAGE_EXP[pet.stage] ?? STAGE_EXP[5]

  return (
    <div className="pb-8">
      <div className="mx-4 mt-3 flex items-center gap-3 rounded-xl3 bg-white p-4 shadow-card">
        <PetAvatar species={pet.species} stage={pet.stage} body={pet.body} size={78} />
        <div className="flex-1">
          <div className="text-[20px] font-extrabold text-ink">{pet.nickname}</div>
          <div className="text-[13px] font-bold text-sky-600">
            Lv.{pet.stage} {STAGE_TITLE[pet.stage - 1]} · {def.name}
          </div>
          <div className="text-[12px] text-muted">
            陪伴第 {Math.max(1, Math.floor((Date.now() - pet.bornAt) / 86400000) + 1)} 天 · {BODY_LABEL[pet.body]}
          </div>
        </div>
      </div>

      <div className="mx-4 mt-3 overflow-hidden rounded-xl3 bg-white shadow-card">
        <Row icon="📋" text="宠物档案" onClick={() => { setRename(pet.nickname); setProfile(true) }} />
        <Row icon="📈" text="成长报告" onClick={() => nav.go('report')} />
        <Row icon="📕" text="错题集" onClick={() => nav.go('wrong', 'math')} />
        <Row icon="⭐" text="积分流水" onClick={() => setLedger('point')} />
        <Row icon="🍖" text="食物流水" onClick={() => setLedger('food')} />
      </div>

      <div className="mx-4 mt-3 overflow-hidden rounded-xl3 bg-white shadow-card">
        <ToggleRow text="音效" on={s.settings.sound} onToggle={() => s.toggleSetting('sound')} />
        <ToggleRow text="题目朗读" on={s.settings.readAloud} onToggle={() => s.toggleSetting('readAloud')} />
      </div>

      <div className="mx-4 mt-5">
        <button className="btn-sub" onClick={() => setAskParent(true)}>爸 爸 妈 妈 请 进</button>
      </div>

      {/* 宠物档案 */}
      <Modal open={profile} title="宠物档案" onClose={() => setProfile(false)}>
        <div className="flex justify-center">
          <PetAvatar species={pet.species} stage={pet.stage} body={pet.body} size={140} />
        </div>
        <div className="mt-2 text-center text-[13px] text-muted">
          {def.name} · {def.tagline}（已确认，不能更换啦）
        </div>

        <div className="mt-3 flex items-center gap-2">
          <input className="field flex-1" value={rename} maxLength={6} onChange={(e) => setRename(e.target.value.slice(0, 6))} />
          <button
            className="btn-chip"
            onClick={() => {
              const r = checkName(rename)
              if (!r.ok) return toast(r.msg, 'warn')
              s.renamePet(rename.trim())
              toast('改好名字啦')
            }}
          >
            改名
          </button>
        </div>

        <div className="mt-4 space-y-2 text-[14px] font-bold">
          <div className="flex justify-between">
            <span className="text-muted">阶段</span>
            <span>Lv.{pet.stage} {STAGE_TITLE[pet.stage - 1]}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted">经验</span>
            <span>{pet.exp} / {pet.stage >= 6 ? '满级' : expNext}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted">体型</span>
            <span>{BODY_LABEL[pet.body]}</span>
          </div>
          {(['math', 'chinese', 'english'] as const).map((k) => (
            <div key={k} className="flex justify-between">
              <span className="text-muted">{ATTR_LABEL[k]}</span>
              <span>{pet.attrs[k]}</span>
            </div>
          ))}
        </div>
      </Modal>

      <Modal
        open={!!ledger}
        title={ledger === 'food' ? '食物流水' : '积分流水'}
        onClose={() => setLedger(null)}
      >
        <LedgerList entries={ledger === 'food' ? s.foodLedger : s.pointLedger} />
      </Modal>

      <Confirm
        open={askParent}
        title="进入家长模式"
        desc="需要输入家长密码，孩子请在爸爸妈妈陪同下操作"
        okText="好的"
        onOk={() => nav.go('parent')}
        onCancel={() => setAskParent(false)}
      />
    </div>
  )
}

function Row({ icon, text, onClick }: { icon: string; text: string; onClick: () => void }) {
  return (
    <button onClick={onClick} className="flex w-full items-center gap-3 border-b border-sky-50 px-4 py-3.5 last:border-0 active:bg-sky-50">
      <span className="text-[19px]">{icon}</span>
      <span className="flex-1 text-left text-[16px] font-bold text-ink">{text}</span>
      <span className="text-muted">›</span>
    </button>
  )
}

function ToggleRow({ text, on, onToggle }: { text: string; on: boolean; onToggle: () => void }) {
  return (
    <div className="flex items-center justify-between border-b border-sky-50 px-4 py-3.5 last:border-0">
      <span className="text-[16px] font-bold text-ink">{text}</span>
      <button
        onClick={onToggle}
        className={`h-7 w-12 rounded-full p-0.5 transition ${on ? 'bg-sky-400' : 'bg-slate-200'}`}
      >
        <span className={`block h-6 w-6 rounded-full bg-white transition-transform ${on ? 'translate-x-5' : ''}`} />
      </button>
    </div>
  )
}
