/**
 * 抽取算法
 * 核心：候选池计算 + 抽签单元（绑定小组）+ Fisher-Yates 洗牌抽样
 */

import type { RosterEntry, PermanentEntry } from '@/types/roster'
import type { BlackWhiteList } from '@/types/list'
import type { Round } from '@/types/session'
import type { Bundle } from '@/types/bundle'
import type { DrawMode, UserPreferences } from '@/types/settings'

export interface CandidateInput {
  roster: RosterEntry[]
  permanent: PermanentEntry[]
  list: BlackWhiteList
  session: Round
  prefs: UserPreferences
}

export interface CandidateItem {
  uid: string
  name: string
  /** 来源：当前名单或名册 */
  from: 'roster' | 'permanent'
}

/** 构建候选池 */
export function buildCandidatePool(input: CandidateInput): CandidateItem[] {
  const { roster, permanent, list, session, prefs } = input

  // 1. 合并
  const all: CandidateItem[] = [
    ...roster.map<CandidateItem>(r => ({ uid: r.uid, name: r.name, from: 'roster' })),
    ...permanent.map<CandidateItem>(p => ({ uid: p.uid, name: p.name, from: 'permanent' })),
  ]

  // 2. 合并去重：同一人可能同时存在于当前名单和名册，按名字只保留一份
  const seenNames = new Set<string>()
  const uidToName = new Map<string, string>()
  const merged: CandidateItem[] = []
  for (const item of all) {
    uidToName.set(item.uid, item.name)
    if (seenNames.has(item.name)) continue
    seenNames.add(item.name)
    merged.push(item)
  }
  let pool = merged

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

  const bundles = session.bundles ?? []

  // 5. 本轮已抽过滤
  const pickedUids = new Set<string>()
  const pickedNames = new Set<string>()
  if (prefs.noRepeatInSession) {
    for (const u of session.picks.flatMap(p => p.uids)) {
      pickedUids.add(u)
      const n = uidToName.get(u)
      if (n) pickedNames.add(n)
    }
  }

  // 按小组抽时，小组全有或全无：组里只要有人本轮已被抽中，整组不再出现，绝不拆成单人。
  // 按人抽时小组只是属性，不参与筛选。
  const blockedUids = new Set<string>()
  if (prefs.drawMode === 'group') {
    for (const b of bundles) {
      const touched = b.members.some(
        m => pickedUids.has(m.uid) || pickedNames.has(uidToName.get(m.uid) ?? '')
      )
      if (touched) b.members.forEach(m => blockedUids.add(m.uid))
    }
  }

  return pool.filter(
    p => !pickedUids.has(p.uid) && !pickedNames.has(p.name) && !blockedUids.has(p.uid)
  )
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

/** 抽签单元：绑定小组是一个多人单元，其他人各自成单元 */
export interface PickUnit {
  items: CandidateItem[]
  bundleId?: string
}

export function buildUnits(pool: CandidateItem[], bundles: Bundle[]): PickUnit[] {
  const byUid = new Map(pool.map(p => [p.uid, p]))
  const used = new Set<string>()
  const units: PickUnit[] = []

  for (const b of bundles) {
    const items = b.members
      .map(m => byUid.get(m.uid))
      .filter((x): x is CandidateItem => !!x)
    // 只剩一个人就不构成小组
    if (items.length < 2) continue
    items.forEach(i => used.add(i.uid))
    units.push({ items, bundleId: b.id })
  }

  for (const p of pool) {
    if (!used.has(p.uid)) units.push({ items: [p] })
  }
  return units
}

/**
 * 按口径抽取 N 个名额。
 * - person：直接洗牌取 N 人，忽略小组
 * - group：以小组为抽签单元（见 pickUnits）
 */
export function pickFrom(
  pool: CandidateItem[],
  n: number,
  bundles: Bundle[],
  mode: DrawMode
): CandidateItem[] {
  if (n <= 0 || pool.length === 0) return []
  if (mode === 'person') return shuffle(pool).slice(0, n)
  return pickUnits(pool, n, bundles)
}

/**
 * 按小组抽取 N 个名额。
 * - 绑定小组整体入选，占 members.length 个名额
 * - 单抽（n=1）抽到小组时整组一起出
 */
export function pickUnits(
  pool: CandidateItem[],
  n: number,
  bundles: Bundle[]
): CandidateItem[] {
  if (n <= 0 || pool.length === 0) return []

  const units = buildUnits(pool, bundles)
  const picked: CandidateItem[] = []

  for (const unit of shuffle(units)) {
    if (picked.length >= n) break

    const fits = picked.length + unit.items.length <= n
    // 单抽时允许整组超额出（2 人小组 → 一次抽中 2 人）
    if (!fits && !(n === 1 && picked.length === 0)) continue

    picked.push(...unit.items)
  }

  return picked
}
