/**
 * 黑白名单
 * 按 name 字符串做 key（不是 UID）
 * 改名不自动同步，名单中残留的旧名将不再匹配任何人
 */

export interface BlackWhiteList {
  black: string[]
  white: string[]
}
