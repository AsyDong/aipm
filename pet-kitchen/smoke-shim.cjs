// Node 环境 shim：让 zustand persist / IndexedDB 相关代码能在 Node 里跑
const store = new Map()
globalThis.localStorage = {
  getItem: (k) => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => store.set(k, String(v)),
  removeItem: (k) => store.delete(k),
  clear: () => store.clear(),
  key: (i) => Array.from(store.keys())[i] ?? null,
  get length() { return store.size },
}
globalThis.window = globalThis
globalThis.self = globalThis
globalThis.indexedDB = undefined
globalThis.speechSynthesis = { speak() {}, cancel() {} }
globalThis.SpeechSynthesisUtterance = function () {}
globalThis.createObjectURL = () => 'blob:fake'
