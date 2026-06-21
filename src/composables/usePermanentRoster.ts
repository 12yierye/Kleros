/**
 * 常驻名单（localStorage）
 * 持久保存的固定人员库
 */

import { computed, type Ref } from 'vue'
import { useStorage } from './useStorage'
import { uid } from '@/utils/id'
import { STORAGE_KEYS, UID_PREFIX } from '@/constants'
import type { PermanentEntry, Name } from '@/types/roster'

let _entries: Ref<PermanentEntry[]> | undefined
function getEntries() {
  if (!_entries) _entries = useStorage<PermanentEntry[]>(STORAGE_KEYS.ROSTER_PERMANENT, [], 'local')
  return _entries
}

export function usePermanentRoster() {
  const entries = getEntries()

  const count = computed(() => entries.value.length)

  function add(name: string): boolean {
    const trimmed = name.trim()
    if (!trimmed) return false
    if (entries.value.some(e => e.name === trimmed)) return false
    entries.value.push({ uid: uid(UID_PREFIX.PERMANENT), name: trimmed, addedAt: Date.now() })
    return true
  }

  function addMany(names: string[]): { added: number; duplicates: number } {
    let added = 0
    let duplicates = 0
    for (const n of names) {
      if (add(n)) added++
      else duplicates++
    }
    return { added, duplicates }
  }

  /** 接收一个 Name（保留原 UID） */
  function importOne(name: Name) {
    if (entries.value.some(e => e.uid === name.uid)) return
    if (entries.value.some(e => e.name === name.name)) return
    entries.value.push({
      uid: name.uid,
      name: name.name,
      addedAt: name.addedAt,
    })
  }

  function importMany(list: Name[]) {
    for (const n of list) importOne(n)
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

  function getByUid(uidVal: string): PermanentEntry | undefined {
    return entries.value.find(e => e.uid === uidVal)
  }

  return {
    entries,
    count,
    add,
    addMany,
    importOne,
    importMany,
    remove,
    clear,
    rename,
    getByUid,
  }
}
