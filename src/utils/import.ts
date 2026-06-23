import { getDB } from '@/composables/useDB'
import type { PersistenceData } from '@/composables/useDB'

interface ImportData {
  version?: number
  roster?: {
    temporary?: unknown[]
    permanent?: unknown[]
  }
  lists?: {
    black?: string[]
    white?: string[]
  }
  sessions?: {
    current?: unknown
    history?: unknown[]
  }
  prefs?: unknown
}

interface ImportResult {
  ok: boolean
  error?: string
}

export async function importData(json: string): Promise<ImportResult> {
  let parsed: ImportData
  try {
    parsed = JSON.parse(json) as ImportData
  } catch {
    return { ok: false, error: 'JSON 解析失败：文件格式无效' }
  }

  if (!parsed || typeof parsed !== 'object') {
    return { ok: false, error: 'JSON 顶层必须是对象' }
  }

  const rosterTemp = parsed.roster?.temporary
  const rosterPerm = parsed.roster?.permanent
  const listsBlack = parsed.lists?.black
  const listsWhite = parsed.lists?.white
  const sessionsCur = parsed.sessions?.current
  const sessionsHist = parsed.sessions?.history

  if (rosterTemp !== undefined && !Array.isArray(rosterTemp)) {
    return { ok: false, error: 'roster.temporary 必须是数组' }
  }
  if (rosterPerm !== undefined && !Array.isArray(rosterPerm)) {
    return { ok: false, error: 'roster.permanent 必须是数组' }
  }
  if (listsBlack !== undefined && !Array.isArray(listsBlack)) {
    return { ok: false, error: 'lists.black 必须是数组' }
  }
  if (listsWhite !== undefined && !Array.isArray(listsWhite)) {
    return { ok: false, error: 'lists.white 必须是数组' }
  }
  if (sessionsHist !== undefined && !Array.isArray(sessionsHist)) {
    return { ok: false, error: 'sessions.history 必须是数组' }
  }

  const db = await getDB()

  const writes: Promise<void>[] = []

  if (rosterTemp !== undefined) {
    writes.push(writeDB(db, 'kleros.roster.temporary', rosterTemp))
  }
  if (rosterPerm !== undefined) {
    writes.push(writeDB(db, 'kleros.roster.permanent', rosterPerm))
  }
  if (parsed.lists !== undefined) {
    writes.push(writeDB(db, 'kleros.lists.bw', { black: listsBlack ?? [], white: listsWhite ?? [] }))
  }
  if (parsed.sessions !== undefined) {
    writes.push(writeDB(db, 'kleros.session.current', sessionsCur ?? null))
    if (sessionsHist !== undefined) {
      writes.push(writeDB(db, 'kleros.session.history', sessionsHist))
    }
  }
  if (parsed.prefs !== undefined) {
    writes.push(writeDB(db, 'kleros.prefs', parsed.prefs))
  }

  await Promise.all(writes)
  return { ok: true }
}

function writeDB(db: IDBDatabase, storeName: string, value: unknown): Promise<void> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite')
    const store = tx.objectStore(storeName)
    store.put(value, 'value')
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}

export function readFileAsJSON(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result ?? ''))
    reader.onerror = () => reject(reader.error)
    reader.readAsText(file, 'utf-8')
  })
}
