/**
 * 抽取算法
 * 核心：候选池计算 + Fisher-Yates 洗牌抽样
 */

import type { RosterEntry, PermanentEntry } from '@/types/roster'
import type { BlackWhiteList } from '@/types/list'
import type { Session } from '@/types/session'
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

  return pool
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

/** 从池中抽取 1 个 */
export function pickOne(pool: CandidateItem[]): CandidateItem | null {
  if (pool.length === 0) return null
  return pool[Math.floor(Math.random() * pool.length)]
}
