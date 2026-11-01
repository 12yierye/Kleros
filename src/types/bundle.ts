/**
 * 绑定小组（Bundle）
 * 同一小组里的人会一起被抽中。
 * 与「名册」（长期保存的一份名单）是不同概念，成员可与名册重叠。
 */

export interface BundleMember {
  uid: string
  /** 该 uid 加入该小组的时刻；用于 chip 多色点的时间排序 */
  addedAt: number
}

export interface Bundle {
  id: string
  name: string
  color: string
  members: BundleMember[]
  createdAt: number
}
