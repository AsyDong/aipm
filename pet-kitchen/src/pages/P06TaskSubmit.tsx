import { useEffect, useRef, useState } from 'react'
import { useStore } from '../store/useStore'
import { useNav } from '../store/nav'
import { toast } from '../components/ui'
import { compressImage, putMedia } from '../utils/media'
import { speak } from '../utils/speech'
import { uid } from '../utils/id'

const TYPE_HINT: Record<string, string> = {
  photo: '拍一张照片给爸爸妈妈看',
  audio: '录一段声音给爸爸妈妈听',
  subjective: '拍照或者录音都可以',
}

/** P06 任务提交：拍照/录音自动通过，主观类待家长确认 */
export default function P06TaskSubmit({ taskId }: { taskId: string }) {
  const nav = useNav()
  const submitTask = useStore((s) => s.submitTask)
  const task = useStore((s) => s.daily.find((t) => t.id === taskId))

  const photoRef = useRef<HTMLInputElement>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [recording, setRecording] = useState(false)
  const [audioUrl, setAudioUrl] = useState<string | null>(null)
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null)
  const recRef = useRef<MediaRecorder | null>(null)
  const chunks = useRef<Blob[]>([])

  useEffect(() => {
    return () => {
      if (audioUrl) URL.revokeObjectURL(audioUrl)
    }
  }, [audioUrl])

  if (!task) {
    return (
      <div className="p-6 text-center text-muted">
        这个任务已经过期啦
        <button className="btn-chip mt-4" onClick={() => nav.back()}>返回</button>
      </div>
    )
  }

  const showPhoto = task.type === 'photo' || task.type === 'subjective'
  const showAudio = task.type === 'audio' || task.type === 'subjective'

  const handlePhoto = async (file: File) => {
    try {
      const blob = await compressImage(file)
      setPreview(URL.createObjectURL(blob))
      const id = uid('m')
      await putMedia(id, blob)
      submitTask(task.id, id)
      toast(task.type === 'subjective' ? '提交啦，等爸爸妈妈确认' : '完成啦！食物 +' + task.foodValue)
      if (task.type !== 'subjective') nav.back()
    } catch {
      toast('没传上去，再试一次', 'warn')
    }
  }

  const startRec = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const rec = new MediaRecorder(stream)
      recRef.current = rec
      chunks.current = []
      rec.ondataavailable = (e) => chunks.current.push(e.data)
      rec.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop())
        const blob = new Blob(chunks.current, { type: 'audio/webm' })
        setAudioBlob(blob)
        setAudioUrl(URL.createObjectURL(blob))
        setRecording(false)
      }
      rec.start()
      setRecording(true)
      setTimeout(() => rec.state === 'recording' && rec.stop(), 60000)
    } catch {
      toast('请允许使用麦克风哦', 'warn')
    }
  }

  const stopRec = () => recRef.current?.stop()

  const submitAudio = async () => {
    if (!audioBlob) return
    const id = uid('m')
    await putMedia(id, audioBlob)
    submitTask(task.id, id)
    toast(task.type === 'subjective' ? '提交啦，等爸爸妈妈确认' : '完成啦！食物 +' + task.foodValue)
    if (task.type !== 'subjective') nav.back()
  }

  return (
    <div className="px-5 pb-10 pt-4">
      <div className="flex items-center gap-3">
        <button className="text-[15px] font-bold text-muted" onClick={() => nav.back()}>← 返回</button>
        <div className="flex-1 text-center text-[18px] font-extrabold text-ink">{task.name}</div>
        <div className="rounded-full bg-food/15 px-2 py-1 text-[12px] font-extrabold text-food">🍖+{task.foodValue}</div>
      </div>

      <p className="mt-4 text-center text-[14px] text-muted">{TYPE_HINT[task.type]}</p>

      {/* 爸爸妈妈的说明：大字展示 + 朗读按钮（点按钮是明确意图，不受全局朗读开关限制） */}
      {task.note && (
        <div className="mt-3 rounded-xl3 bg-sky-50 px-4 py-3">
          <div className="flex items-start gap-2">
            <p className="flex-1 text-[15px] font-extrabold leading-relaxed text-sky-700">{task.note}</p>
            <button
              className="shrink-0 rounded-full bg-white px-2.5 py-1.5 text-[18px] shadow-card active:scale-95"
              aria-label="朗读说明"
              onClick={() => speak(task.note!, true)}
            >
              🔊
            </button>
          </div>
          <div className="mt-1 text-right text-[11px] font-bold text-sky-500">爸爸妈妈的说明</div>
        </div>
      )}

      {preview && (
        <img src={preview} alt="佐证" className="mt-4 w-full rounded-xl3 object-cover shadow-card" />
      )}

      {audioUrl && (
        <div className="mt-4 rounded-xl3 bg-white p-4 shadow-card">
          <audio src={audioUrl} controls className="w-full" />
          <button className="btn-main mt-3" onClick={submitAudio}>用这段录音</button>
          <button className="mt-2 w-full text-center text-[13px] font-bold text-muted" onClick={() => { setAudioUrl(null); setAudioBlob(null) }}>
            重新录
          </button>
        </div>
      )}

      {!preview && !audioUrl && (
        <div className="mt-6 flex gap-3">
          {showPhoto && (
            <button className="btn-main" onClick={() => photoRef.current?.click()}>
              📷 拍 照
            </button>
          )}
          {showAudio && (
            <button className={showPhoto ? 'btn-sub' : 'btn-main'} onClick={recording ? stopRec : startRec}>
              {recording ? '⏹ 停止录音' : '🎤 录 音'}
            </button>
          )}
        </div>
      )}

      {recording && <div className="mt-4 text-center text-[14px] font-bold text-danger">● 录音中…最多 60 秒</div>}

      {task.status === 'pending' && (
        <div className="mt-6 rounded-xl3 bg-warn/15 px-4 py-3 text-center text-[15px] font-bold text-warn">
          ⏳ 等待爸爸妈妈看一下
        </div>
      )}

      {task.rejectReason && (
        <div className="mt-4 rounded-xl3 bg-danger/10 px-4 py-3 text-[14px] font-bold text-danger">
          爸爸妈妈说：{task.rejectReason}
        </div>
      )}

      <input
        ref={photoRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0]
          if (f) void handlePhoto(f)
        }}
      />
    </div>
  )
}
