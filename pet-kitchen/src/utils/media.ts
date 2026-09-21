/** 佐证照片/录音走 IndexedDB（localStorage 装不下），30 天自动清理（合规） */

const DB_NAME = 'petcheckin_media'
const STORE = 'blobs'
const MAX_AGE = 30 * 86400_000

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE)
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

async function tx<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await open()
  return new Promise<T>((resolve, reject) => {
    const t = db.transaction(STORE, mode)
    const req = fn(t.objectStore(STORE))
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
    t.oncomplete = () => db.close()
  })
}

export async function putMedia(id: string, blob: Blob): Promise<void> {
  await tx('readwrite', (s) => s.put({ blob, at: Date.now() }, id) as IDBRequest<IDBValidKey>)
}

export async function getMedia(id: string): Promise<Blob | null> {
  try {
    const rec = await tx<{ blob: Blob; at: number } | undefined>('readonly', (s) => s.get(id))
    return rec?.blob ?? null
  } catch {
    return null
  }
}

export async function delMedia(id: string): Promise<void> {
  try {
    await tx('readwrite', (s) => s.delete(id) as unknown as IDBRequest<undefined>)
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
