function safeSnippet(value, limit = 160) {
  const text = String(value ?? '').replace(/\s+/g, ' ').trim()
  if (!text) return 'Source evidence not available.'
  if (text.length <= limit) return text
  return `${text.slice(0, limit - 1)}…`
}

function citationNumber(token) {
  const match = String(token ?? '').match(/(\d+)/)
  if (!match) return null
  const parsed = Number(match[1])
  if (!Number.isInteger(parsed) || parsed <= 0) return null
  return parsed
}

function extractQuoteText(source) {
  if (typeof source === 'string') return source
  if (!source || typeof source !== 'object') return ''
  if (typeof source.text === 'string') return source.text
  if (typeof source.quote === 'string') return source.quote
  if (typeof source.summary === 'string') return source.summary
  return ''
}

export function InteractiveCitation({ source, citation }) {
  const quoteText = extractQuoteText(source)
  const tooltip = quoteText ? safeSnippet(quoteText) : 'Source evidence not available.'
  const shellClass = quoteText
    ? 'text-indigo-300 bg-indigo-500/10 border-indigo-500/20 hover:bg-indigo-500/30'
    : 'text-zinc-500 bg-zinc-500/10 border-zinc-500/20 hover:bg-zinc-500/20'

  const handleClick = () => {
    if (typeof document === 'undefined') return
    document.getElementById('signal-feed')?.scrollIntoView({ behavior: 'smooth' })
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      className={`relative group inline-flex items-center justify-center w-5 h-5 text-[10px] font-bold border rounded-sm mx-0.5 align-super cursor-pointer transition-colors ${shellClass}`}
      data-testid={`interactive-citation-${citation}`}
      aria-label={`Source citation ${citation}`}
    >
      {citation}
      <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-64 p-3 bg-zinc-900 border border-zinc-700 rounded-lg shadow-2xl text-xs text-zinc-300 font-normal leading-relaxed opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50 pointer-events-none break-words whitespace-normal text-left">
        {tooltip}
        <span className="absolute top-full left-1/2 -translate-x-1/2 -mt-[1px] border-4 border-transparent border-t-zinc-700" />
      </span>
    </button>
  )
}

export function parseCitations(text, quotesData = []) {
  const input = String(text ?? '')
  const regex = /\[(Q?\d+)\]/gi
  const nodes = []
  let lastIndex = 0
  let match

  while ((match = regex.exec(input)) !== null) {
    const fullMatch = match[0]
    const token = match[1]
    const start = match.index

    if (start > lastIndex) {
      nodes.push(input.slice(lastIndex, start))
    }

    const number = citationNumber(token)
    if (number === null) {
      nodes.push(fullMatch)
    } else {
      const source = Array.isArray(quotesData) ? quotesData[number - 1] : null
      nodes.push(
        <InteractiveCitation
          key={`citation-${number}-${start}`}
          citation={number}
          source={source}
        />
      )
    }

    lastIndex = start + fullMatch.length
  }

  if (lastIndex < input.length) {
    nodes.push(input.slice(lastIndex))
  }

  return nodes.length > 0 ? nodes : [input]
}
