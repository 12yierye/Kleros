/**
 * 互斥组（Binding Group）管理
 * 数据存在当前 Session 的 bindingGroups 字段
 * 派生 lockedUids：已抽中成员的同组其他 uid
 * 自动监听临时/常驻名单变化，消失的 uid 同步从所有互斥组移除
 */

import { computed, watch, type ComputedRef } from 'vue'
import { useSession } from './useSession'
import { useRoster } from './useRoster'
import { usePermanentRoster } from './usePermanentRoster'
import { uid } from '@/utils/id'
import { UID_PREFIX } from '@/constants'
import { getLockedUids } from '@/utils/pick'
import type { BindingGroup, BindingMember } from '@/types/binding'

let _instance: ReturnType<typeof create> | undefined

export function useBindingGroups() {
  if (!_instance) _instance = create()
  return _instance
}

function create() {
  const session = useSession()
  const roster = useRoster()
  const permanent = usePermanentRoster()

  const groups: ComputedRef<BindingGroup[]> = computed(
    () => session.current.value?.bindingGroups ?? []
  )

  const lockedUids: ComputedRef<Set<string>> = computed(() => {
    const cur = session.current.value
    if (!cur) return new Set()
    return getLockedUids(cur.picks, cur.bindingGroups ?? [])
  })

  function getGroupsForUid(uidVal: string): BindingGroup[] {
    return groups.value.filter(g => g.members.some(m => m.uid === uidVal))
  }

  /** 返回该 uid 所在的所有组，按"该 uid 加入该组的时间"升序（用于 chip 多色点排序） */
  function getGroupsForUidByAddedAt(uidVal: string): BindingGroup[] {
    return groups.value
      .filter(g => g.members.some(m => m.uid === uidVal))
      .map(g => {
        const m = g.members.find(x => x.uid === uidVal)!
        return { g, addedAt: m.addedAt }
      })
      .sort((a, b) => a.addedAt - b.addedAt)
      .map(x => x.g)
  }

  function validUidSet(): Set<string> {
    const s = new Set<string>()
    for (const e of roster.entries.value) s.add(e.uid)
    for (const e of permanent.entries.value) s.add(e.uid)
    return s
  }

  function commit(next: BindingGroup[]) {
    const cur = session.current.value
    if (!cur) return
    cur.bindingGroups = next
    session.current.value = { ...cur }
  }

  function createGroup(opts: { name: string; color: string; memberUids: string[] }): BindingGroup | null {
    const cur = session.current.value
    if (!cur) return null
    const valid = validUidSet()
    const filtered = opts.memberUids.filter(u => valid.has(u))
    const unique = Array.from(new Set(filtered))
    if (unique.length < 2) return null
    const now = Date.now()
    const g: BindingGroup = {
      id: uid(UID_PREFIX.BINDING),
      name: opts.name.trim() || '未命名组',
      color: opts.color,
      members: unique.map(m => ({ uid: m, addedAt: now })),
      createdAt: now,
    }
    commit([...groups.value, g])
    return g
  }

  function rename(id: string, name: string) {
    commit(groups.value.map(g => g.id === id ? { ...g, name: name.trim() || g.name } : g))
  }

  function recolor(id: string, color: string) {
    commit(groups.value.map(g => g.id === id ? { ...g, color } : g))
  }

  function addMembers(id: string, uids: string[]) {
    const target = groups.value.find(g => g.id === id)
    if (!target) return
    const valid = validUidSet()
    const existing = new Set(target.members.map(m => m.uid))
    const filtered = uids.filter(u => valid.has(u) && !existing.has(u))
    if (filtered.length === 0) return
    const now = Date.now()
    commit(groups.value.map(g => {
      if (g.id !== id) return g
      return { ...g, members: [...g.members, ...filtered.map(u => ({ uid: u, addedAt: now }))] }
    }))
  }

  function removeMembers(id: string, uids: string[]) {
    const set = new Set(uids)
    const next = groups.value
      .map(g => g.id === id ? { ...g, members: g.members.filter(m => !set.has(m.uid)) } : g)
      .filter(g => g.members.length >= 2)
    commit(next)
  }

  function dissolve(id: string) {
    commit(groups.value.filter(g => g.id !== id))
  }

  function purgeUids(uids: string[]) {
    const set = new Set(uids)
    if (set.size === 0) return
    const before = groups.value
    const next = before
      .map(g => ({ ...g, members: g.members.filter(m => !set.has(m.uid)) }))
      .filter(g => g.members.length >= 2)
    const changed = next.length !== before.length ||
      next.some((g, i) => g.members.length !== before[i].members.length)
    if (changed) commit(next)
  }

  let prevRosterUids = new Set(roster.entries.value.map(e => e.uid))
  let prevPermUids = new Set(permanent.entries.value.map(e => e.uid))

  // 初始化时执行一次：清理引用了不存在 uid 的组
  {
    const validUids = new Set<string>()
    for (const e of roster.entries.value) validUids.add(e.uid)
    for (const e of permanent.entries.value) validUids.add(e.uid)
    const toRemove: string[] = []
    for (const g of groups.value) {
      for (const m of g.members) {
        if (!validUids.has(m.uid)) toRemove.push(m.uid)
      }
    }
    if (toRemove.length > 0) purgeUids(toRemove)
  }

  watch(
    [roster.entries, permanent.entries],
    () => {
      const newRosterUids = new Set(roster.entries.value.map(e => e.uid))
      const newPermUids = new Set(permanent.entries.value.map(e => e.uid))
      const removed: string[] = []
      for (const u of prevRosterUids) if (!newRosterUids.has(u)) removed.push(u)
      for (const u of prevPermUids) if (!newPermUids.has(u)) removed.push(u)
      prevRosterUids = newRosterUids
      prevPermUids = newPermUids
      if (removed.length > 0) purgeUids(removed)
    },
    { deep: true, flush: 'post' }
  )

  return {
    groups,
    lockedUids,
    getGroupsForUid,
    getGroupsForUidByAddedAt,
    create: createGroup,
    rename,
    recolor,
    addMembers,
    removeMembers,
    dissolve,
    purgeUids,
  }
}
