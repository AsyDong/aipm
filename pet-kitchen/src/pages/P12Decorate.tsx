import { useRef, useState } from 'react'
import { useStore } from '../store/useStore'
import { useNav } from '../store/nav'
import PetAvatar from '../components/PetAvatar'
import { Confirm, Empty, toast } from '../components/ui'
import { SHOP_ITEMS } from '../data/content'

/** P12 家园布置：从底部栏拖到场景，松手吸附网格 */
export default function P12Decorate() {
  const nav = useNav()
  const pet = useStore((s) => s.pet)
  const owned = useStore((s) => s.owned)
  const placed = useStore((s) => s.placed)
  const placeItem = useStore((s) => s.placeItem)
  const movePlaced = useStore((s) => s.movePlaced)
  const removePlaced = useStore((s) => s.removePlaced)
  const resetPlaced = useStore((s) => s.resetPlaced)

  const sceneRef = useRef<HTMLDivElement>(null)
  const [dragUid, setDragUid] = useState<string | null>(null)
  const [askReset, setAskReset] = useState(false)

  const items = SHOP_ITEMS.filter((i) => owned.includes(i.id))

  const posFromEvent = (clientX: number, clientY: number) => {
    const r = sceneRef.current?.getBoundingClientRect()
    if (!r) return { x: 50, y: 50 }
    const x = ((clientX - r.left) / r.width) * 100
    const y = ((clientY - r.top) / r.height) * 100
    // 吸附到 5% 网格
    return { x: Math.round(x / 5) * 5, y: Math.round(y / 5) * 5 }
  }

  const onDrop = (itemId: string, clientX: number, clientY: number) => {
    const { x, y } = posFromEvent(clientX, clientY)
    placeItem(itemId, Math.min(95, Math.max(5, x)), Math.min(90, Math.max(8, y)))
    toast('放好啦')
  }

  if (!pet) return null

  return (
    <div className="flex min-h-screen flex-col pb-6">
      <div className="flex items-center justify-between px-4 py-3">
        <button className="text-[15px] font-bold text-sky-600" onClick={() => nav.back()}>完 成</button>
        <div className="text-[17px] font-extrabold text-ink">布置我的家</div>
        <button className="text-[15px] font-bold text-muted" onClick={() => setAskReset(true)}>重 置</button>
      </div>

      <div
        ref={sceneRef}
        className="relative mx-4 h-[300px] overflow-hidden rounded-xl3 bg-gradient-to-b from-sky-100 to-emerald-50 shadow-card"
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault()
          const id = e.dataTransfer.getData('text/item')
          if (id) onDrop(id, e.clientX, e.clientY)
        }}
        onPointerMove={(e) => {
          if (!dragUid) return
          const { x, y } = posFromEvent(e.clientX, e.clientY)
          movePlaced(dragUid, Math.min(95, Math.max(5, x)), Math.min(90, Math.max(8, y)))
        }}
        onPointerUp={() => setDragUid(null)}
      >
        {placed.map((p) => {
          const it = SHOP_ITEMS.find((i) => i.id === p.itemId)
          if (!it) return null
          return (
            <div
              key={p.uid}
              className="absolute cursor-grab select-none text-[34px] active:cursor-grabbing"
              style={{ left: `${p.x}%`, top: `${p.y}%`, transform: 'translate(-50%,-50%)' }}
              onPointerDown={() => setDragUid(p.uid)}
              onDoubleClick={() => removePlaced(p.uid)}
            >
              {it.emoji}
            </div>
          )
        })}
        <div
          className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2"
          style={{ pointerEvents: 'none' }}
        >
          <PetAvatar species={pet.species} stage={pet.stage} size={150} />
        </div>
      </div>

      <div className="mt-3 text-center text-[12px] text-muted">拖动下面的东西放到家里，双击可以收起来</div>

      <div className="mt-3 px-4">
        {items.length === 0 ? (
          <Empty
            emoji="🛒"
            text="还没有买到装饰哦"
            action={<button className="btn-chip" onClick={() => nav.tab('shop')}>去商店看看</button>}
          />
        ) : (
          <div className="flex gap-3 overflow-x-auto pb-2 no-scrollbar">
            {items.map((it) => (
              <div
                key={it.id}
                draggable
                onDragStart={(e) => e.dataTransfer.setData('text/item', it.id)}
                className="flex min-w-[76px] flex-col items-center rounded-2xl bg-white px-3 py-2 shadow-card active:scale-95"
              >
                <span className="text-[32px]">{it.emoji}</span>
                <span className="mt-0.5 text-[12px] font-bold text-ink">{it.name}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <Confirm
        open={askReset}
        title="把所有东西都收起来吗？"
        okText="收起来"
        danger
        onOk={() => {
          resetPlaced()
          toast('已重置')
        }}
        onCancel={() => setAskReset(false)}
      />
    </div>
  )
}
