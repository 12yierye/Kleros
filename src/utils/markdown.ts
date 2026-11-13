/**
 * 极简 Markdown 渲染，只覆盖 GitHub Release 正文里实际出现的语法：
 * 标题、列表、引用、分隔线、加粗、行内代码、链接。
 *
 * 行级语法在原文上匹配，行内内容先转义再生成标签，所以正文里写了什么 HTML 都不会被执行；
 * 链接只放行 http(s)，其余原样保留为文本。
 */

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function renderInline(text: string): string {
  return escapeHtml(text)
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(
      /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g,
      '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>'
    )
}

export function renderMarkdown(source: string): string {
  // 行级语法要在原文上判断，行内内容才转义——否则 > 会先变成 &gt;，引用块全失效
  const lines = source.replace(/\r\n?/g, '\n').split('\n')
  const out: string[] = []

  let list: 'ul' | 'ol' | null = null
  let paragraph: string[] = []
  let quote: string[] = []

  const flushParagraph = () => {
    if (!paragraph.length) return
    out.push(`<p>${renderInline(paragraph.join(' '))}</p>`)
    paragraph = []
  }

  const flushQuote = () => {
    if (!quote.length) return
    out.push(`<blockquote>${quote.map(renderInline).join('<br>')}</blockquote>`)
    quote = []
  }

  const closeList = () => {
    if (!list) return
    out.push(`</${list}>`)
    list = null
  }

  for (const raw of lines) {
    const line = raw.trim()
    if (!line) {
      flushParagraph()
      flushQuote()
      closeList()
      continue
    }

    const heading = line.match(/^(#{1,6})\s+(.*)$/)
    if (heading) {
      flushParagraph()
      flushQuote()
      closeList()
      const level = Math.min(6, heading[1].length + 2)
      out.push(`<h${level}>${renderInline(heading[2])}</h${level}>`)
      continue
    }

    if (/^(-{3,}|\*{3,}|_{3,})$/.test(line)) {
      flushParagraph()
      flushQuote()
      closeList()
      out.push('<hr>')
      continue
    }

    const quoted = line.match(/^>\s?(.*)$/)
    if (quoted) {
      flushParagraph()
      closeList()
      quote.push(quoted[1])
      continue
    }
    flushQuote()

    const bullet = line.match(/^[-*+]\s+(.*)$/)
    if (bullet) {
      flushParagraph()
      if (list !== 'ul') {
        closeList()
        out.push('<ul>')
        list = 'ul'
      }
      out.push(`<li>${renderInline(bullet[1])}</li>`)
      continue
    }

    const ordered = line.match(/^\d+[.)]\s+(.*)$/)
    if (ordered) {
      flushParagraph()
      if (list !== 'ol') {
        closeList()
        out.push('<ol>')
        list = 'ol'
      }
      out.push(`<li>${renderInline(ordered[1])}</li>`)
      continue
    }

    closeList()
    paragraph.push(line)
  }

  flushParagraph()
  flushQuote()
  closeList()
  return out.join('\n')
}
