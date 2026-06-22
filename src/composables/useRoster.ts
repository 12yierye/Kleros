/**
 * 临时名单（sessionStorage）
 * 支持多分组：一个会话可包含多个临时名单
 */

import { ref, computed, type Ref } from 'vue'
import { useDB } from './useDB'
import { uid } from '@/utils/id'
import { STORAGE_KEYS, UID_PREFIX } from '@/constants'
import type { RosterEntry, RosterGroup, Name } from '@/types/roster'

let _entries: Ref<RosterEntry[]> | undefined
function getEntries() {
  if (!_entries) _entries = useDB<RosterEntry[]>(STORAGE_KEYS.ROSTER_TEMP, [])
  return _entries
}

let _groups: Ref<RosterGroup[]> | undefined
function getGroups() {
  if (!_groups) _groups = ref<RosterGroup[]>([])
  return _groups
}

let _activeGroupId: Ref<string> | undefined
function getActiveGroupId() {
  if (!_activeGroupId) _activeGroupId = ref<string>('')
  return _activeGroupId
}

let _crossGroup: Ref<boolean> | undefined
function getCrossGroup() {
  if (!_crossGroup) _crossGroup = ref<boolean>(false)
  return _crossGroup
}

export function useRoster() {
  const entries = getEntries()
  const groups = getGroups()
  const activeGroupId = getActiveGroupId()
  const crossGroup = getCrossGroup()

  const count = computed(() => entries.value.length)

  const currentEntries = computed(() =>
    entries.value.filter(e => e.groupId === activeGroupId.value)
  )

  const groupNames = computed(() =>
    groups.value.reduce<Record<string, string>>((m, g) => {
      m[g.id] = g.name
      return m
    }, {})
  )

  function ensureDefaultGroup() {
    if (groups.value.length === 0) {
      const g: RosterGroup = {
        id: uid(UID_PREFIX.GROUP),
        name: '临时名单',
      }
      groups.value = [g]
    }
    if (!groups.value.find(g => g.id === activeGroupId.value)) {
      activeGroupId.value = groups.value[0].id
    }
    const defaultId = groups.value[0].id
    let migrated = false
    for (const e of entries.value) {
      if (!e.groupId) {
        e.groupId = defaultId
        migrated = true
      }
    }
    if (migrated) {
      entries.value = [...entries.value]
    }
  }

  function addGroup(): string {
    const existing = groups.value.map(g => g.name)
    let n = 2
    let name = '临时名单2'
    while (existing.includes(name)) {
      n++
      name = `临时名单${n}`
    }
    const g: RosterGroup = {
      id: uid(UID_PREFIX.GROUP),
      name,
    }
    groups.value = [...groups.value, g]
    activeGroupId.value = g.id
    return g.id
  }

  function renameGroup(id: string, name: string) {
    groups.value = groups.value.map(g =>
      g.id === id ? { ...g, name } : g
    )
  }

  function deleteGroup(id: string): boolean {
    if (groups.value.length <= 1) {
      groups.value = [{ ...groups.value[0] }]
      entries.value = entries.value.filter(e => e.groupId !== id)
      if (activeGroupId.value === id) {
        activeGroupId.value = groups.value[0].id
      }
      return false
    }
    entries.value = entries.value.filter(e => e.groupId !== id)
    groups.value = groups.value.filter(g => g.id !== id)
    if (activeGroupId.value === id) {
      activeGroupId.value = groups.value[0].id
    }
    return true
  }

  function setActiveGroup(id: string) {
    if (groups.value.find(g => g.id === id)) {
      activeGroupId.value = id
    }
  }

  function moveToGroup(uids: string[], targetGroupId: string) {
    if (!groups.value.find(g => g.id === targetGroupId)) return
    for (const e of entries.value) {
      if (uids.includes(e.uid)) {
        e.groupId = targetGroupId
      }
    }
  }

  function add(name: string): boolean {
    return addMany([name]).added > 0
  }

  function addMany(names: string[], opts: { fromPermanent?: boolean; groupId?: string } = {}): {
    added: number
    duplicates: number
  } {
    ensureDefaultGroup()
    const targetGroupId = opts.groupId || activeGroupId.value
    let added = 0
    let duplicates = 0
    const existing = new Set(entries.value.map(e => e.name))
    for (const name of names) {
      if (existing.has(name)) {
        duplicates++
        continue
      }
      existing.add(name)
      entries.value.push({
        uid: uid(UID_PREFIX.ROSTER),
        name,
        addedAt: Date.now(),
        pickedThisSession: false,
        fromPermanent: opts.fromPermanent ?? false,
        groupId: targetGroupId,
      })
      added++
    }
    return { added, duplicates }
  }

  function remove(uidVal: string) {
    entries.value = entries.value.filter(e => e.uid !== uidVal)
  }

  function clear() {
    entries.value = entries.value.filter(e => e.groupId !== activeGroupId.value)
  }

  function clearGroup(groupId: string) {
    entries.value = entries.value.filter(e => e.groupId !== groupId)
  }

  function rename(uidVal: string, newName: string) {
    const e = entries.value.find(x => x.uid === uidVal)
    if (e) e.name = newName
  }

  function markPicked(uids: string[]) {
    const set = new Set(uids)
    for (const e of entries.value) {
      if (set.has(e.uid)) e.pickedThisSession = true
    }
  }

  function resetPickedFlags() {
    for (const e of entries.value) e.pickedThisSession = false
  }

  function promoteToPermanent(uidVal: string): Name | null {
    const e = entries.value.find(x => x.uid === uidVal)
    if (!e) return null
    const snap: Name = { uid: e.uid, name: e.name, addedAt: e.addedAt }
    remove(uidVal)
    return snap
  }

  function promoteAllToPermanent(): Name[] {
    const current = currentEntries.value.map(e => ({
      uid: e.uid,
      name: e.name,
      addedAt: e.addedAt,
    }))
    entries.value = entries.value.filter(e => e.groupId !== activeGroupId.value)
    return current
  }

  function deleteEntries(uids: string[]) {
    const set = new Set(uids)
    entries.value = entries.value.filter(e => !set.has(e.uid))
  }

  function promoteEntries(uids: string[]): Name[] {
    const set = new Set(uids)
    const result: Name[] = []
    entries.value = entries.value.filter(e => {
      if (set.has(e.uid)) {
        result.push({ uid: e.uid, name: e.name, addedAt: e.addedAt })
        return false
      }
      return true
    })
    return result
  }

  return {
    entries,
    groups,
    activeGroupId,
    crossGroup,
    count,
    currentEntries,
    groupNames,
    ensureDefaultGroup,
    addGroup,
    renameGroup,
    deleteGroup,
    setActiveGroup,
    moveToGroup,
    add,
    addMany,
    remove,
    clear,
    clearGroup,
    rename,
    markPicked,
    resetPickedFlags,
    promoteToPermanent,
    promoteAllToPermanent,
    deleteEntries,
    promoteEntries,
  }
}
