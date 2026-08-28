import { reactive } from 'vue'

export const route = reactive<{ page: string; params: Record<string, any> }>({ page: 'home', params: {} })

export function go(page: string, params: Record<string, any> = {}) {
  route.page = page
  route.params = params
  window.scrollTo(0, 0)
}

export function back() {
  go('home')
}
