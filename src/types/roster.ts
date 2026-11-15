/**
 * 名单相关基础类型
 * 数据库以 UID 为主键，允许同显示名的多个条目共存
 */

export interface Name {
  /** 稳定唯一 ID（数据库主键） */
  uid: string
  /** 显示文本 */
  name: string
  /** 加入时间戳 */
  addedAt: number
}

/** 临时名单分组 */
export interface RosterGroup {
  id: string
  name: string
}

/** 临时名单条目 */
export interface RosterEntry extends Name {
  /** 当前会话中是否已被抽中 */
  pickedThisSession: boolean
  /** 是否从名单库同步过来（用于"移回名单库"时识别） */
  fromPermanent: boolean
  /** 所属分组 ID（历史兼容，当前单名单，不再区分） */
  groupId: string
}

/** 名单 chip 上的归属标记（小组带颜色，名册不带颜色） */
export type RosterMark =
  | { kind: 'bundle'; name: string; color: string }
  | { kind: 'book'; name: string }

/** 名单库成员 */
export interface PermanentEntry extends Name {}

/** 名单库分组：一组可复用的固定成员 */
export interface PermanentGroup {
  id: string
  name: string
  members: PermanentEntry[]
  createdAt: number
}
