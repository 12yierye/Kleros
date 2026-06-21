/**
 * 轻量 ID 生成
 * nanoid 风格：base62 随机 + 时间戳前缀
 * 足够本地数据库主键使用
 */

const ALPHABET =
  '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz'

function randomString(length: number): string {
  let result = ''
  const arr = new Uint8Array(length)
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    crypto.getRandomValues(arr)
  } else {
    for (let i = 0; i < length; i++) arr[i] = Math.floor(Math.random() * 256)
  }
  for (let i = 0; i < length; i++) {
    result += ALPHABET[arr[i] % ALPHABET.length]
  }
  return result
}

export function uid(prefix = ''): string {
  return `${prefix}${Date.now().toString(36)}_${randomString(8)}`
}
