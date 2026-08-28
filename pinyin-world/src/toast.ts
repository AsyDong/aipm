import { reactive } from 'vue'

export const toast = reactive({ msg: '', visible: false })
let timer: ReturnType<typeof setTimeout> | null = null

export function showToast(msg: string) {
  toast.msg = msg
  toast.visible = true
  if (timer) clearTimeout(timer)
  timer = setTimeout(() => { toast.visible = false }, 2200)
}
