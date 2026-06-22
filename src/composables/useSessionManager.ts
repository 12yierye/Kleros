/**
 * 会话工作区协调器
 * - 启动时恢复最近会话或创建新会话
 * - 会话切换：保存当前快照 → 加载目标会话状态
 * - 自动保存：监听 roster / blacklist / whitelist 变更同步到当前会话
 */

import { watch, onMounted, nextTick } from 'vue'
import { useSession } from './useSession'
import { useRoster } from './useRoster'
import { useBlackWhiteList } from './useBlackWhiteList'
import { dbReady } from './useDB'
import { isFullSession } from '@/types/session'
import type { RosterGroup } from '@/types/roster'

export function useSessionManager() {
  const session = useSession()
  const { entries: roster, groups, activeGroupId, ensureDefaultGroup } = useRoster()
  const { list } = useBlackWhiteList()

  let savePending = false

  function syncPickedFlags() {
    const cur = session.current.value
    if (!cur) return
    const pickedUids = new Set(cur.picks.flatMap(p => p.uids))
    for (const e of roster.value) {
      e.pickedThisSession = pickedUids.has(e.uid)
    }
  }

  function saveSnapshot() {
    const cur = session.current.value
    if (!cur) return
    cur.roster = JSON.parse(JSON.stringify(roster.value))
    cur.rosterGroups = JSON.parse(JSON.stringify(groups.value))
    cur.blacklist = [...list.value.black]
    cur.whitelist = [...list.value.white]
  }

  watch(
    [roster, () => list.value.black, () => list.value.white],
    () => {
      if (savePending) return
      savePending = true
      saveSnapshot()
      nextTick(() => { savePending = false })
    },
    { deep: true }
  )

  function switchSession(id: string) {
    saveSnapshot()
    if (session.current.value) {
      session.endCurrentSession()
    }
    const target = session.history.value.find(s => s.id === id)
    if (!target || !isFullSession(target)) return
    session.current.value = target
    roster.value = JSON.parse(JSON.stringify(target.roster || []))
    groups.value = JSON.parse(JSON.stringify(target.rosterGroups || []))
    list.value = {
      black: [...(target.blacklist || [])],
      white: [...(target.whitelist || [])],
    }
    target.endedAt = null
    ensureDefaultGroup()
    syncPickedFlags()
    session.initLastSeen()
  }

  function deleteSessions(ids: string[]) {
    session.deleteSessions(ids)
    if (!session.current.value) {
      session.startNewSession()
      roster.value = []
      groups.value = []
      list.value = { black: [], white: [] }
      ensureDefaultGroup()
    }
  }

  function init() {
    onMounted(async () => {
      await dbReady
      if (session.history.value.length === 0) {
        session.startNewSession()
        ensureDefaultGroup()
      } else {
        const mostRecent = session.history.value[0]
        if (!isFullSession(mostRecent)) {
          session.startNewSession()
          ensureDefaultGroup()
        } else {
          session.current.value = mostRecent
          roster.value = JSON.parse(JSON.stringify(mostRecent.roster || []))
          groups.value = JSON.parse(JSON.stringify(mostRecent.rosterGroups || []))
          list.value = {
            black: [...(mostRecent.blacklist || [])],
            white: [...(mostRecent.whitelist || [])],
          }
          mostRecent.endedAt = null
          ensureDefaultGroup()
        }
      }
      syncPickedFlags()
      session.initLastSeen()
    })
  }

  return {
    ...session,
    switchSession,
    deleteSessions,
    init,
    saveSnapshot,
  }
}
