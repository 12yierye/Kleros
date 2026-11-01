/**
 * 抽取相关类型
 * 整个应用只有一个「本轮」状态：抽了谁 + 绑定小组，不再保留历史轮次
 */

import type { Bundle } from './bundle'

export type PickMode = 'single' | 'multi'

/** 一次抽取记录（按 UID 记录） */
export interface PickRecord {
  /** 抽中时刻 */
  time: number
  /** 抽取模式 */
  mode: PickMode
  /** 抽中的 UID 列表（按显示名重命名时仍可定位） */
  uids: string[]
}

/** 本轮抽取状态 */
export interface Round {
  id: string
  startedAt: number
  picks: PickRecord[]
  /** 缓存的抽中总人次，避免每次重算 */
  totalPicked: number
  /** 绑定小组（跨轮保留） */
  bundles: Bundle[]
}
