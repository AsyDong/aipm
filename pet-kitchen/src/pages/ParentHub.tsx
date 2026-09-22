import { useState } from 'react'
import { useStore } from '../store/useStore'
import { useNav } from '../store/nav'
import { useParent } from '../store/parent'
import { claimPin, loginChild, setCredentials, syncStats } from '../store/sync'
import { Modal, toast } from '../components/ui'
import Coin from '../components/Coin'

function Entry({ icon, title, desc, onClick }: { icon: React.ReactNode; title: string; desc: string; onClick: () => void }) {
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

/** 设备绑定：本机孩子编号 + 6 位登录码。新设备填同一组编号/码即可找回数据。 */
function BindModal({ onClose }: { onClose: () => void }) {
  const s = useStore()
  const stats = syncStats()
  const [cid, setCid] = useState(stats.childId)
  const [pin, setPin] = useState('')
  const [busy, setBusy] = useState(false)
  const [bound, setBound] = useState(stats.hasPin)

  const go = async () => {
    if (!/^\d{6}$/.test(pin)) { toast('登录码是 6 位数字'); return }
    setBusy(true)
    try {
      // 本机未绑定 → 先走设置；被绑过（比如清过缓存）或登录别的孩子 → 直接登录
      let r = cid === stats.childId && !stats.hasPin ? await claimPin(pin) : { ok: false, conflict: true }
      if (r.conflict) r = await loginChild(cid, pin)
      if (!r.ok) { toast(r.error ?? '登录失败'); return }
      setCredentials(cid, pin)
      await s.syncNow()
      toast(cid === stats.childId ? '登录码已设置' : '登录成功，数据已同步')
      setBound(true)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal open title="设备绑定" onClose={onClose}>
      <div className="text-[13px] leading-relaxed text-muted">
        孩子编号是数据身份，登录码是凭证。换手机/平板时，在这里输入<b>同一个编号和登录码</b>，宠物和进度就都回来了。
      </div>
      {stats.unauthorized && (
        <div className="mt-2 rounded-xl bg-warn/10 px-3 py-2 text-[12px] font-bold text-warn">
          同步被拒：登录码不对或还没设置，数据先攒在本地。
        </div>
      )}
      <div className="mt-3 flex items-center gap-2 rounded-xl bg-sky-50 px-3 py-2.5">
        <div className="flex-1 text-[12px] text-sky-700">
          <div className="font-bold">孩子编号</div>
          <div className="mt-0.5 break-all font-mono text-[13px] text-ink">{stats.childId}</div>
        </div>
        <button
          className="btn-chip"
          onClick={() => {
            void navigator.clipboard?.writeText(stats.childId)
            toast('编号已复制')
          }}
        >
          复制
        </button>
      </div>
      {bound && (
        <div className="mt-2 rounded-xl bg-ok/10 px-3 py-2 text-[12px] font-bold text-ok">
          ✅ 本机已绑定。新设备装好后打开这个页面，填上面的编号和登录码即可。
        </div>
      )}
      <div className="mt-3">
        <div className="text-[12px] font-bold text-muted">在（另一台）设备上登录</div>
        <input className="field mt-1 font-mono" value={cid} onChange={(e) => setCid(e.target.value.trim())} placeholder="孩子编号" />
        <input
          className="field mt-2"
          type="password"
          inputMode="numeric"
          maxLength={6}
          value={pin}
          onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
          placeholder="6 位登录码"
        />
        <button className="btn-main mt-3" disabled={busy} onClick={() => void go()}>
          {busy ? '请稍候…' : bound ? '登 录' : '设 置 并 绑 定'}
        </button>
      </div>
    </Modal>
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
  const [bind, setBind] = useState(false)

  const sync = syncStats()

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
        <Entry icon={<Coin size={24} />} title="奖励积分" desc="孩子表现好时手动奖励（积分兜底出口）" onClick={() => setGrant(true)} />
        <Entry
          icon="📱"
          title="设备绑定"
          desc={
            !sync.enabled
              ? '未配置同步（纯本地模式）'
              : sync.unauthorized
                ? '需要重新登录，数据攒在本地'
                : sync.hasPin
                  ? `已绑定 · 编号 ${sync.childId.slice(0, 8)}…`
                  : '设置登录码，换设备可找回数据'
          }
          onClick={() => setBind(true)}
        />
        <Entry icon="🔑" title="修改家长密码" desc={s.settings.pinChanged ? '已修改过' : '当前仍是默认密码 1234'} onClick={() => nav.go('pin', 'change')} />
      </div>

      {bind && <BindModal onClose={() => setBind(false)} />}

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
