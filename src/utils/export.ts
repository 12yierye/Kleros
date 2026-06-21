import { STORAGE_KEYS } from '../constants'

interface ExportData {
  version: 1
  exportedAt: number
  roster: {
    temporary: unknown[]
    permanent: unknown[]
  }
  lists: {
    black: string[]
    white: string[]
  }
  sessions: {
    current: unknown
    history: unknown[]
  }
  prefs: unknown
}

export function exportAll(): ExportData {
  return {
    version: 1,
    exportedAt: Date.now(),
    roster: {
      temporary: readJSON<unknown[]>(STORAGE_KEYS.ROSTER_TEMP, 'session', []),
      permanent: readJSON<unknown[]>(STORAGE_KEYS.ROSTER_PERMANENT, 'local', []),
    },
    lists: readJSON<{ black: string[]; white: string[] }>(STORAGE_KEYS.LISTS_BW, 'local', { black: [], white: [] }),
    sessions: {
      current: readJSON<unknown>(STORAGE_KEYS.SESSION_CURRENT, 'local', null),
      history: readJSON<unknown[]>(STORAGE_KEYS.SESSION_HISTORY, 'local', []),
    },
    prefs: readJSON<unknown>(STORAGE_KEYS.PREFS, 'local', null),
  }
}

export function downloadExport() {
  const data = exportAll()
  const json = JSON.stringify(data, null, 2)
  const blob = new Blob([json], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  const date = new Date().toISOString().slice(0, 10)
  a.download = `kleros-export-${date}.json`
  a.click()
  URL.revokeObjectURL(url)
}

function readJSON<T>(key: string, kind: 'local' | 'session', fallback: T): T {
  const store = kind === 'local' ? window.localStorage : window.sessionStorage
  try {
    const raw = store.getItem(key)
    return raw ? (JSON.parse(raw) as T) : fallback
  } catch {
    return fallback
  }
}
