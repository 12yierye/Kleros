/**
 * 临时名单（sessionStorage）
 * 关闭标签页后清空
 */

import { computed, type Ref } from 'vue'
import { useStorage } from './useStorage'
import { uid } from '@/utils/id'
import { STORAGE_KEYS, UID_PREFIX } from '@/constants'
import type { RosterEntry, Name } from '@/types/roster'

let _entries: Ref<RosterEntry[]> | undefined
function getEntries() {
  if (!_entries) _entries = useStorage<RosterEntry[]>(STORAGE_KEYS.ROSTER_TEMP, [], 'session')
  return _entries
}

export function useRoster() {
  const entries = getEntries()

  const count = computed(() => entries.value.length)

  /** 批量添加名字（自动跳过重名） */
  function addMany(names: string[], opts: { fromPermanent?: boolean } = {}): {
    added: number
    duplicates: number
  } {
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
      })
      added++
    }
    return { added, duplicates }
  }

  function add(name: string): boolean {
    return addMany([name]).added > 0
  }

  function remove(uidVal: string) {
    entries.value = entries.value.filter(e => e.uid !== uidVal)
  }

  function clear() {
    entries.value = []
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
    const snap = entries.value.map(e => ({
      uid: e.uid,
      name: e.name,
      addedAt: e.addedAt,
    }))
    clear()
    return snap
  }

  return {
    entries,
    count,
    add,
    addMany,
    remove,
    clear,
    rename,
    markPicked,
    resetPickedFlags,
    promoteToPermanent,
    promoteAllToPermanent,
  }
}
