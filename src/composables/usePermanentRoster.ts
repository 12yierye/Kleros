/**
 * 名册（原常驻名单）
 * - 以「组」为单位长期保存：一组 = 一批可复用的人
 * - 组内成员可单独或整组加入当前名单
 * - 旧版本扁平结构在读取时自动收进一个默认组
 */

import { computed, type Ref } from 'vue'
import { useDB } from './useDB'
import { uid } from '@/utils/id'
import { BOOK_COLORS, STORAGE_KEYS, UID_PREFIX } from '@/constants'
import type { PermanentEntry, PermanentGroup, Name } from '@/types/roster'

let _groups: Ref<PermanentGroup[]> | undefined

/** 名册按加入顺序循环取色 */
function colorAt(index: number): string {
  return BOOK_COLORS[index % BOOK_COLORS.length]
}

function isGrouped(raw: unknown): boolean {
  if (!Array.isArray(raw)) return false
  if (raw.length === 0) return true
  const first = raw[0] as { members?: unknown }
  return !!first && typeof first === 'object' && Array.isArray(first.members)
}

function normalize(raw: unknown): PermanentGroup[] {
  if (!Array.isArray(raw)) return []
  if (isGrouped(raw)) {
    return (raw as PermanentGroup[]).map((g, i) => ({
      id: g.id || uid(UID_PREFIX.GROUP),
      name: g.name || '未命名组',
      color: g.color || colorAt(i),
      createdAt: g.createdAt ?? Date.now(),
      members: Array.isArray(g.members)
        ? g.members.filter(m => m && typeof m.name === 'string').map(m => ({
            uid: m.uid || uid(UID_PREFIX.PERMANENT),
            name: m.name,
            addedAt: m.addedAt ?? Date.now(),
          }))
        : [],
    }))
  }
  const flat = (raw as Name[]).filter(x => x && typeof x.name === 'string')
  if (flat.length === 0) return []
  return [{
    id: uid(UID_PREFIX.GROUP),
    name: '默认组',
    color: colorAt(0),
    createdAt: Date.now(),
    members: flat.map(f => ({
      uid: f.uid || uid(UID_PREFIX.PERMANENT),
      name: f.name,
      addedAt: f.addedAt ?? Date.now(),
    })),
  }]
}

function getGroups() {
  if (!_groups) {
    _groups = useDB<PermanentGroup[]>(STORAGE_KEYS.ROSTER_PERMANENT, [])
    if (!isGrouped(_groups.value)) {
      _groups.value = normalize(_groups.value)
    }
  }
  return _groups
}

export function usePermanentRoster() {
  const groups = getGroups()

  /** 所有组成员拉平（候选池、重命名匹配等用） */
  const entries = computed<PermanentEntry[]>(() => groups.value.flatMap(g => g.members))

  const count = computed(() => entries.value.length)

  function uniqueGroupName(base = '新组'): string {
    const names = new Set(groups.value.map(g => g.name))
    if (!names.has(base)) return base
    let n = 2
    while (names.has(`${base} ${n}`)) n++
    return `${base} ${n}`
  }

  function addGroup(name?: string): string {
    const g: PermanentGroup = {
      id: uid(UID_PREFIX.GROUP),
      name: (name ?? '').trim() || uniqueGroupName(),
      color: colorAt(groups.value.length),
      members: [],
      createdAt: Date.now(),
    }
    groups.value = [...groups.value, g]
    return g.id
  }

  function renameGroup(id: string, name: string) {
    const trimmed = name.trim()
    if (!trimmed) return
    const g = groups.value.find(x => x.id === id)
    if (g) g.name = trimmed
  }

  function deleteGroup(id: string) {
    groups.value = groups.value.filter(g => g.id !== id)
  }

  function findGroup(groupId: string) {
    return groups.value.find(g => g.id === groupId)
  }

  function addMember(groupId: string, name: string): boolean {
    return addMembers(groupId, [name]).added > 0
  }

  function addMembers(groupId: string, names: string[]): { added: number; duplicates: number } {
    const g = findGroup(groupId)
    if (!g) return { added: 0, duplicates: 0 }
    const existing = new Set(g.members.map(m => m.name))
    let added = 0
    let duplicates = 0
    const next = [...g.members]
    for (const raw of names) {
      const name = raw.trim()
      if (!name) continue
      if (existing.has(name)) { duplicates++; continue }
      existing.add(name)
      next.push({ uid: uid(UID_PREFIX.PERMANENT), name, addedAt: Date.now() })
      added++
    }
    if (added > 0) g.members = next
    return { added, duplicates }
  }

  /** 用一组名字覆盖成员（保留已有 uid，仅做增删） */
  function setMembers(groupId: string, names: string[]) {
    const g = findGroup(groupId)
    if (!g) return
    const wanted = new Set(names.map(n => n.trim()).filter(Boolean))
    const kept: PermanentEntry[] = []
    const keptNames = new Set<string>()
    for (const m of g.members) {
      if (wanted.has(m.name) && !keptNames.has(m.name)) {
        kept.push(m)
        keptNames.add(m.name)
      }
    }
    for (const n of wanted) {
      if (keptNames.has(n)) continue
      kept.push({ uid: uid(UID_PREFIX.PERMANENT), name: n, addedAt: Date.now() })
      keptNames.add(n)
    }
    g.members = kept
  }

  function removeMember(groupId: string, uidVal: string) {
    const g = findGroup(groupId)
    if (!g) return
    g.members = g.members.filter(m => m.uid !== uidVal)
  }

  function removeByUid(uidVal: string) {
    for (const g of groups.value) {
      const idx = g.members.findIndex(m => m.uid === uidVal)
      if (idx >= 0) {
        g.members = g.members.filter(m => m.uid !== uidVal)
        return
      }
    }
  }

  function rename(uidVal: string, newName: string) {
    const trimmed = newName.trim()
    if (!trimmed) return
    for (const g of groups.value) {
      const m = g.members.find(x => x.uid === uidVal)
      if (m) { m.name = trimmed; return }
    }
  }

  /** 接收 Name（保留原 UID），默认放进指定组，未指定则第一个组 */
  function importOne(name: Name, groupId?: string) {
    if (entries.value.some(e => e.uid === name.uid)) return
    const target = groupId ? findGroup(groupId) : groups.value[0]
    if (!target) {
      const id = addGroup('默认组')
      addMembers(id, [name.name])
      return
    }
    if (target.members.some(m => m.name === name.name)) return
    target.members = [...target.members, { uid: name.uid, name: name.name, addedAt: name.addedAt }]
  }

  function importMany(list: Name[], groupId?: string) {
    for (const n of list) importOne(n, groupId)
  }

  function clear() {
    groups.value = []
  }

  function getByUid(uidVal: string): PermanentEntry | undefined {
    for (const g of groups.value) {
      const m = g.members.find(x => x.uid === uidVal)
      if (m) return m
    }
    return undefined
  }

  function groupOfUid(uidVal: string): PermanentGroup | undefined {
    return groups.value.find(g => g.members.some(m => m.uid === uidVal))
  }

  /** 备份恢复 / 导入：接受旧扁平数组或新分组数组 */
  function replaceAll(raw: unknown) {
    groups.value = normalize(raw)
  }

  return {
    groups,
    entries,
    count,
    addGroup,
    renameGroup,
    deleteGroup,
    addMember,
    addMembers,
    setMembers,
    removeMember,
    removeByUid,
    rename,
    importOne,
    importMany,
    clear,
    getByUid,
    groupOfUid,
    replaceAll,
  }
}
