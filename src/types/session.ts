/**
 * 抽取相关类型
 * 整个应用只有一个「本轮」状态：抽了谁 + 小组，不再保留历史轮次
 */

import type { Bundle } from './bundle'

export type PickMode = 'single' | 'multi'

/** 一次抽取中的一个签：小组或单人 */
export interface PickUnitRecord {
  /** 小组 id，单人为空 */
  bundleId?: string
  /** 展示名：小组名 / 人名 */
  label: string
  /** 小组色，单人为空 */
  color?: string
  /** 该签包含的成员 uid */
  uids: string[]
}

/** 一次抽取记录（按 UID 记录） */
export interface PickRecord {
  /** 抽中时刻 */
  time: number
  /** 抽取模式 */
  mode: PickMode
  /** 抽中的 UID 列表（按显示名重命名时仍可定位） */
  uids: string[]
  /** 签的明细：按小组抽时能还原「小组名 + 成员」；旧记录没有此字段 */
  units?: PickUnitRecord[]
}

/** 本轮抽取状态 */
export interface Round {
  id: string
  startedAt: number
  picks: PickRecord[]
  /** 缓存的抽中总人次，避免每次重算 */
  totalPicked: number
  /** 小组（跨轮保留） */
  bundles: Bundle[]
}
