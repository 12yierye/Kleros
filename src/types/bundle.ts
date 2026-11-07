/**
 * 小组（Bundle）
 * 同一小组里的人会一起被抽中。
 * 与「名册」（长期保存的一份名单）是不同概念，成员可与名册重叠。
 */

export interface BundleMember {
  /** 建组时的名单 uid，仅作参考：名单清空重加后 uid 会变 */
  uid: string
  /** 成员名字：跨名单、跨轮次稳定的唯一标识 */
  name: string
  /** 该成员加入该小组的时刻；用于 chip 多色点的时间排序 */
  addedAt: number
}

export interface Bundle {
  id: string
  name: string
  color: string
  members: BundleMember[]
  createdAt: number
}
