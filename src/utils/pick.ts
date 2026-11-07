/**
 * 抽取算法
 * 核心：候选池计算 + 抽签单元（小组）+ Fisher-Yates 洗牌抽样
 *
 * 小组成员一律按「名字」匹配：名单清空重加、名册/名单同名互通、跨轮保留都不会掉人。
 * 黑白名单优先于小组：被拉黑 / 不在白名单的人不会进候选池，小组只用池内成员成组。
 * 按小组抽时，不属于任何小组的人不参与抽取。
 */

import type { RosterEntry, PermanentEntry } from '@/types/roster'
import type { BlackWhiteList } from '@/types/list'
import type { Round, PickUnitRecord } from '@/types/session'
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

/** 构建候选池：黑白名单 → 本轮已抽 → 按小组抽时剔掉散人 */
export function buildCandidatePool(input: CandidateInput): CandidateItem[] {
  const { roster, permanent, list, session, prefs } = input

  // 1. uid → name（含被去重掉的那份，用于回溯历史抽取记录）
  const uidToName = new Map<string, string>()
  for (const p of permanent) uidToName.set(p.uid, p.name)
  for (const r of roster) uidToName.set(r.uid, r.name)

  // 2. 合并去重：同一人同时存在于当前名单和名册，按名字只保留一份（当前名单优先）
  const seenNames = new Set<string>()
  let pool: CandidateItem[] = []
  for (const r of roster) {
    if (seenNames.has(r.name)) continue
    seenNames.add(r.name)
    pool.push({ uid: r.uid, name: r.name, from: 'roster' })
  }
  for (const p of permanent) {
    if (seenNames.has(p.name)) continue
    seenNames.add(p.name)
    pool.push({ uid: p.uid, name: p.name, from: 'permanent' })
  }

  // 3. 黑白名单（按名字，硬优先级：黑名单绝不出现，白名单非空则只留白名单）
  const blackSet = new Set(list.black)
  const whiteSet = new Set(list.white)
  if (blackSet.size > 0) pool = pool.filter(p => !blackSet.has(p.name))
  if (whiteSet.size > 0) pool = pool.filter(p => whiteSet.has(p.name))

  // 4. 本轮已抽过滤（uid 为主，名字兜底）
  const pickedUids = new Set<string>()
  const pickedNames = new Set<string>()
  if (prefs.noRepeatInSession) {
    for (const u of session.picks.flatMap(p => p.uids)) {
      pickedUids.add(u)
      const n = uidToName.get(u)
      if (n) pickedNames.add(n)
    }
  }
  const filtered = pool.filter(p => !pickedUids.has(p.uid) && !pickedNames.has(p.name))

  // 5. 按小组抽：只留小组内的人，散人不参与
  if (prefs.drawMode === 'group') {
    const names = new Set(filtered.map(p => p.name))
    const grouped = new Set<string>()
    for (const b of session.bundles ?? []) {
      const members = Array.from(new Set(b.members.map(m => m.name).filter(Boolean)))
      const inPool = members.filter(n => names.has(n))
      // 池内不足 2 人构不成小组，这些人按散人处理，也不参与
      if (inPool.length >= 2) inPool.forEach(n => grouped.add(n))
    }
    return filtered.filter(p => grouped.has(p.name))
  }

  return filtered
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

/** 抽签单元：小组是一个多人单元，其他人各自成单元 */
export interface PickUnit {
  items: CandidateItem[]
  /** 展示名：小组名 / 人名 */
  label: string
  bundleId?: string
  /** 小组色 */
  color?: string
}

function singleUnit(p: CandidateItem): PickUnit {
  return { items: [p], label: p.name }
}

export function buildUnits(pool: CandidateItem[], bundles: Bundle[]): PickUnit[] {
  const byName = new Map(pool.map(p => [p.name, p]))
  const used = new Set<string>()
  const units: PickUnit[] = []

  for (const b of bundles) {
    const items: CandidateItem[] = []
    const seen = new Set<string>()
    for (const m of b.members) {
      const item = byName.get(m.name)
      if (!item || seen.has(item.name)) continue
      seen.add(item.name)
      items.push(item)
    }
    // 池内不足 2 人的组不成立（成员可能被黑名单/白名单/本轮已抽挡掉）
    if (items.length < 2) continue
    items.forEach(i => used.add(i.name))
    units.push({ items, label: b.name, bundleId: b.id, color: b.color })
  }

  for (const p of pool) {
    if (!used.has(p.name)) units.push(singleUnit(p))
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
): PickUnit[] {
  if (n <= 0 || pool.length === 0) return []
  if (mode === 'person') return shuffle(pool).slice(0, n).map(singleUnit)
  return pickUnits(pool, n, bundles)
}

/**
 * 按小组抽取 N 个名额。
 * - 小组整体入选，占 members.length 个名额
 * - 小组不可拆：第一个单元就塞不下名额时整组出，宁可超出名额也不拆散
 */
export function pickUnits(
  pool: CandidateItem[],
  n: number,
  bundles: Bundle[]
): PickUnit[] {
  if (n <= 0 || pool.length === 0) return []

  const units = shuffle(buildUnits(pool, bundles))
  const picked: PickUnit[] = []
  let count = 0

  for (const unit of units) {
    if (count >= n) break
    const room = n - count
    if (unit.items.length <= room) {
      picked.push(unit)
      count += unit.items.length
      continue
    }
    // 塞不下：还没出结果就整组出，已有结果则收手（剩下的名额空着，也不拆组）
    if (count === 0) {
      picked.push(unit)
      count += unit.items.length
    }
    break
  }

  return picked
}

/** 抽取结果 → 可落库的签明细 */
export function toUnitRecords(units: PickUnit[]): PickUnitRecord[] {
  return units.map(u => ({
    bundleId: u.bundleId,
    label: u.label,
    color: u.color,
    uids: u.items.map(i => i.uid),
  }))
}
