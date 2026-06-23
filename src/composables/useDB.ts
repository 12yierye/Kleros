/**
 * IndexedDB 持久化层
 * 替代 useStorage，以数据库方式储存名单、会话等数据
 */

import { ref, watch, type Ref } from 'vue'

const DB_NAME = 'kleros'
const DB_VERSION = 2

let dbPromise: Promise<IDBDatabase> | null = null
let migrating = false
let _loadCount = 0
let _dbReadyResolve: (() => void) | null = null
export const dbReady = new Promise<void>(resolve => { _dbReadyResolve = resolve })

export function getDB(): Promise<IDBDatabase> {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION)
      request.onupgradeneeded = () => {
        const db = request.result
        const all = [...storeNames, 'file_handle']
        for (const name of all) {
          if (!db.objectStoreNames.contains(name)) {
            db.createObjectStore(name)
          }
        }
      }
      request.onsuccess = () => {
        const db = request.result
        if (!migrating) {
          migrating = true
          migrateFromLegacy(db).finally(() => resolve(db))
        } else {
          resolve(db)
        }
      }
      request.onerror = () => reject(request.error)
    })
  }
  return dbPromise
}

const storeNames = [
  'roster_temporary',
  'roster_permanent',
  'lists_bw',
  'session_current',
  'session_history',
  'prefs',
]

/** 旧 localStorage/sessionStorage key → DB store 映射 */
const legacyMap: Record<string, string> = {
  'kleros.roster.temporary': 'roster_temporary',
  'kleros.roster.permanent': 'roster_permanent',
  'kleros.lists.bw': 'lists_bw',
  'kleros.session.current': 'session_current',
  'kleros.session.history': 'session_history',
  'kleros.prefs': 'prefs',
}

async function migrateFromLegacy(db: IDBDatabase) {
  let migrated = false
  for (const [storageKey, storeName] of Object.entries(legacyMap)) {
    let raw: string | null = null
    try { raw = localStorage.getItem(storageKey) } catch { /* noop */ }
    if (raw === null) {
      try { raw = sessionStorage.getItem(storageKey) } catch { /* noop */ }
    }
    if (raw !== null) {
      try {
        const data = JSON.parse(raw)
        const tx = db.transaction(storeName, 'readwrite')
        const store = tx.objectStore(storeName)
        store.put(data, 'value')
        await new Promise<void>((resolve, reject) => {
          tx.oncomplete = () => resolve()
          tx.onerror = () => reject(tx.error)
        })
        migrated = true
        try { localStorage.removeItem(storageKey) } catch { /* noop */ }
        try { sessionStorage.removeItem(storageKey) } catch { /* noop */ }
      } catch (e) {
        console.warn(`[useDB] migration failed for ${storageKey}`, e)
      }
    }
  }
  if (migrated) {
    console.log('[useDB] migrated legacy data to IndexedDB')
  }
}

async function dbLoad<T>(storeName: string, key = 'value'): Promise<T | undefined> {
  const db = await getDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readonly')
    const store = tx.objectStore(storeName)
    const req = store.get(key)
    req.onsuccess = () => resolve(req.result as T | undefined)
    req.onerror = () => reject(req.error)
  })
}

async function dbSave<T>(storeName: string, value: T, key = 'value'): Promise<void> {
  const db = await getDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite')
    const store = tx.objectStore(storeName)
    const req = store.put(value, key)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}

export function useDB<T>(storeName: string, defaultValue: T): Ref<T> {
  const state = ref(defaultValue) as Ref<T>
  let ready = false
  let counted = false

  dbLoad<T>(storeName).then(data => {
    if (data !== undefined) {
      state.value = data
    }
    ready = true
    if (!counted) {
      counted = true
      _loadCount++
      if (_loadCount >= storeNames.length && _dbReadyResolve) {
        _dbReadyResolve()
        _dbReadyResolve = null
      }
    }
  }).catch(err => {
    console.warn(`[useDB] failed to load ${storeName}`, err)
    ready = true
    if (!counted) {
      counted = true
      _loadCount++
      if (_loadCount >= storeNames.length && _dbReadyResolve) {
        _dbReadyResolve()
        _dbReadyResolve = null
      }
    }
  })

  watch(state, (val) => {
    if (!ready) return
    dbSave(storeName, val).catch(err => {
      console.error(`[useDB] failed to save ${storeName}`, err)
    })
  }, { deep: true })

  return state
}

/** 清除 IndexedDB 中所有 Kleros 数据 */
export async function clearAllDB(): Promise<void> {
  const db = await getDB()
  const names = Array.from(db.objectStoreNames)
  for (const name of names) {
    const tx = db.transaction(name, 'readwrite')
    const store = tx.objectStore(name)
    store.clear()
    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error)
    })
  }
}

export interface PersistenceData {
  version: 1
  savedAt: number
  roster: { temporary: unknown[]; permanent: unknown[] }
  lists: { black: string[]; white: string[] }
  sessions: { current: unknown; history: unknown[] }
  prefs: unknown
}

async function readStore<T>(db: IDBDatabase, name: string, fallback: T): Promise<T> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(name, 'readonly')
    const store = tx.objectStore(name)
    const req = store.get('value')
    req.onsuccess = () => resolve((req.result as T) ?? fallback)
    req.onerror = () => reject(req.error)
  })
}

async function writeStore(db: IDBDatabase, name: string, value: unknown): Promise<void> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(name, 'readwrite')
    const store = tx.objectStore(name)
    store.put(value, 'value')
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}

export async function exportAllDB(): Promise<PersistenceData> {
  const db = await getDB()
  const [temp, perm] = await Promise.all([
    readStore<unknown[]>(db, 'roster_temporary', []),
    readStore<unknown[]>(db, 'roster_permanent', []),
  ])
  const lists = await readStore<{ black: string[]; white: string[] }>(db, 'lists_bw', { black: [], white: [] })
  const [cur, hist] = await Promise.all([
    readStore<unknown>(db, 'session_current', null),
    readStore<unknown[]>(db, 'session_history', []),
  ])
  const prefs = await readStore<unknown>(db, 'prefs', null)
  return {
    version: 1,
    savedAt: Date.now(),
    roster: { temporary: temp, permanent: perm },
    lists,
    sessions: { current: cur, history: hist },
    prefs,
  }
}

export async function importAllDB(data: PersistenceData): Promise<void> {
  const db = await getDB()
  await Promise.all([
    writeStore(db, 'roster_temporary', data.roster.temporary),
    writeStore(db, 'roster_permanent', data.roster.permanent),
    writeStore(db, 'lists_bw', data.lists),
    writeStore(db, 'session_current', data.sessions.current),
    writeStore(db, 'session_history', data.sessions.history),
    writeStore(db, 'prefs', data.prefs),
  ])
}
