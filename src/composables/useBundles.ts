/**
 * 小组管理
 * 数据存在当前轮的 bundles 字段（跨轮保留）
 * 成员以「名字」为准（uid 只是线索）：名单清空重加、名册/名单同名互通都能正确成组
 * 小组不随名单变动自动删除：名单清空后再加回同名的人，小组自动恢复
 */

import { computed, watch, type ComputedRef } from 'vue'
import { useSession } from './useSession'
import { useRoster } from './useRoster'
import { usePermanentRoster } from './usePermanentRoster'
import { uid } from '@/utils/id'
import { UID_PREFIX } from '@/constants'
import type { Bundle, BundleMember } from '@/types/bundle'

/** 引用一个成员：名字为准，uid 仅作辅助 */
export interface MemberRef {
  uid: string
  name: string
}

let _instance: ReturnType<typeof create> | undefined

export function useBundles() {
  if (!_instance) _instance = create()
  return _instance
}

function create() {
  const session = useSession()
  const roster = useRoster()
  const permanent = usePermanentRoster()

  const all: ComputedRef<Bundle[]> = computed(
    () => session.current.value?.bundles ?? []
  )

  /** 当前所有可用的人：名字 → uid（当前名单优先于名册） */
  function liveIndex(): Map<string, string> {
    const map = new Map<string, string>()
    for (const e of permanent.entries.value) map.set(e.name, e.uid)
    for (const e of roster.entries.value) map.set(e.name, e.uid)
    return map
  }

  /** 该名字所在的所有小组，按"加入时间"升序（用于 chip 多色点排序） */
  function getBundlesForName(name: string): Bundle[] {
    return all.value
      .filter(g => g.members.some(m => m.name === name))
      .map(g => {
        const m = g.members.find(x => x.name === name)!
        return { g, addedAt: m.addedAt }
      })
      .sort((a, b) => a.addedAt - b.addedAt)
      .map(x => x.g)
  }

  function commit(next: Bundle[]) {
    const cur = session.current.value
    if (!cur) return
    cur.bundles = next
    session.current.value = { ...cur }
  }

  /** 旧数据只有 uid 没有名字：按当前名单 / 名册回填一次 */
  function repairNames() {
    const byUid = new Map<string, string>()
    for (const [n, u] of liveIndex()) byUid.set(u, n)
    let changed = false
    const next = all.value.map(g => {
      let gChanged = false
      const members = g.members.map<BundleMember>(m => {
        if (m.name) return m
        const name = byUid.get(m.uid)
        if (!name) return m
        gChanged = true
        return { ...m, name }
      })
      if (!gChanged) return g
      changed = true
      return { ...g, members }
    })
    if (changed) commit(next)
  }

  function createGroup(opts: { name: string; color: string; members: MemberRef[] }): Bundle | null {
    const cur = session.current.value
    if (!cur) return null
    const live = liveIndex()
    const seen = new Set<string>()
    const members: BundleMember[] = []
    for (const m of opts.members) {
      const name = m.name.trim()
      if (!name || seen.has(name)) continue
      if (!live.has(name)) continue
      seen.add(name)
      members.push({ uid: live.get(name)!, name, addedAt: Date.now() })
    }
    if (members.length < 2) return null
    const now = Date.now()
    const g: Bundle = {
      id: uid(UID_PREFIX.BINDING),
      name: opts.name.trim() || '未命名小组',
      color: opts.color,
      members,
      createdAt: now,
    }
    commit([...all.value, g])
    return g
  }

  function rename(id: string, name: string) {
    commit(all.value.map(g => g.id === id ? { ...g, name: name.trim() || g.name } : g))
  }

  function recolor(id: string, color: string) {
    commit(all.value.map(g => g.id === id ? { ...g, color } : g))
  }

  function addMembers(id: string, refs: MemberRef[]) {
    const target = all.value.find(g => g.id === id)
    if (!target) return
    const live = liveIndex()
    const existing = new Set(target.members.map(m => m.name))
    const now = Date.now()
    const added: BundleMember[] = []
    for (const r of refs) {
      const name = r.name.trim()
      if (!name || existing.has(name) || !live.has(name)) continue
      existing.add(name)
      added.push({ uid: live.get(name)!, name, addedAt: now })
    }
    if (added.length === 0) return
    commit(all.value.map(g => {
      if (g.id !== id) return g
      return { ...g, members: [...g.members, ...added] }
    }))
  }

  /** 按名字移除成员（uid 会随名单变化，名字才可靠） */
  function removeMembers(id: string, names: string[]) {
    const set = new Set(names)
    const next = all.value
      .map(g => g.id === id ? { ...g, members: g.members.filter(m => !set.has(m.name)) } : g)
      .filter(g => g.members.length >= 2)
    commit(next)
  }

  /** 人名被重命名时，同步更新所有小组里的成员引用 */
  function renameMember(oldName: string, newName: string) {
    const from = oldName.trim()
    const to = newName.trim()
    if (!from || !to || from === to) return
    let changed = false
    const next = all.value
      .map(g => {
        if (!g.members.some(m => m.name === from)) return g
        changed = true
        const seen = new Set<string>()
        const members = g.members
          .map(m => (m.name === from ? { ...m, name: to } : m))
          .filter(m => {
            if (!m.name || seen.has(m.name)) return false
            seen.add(m.name)
            return true
          })
        return { ...g, members }
      })
      .filter(g => g.members.length >= 2)
    if (changed) commit(next)
  }

  function dissolve(id: string) {
    commit(all.value.filter(g => g.id !== id))
  }

  // 旧数据补名字：数据异步载入后跑一次，之后名单变化也补
  watch(
    [roster.entries, permanent.entries],
    () => { repairNames() },
    { deep: true, flush: 'post' }
  )

  return {
    all,
    getBundlesForName,
    create: createGroup,
    rename,
    recolor,
    addMembers,
    removeMembers,
    renameMember,
    dissolve,
  }
}
