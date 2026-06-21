/**
 * 名字解析器
 * 支持的分隔符：换行、中英文逗号、中英文分号、Tab、连续空白
 * 规则：归一化分隔符 → split → trim → 去空 → 全/半角统一 → 去重（保留首次出现）
 */

const SEPARATORS = /[\n\r,，;；\t]+/g

/** 全角字符 → 半角（仅处理常见标点和空格） */
function normalize(s: string): string {
  return s
    .replace(/\u3000/g, ' ') // 全角空格
    .trim()
}

export interface ParseResult {
  /** 解析出的名字列表（已去重、已 trim） */
  names: string[]
  /** 被丢弃的条目（含原始文本），用于 UI 提示 */
  dropped: string[]
}

/** 从一段自由文本中解析出名字 */
export function parseNamesFromText(input: string): ParseResult {
  const result: ParseResult = { names: [], dropped: [] }
  if (!input) return result

  // 把多种分隔符统一为 \n
  const normalized = normalize(input).replace(SEPARATORS, '\n')
  const tokens = normalized.split('\n').map(s => s.trim()).filter(Boolean)

  const seen = new Set<string>()
  for (const t of tokens) {
    // 进一步把连续空白切分（防止一行内手写空格分隔）
    const parts = t.split(/\s+/).filter(Boolean)
    for (const p of parts) {
      const key = p // 保留原始大小写，但去重
      if (seen.has(key)) {
        result.dropped.push(p)
        continue
      }
      seen.add(key)
      result.names.push(p)
    }
  }
  return result
}

/** 从 CSV 文本中解析（按行，第一列为名字） */
export function parseNamesFromCSV(input: string): ParseResult {
  const result: ParseResult = { names: [], dropped: [] }
  if (!input) return result

  const lines = input.split(/\r?\n/).map(s => s.trim()).filter(Boolean)
  if (lines.length === 0) return result

  // 简单表头嗅探：如果第一行包含 "name" 之类关键词则跳过
  const headerLike = /^(name|姓名|名字)$/i.test(lines[0].split(',')[0].trim())
  const dataLines = headerLike ? lines.slice(1) : lines

  const seen = new Set<string>()
  for (const line of dataLines) {
    // 简单 CSV：忽略引号包裹（首版不处理嵌套引号转义）
    const first = line.split(',')[0].replace(/^["']|["']$/g, '').trim()
    if (!first) continue
    if (seen.has(first)) {
      result.dropped.push(first)
      continue
    }
    seen.add(first)
    result.names.push(first)
  }
  return result
}

/** 读取一个 File 对象为字符串 */
export function readFileAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result ?? ''))
    reader.onerror = () => reject(reader.error)
    reader.readAsText(file, 'utf-8')
  })
}
