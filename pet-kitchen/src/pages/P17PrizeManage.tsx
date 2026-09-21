import { useState } from 'react'
import { useStore } from '../store/useStore'
import { useNav } from '../store/nav'
import { Confirm, Empty, Modal, toast } from '../components/ui'
import { fmtDate, diffDays, nowDay } from '../engine/time'

/** P17 家长 · 现实奖品管理与兑换审批 */
export default function P17PrizeManage() {
  const nav = useNav()
  const s = useStore()
  const [adding, setAdding] = useState(false)
  const [name, setName] = useState('')
  const [pts, setPts] = useState(300)
  const [note, setNote] = useState('')
  const [rejectId, setRejectId] = useState<string | null>(null)
  const [reason, setReason] = useState('')
  const [removeId, setRemoveId] = useState<string | null>(null)
  const [editId, setEditId] = useState<string | null>(null)

  const pending = s.redeems.filter((r) => r.state === 'pending')
  const approved = s.redeems.filter((r) => r.state === 'approved')
  const delivered = s.redeems.filter((r) => r.state === 'delivered').slice(0, 10)

  return (
    <div className="px-4 pb-10 pt-4">
      <div className="flex items-center gap-3">
        <button className="text-[15px] font-bold text-muted" onClick={() => nav.back()}>← 返回</button>
        <div className="flex-1 text-center text-[18px] font-extrabold text-ink">奖品管理</div>
        <button className="text-[14px] font-bold text-sky-600" onClick={() => nav.tab('mine')}>完成</button>
      </div>

      <div className="mt-3 rounded-xl3 bg-white p-3 shadow-card">
        <div className="mb-2 text-[14px] font-extrabold text-ink">现实奖品</div>
        {s.prizes.length === 0 && <Empty emoji="🎁" text="还没有奖品" />}
        {s.prizes.map((p) => (
          <div key={p.id} className="mb-2 flex items-center gap-2 rounded-2xl bg-sky-50 px-3 py-2.5">
            <span className="flex-1 text-[15px] font-bold text-ink">{p.name}</span>
            <span className="text-[14px] font-extrabold text-amber-500">{p.points} 分</span>
            <button
              className="rounded-lg bg-white px-2 py-1 text-[12px] font-bold text-sky-600"
              onClick={() => {
                setName(p.name)
                setPts(p.points)
                setNote(p.note ?? '')
                setEditId(p.id)
                setAdding(true)
              }}
            >
              编辑
            </button>
            <button className="text-[13px] font-bold text-danger" onClick={() => setRemoveId(p.id)}>✕</button>
          </div>
        ))}
        <button
          className="btn-chip w-full"
          onClick={() => {
            setName('')
            setPts(300)
            setNote('')
            setEditId(null)
            setAdding(true)
          }}
        >
          + 添加奖品
        </button>
      </div>

      <div className="mt-3 rounded-xl3 bg-white p-3 shadow-card">
        <div className="mb-2 text-[14px] font-extrabold text-ink">待审批 ({pending.length})</div>
        {pending.length === 0 && <div className="py-3 text-center text-[13px] text-muted">没有待审批的兑换</div>}
        {pending.map((r) => (
          <div key={r.id} className="mb-2 rounded-2xl bg-warn/10 px-3 py-2.5">
            <div className="flex items-center justify-between">
              <span className="text-[15px] font-bold text-ink">{r.prizeName}</span>
              <span className="text-[14px] font-extrabold text-amber-500">{r.points} 分</span>
            </div>
            <div className="mt-0.5 text-[12px] text-muted">
              {fmtDate(r.at)} · 孩子当前积分 {s.points} 分 · 还剩 {Math.max(0, 7 - diffDays(nowDay(r.at), nowDay()))} 天自动退回
            </div>
            <div className="mt-2 flex gap-2">
              <button
                className="btn-chip flex-1 bg-ok/20 text-ok"
                onClick={() => {
                  s.approveRedeem(r.id)
                  toast('已同意，记得线下兑现哦')
                }}
              >
                同意
              </button>
              <button className="btn-chip flex-1 bg-danger/15 text-danger" onClick={() => setRejectId(r.id)}>驳回</button>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-3 rounded-xl3 bg-white p-3 shadow-card">
        <div className="mb-2 text-[14px] font-extrabold text-ink">已通过 · 待兑现 ({approved.length})</div>
        {approved.length === 0 && <div className="py-3 text-center text-[13px] text-muted">暂无</div>}
        {approved.map((r) => (
          <div key={r.id} className="mb-2 flex items-center justify-between rounded-2xl bg-ok/10 px-3 py-2.5">
            <span className="text-[15px] font-bold text-ink">{r.prizeName}</span>
            <button className="btn-chip" onClick={() => { s.deliverRedeem(r.id); toast('已标记兑现') }}>标记已兑现</button>
          </div>
        ))}
      </div>

      {delivered.length > 0 && (
        <div className="mt-3 rounded-xl3 bg-white p-3 shadow-card">
          <div className="mb-2 text-[14px] font-extrabold text-ink">已兑现</div>
          {delivered.map((r) => (
            <div key={r.id} className="flex items-center justify-between border-b border-sky-50 py-2 last:border-0">
              <span className="text-[14px] font-bold text-muted">{r.prizeName}</span>
              <span className="text-[12px] text-muted">{fmtDate(r.deliveredAt ?? r.at)}</span>
            </div>
          ))}
        </div>
      )}

      {/* 添加/编辑奖品 */}
      <Modal open={adding} title="奖品" onClose={() => setAdding(false)}>
        <input className="field" placeholder="奖品名字（10 字内）" value={name} onChange={(e) => setName(e.target.value.slice(0, 10))} />
        <input className="field mt-2" type="number" value={pts} onChange={(e) => setPts(Math.max(1, Number(e.target.value)))} />
        <input className="field mt-2" placeholder="备注（可选）" value={note} onChange={(e) => setNote(e.target.value.slice(0, 20))} />
        <button
          className="btn-main mt-4"
          disabled={!name.trim()}
          onClick={() => {
            if (editId) s.updatePrize(editId, { name: name.trim(), points: pts, note })
            else s.addPrize(name.trim(), pts, note)
            toast('保存好啦')
            setAdding(false)
            setEditId(null)
          }}
        >
          保 存
        </button>
      </Modal>

      {/* 驳回原因 */}
      <Modal open={!!rejectId} title="驳回这个兑换吗？" onClose={() => setRejectId(null)}>
        <input className="field" placeholder="写给孩子看的原因" value={reason} onChange={(e) => setReason(e.target.value.slice(0, 30))} />
        <button
          className="btn-main mt-4 bg-danger"
          onClick={() => {
            if (rejectId) {
              s.rejectRedeem(rejectId, reason || '这次先不换哦，再攒攒')
              toast('已驳回，积分已退回')
            }
            setRejectId(null)
            setReason('')
          }}
        >
          确认驳回并退回积分
        </button>
      </Modal>

      <Confirm
        open={!!removeId}
        title="删除这个奖品？"
        okText="删除"
        danger
        onOk={() => removeId && s.removePrize(removeId)}
        onCancel={() => setRemoveId(null)}
      />
    </div>
  )
}
