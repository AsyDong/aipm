import { useState } from 'react'
import { useStore } from '../store/useStore'
import { useNav } from '../store/nav'
import { Confirm, Empty, toast } from '../components/ui'
import { SHOP_ITEMS } from '../data/content'

type Sub = 'decor' | 'prize'

/** P11 商店：装饰（积分购买即到账）+ 现实奖品（积分兑换，需家长审批） */
export default function P11Shop() {
  const nav = useNav()
  const points = useStore((s) => s.points)
  const owned = useStore((s) => s.owned)
  const buyItem = useStore((s) => s.buyItem)
  const prizes = useStore((s) => s.prizes)
  const redeems = useStore((s) => s.redeems)
  const redeem = useStore((s) => s.redeem)
  const [sub, setSub] = useState<Sub>('decor')
  const [ask, setAsk] = useState<string | null>(null)

  const target = prizes.find((p) => p.id === ask)

  return (
    <div className="pb-6">
      <div className="px-4 pt-3">
        <div className="seg">
          <button data-on={sub === 'decor'} onClick={() => setSub('decor')}>装 饰</button>
          <button data-on={sub === 'prize'} onClick={() => setSub('prize')}>现 实 奖 品</button>
        </div>
      </div>

      <div className="mx-4 mt-3 rounded-2xl bg-white px-4 py-2.5 text-center shadow-card">
        <span className="text-[13px] font-bold text-muted">积分余额 </span>
        <span className="text-[22px] font-extrabold text-amber-500">🪙{points}</span>
      </div>

      {sub === 'decor' ? (
        <div className="mt-3 grid grid-cols-2 gap-3 px-4">
          {SHOP_ITEMS.map((it) => {
            const has = owned.includes(it.id)
            const short = Math.max(0, it.points - points)
            return (
              <div key={it.id} className="rounded-xl3 bg-white p-3 text-center shadow-card">
                <div className="text-[44px]">{it.emoji}</div>
                <div className="mt-1 text-[15px] font-extrabold text-ink">{it.name}</div>
                <div className="mt-0.5 text-[13px] font-bold text-amber-500">🪙{it.points}</div>
                {has ? (
                  <button className="btn-chip mt-2 w-full" onClick={() => nav.go('decorate')}>去 布 置</button>
                ) : (
                  <button
                    className="btn-chip mt-2 w-full"
                    disabled={short > 0}
                    onClick={() => {
                      if (buyItem(it.id, it.points)) toast(`买到${it.name}啦，去布置吧`)
                    }}
                  >
                    {short > 0 ? `还差 🪙${short}` : '购 买'}
                  </button>
                )}
              </div>
            )
          })}
        </div>
      ) : (
        <div className="mt-3 px-4">
          {prizes.length === 0 && <Empty emoji="🎁" text="爸爸妈妈还没设置奖品" />}
          {prizes.map((p) => {
            const pending = redeems.find((r) => r.prizeId === p.id && (r.state === 'pending' || r.state === 'approved'))
            const short = Math.max(0, p.points - points)
            return (
              <div key={p.id} className="mb-3 rounded-xl3 bg-white p-4 shadow-card">
                <div className="flex items-center justify-between">
                  <div className="text-[17px] font-extrabold text-ink">{p.name}</div>
                  <div className="text-[16px] font-extrabold text-amber-500">🪙{p.points}</div>
                </div>
                {p.note && <div className="mt-0.5 text-[12px] text-muted">{p.note}</div>}
                <button
                  className="btn-main mt-3"
                  disabled={!!pending || short > 0}
                  onClick={() => setAsk(p.id)}
                >
                  {pending
                    ? pending.state === 'pending'
                      ? '⏳ 待爸爸妈妈同意'
                      : '✅ 已同意，等兑现'
                    : short > 0
                      ? `还差 🪙${short}`
                      : '兑 换'}
                </button>
              </div>
            )
          })}
          <div className="mt-2 text-center text-[12px] text-muted">
            积分只能通过闯关获得哦，去闯关赚积分吧！
          </div>
        </div>
      )}

      <Confirm
        open={!!target}
        title={`要用 🪙${target?.points ?? 0} 换「${target?.name ?? ''}」吗？`}
        desc="兑换后会先冻结积分，等爸爸妈妈同意才算成功"
        okText="要 换"
        onOk={() => {
          if (target && redeem(target.id)) toast('申请已发出，等爸爸妈妈同意')
          else toast('积分不够哦', 'warn')
        }}
        onCancel={() => setAsk(null)}
      />
    </div>
  )
}
