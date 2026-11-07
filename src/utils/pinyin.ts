/**
 * 名字搜索：支持原文、全拼、拼音首字母
 * 例：张三 → "zhangsan" / "zs" 都能搜到
 *
 * 字典内置在 pinyinDict.ts，不依赖 Intl/ICU，任何环境结果一致。
 * 字典只给每个字一个主读音；姓氏里的异读（单 shan、重 chong…）走 SURNAME_ALTS 兜底。
 */

import { PY_START, PY_LIST, PY_CODES } from './pinyinDict'

interface PinyinText {
  /** 全拼（无分隔） */
  full: string
  /** 每个字的拼音首字母 */
  initials: string
}

const EMPTY: PinyinText = { full: '', initials: '' }
const cache = new Map<string, PinyinText>()

/** 去掉空白，避免名字里的空格把拼音串断开 */
function plain(s: string): string {
  return s.toLowerCase().replace(/\s+/g, '')
}

/** 常见姓氏异读：字典按主读音走，姓氏位置再补一个读音 */
const SURNAME_ALTS: Record<string, string> = {
  单: 'shan',
  重: 'chong',
  区: 'ou',
  仇: 'qiu',
  解: 'xie',
  查: 'zha',
  朴: 'piao',
  尉: 'yu',
  乐: 'yue',
  翟: 'zhai',
  种: 'chong',
  盖: 'ge',
  折: 'she',
  都: 'du',
  阚: 'kan',
  覃: 'qin',
  缪: 'miao',
  句: 'gou',
  秘: 'bi',
  洗: 'xian',
  能: 'nai',
  说: 'yue',
  牟: 'mou',
  莘: 'shen',
  藏: 'zang',
  祭: 'zhai',
  繁: 'po',
  员: 'yun',
  过: 'guo',
  华: 'hua',
  任: 'ren',
  燕: 'yan',
  召: 'shao',
  蕃: 'fan',
}

/** 单字查表：不在字典里返回 null */
function pinyinOfChar(ch: string): string | null {
  const code = ch.codePointAt(0)
  if (code === undefined) return null
  const off = (code - PY_START) * 2
  if (off < 0 || off + 2 > PY_CODES.length) return null
  const idx = parseInt(PY_CODES.slice(off, off + 2), 36)
  if (!idx) return null
  return PY_LIST[idx - 1] ?? null
}

function build(name: string): PinyinText {
  let full = ''
  let initials = ''
  for (const ch of name) {
    const py = pinyinOfChar(ch)
    if (py) {
      full += py
      initials += py[0] ?? ''
    } else {
      const p = plain(ch)
      full += p
      initials += p
    }
  }
  return { full, initials }
}

export function pinyinOf(name: string): PinyinText {
  if (!name) return EMPTY
  const hit = cache.get(name)
  if (hit) return hit
  const result = build(name)
  cache.set(name, result)
  return result
}

/** 姓氏位置换成异读后的索引；没有异读返回 null */
function altOf(name: string): PinyinText | null {
  const chars = Array.from(name)
  const first = chars[0]
  if (!first) return null
  const alt = SURNAME_ALTS[first]
  if (!alt) return null
  const rest = build(chars.slice(1).join(''))
  return { full: alt + rest.full, initials: (alt[0] ?? '') + rest.initials }
}

/** 任一命中：原文包含 / 全拼包含 / 首字母包含（含姓氏异读） */
export function matchName(name: string, keyword: string): boolean {
  const kw = plain(keyword)
  if (!kw) return true
  if (plain(name).includes(kw)) return true

  const main = pinyinOf(name)
  if (main.full.includes(kw) || main.initials.includes(kw)) return true

  const alt = altOf(name)
  if (alt && (alt.full.includes(kw) || alt.initials.includes(kw))) return true

  return false
}
