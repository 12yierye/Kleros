/**
 * IndexedDB 持久化层
 * 替代 useStorage，以数据库方式储存名单、会话等数据
 */

import { ref, watch, type Ref } from 'vue'
import { debug } from '@/utils/debug'

const DB_NAME = 'kleros_v4'
const DB_VERSION = 3

let dbPromise: Promise<IDBDatabase> | null = null
let _dbInstance: IDBDatabase | null = null
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
        debug('db', `onupgradeneeded version=${db.version}`)
        for (const name of storeNames) {
          if (!db.objectStoreNames.contains(name)) {
            db.createObjectStore(name)
            debug('db', `created store: ${name}`)
          }
        }
      }
      request.onsuccess = () => {
        const db = request.result
        _dbInstance = db
        debug('db', `opened ${db.name} v${db.version} stores=${Array.from(db.objectStoreNames).join(',')}`)
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
  'kleros.roster.temporary',
  'kleros.roster.permanent',
  'kleros.lists.bw',
  'kleros.session.current',
  'kleros.session.history',
  'kleros.prefs',
]

/** 旧 localStorage/sessionStorage key → DB store 映射 */
const legacyMap: Record<string, string> = {
  'kleros.roster.temporary': 'kleros.roster.temporary',
  'kleros.roster.permanent': 'kleros.roster.permanent',
  'kleros.lists.bw': 'kleros.lists.bw',
  'kleros.session.current': 'kleros.session.current',
  'kleros.session.history': 'kleros.session.history',
  'kleros.prefs': 'kleros.prefs',
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
    dbSave(storeName, JSON.parse(JSON.stringify(val))).catch(err => {
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

/** 删除整个 IndexedDB 数据库（彻底重建用） */
export function deleteDB(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (_dbInstance) {
      try {
        _dbInstance.close()
        debug('db', 'closed existing connection')
      } catch (e) {
        debug('db', 'close failed', e)
      }
      _dbInstance = null
    }
    dbPromise = null
    const req = indexedDB.deleteDatabase(DB_NAME)
    req.onsuccess = () => {
      debug('db', 'deleteDatabase success')
      resolve()
    }
    req.onerror = () => reject(req.error)
    req.onblocked = () => debug('db', 'deleteDatabase blocked, waiting')
  })
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
    readStore<unknown[]>(db, 'kleros.roster.temporary', []),
    readStore<unknown[]>(db, 'kleros.roster.permanent', []),
  ])
  const lists = await readStore<{ black: string[]; white: string[] }>(db, 'kleros.lists.bw', { black: [], white: [] })
  const [cur, hist] = await Promise.all([
    readStore<unknown>(db, 'kleros.session.current', null),
    readStore<unknown[]>(db, 'kleros.session.history', []),
  ])
  const prefs = await readStore<unknown>(db, 'kleros.prefs', null)
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
    writeStore(db, 'kleros.roster.temporary', data.roster.temporary),
    writeStore(db, 'kleros.roster.permanent', data.roster.permanent),
    writeStore(db, 'kleros.lists.bw', data.lists),
    writeStore(db, 'kleros.session.current', data.sessions.current),
    writeStore(db, 'kleros.session.history', data.sessions.history),
    writeStore(db, 'kleros.prefs', data.prefs),
  ])
}
