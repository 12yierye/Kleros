import { STORAGE_KEYS } from '../constants'

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

const VALIDATORS: Record<string, (v: unknown) => boolean> = {
  rosterTemp: Array.isArray,
  rosterPerm: Array.isArray,
  listsBlack: Array.isArray,
  listsWhite: Array.isArray,
  sessionsHistory: Array.isArray,
}

export function importData(json: string): ImportResult {
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

  const local = window.localStorage
  const session = window.sessionStorage

  if (rosterTemp !== undefined) {
    session.setItem(STORAGE_KEYS.ROSTER_TEMP, JSON.stringify(rosterTemp))
  }
  if (rosterPerm !== undefined) {
    local.setItem(STORAGE_KEYS.ROSTER_PERMANENT, JSON.stringify(rosterPerm))
  }
  if (parsed.lists !== undefined) {
    local.setItem(STORAGE_KEYS.LISTS_BW, JSON.stringify({ black: listsBlack ?? [], white: listsWhite ?? [] }))
  }
  if (parsed.sessions !== undefined) {
    if (sessionsCur !== undefined && sessionsCur !== null) {
      local.setItem(STORAGE_KEYS.SESSION_CURRENT, JSON.stringify(sessionsCur))
    } else {
      local.removeItem(STORAGE_KEYS.SESSION_CURRENT)
    }
    if (sessionsHist !== undefined) {
      local.setItem(STORAGE_KEYS.SESSION_HISTORY, JSON.stringify(sessionsHist))
    }
  }
  if (parsed.prefs !== undefined) {
    local.setItem(STORAGE_KEYS.PREFS, JSON.stringify(parsed.prefs))
  }

  return { ok: true }
}

export function readFileAsJSON(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result ?? ''))
    reader.onerror = () => reject(reader.error)
    reader.readAsText(file, 'utf-8')
  })
}
