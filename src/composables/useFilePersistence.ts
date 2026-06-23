/**
 * 文件持久化层
 * Chromium: File System Access API（固定 JSON 文件）
 * Firefox/其他: localStorage 降级
 */
import { ref } from 'vue'
import { getDB, type PersistenceData } from './useDB'

const FILE_HANDLE_STORE = 'file_handle'
const LS_KEY = 'kleros.file-backup'

function hasFSA(): boolean {
  try {
    return typeof window !== 'undefined' && 'showOpenFilePicker' in window
  } catch {
    return false
  }
}

async function getFileHandle(): Promise<FileSystemFileHandle | null> {
  const db = await getDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(FILE_HANDLE_STORE, 'readonly')
    const store = tx.objectStore(FILE_HANDLE_STORE)
    const req = store.get('handle')
    req.onsuccess = () => resolve((req.result as FileSystemFileHandle) ?? null)
    req.onerror = () => reject(req.error)
  })
}

async function setFileHandle(handle: FileSystemFileHandle | null): Promise<void> {
  const db = await getDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(FILE_HANDLE_STORE, 'readwrite')
    const store = tx.objectStore(FILE_HANDLE_STORE)
    if (handle) {
      store.put(handle, 'handle')
    } else {
      store.delete('handle')
    }
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}

async function verifyPermission(handle: FileSystemFileHandle): Promise<boolean> {
  try {
    const opts: FileSystemHandlePermissionDescriptor = { mode: 'readwrite' }
    if ((await handle.queryPermission(opts)) === 'granted') return true
    return (await handle.requestPermission(opts)) === 'granted'
  } catch {
    return false
  }
}

export function useFilePersistence() {
  const isConnected = ref(false)
  const fileLabel = ref('')
  const mode = hasFSA() ? ('fsa' as const) : ('localstorage' as const)

  async function connectFile(): Promise<boolean> {
    if (mode === 'fsa') {
      try {
        const [handle] = await window.showOpenFilePicker({
          types: [{ description: 'JSON 数据文件', accept: { 'application/json': ['.json'] } }],
          multiple: false,
        })
        if (!(await verifyPermission(handle))) return false
        await setFileHandle(handle)
        isConnected.value = true
        fileLabel.value = handle.name
        return true
      } catch {
        return false
      }
    } else {
      isConnected.value = true
      fileLabel.value = '浏览器本地存储'
      return true
    }
  }

  async function connectNewFile(): Promise<boolean> {
    if (mode !== 'fsa') {
      isConnected.value = true
      fileLabel.value = '浏览器本地存储'
      return true
    }
    try {
      const handle = await window.showSaveFilePicker({
        types: [{ description: 'JSON 数据文件', accept: { 'application/json': ['.json'] } }],
        suggestedName: 'kleros-data.json',
      })
      if (!(await verifyPermission(handle))) return false
      await setFileHandle(handle)
      isConnected.value = true
      fileLabel.value = handle.name
      return true
    } catch {
      return false
    }
  }

  async function disconnectFile(): Promise<void> {
    if (mode === 'fsa') {
      await setFileHandle(null)
    } else {
      try { localStorage.removeItem(LS_KEY) } catch {}
    }
    isConnected.value = false
    fileLabel.value = ''
  }

  async function saveToFile(data: PersistenceData): Promise<void> {
    if (!isConnected.value) return
    const json = JSON.stringify(data, null, 2)
    if (mode === 'fsa') {
      const handle = await getFileHandle()
      if (!handle) return
      if (!(await verifyPermission(handle))) {
        isConnected.value = false
        fileLabel.value = ''
        return
      }
      try {
        const writable = await handle.createWritable()
        await writable.write(json)
        await writable.close()
      } catch (e) {
        console.warn('[filePersistence] write failed', e)
      }
    } else {
      try {
        localStorage.setItem(LS_KEY, json)
      } catch (e) {
        console.warn('[filePersistence] localStorage write failed', e)
      }
    }
  }

  async function loadFromFile(): Promise<PersistenceData | null> {
    if (mode === 'fsa') {
      const handle = await getFileHandle()
      if (!handle) return null
      try {
        if (!(await verifyPermission(handle))) return null
        const file = await handle.getFile()
        const text = await file.text()
        const data = JSON.parse(text) as PersistenceData
        if (data && data.version === 1) return data
        return null
      } catch {
        return null
      }
    } else {
      try {
        const raw = localStorage.getItem(LS_KEY)
        if (!raw) return null
        const data = JSON.parse(raw) as PersistenceData
        if (data && data.version === 1) return data
        return null
      } catch {
        return null
      }
    }
  }

  async function init(): Promise<void> {
    if (mode === 'fsa') {
      const handle = await getFileHandle()
      if (handle) {
        if (await verifyPermission(handle)) {
          isConnected.value = true
          fileLabel.value = handle.name
          return
        }
        await setFileHandle(null)
      }
    } else {
      if (localStorage.getItem(LS_KEY)) {
        isConnected.value = true
        fileLabel.value = '浏览器本地存储'
      }
    }
  }

  return {
    isConnected,
    fileLabel,
    mode,
    connectFile,
    connectNewFile,
    disconnectFile,
    saveToFile,
    loadFromFile,
    init,
  }
}
