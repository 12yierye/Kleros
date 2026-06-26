/**
 * 会话工作区协调器
 * - 启动时恢复最近会话或创建新会话
 * - 会话切换：保存当前快照 → 加载目标会话状态
 * - 自动保存：监听 roster / blacklist / whitelist 变更同步到当前会话
 */

import { watch, nextTick } from 'vue'
import { useSession } from './useSession'
import { useRoster } from './useRoster'
import { useBlackWhiteList } from './useBlackWhiteList'
import { dbReady } from './useDB'
import { isFullSession } from '@/types/session'
import { debug } from '@/utils/debug'

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
    debug('session', `saveSnapshot roster=${cur.roster.length} picks=${cur.totalPicked}`)
  }

  watch(
    [roster, groups, () => list.value.black, () => list.value.white],
    () => {
      if (savePending) return
      savePending = true
      saveSnapshot()
      nextTick(() => { savePending = false })
    },
    { deep: true, flush: 'sync' }
  )

  function migrateBindingGroups(target: { bindingGroups: unknown }): void {
    if (!Array.isArray(target.bindingGroups)) {
      target.bindingGroups = []
      return
    }
    type Old = { id: string; name: string; color: string; memberUids: string[]; createdAt: number }
    type New = { id: string; name: string; color: string; members: { uid: string; addedAt: number }[]; createdAt: number }
    target.bindingGroups = (target.bindingGroups as Array<Old | New>).map((g): New => {
      const anyG = g as Old & New
      if (Array.isArray((anyG as New).members)) return anyG as New
      const memberUids = Array.isArray((anyG as Old).memberUids) ? (anyG as Old).memberUids : []
      const createdAt = typeof anyG.createdAt === 'number' ? anyG.createdAt : Date.now()
      return {
        id: anyG.id,
        name: anyG.name,
        color: anyG.color,
        members: memberUids.map(uid => ({ uid, addedAt: createdAt })),
        createdAt,
      }
    })
  }

  function switchSession(id: string) {
    saveSnapshot()
    if (session.current.value) {
      session.endCurrentSession()
    }
    const target = session.history.value.find(s => s.id === id)
    if (!target || !isFullSession(target)) return
    migrateBindingGroups(target as { bindingGroups: unknown })
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

  async function init() {
    await dbReady
    debug('session', `init history.length=${session.history.value.length}`)
    if (session.history.value.length === 0) {
      debug('session', 'no history, starting new session')
      session.startNewSession()
      ensureDefaultGroup()
    } else {
      const mostRecent = session.history.value[0]
      if (!isFullSession(mostRecent)) {
        debug('session', 'most recent is compressed, starting new')
        session.startNewSession()
        ensureDefaultGroup()
      } else {
        debug('session', `restoring session ${mostRecent.id} picks=${mostRecent.picks.length} roster=${(mostRecent.roster || []).length}`)
        migrateBindingGroups(mostRecent as { bindingGroups: unknown })
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
    debug('session', `init done, roster=${roster.value.length}`)
  }

  return {
    ...session,
    switchSession,
    deleteSessions,
    init,
    saveSnapshot,
  }
}
