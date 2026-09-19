import { useEffect, useState } from 'react'
import { useStore, templateAppliesOn } from '../store/useStore'
import { useNav } from '../store/nav'
import { Confirm, Modal, toast } from '../components/ui'
import { TASK_ICONS } from '../data/content'
import { MAINTAIN_FOOD } from '../engine/rules'
import { getMedia } from '../utils/media'
import { fmtDate, nowDay } from '../engine/time'
import { speak } from '../utils/speech'
import type { TaskKind, TaskTemplate, TaskType } from '../types'

const TYPE_LABEL: Record<TaskType, string> = { photo: '拍照', audio: '录音', subjective: '主观' }
const WEEKDAY_LABELS = ['一', '二', '三', '四', '五', '六', '日']
const WEEK_ALL = [1, 2, 3, 4, 5, 6, 7]

/** 模板的排期摘要：每天 / 毑周一三五 / 仅今天 */
function scheduleLabel(t: TaskTemplate): string {
  if (t.kind === 'once') return t.onceDay === nowDay() ? '仅今天' : `仅 ${t.onceDay ?? '今天'}`
  const wd = t.weekdays && t.weekdays.length > 0 ? t.weekdays : WEEK_ALL
  if (wd.length === 7) return '每天'
  return '周' + [...wd].sort().map((d) => WEEKDAY_LABELS[d - 1]).join('')
}

/** P16 家长 · 任务管理 */
export default function P16TaskManage() {
  const nav = useNav()
  const s = useStore()
  const [adding, setAdding] = useState(false)
  /** 正在编辑的模板（null + adding=false = 弹窗关闭） */
  const [editing, setEditing] = useState<TaskTemplate | null>(null)
  // 弹窗表单
  const [name, setName] = useState('')
  const [note, setNote] = useState('')
  const [icon, setIcon] = useState(TASK_ICONS[0])
  const [type, setType] = useState<TaskType>('photo')
  const [kind, setKind] = useState<TaskKind>('regular')
  const [weekdays, setWeekdays] = useState<number[]>(WEEK_ALL)
  const [foodValue, setFoodValue] = useState(1)
  const [adjust, setAdjust] = useState<number>(1)
  const [adjustNote, setAdjustNote] = useState('')
  const [streakFix, setStreakFix] = useState(0)
  const [mediaUrl, setMediaUrl] = useState<string | null>(null)
  const [removeId, setRemoveId] = useState<string | null>(null)
  const [rejectId, setRejectId] = useState<string | null>(null)
  const [rejectReason, setRejectReason] = useState('')

  // 收支提示按「今天真的会出现的任务」算，而不是所有启用模板
  const today = nowDay()
  const dailyProduce = s.templates
    .filter((t) => templateAppliesOn(t, today))
    .reduce((a, t) => a + t.foodValue, 0)
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

  const openCreate = () => {
    setEditing(null)
    setName('')
    setNote('')
    setIcon(TASK_ICONS[0])
    setType('photo')
    setKind('regular')
    setWeekdays(WEEK_ALL)
    setFoodValue(1)
    setAdding(true)
  }

  const openEdit = (t: TaskTemplate) => {
    setEditing(t)
    setName(t.name)
    setNote(t.note ?? '')
    setIcon(t.icon)
    setType(t.type)
    setKind(t.kind ?? 'regular')
    setWeekdays(t.weekdays && t.weekdays.length > 0 ? t.weekdays : WEEK_ALL)
    setFoodValue(t.foodValue)
    setAdding(true)
  }

  const toggleWeekday = (d: number) => {
    setWeekdays((ws) => {
      const next = ws.includes(d) ? ws.filter((x) => x !== d) : [...ws, d].sort()
      // 至少保留一天，否则任务永远不会出现
      return next.length === 0 ? ws : next
    })
  }

  const save = () => {
    if (!name.trim()) return
    const patch = {
      name: name.trim(),
      icon,
      type,
      note: note.trim() || undefined,
      kind,
      weekdays: kind === 'regular' ? weekdays : undefined,
      onceDay: kind === 'once' ? (editing?.onceDay ?? today) : undefined,
      foodValue,
    }
    if (editing) {
      // 「今日任务」编辑后仍限定在原发布日，不会变成每天出现
      s.updateTemplate(editing.id, patch)
      toast('已更新，今天的任务立即生效')
    } else {
      s.addTemplate({ ...patch, enabled: true })
      toast('已发布，孩子首页马上能看到')
    }
    setAdding(false)
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
        今日产出 {dailyProduce} 份 · 宠物维持需 {MAINTAIN_FOOD} 份/天
        {short ? ' ⚠ 产出不足，建议调高单个任务的食物值' : ' ✅'}
      </div>

      <div className="mt-3 rounded-xl3 bg-white p-3 shadow-card">
        <div className="mb-2 text-[14px] font-extrabold text-ink">任务（点名字可以改）</div>
        {s.templates.map((t) => (
          <div key={t.id} className="mb-2 flex items-center gap-2 rounded-2xl bg-sky-50 px-3 py-2.5">
            <span className="text-[20px]">{t.icon}</span>
            <button className="min-w-0 flex-1 text-left" onClick={() => openEdit(t)}>
              <span className="block truncate text-[15px] font-bold text-ink">{t.name}</span>
              <span className="block text-[11px] font-bold text-sky-500">
                {t.kind === 'once' ? '今日任务 · ' : ''}{scheduleLabel(t)}{t.note ? ' · 有说明' : ''}
              </span>
            </button>
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
        <button className="btn-chip w-full" onClick={openCreate}>+ 发布任务</button>
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

      {/* 发布 / 编辑任务 */}
      <Modal open={adding} title={editing ? '编辑任务' : '发布任务'} onClose={() => setAdding(false)}>
        <input className="field" placeholder="任务名字，如：练琴 30 分钟" value={name} onChange={(e) => setName(e.target.value.slice(0, 12))} />
        <textarea
          className="field mt-2 h-16 resize-none"
          placeholder="说明（选填）：写给孩子看的要求，任务页可以朗读"
          value={note}
          onChange={(e) => setNote(e.target.value.slice(0, 60))}
        />
        {note.trim() && (
          <button className="mt-1 text-[13px] font-bold text-sky-600" onClick={() => speak(note.trim(), true)}>
            🔊 试听一下
          </button>
        )}
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

        {/* 任务种类 */}
        <div className="mt-3">
          <div className="mb-1.5 text-[13px] font-bold text-muted">出现方式</div>
          <div className="seg">
            <button data-on={kind === 'regular'} onClick={() => setKind('regular')}>常规任务</button>
            <button data-on={kind === 'once'} onClick={() => setKind('once')}>今日任务</button>
          </div>
          <div className="mt-1.5 text-[12px] text-muted">
            {kind === 'once' ? '只在今天出现，完成后就从列表消失' : '按下面的星期重复出现'}
          </div>
        </div>

        {/* 常规任务：每周排期 */}
        {kind === 'regular' && (
          <div className="mt-3">
            <div className="mb-1.5 text-[13px] font-bold text-muted">每周哪几天出现</div>
            <div className="flex gap-1.5">
              {WEEKDAY_LABELS.map((label, i) => {
                const d = i + 1
                const on = weekdays.includes(d)
                return (
                  <button
                    key={d}
                    onClick={() => toggleWeekday(d)}
                    className={`h-10 flex-1 rounded-xl text-[14px] font-extrabold ${on ? 'bg-sky-400 text-white' : 'bg-sky-50 text-sky-500'}`}
                  >
                    {label}
                  </button>
                )
              })}
            </div>
          </div>
        )}

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
          onClick={save}
        >
          {editing ? '保 存' : '发 布'}
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
