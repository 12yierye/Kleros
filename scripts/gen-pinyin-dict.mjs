/**
 * 生成内置拼音字典（不依赖 Intl/ICU）
 * 用法：node scripts/gen-pinyin-dict.mjs
 * 数据源：tiny-pinyin（仅构建期使用，运行时不需要）
 */
import Pinyin from 'tiny-pinyin'
import { writeFileSync } from 'node:fs'

const START = 0x4e00
const END = 0x9fff
const BASE = 36

if (!Pinyin.isSupported()) {
  console.error('当前 Node 缺少 zh-CN ICU，无法生成字典')
  process.exit(1)
}

const list = []
const index = new Map()
const codes = []
let unknown = 0

for (let code = START; code <= END; code++) {
  const ch = String.fromCodePoint(code)
  let py = ''
  try {
    const parsed = Pinyin.parse(ch)
    if (parsed[0] && parsed[0].type === 2) py = parsed[0].target.toLowerCase()
  } catch { /* ignore */ }

  if (!py) {
    unknown++
    codes.push('00')
    continue
  }
  let i = index.get(py)
  if (i === undefined) {
    i = list.length
    list.push(py)
    index.set(py, i)
  }
  // 0 留给「无拼音」，索引 +1
  codes.push((i + 1).toString(BASE).padStart(2, '0'))
}

const body = `/**
 * 自动生成，请勿手改。
 * 重新生成：node scripts/gen-pinyin-dict.mjs
 *
 * 每个汉字占 2 个 base36 字符，'00' 表示无拼音；
 * 其余值 n 对应 PY_LIST[n - 1]。
 */
export const PY_START = 0x${START.toString(16)}
export const PY_BASE = ${BASE}
export const PY_LIST = ${JSON.stringify(list)}
export const PY_CODES = '${codes.join('')}'
`

writeFileSync(new URL('../src/utils/pinyinDict.ts', import.meta.url), body, 'utf8')
console.log(`汉字区间 ${END - START + 1}，有拼音 ${END - START + 1 - unknown}，无拼音 ${unknown}，拼音 ${list.length} 个`)
console.log(`字典长度 ${codes.join('').length} 字符`)
