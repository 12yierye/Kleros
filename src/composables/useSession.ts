/**
 * 会话管理
 * - 每个会话保存完整状态快照（名单+过滤），支持切换恢复
 * - 启动逻辑交给 useSessionManager
 */

import { ref, computed, watch, type Ref } from 'vue'
import { useDB } from './useDB'
import { useSettings } from './useSettings'
import { uid } from '@/utils/id'
import { STORAGE_KEYS, UID_PREFIX } from '@/constants'
import type { Session, SessionSummary, PickMode, PickRecord } from '@/types/session'

let _current: Ref<Session | null> | undefined
function getCurrent() {
  if (!_current) _current = useDB<Session | null>(STORAGE_KEYS.SESSION_CURRENT, null)
  return _current
}

let _history: Ref<(Session | SessionSummary)[]> | undefined
function getHistory() {
  if (!_history) _history = useDB<(Session | SessionSummary)[]>(STORAGE_KEYS.SESSION_HISTORY, [])
  return _history
}

function timestampTitle(): string {
  const d = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
}

export function useSession() {
  const current = getCurrent()
  const history = getHistory()
  const { prefs } = useSettings()

  const totalPickedThisSession = computed(() => current.value?.totalPicked ?? 0)

  function startNewSession() {
    if (current.value) endCurrentSession()
    const session: Session = {
      id: uid(UID_PREFIX.SESSION),
      title: timestampTitle(),
      startedAt: Date.now(),
      endedAt: null,
      picks: [],
      totalPicked: 0,
      roster: [],
      rosterGroups: [],
      blacklist: [],
      whitelist: [],
    }
    current.value = session
    history.value = [session, ...history.value]
    trimHistory()
  }

  function endCurrentSession() {
    if (!current.value) return
    current.value.endedAt = Date.now()
    const idx = history.value.findIndex(s => s.id === current.value!.id)
    if (idx >= 0) history.value[idx] = { ...current.value }
  }

  function appendPick(uids: string[], mode: PickMode) {
    if (!current.value) return
    const rec: PickRecord = { time: Date.now(), mode, uids: [...uids] }
    current.value.picks.push(rec)
    current.value.totalPicked += uids.length
    const idx = history.value.findIndex(s => s.id === current.value!.id)
    if (idx >= 0) history.value[idx] = { ...current.value }
  }

  function trimHistory() {
    const limit = Math.max(1, prefs.value.historyLimit)
    if (history.value.length <= limit) return
    const overflow = history.value.length - limit
    const kept: (Session | SessionSummary)[] = []
    for (let i = 0; i < history.value.length; i++) {
      const s = history.value[i]
      if (i < overflow && 'picks' in s) {
        kept.push({
          id: s.id,
          title: s.title,
          startedAt: s.startedAt,
          endedAt: s.endedAt,
          totalPicked: s.totalPicked,
          compressed: true,
        })
      } else {
        kept.push(s)
      }
    }
    history.value = kept.slice(0, limit)
  }

  function deleteSession(sessionId: string) {
    history.value = history.value.filter(s => s.id !== sessionId)
    if (current.value?.id === sessionId) current.value = null
  }

  function deleteSessions(ids: string[]) {
    const idSet = new Set(ids)
    history.value = history.value.filter(s => !idSet.has(s.id))
    if (current.value && idSet.has(current.value.id)) current.value = null
  }

  function clearAllHistory() {
    history.value = []
    startNewSession()
  }

  function undoToPick(pickIndex: number): string[] | null {
    if (!current.value) return null
    if (pickIndex < 0 || pickIndex >= current.value.picks.length) return null
    const undone = current.value.picks.slice(pickIndex).flatMap(p => p.uids)
    current.value.picks = current.value.picks.slice(0, pickIndex)
    current.value.totalPicked = current.value.picks.reduce((sum, p) => sum + p.uids.length, 0)
    const idx = history.value.findIndex(s => s.id === current.value!.id)
    if (idx >= 0) history.value[idx] = { ...current.value }
    return undone
  }

  /** 自动开新会话监听：totalPicked 达到阈值 */
  let lastSeenCount = 0
  watch(totalPickedThisSession, (n) => {
    const threshold = prefs.value.autoNewSessionAfter
    if (threshold <= 0) return
    if (lastSeenCount < threshold && n >= threshold) {
      startNewSession()
    }
    lastSeenCount = n
  })

  function initLastSeen() {
    lastSeenCount = totalPickedThisSession.value
  }

  return {
    current,
    history,
    totalPickedThisSession,
    startNewSession,
    endCurrentSession,
    appendPick,
    undoToPick,
    deleteSession,
    deleteSessions,
    clearAllHistory,
    initLastSeen,
  }
}
