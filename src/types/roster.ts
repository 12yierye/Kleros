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
  /** 是否从常驻同步过来（用于"移回常驻"时识别） */
  fromPermanent: boolean
  /** 所属分组 ID */
  groupId: string
}

/** 常驻名单条目 */
export interface PermanentEntry extends Name {}
