/**
 * 会话相关类型
 * 当前会话 endedAt = null，进行中
 * 历史会话 endedAt 有值
 *
 * 每个会话保存当时完整的名单和过滤条件快照，切换时恢复最后一刻的状态
 */

import type { RosterEntry, RosterGroup } from './roster'

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

/** 会话 */
export interface Session {
  id: string
  /** 用户可见标题（默认时间戳精确到秒） */
  title: string
  startedAt: number
  endedAt: number | null
  picks: PickRecord[]
  /** 缓存的抽中总人次，避免每次重算 */
  totalPicked: number
  /** 分组列表 */
  rosterGroups: RosterGroup[]
  /** 临时名单快照 */
  roster: RosterEntry[]
  /** 黑名单快照 */
  blacklist: string[]
  /** 白名单快照 */
  whitelist: string[]
}

/** 概要会话（历史压缩模式，丢弃 picks 和名单明细） */
export interface SessionSummary {
  id: string
  title: string
  startedAt: number
  endedAt: number | null
  totalPicked: number
  /** 是否已被压缩（无明细） */
  compressed: true
}

export function isFullSession(s: Session | SessionSummary): s is Session {
  return !('compressed' in s)
}
