/**
 * 互斥组（Binding Group）
 * 抽中组内任一 uid 后，该组其他成员本会话不再参与抽取
 * 与「临时名单分组 RosterGroup」是不同概念；可重叠
 */

export interface BindingMember {
  uid: string
  /** 该 uid 加入该组的时刻；用于 chip 多色点的时间排序 */
  addedAt: number
}

export interface BindingGroup {
  id: string
  name: string
  color: string
  members: BindingMember[]
  createdAt: number
}
