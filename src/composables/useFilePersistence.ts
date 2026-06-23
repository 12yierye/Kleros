/**
 * 文件持久化层
 * OPFS 优先 + localStorage 降级
 * 读取时比较 savedAt 时间戳，取最新数据
 */
import { ref } from 'vue'
import { debug, debugWarn } from '@/utils/debug'
import type { PersistenceData } from './useDB'

const FILE_NAME = 'kleros-data.json'
const LS_KEY = 'kleros.file-backup'

let _useOPFS: boolean | null = null
async function checkOPFS(): Promise<boolean> {
  if (_useOPFS !== null) return _useOPFS
  try {
    if (
      typeof navigator === 'undefined' ||
      !('storage' in navigator) ||
      !('getDirectory' in navigator.storage)
    ) {
      _useOPFS = false
      debug('persist', 'OPFS not available')
      return false
    }
    await navigator.storage.getDirectory()
    _useOPFS = true
    debug('persist', 'OPFS available')
  } catch {
    _useOPFS = false
    debugWarn('persist', 'OPFS check failed')
  }
  return _useOPFS
}

async function opfsRead(): Promise<string | null> {
  try {
    const root = await navigator.storage.getDirectory()
    const handle = await root.getFileHandle(FILE_NAME, { create: false })
    const file = await handle.getFile()
    const text = await file.text()
    debug('persist', 'OPFS read ok', text.length, 'chars')
    return text
  } catch {
    debug('persist', 'OPFS read empty / not found')
    return null
  }
}

async function opfsWrite(json: string): Promise<boolean> {
  try {
    const root = await navigator.storage.getDirectory()
    const handle = await root.getFileHandle(FILE_NAME, { create: true })
    const writable = await handle.createWritable()
    await writable.write(json)
    await writable.close()
    debug('persist', 'OPFS write ok', json.length, 'chars')
    return true
  } catch (e) {
    debugWarn('persist', 'OPFS write failed', e)
    return false
  }
}

function lsRead(): string | null {
  try {
    const raw = localStorage.getItem(LS_KEY)
    if (raw) debug('persist', 'localStorage read ok', raw.length, 'chars')
    else debug('persist', 'localStorage empty')
    return raw
  } catch {
    debugWarn('persist', 'localStorage read failed')
    return null
  }
}

function lsWrite(json: string): boolean {
  try {
    localStorage.setItem(LS_KEY, json)
    debug('persist', 'localStorage write ok', json.length, 'chars')
    return true
  } catch (e) {
    debugWarn('persist', 'localStorage write failed', e)
    return false
  }
}

function parseData(raw: string, source: string): PersistenceData | null {
  try {
    const data = JSON.parse(raw) as PersistenceData
    if (data && data.version === 1) {
      debug('persist', `${source} parse ok, savedAt=${data.savedAt}`)
      return data
    }
    debugWarn('persist', `${source} bad version`, data?.version)
    return null
  } catch {
    debugWarn('persist', `${source} JSON parse failed`)
    return null
  }
}

export function useFilePersistence() {
  const isConnected = ref(false)
  const fileLabel = ref('')

  async function saveToFile(data: PersistenceData): Promise<void> {
    if (!isConnected.value) return
    const json = JSON.stringify(data, null, 2)
    const useOpfs = await checkOPFS()
    if (useOpfs) {
      const ok = await opfsWrite(json)
      if (!ok) lsWrite(json)
    } else {
      lsWrite(json)
    }
  }

  async function loadFromFile(): Promise<PersistenceData | null> {
    debug('persist', '======== loadFromFile start ========')
    let best: PersistenceData | null = null
    let bestTs = 0

    const useOpfs = await checkOPFS()
    if (useOpfs) {
      const text = await opfsRead()
      if (text) {
        const data = parseData(text, 'OPFS')
        if (data && data.savedAt > bestTs) {
          best = data
          bestTs = data.savedAt
        }
      }
    }

    const raw = lsRead()
    if (raw) {
      const data = parseData(raw, 'localStorage')
      if (data && data.savedAt > bestTs) {
        best = data
        bestTs = data.savedAt
      }
    }

    debug('persist', `loadFromFile result: ${best ? `savedAt=${best.savedAt}, source newer` : 'no data'}`)
    return best
  }

  async function init(): Promise<void> {
    debug('persist', '======== init start ========')
    const useOpfs = await checkOPFS()
    if (useOpfs) {
      try {
        const granted = await navigator.storage.persist()
        debug('persist', `navigator.storage.persist() = ${granted}`)
      } catch {}
      fileLabel.value = '本地文件 (OPFS)'
    } else {
      fileLabel.value = '浏览器本地存储'
    }
    isConnected.value = true
    debug('persist', `init done, mode=${fileLabel.value}`)
  }

  return {
    isConnected,
    fileLabel,
    saveToFile,
    loadFromFile,
    init,
  }
}
