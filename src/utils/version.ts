/**
 * 版本号比较
 * 只处理 release tag 的形态（1.7 / v1.8 / 1.10），不处理 semver 的预发布优先级：
 * 1.8.0-beta 会被当成 1.8.0，够用且不会误判成「有新版本」以外的怪结果。
 */

/** "v1.10.2" → [1, 10, 2]；非数字段落按 0 处理 */
export function parseVersion(input: string): number[] {
  return input
    .trim()
    .replace(/^v/i, '')
    .split('.')
    .map((part) => {
      const n = Number.parseInt(part, 10)
      return Number.isFinite(n) && n > 0 ? n : 0
    })
}

/** remote 是否严格高于 local */
export function isNewerVersion(remote: string, local: string): boolean {
  const a = parseVersion(remote)
  const b = parseVersion(local)
  const len = Math.max(a.length, b.length)
  for (let i = 0; i < len; i++) {
    const x = a[i] ?? 0
    const y = b[i] ?? 0
    if (x !== y) return x > y
  }
  return false
}
