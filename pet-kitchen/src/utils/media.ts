/**
 * 佐证照片/录音走 IndexedDB（localStorage 装不下），**AES-GCM 加密后落库**，30 天自动清理。
 *
 * 为什么要加密（PRD §8）：
 *   这类佐证可能拍到孩子的脸、录到孩子的声音，属儿童**敏感**个人信息。
 *   明文躺在 IndexedDB 里，任何能打开 DevTools 的人、任何同源脚本、
 *   以及任何把存储目录/云端备份拷走的人，都能直接拿到原图原声。
 *   加密后落库的是密文，拷走也解不开 —— 这正是「加密存储」的实际收益。
 *
 * 边界（说清楚，别过度承诺）：
 *   密钥也存在本机（IndexedDB 的 keys store），所以这是**本机静态加密**，
 *   不是端到端加密。它防的是「拿到数据文件 / 备份副本的人」，
 *   防不了「已经能完全控制这台设备、能在页面里调 API 的人」——
 *   后者在浏览器里任何方案都防不住（孩子自己能看自己的照片是产品需求）。
 *   密钥本身 mark 成 `extractable: false`：即便拿到那个 IDB 记录，
 *   也导不出原始密钥字节，只能在这个浏览器上下文里用。
 *
 * 降级：WebCrypto 不可用（非安全上下文，比如直接用 file:// 打开）时
 *   优雅地退回明文存储，行为与改造前完全一致，不会让孩子存不了佐证。
 *   用 http://localhost 或 https 打开时 crypto.subtle 一定可用。
 */

const DB_NAME = 'petcheckin_media'
const STORE = 'blobs'
/** 密钥单独一个 store：密文与密钥分离，便于将来把密钥换成设备级保护（如 passkey / 系统钥匙串） */
const KEY_STORE = 'keys'
const KEY_ID = 'media-key-v1'
const MAX_AGE = 30 * 86400_000
/** 1 → 2：新增 keys store */
const DB_VERSION = 2

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE)
      if (!db.objectStoreNames.contains(KEY_STORE)) db.createObjectStore(KEY_STORE)
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

async function txOn<T>(
  store: string,
  mode: IDBTransactionMode,
  fn: (s: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  const db = await open()
  return new Promise<T>((resolve, reject) => {
    const t = db.transaction(store, mode)
    const req = fn(t.objectStore(store))
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
    t.oncomplete = () => db.close()
  })
}

// ---------- 加密原语（与 IndexedDB 解耦，便于单独测试） ----------

export interface Sealed {
  iv: Uint8Array
  data: ArrayBuffer
}

/** 造一把新密钥：AES-GCM 256 位，**不可导出**（extractable=false） */
export async function newMediaKey(): Promise<CryptoKey> {
  return (await crypto.subtle.generateKey(
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  )) as CryptoKey
}

/**
 * TS 5.7 起 Uint8Array 带上了 ArrayBufferLike 泛型（可能指向 SharedArrayBuffer），
 * 而 WebCrypto 只接受 BufferSource。运行时是同一个对象，这里只把类型收窄。
 */
const asIv = (u: Uint8Array): BufferSource => u as unknown as BufferSource

/** 加密一段字节。iv 每次随机 —— 同一明文两次的结果也不同 */
export async function sealBytes(bytes: ArrayBuffer, key: CryptoKey): Promise<Sealed> {
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const data = await crypto.subtle.encrypt({ name: 'AES-GCM', iv: asIv(iv) }, key, bytes)
  return { iv, data }
}

/** 解密。密钥不对或数据被改过都会抛错（AES-GCM 自带完整性校验） */
export async function openBytes(sealed: Sealed, key: CryptoKey): Promise<ArrayBuffer> {
  return crypto.subtle.decrypt({ name: 'AES-GCM', iv: asIv(sealed.iv) }, key, sealed.data)
}

// ---------- 密钥的持久化 ----------

let keyPromise: Promise<CryptoKey | null> | null = null

function webCryptoReady(): boolean {
  return typeof crypto !== 'undefined' && !!crypto.subtle && typeof crypto.subtle.generateKey === 'function'
}

/** 取密钥：没有就造一把存进 keys store。WebCrypto 不可用时返回 null（调用方退化为明文） */
async function loadKey(): Promise<CryptoKey | null> {
  if (!webCryptoReady()) return null
  if (!keyPromise) {
    keyPromise = (async () => {
      const hit = await txOn<CryptoKey | undefined>(KEY_STORE, 'readonly', (s) => s.get(KEY_ID))
      if (hit) return hit
      const key = await newMediaKey()
      await txOn(KEY_STORE, 'readwrite', (s) => s.put(key, KEY_ID) as IDBRequest<IDBValidKey>)
      return key
    })().catch(() => null)
  }
  return keyPromise
}

// ---------- 记录形状 ----------

/** 加密记录。type 单独存：加密只覆盖字节，Blob 的 MIME 类型拿不回来 */
interface SealedRec {
  v: 1
  iv: Uint8Array
  data: ArrayBuffer
  type: string
  at: number
}

/** 改造前存进去的明文记录，读到就顺手升级为密文 */
interface PlainRec {
  blob: Blob
  at: number
}

// ---------- 对外接口（签名与改造前完全一致，调用点零改动） ----------

export async function putMedia(id: string, blob: Blob): Promise<void> {
  const at = Date.now()
  const key = await loadKey()
  if (!key) {
    // WebCrypto 不可用：退回明文，至少别让孩子存不了
    await txOn(STORE, 'readwrite', (s) => s.put({ blob, at } as PlainRec, id) as IDBRequest<IDBValidKey>)
    return
  }
  const sealed = await sealBytes(await blob.arrayBuffer(), key)
  const rec: SealedRec = {
    v: 1,
    iv: sealed.iv,
    data: sealed.data,
    type: blob.type || 'application/octet-stream',
    at,
  }
  await txOn(STORE, 'readwrite', (s) => s.put(rec, id) as IDBRequest<IDBValidKey>)
}

export async function getMedia(id: string): Promise<Blob | null> {
  try {
    const rec = await txOn<SealedRec | PlainRec | undefined>(STORE, 'readonly', (s) => s.get(id))
    if (!rec) return null
    // 老数据（明文）：照旧返回，并顺手加密重存（懒迁移，只发生一次）
    if ('blob' in rec) {
      void putMedia(id, rec.blob)
      return rec.blob
    }
    const key = await loadKey()
    if (!key) return null
    const buf = await openBytes({ iv: rec.iv, data: rec.data }, key)
    return new Blob([buf], { type: rec.type })
  } catch {
    return null
  }
}

export async function delMedia(id: string): Promise<void> {
  try {
    await txOn(STORE, 'readwrite', (s) => s.delete(id) as unknown as IDBRequest<undefined>)
  } catch {
    /* ignore */
  }
}

/** 清理 30 天前的佐证 */
export async function pruneMedia(): Promise<void> {
  try {
    const db = await open()
    await new Promise<void>((resolve) => {
      const t = db.transaction(STORE, 'readwrite')
      const store = t.objectStore(STORE)
      const cur = store.openCursor()
      cur.onsuccess = () => {
        const c = cur.result
        if (!c) return resolve()
        const v = c.value as { at?: number }
        if (v?.at && Date.now() - v.at > MAX_AGE) c.delete()
        c.continue()
      }
      cur.onerror = () => resolve()
      t.oncomplete = () => {
        db.close()
        resolve()
      }
    })
  } catch {
    /* ignore */
  }
}

/** 压缩图片到长边 ≤1280、质量 0.7 的 JPEG */
export async function compressImage(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file)
  const max = 1280
  const scale = Math.min(1, max / Math.max(bitmap.width, bitmap.height))
  const w = Math.round(bitmap.width * scale)
  const h = Math.round(bitmap.height * scale)
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')!
  ctx.drawImage(bitmap, 0, 0, w, h)
  bitmap.close?.()
  return new Promise<Blob>((resolve) => canvas.toBlob((b) => resolve(b ?? file), 'image/jpeg', 0.7))
}

export function blobToUrl(blob: Blob): string {
  return URL.createObjectURL(blob)
}
