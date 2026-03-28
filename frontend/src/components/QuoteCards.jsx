import { useState } from 'react'

const PLATFORM = {
  Reddit:  { color: '#f97316', bg: 'rgba(249,115,22,0.1)' },
  Twitter: { color: '#3b82f6', bg: 'rgba(59,130,246,0.1)' },
}

const SENTIMENT = {
  positive: { label: 'Positive', color: '#22c55e', bg: 'rgba(34,197,94,0.08)' },
  negative: { label: 'Negative', color: '#ef4444', bg: 'rgba(239,68,68,0.08)' },
  neutral:  { label: 'Neutral',  color: '#6b7280', bg: 'rgba(107,114,128,0.08)' },
}

function displayUrl(url) {
  try {
    const { hostname, pathname } = new URL(url)
    const path = pathname.length > 1
      ? pathname.slice(0, 28) + (pathname.length > 28 ? '…' : '')
      : ''
    return hostname + path
  } catch {
    return url.slice(0, 40) + (url.length > 40 ? '…' : '')
  }
}

function ExternalIcon() {
  return (
    <svg width={11} height={11} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
      <polyline points="15 3 21 3 21 9" />
      <line x1="10" y1="14" x2="21" y2="3" />
    </svg>
  )
}

function Badge({ color, bg, children }) {
  return (
    <span style={{ color, background: bg, border: `1px solid ${color}30` }}
      className="rounded-full px-2 py-0.5 text-xs font-medium leading-none">
      {children}
    </span>
  )
}

function QuoteCard({ quote, platform, index }) {
  const [expanded, setExpanded] = useState(false)

  const ps = PLATFORM[platform]  ?? PLATFORM.Reddit
  const ss = SENTIMENT[quote.sentiment?.toLowerCase()] ?? SENTIMENT.neutral
  const isLong = quote.text?.length > 160

  return (
    <div
      className="animate-fade-up bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl p-4 flex flex-col gap-3"
      style={{ animationDelay: `${index * 50}ms`, animationFillMode: 'both', opacity: 0 }}
    >
      {/* Platform + sentiment badges */}
      <div className="flex items-center gap-2 flex-wrap">
        <Badge color={ps.color} bg={ps.bg}>{platform}</Badge>
        <Badge color={ss.color} bg={ss.bg}>{ss.label}</Badge>
      </div>

      {/* Quote text */}
      <div className="flex-1">
        <p className={`text-[#e5e7eb] text-sm leading-relaxed ${expanded ? '' : 'line-clamp-3'}`}>
          &ldquo;{quote.text}&rdquo;
        </p>
        {isLong && (
          <button
            onClick={() => setExpanded(e => !e)}
            className="text-[#3b82f6] text-xs mt-1.5 hover:text-[#60a5fa] transition-colors"
          >
            {expanded ? 'Show less' : 'Read more'}
          </button>
        )}
      </div>

      {/* Source link */}
      {quote.url && (
        <a
          href={quote.url}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1.5 text-[#4b5563] hover:text-[#6b7280] transition-colors mt-auto min-w-0"
        >
          <ExternalIcon />
          <span className="text-xs truncate">{displayUrl(quote.url)}</span>
        </a>
      )}
    </div>
  )
}

export default function QuoteCards({ redditSentiment, twitterSentiment }) {
  // Reddit quotes first, then Twitter
  const quotes = [
    ...(redditSentiment?.representativeQuotes ?? []).map(q => ({ ...q, platform: 'Reddit' })),
    ...(twitterSentiment?.representativeQuotes ?? []).map(q => ({ ...q, platform: 'Twitter' })),
  ]

  if (quotes.length === 0) return null

  return (
    <div>
      <p className="text-[#4b5563] text-xs uppercase tracking-widest mb-4 font-medium">
        What People Are Saying
      </p>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {quotes.map((q, i) => (
          <QuoteCard key={i} quote={q} platform={q.platform} index={i} />
        ))}
      </div>
    </div>
  )
}
