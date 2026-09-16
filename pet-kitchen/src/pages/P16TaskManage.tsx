import { useEffect, useState } from 'react'
import { useStore } from '../store/useStore'
import { useNav } from '../store/nav'
import { Confirm, Modal, toast } from '../components/ui'
import { TASK_ICONS } from '../data/content'
import { MAINTAIN_FOOD } from '../engine/rules'
import { getMedia } from '../utils/media'
import { fmtDate } from '../engine/time'
import type { TaskType } from '../types'

const TYPE_LABEL: Record<TaskType, string> = { photo: '拍照', audio: '录音', subjective: '主观' }

/** P16 家长 · 任务管理 */
export default function P16TaskManage() {
  const nav = useNav()
  const s = useStore()
  const [adding, setAdding] = useState(false)
  const [name, setName] = useState('')
  const [icon, setIcon] = useState(TASK_ICONS[0])
  const [type, setType] = useState<TaskType>('photo')
  const [foodValue, setFoodValue] = useState(1)
  const [adjust, setAdjust] = useState<number>(1)
  const [adjustNote, setAdjustNote] = useState('')
  const [streakFix, setStreakFix] = useState(0)
  const [mediaUrl, setMediaUrl] = useState<string | null>(null)
  const [removeId, setRemoveId] = useState<string | null>(null)
  const [rejectId, setRejectId] = useState<string | null>(null)
  const [rejectReason, setRejectReason] = useState('')

  const dailyProduce = s.templates.filter((t) => t.enabled).reduce((a, t) => a + t.foodValue, 0)
  const short = dailyProduce < MAINTAIN_FOOD
  const pending = s.daily.filter((t) => t.status === 'pending')

  useEffect(() => {
    return () => {
      if (mediaUrl) URL.revokeObjectURL(mediaUrl)
    }
  }, [mediaUrl])

  const view = async (mediaId?: string) => {
    if (!mediaId) return toast('这个任务没有佐证', 'warn')
    const blob = await getMedia(mediaId)
    if (!blob) return toast('佐证已过期（30 天自动清理）', 'warn')
    setMediaUrl(URL.createObjectURL(blob))
  }

  return (
    <div className="px-4 pb-10 pt-4">
      <div className="flex items-center gap-3">
        <button className="text-[15px] font-bold text-muted" onClick={() => nav.back()}>← 返回</button>
        <div className="flex-1 text-center text-[18px] font-extrabold text-ink">任务管理</div>
        <button className="text-[14px] font-bold text-sky-600" onClick={() => nav.tab('mine')}>完成</button>
      </div>

      {/* 收支提示条：核心防坑设计 */}
      <div className={`mt-3 rounded-xl px-3 py-2.5 text-center text-[13px] font-extrabold ${short ? 'bg-danger/12 text-danger' : 'bg-ok/12 text-ok'}`}>
        每日产出 {dailyProduce} 份 · 宠物维持需 {MAINTAIN_FOOD} 份/天
        {short ? ' ⚠ 产出不足，建议调高单个任务的食物值' : ' ✅'}
      </div>

      <div className="mt-3 rounded-xl3 bg-white p-3 shadow-card">
        <div className="mb-2 text-[14px] font-extrabold text-ink">每日任务</div>
        {s.templates.map((t) => (
          <div key={t.id} className="mb-2 flex items-center gap-2 rounded-2xl bg-sky-50 px-3 py-2.5">
            <span className="text-[20px]">{t.icon}</span>
            <span className="flex-1 text-[15px] font-bold text-ink">{t.name}</span>
            <span className="rounded-full bg-white px-2 py-1 text-[11px] font-bold text-muted">{TYPE_LABEL[t.type]}</span>
            <select
              className="rounded-lg bg-white px-2 py-1 text-[13px] font-bold text-food"
              value={t.foodValue}
              onChange={(e) => s.updateTemplate(t.id, { foodValue: Number(e.target.value) })}
            >
              {[1, 2, 3].map((n) => (
                <option key={n} value={n}>食物 {n}</option>
              ))}
            </select>
            <button
              className="text-[13px] font-bold"
              onClick={() => s.updateTemplate(t.id, { enabled: !t.enabled })}
            >
              {t.enabled ? '✅' : '⏸'}
            </button>
            <button className="text-[13px] font-bold text-danger" onClick={() => setRemoveId(t.id)}>✕</button>
          </div>
        ))}
        <button className="btn-chip w-full" onClick={() => setAdding(true)}>+ 添加任务</button>
      </div>

      <div className="mt-3 rounded-xl3 bg-white p-3 shadow-card">
        <div className="mb-2 text-[14px] font-extrabold text-ink">待确认 ({pending.length})</div>
        {pending.length === 0 && <div className="py-3 text-center text-[13px] text-muted">没有待确认的任务</div>}
        {pending.map((t) => (
          <div key={t.id} className="mb-2 rounded-2xl bg-warn/10 px-3 py-2.5">
            <div className="flex items-center justify-between">
              <span className="text-[15px] font-bold text-ink">{t.icon} {t.name}</span>
              <span className="text-[12px] text-muted">{fmtDate(t.doneAt ?? Date.now())}</span>
            </div>
            <div className="mt-2 flex gap-2">
              <button className="btn-chip flex-1" onClick={() => void view(t.mediaId)}>查看</button>
              <button
                className="btn-chip flex-1 bg-ok/20 text-ok"
                onClick={() => {
                  s.approveTask(t.id)
                  toast(`已通过，食物 +${t.foodValue}`)
                }}
              >
                通过
              </button>
              <button
                className="btn-chip flex-1 bg-danger/15 text-danger"
                onClick={() => setRejectId(t.id)}
              >
                驳回
              </button>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-3 rounded-xl3 bg-white p-3 shadow-card">
        <div className="mb-2 text-[14px] font-extrabold text-ink">手动调整</div>
        <div className="flex items-center gap-2">
          <input
            type="number"
            className="field flex-1"
            value={adjust}
            onChange={(e) => setAdjust(Number(e.target.value))}
          />
          <button
            className="btn-chip"
            onClick={() => {
              if (!adjust) return
              s.parentAdjustFood(adjust, adjustNote)
              toast(`已${adjust > 0 ? '增加' : '扣除'} ${Math.abs(adjust)} 份食物`)
              setAdjust(1)
              setAdjustNote('')
            }}
          >
            调整食物
          </button>
        </div>
        <input
          className="field mt-2"
          placeholder="原因（会记入流水）"
          value={adjustNote}
          onChange={(e) => setAdjustNote(e.target.value)}
        />
        <div className="mt-3 flex items-center gap-2">
          <input
            type="number"
            className="field flex-1"
            value={streakFix}
            onChange={(e) => setStreakFix(Number(e.target.value))}
          />
          <button
            className="btn-chip"
            onClick={() => {
              useStore.setState({ streak: Math.max(0, streakFix) })
              toast(`连续天数已校准为 ${streakFix}`)
            }}
          >
            连续天数校准
          </button>
        </div>
      </div>

      {/* 添加任务 */}
      <Modal open={adding} title="添加任务" onClose={() => setAdding(false)}>
        <input className="field" placeholder="任务名字，如：练琴 30 分钟" value={name} onChange={(e) => setName(e.target.value.slice(0, 12))} />
        <div className="mt-3 flex flex-wrap gap-2">
          {TASK_ICONS.map((i) => (
            <button
              key={i}
              onClick={() => setIcon(i)}
              className={`h-11 w-11 rounded-xl text-[22px] ${icon === i ? 'bg-sky-200' : 'bg-sky-50'}`}
            >
              {i}
            </button>
          ))}
        </div>
        <div className="seg mt-3">
          {(['photo', 'audio', 'subjective'] as TaskType[]).map((t) => (
            <button key={t} data-on={type === t} onClick={() => setType(t)}>{TYPE_LABEL[t]}</button>
          ))}
        </div>
        <div className="mt-3 flex items-center gap-2">
          <span className="text-[14px] font-bold text-muted">食物</span>
          <div className="seg flex-1">
            {[1, 2, 3].map((n) => (
              <button key={n} data-on={foodValue === n} onClick={() => setFoodValue(n)}>{n} 份</button>
            ))}
          </div>
        </div>
        <button
          className="btn-main mt-4"
          disabled={!name.trim()}
          onClick={() => {
            s.addTemplate({ name: name.trim(), icon, type, foodValue, enabled: true })
            toast('添加成功')
            setName('')
            setAdding(false)
          }}
        >
          添 加
        </button>
      </Modal>

      {/* 佐证查看 */}
      <Modal open={!!mediaUrl} title="佐证" onClose={() => setMediaUrl(null)}>
        {mediaUrl && (
          mediaUrl.startsWith('blob:') ? (
            <div className="space-y-3">
              <img src={mediaUrl} alt="佐证" className="w-full rounded-xl" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }} />
              <audio src={mediaUrl} controls className="w-full" />
            </div>
          ) : null
        )}
      </Modal>

      <Confirm
        open={!!rejectId}
        title="驳回这个任务吗？"
        okText="驳回"
        danger
        onOk={() => {
          if (rejectId) {
            s.rejectTask(rejectId, rejectReason || '这次不算哦，再试一次吧')
            setRejectId(null)
            setRejectReason('')
          }
        }}
        onCancel={() => setRejectId(null)}
      />
      {rejectId && (
        <div className="fixed inset-x-0 bottom-6 z-[95] mx-auto w-[320px] rounded-xl3 bg-white p-4 shadow-pop">
          <div className="text-[15px] font-extrabold text-ink">驳回原因</div>
          <input className="field mt-2" placeholder="写给孩子看的原因" value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} />
        </div>
      )}

      <Confirm
        open={!!removeId}
        title="删除这个任务？"
        desc="已经完成过的记录会保留"
        okText="删除"
        danger
        onOk={() => removeId && s.removeTemplate(removeId)}
        onCancel={() => setRemoveId(null)}
      />
    </div>
  )
}
