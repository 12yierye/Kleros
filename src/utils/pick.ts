/**
 * 抽取算法
 * 核心：候选池计算 + Fisher-Yates 洗牌抽样
 */

import type { RosterEntry, PermanentEntry } from '@/types/roster'
import type { BlackWhiteList } from '@/types/list'
import type { Session, PickRecord } from '@/types/session'
import type { BindingGroup } from '@/types/binding'
import type { UserPreferences } from '@/types/settings'

export interface CandidateInput {
  roster: RosterEntry[]
  permanent: PermanentEntry[]
  list: BlackWhiteList
  session: Session
  prefs: UserPreferences
}

export interface CandidateItem {
  uid: string
  name: string
  /** 来源：临时或常驻（用于决定抽中后的样式 / 行为） */
  from: 'roster' | 'permanent'
}

/** 构建候选池（去重按 UID） */
export function buildCandidatePool(input: CandidateInput): CandidateItem[] {
  const { roster, permanent, list, session, prefs } = input

  // 1. 合并
  const all: CandidateItem[] = [
    ...roster.map<CandidateItem>(r => ({
      uid: r.uid,
      name: r.name,
      from: 'roster',
    })),
    ...permanent.map<CandidateItem>(p => ({
      uid: p.uid,
      name: p.name,
      from: 'permanent',
    })),
  ]

  // 2. 按 UID 去重（同名不同 UID 都保留）
  const uidMap = new Map<string, CandidateItem>()
  for (const item of all) {
    if (!uidMap.has(item.uid)) uidMap.set(item.uid, item)
  }
  let pool = Array.from(uidMap.values())

  // 3. 过滤黑名单（按 name 匹配）
  if (list.black.length > 0) {
    const blackSet = new Set(list.black)
    pool = pool.filter(p => !blackSet.has(p.name))
  }

  // 4. 白名单覆盖（白名单非空 → 取交集）
  if (list.white.length > 0) {
    const whiteSet = new Set(list.white)
    pool = pool.filter(p => whiteSet.has(p.name))
  }

  // 5. 本会话已抽过滤
  if (prefs.noRepeatInSession) {
    const pickedSet = new Set(session.picks.flatMap(p => p.uids))
    pool = pool.filter(p => !pickedSet.has(p.uid))
  }

  // 6. 互斥组锁定过滤：本会话已被抽中成员的同组其他人排除
  const groups = session.bindingGroups ?? []
  if (groups.length > 0) {
    const locked = getLockedUids(session.picks, groups)
    if (locked.size > 0) {
      pool = pool.filter(p => !locked.has(p.uid))
    }
  }

  return pool
}

/**
 * 计算本会话已被「互斥锁定」的 uid 集合
 * 对每个 pick 的每个 uid，遍历其所在组，把组内其他成员 uid 加入集合
 */
export function getLockedUids(
  picks: PickRecord[],
  groups: BindingGroup[]
): Set<string> {
  if (groups.length === 0) return new Set()
  const uidToGroups = new Map<string, BindingGroup[]>()
  for (const g of groups) {
    for (const m of g.members) {
      const arr = uidToGroups.get(m.uid)
      if (arr) arr.push(g)
      else uidToGroups.set(m.uid, [g])
    }
  }
  const locked = new Set<string>()
  for (const pick of picks) {
    for (const uid of pick.uids) {
      const gs = uidToGroups.get(uid)
      if (!gs) continue
      for (const g of gs) {
        for (const member of g.members) {
          if (member.uid !== uid) locked.add(member.uid)
        }
      }
    }
  }
  return locked
}

/** Fisher-Yates 洗牌（返回新数组，不修改入参） */
export function shuffle<T>(arr: readonly T[]): T[] {
  const a = arr.slice()
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

/** 从池中抽取 N 个不重复的人，N > 池大小时返回池中全部 */
export function pickMany(pool: CandidateItem[], n: number): CandidateItem[] {
  if (n <= 0 || pool.length === 0) return []
  const shuffled = shuffle(pool)
  return shuffled.slice(0, Math.min(n, shuffled.length))
}

/**
 * 多抽 + 互斥组约束：本轮内同一互斥组最多出 1 人
 * 不修改入参；不足时返回少于 n
 */
export function pickManyWithMutex(
  pool: CandidateItem[],
  n: number,
  groups: BindingGroup[]
): CandidateItem[] {
  if (n <= 0 || pool.length === 0) return []
  if (groups.length === 0) return pickMany(pool, n)

  // uid → 该 uid 所在互斥组的 id 集合
  const uidToGroupIds = new Map<string, Set<string>>()
  for (const g of groups) {
    for (const m of g.members) {
      const s = uidToGroupIds.get(m.uid)
      if (s) s.add(g.id)
      else uidToGroupIds.set(m.uid, new Set([g.id]))
    }
  }

  const shuffled = shuffle(pool)
  const picked: CandidateItem[] = []
  const usedGroupIds = new Set<string>()

  for (const item of shuffled) {
    if (picked.length >= n) break
    const groupsOfItem = uidToGroupIds.get(item.uid)
    let conflict = false
    if (groupsOfItem) {
      for (const gid of groupsOfItem) {
        if (usedGroupIds.has(gid)) { conflict = true; break }
      }
    }
    if (conflict) continue
    picked.push(item)
    if (groupsOfItem) {
      for (const gid of groupsOfItem) usedGroupIds.add(gid)
    }
  }

  return picked
}

/** 从池中抽取 1 个 */
export function pickOne(pool: CandidateItem[]): CandidateItem | null {
  if (pool.length === 0) return null
  return pool[Math.floor(Math.random() * pool.length)]
}
