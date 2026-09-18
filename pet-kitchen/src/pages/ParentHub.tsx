import { useState } from 'react'
import { useStore } from '../store/useStore'
import { useNav } from '../store/nav'
import { useParent } from '../store/parent'
import { Modal, toast } from '../components/ui'

function Entry({ icon, title, desc, onClick }: { icon: string; title: string; desc: string; onClick: () => void }) {
  return (
    <button onClick={onClick} className="mb-3 flex w-full items-center gap-3 rounded-xl3 bg-white p-4 text-left shadow-card active:scale-[0.99]">
      <span className="text-[26px]">{icon}</span>
      <span className="flex-1">
        <span className="block text-[16px] font-extrabold text-ink">{title}</span>
        <span className="block text-[12px] text-muted">{desc}</span>
      </span>
      <span className="text-muted">›</span>
    </button>
  )
}

/** 家长模式首页（最小集：任务管理 / 现实奖品管理 / 成长报告 + D3 奖励积分兜底） */
export default function ParentHub({ focus }: { focus?: string }) {
  const nav = useNav()
  const s = useStore()
  const parent = useParent()
  const [grant, setGrant] = useState(focus === 'grant')
  const [pts, setPts] = useState(20)
  const [note, setNote] = useState('')

  return (
    <div className="px-4 pb-10 pt-4">
      <div className="flex items-center gap-3">
        <div className="flex-1 text-center text-[18px] font-extrabold text-ink">家长模式</div>
        <button
          className="text-[14px] font-bold text-muted"
          onClick={() => {
            parent.lock()
            nav.tab('mine')
          }}
        >
          退出
        </button>
      </div>

      <div className="mt-3 rounded-xl3 bg-sky-50 px-4 py-3 text-[13px] leading-relaxed text-sky-700">
        每日 0 点结算：饱食度 −60（不低于 0）。每天最多喂 5 份，刚好喂到顶格线。投喂只影响饱食度和经验，不影响属性和闯关。
      </div>

      <div className="mt-3">
        <Entry icon="📝" title="任务管理" desc={`当前 ${s.templates.filter((t) => t.enabled).length} 个任务 · 待确认 ${s.daily.filter((t) => t.status === 'pending').length}`} onClick={() => nav.go('ptasks')} />
        <Entry icon="🎁" title="现实奖品管理" desc={`${s.prizes.length} 个奖品 · 待审批 ${s.redeems.filter((r) => r.state === 'pending').length}`} onClick={() => nav.go('pprizes')} />
        <Entry icon="📈" title="成长报告" desc="任务完成率、闯关正确率、宠物状态" onClick={() => nav.go('report')} />
        <Entry icon="🪙" title="奖励积分" desc="孩子表现好时手动奖励（积分兜底出口）" onClick={() => setGrant(true)} />
        <Entry icon="🔑" title="修改家长密码" desc={s.settings.pinChanged ? '已修改过' : '当前仍是默认密码 1234'} onClick={() => nav.go('pin', 'change')} />
      </div>

      <Modal open={grant} title="奖励积分" onClose={() => setGrant(false)}>
        <div className="text-center text-[13px] text-muted">孩子当前积分 {s.points} 分</div>
        <input className="field mt-2" type="number" value={pts} onChange={(e) => setPts(Number(e.target.value))} />
        <input className="field mt-2" placeholder="奖励原因" value={note} onChange={(e) => setNote(e.target.value.slice(0, 20))} />
        <div className="mt-3 flex gap-2">
          {[10, 20, 50].map((n) => (
            <button key={n} className="btn-chip flex-1" onClick={() => setPts(n)}>{n}</button>
          ))}
        </div>
        <button
          className="btn-main mt-3"
          onClick={() => {
            s.parentGrantPoints(pts, note || '家长奖励')
            toast(`已奖励 ${pts} 分`)
            setGrant(false)
            setNote('')
          }}
        >
          确 认 奖 励
        </button>
      </Modal>
    </div>
  )
}
