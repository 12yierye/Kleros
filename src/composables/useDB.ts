/**
 * IndexedDB 持久化层
 * 替代 useStorage，以数据库方式储存名单、会话等数据
 */

import { ref, watch, type Ref } from 'vue'

const DB_NAME = 'kleros'
const DB_VERSION = 1

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
        for (const name of storeNames) {
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
