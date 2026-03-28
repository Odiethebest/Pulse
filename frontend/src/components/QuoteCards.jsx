import { useMemo, useState } from 'react'

const PLATFORM = {
  Reddit: { color: '#f97316', bg: 'rgba(249,115,22,0.1)' },
  Twitter: { color: '#3b82f6', bg: 'rgba(59,130,246,0.1)' },
}

const SENTIMENT = {
  positive: { label: 'Positive', color: '#22c55e', bg: 'rgba(34,197,94,0.08)' },
  negative: { label: 'Negative', color: '#ef4444', bg: 'rgba(239,68,68,0.08)' },
  neutral: { label: 'Neutral', color: '#6b7280', bg: 'rgba(107,114,128,0.08)' },
}

const CAMP = {
  support: { label: 'Support', color: '#16a34a', bg: 'rgba(22,163,74,0.1)' },
  oppose: { label: 'Oppose', color: '#dc2626', bg: 'rgba(220,38,38,0.1)' },
  neutral: { label: 'Neutral', color: '#6b7280', bg: 'rgba(107,114,128,0.1)' },
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
    <span
      style={{ color, background: bg, border: `1px solid ${color}30` }}
      className="rounded-full px-2 py-0.5 text-xs font-medium leading-none"
    >
      {children}
    </span>
  )
}

function QuoteCard({ quote, index, highlighted, dimmed, aspectMatched }) {
  const [expanded, setExpanded] = useState(false)
  const ps = PLATFORM[quote.platform] ?? PLATFORM.Reddit
  const ss = SENTIMENT[quote.sentiment?.toLowerCase()] ?? SENTIMENT.neutral
  const cs = CAMP[quote.camp?.toLowerCase?.() || quote.camp] ?? CAMP.neutral
  const evidence = typeof quote.evidenceWeight === 'number'
    ? Math.max(0, Math.min(1, quote.evidenceWeight))
    : 0.5
  const isLong = quote.text?.length > 160

  return (
    <div
      className={`animate-fade-up rounded-xl p-4 flex flex-col gap-3 transition-all ${
        highlighted
          ? 'bg-[#151d1a] border border-[#22c55e]/50 shadow-[0_0_0_1px_rgba(34,197,94,0.25)]'
          : 'bg-[#1a1a1a] border border-[#2a2a2a]'
      }`}
      style={{
        animationDelay: `${index * 50}ms`,
        animationFillMode: 'both',
        opacity: dimmed ? 0.45 : 1,
      }}
    >
      <div className="flex items-center gap-2 flex-wrap">
        <Badge color={ps.color} bg={ps.bg}>{quote.platform}</Badge>
        <Badge color={ss.color} bg={ss.bg}>{ss.label}</Badge>
        <Badge color={cs.color} bg={cs.bg}>{cs.label}</Badge>
        <Badge color="#9ca3af" bg="rgba(156,163,175,0.08)">Evidence {Math.round(evidence * 100)}</Badge>
        {aspectMatched && <Badge color="#93c5fd" bg="rgba(59,130,246,0.12)">Aspect Match</Badge>}
        {highlighted && <Badge color="#22c55e" bg="rgba(34,197,94,0.1)">Claim Match</Badge>}
      </div>

      <div className="flex-1">
        <p className={`text-[#e5e7eb] text-sm leading-relaxed ${expanded ? '' : 'line-clamp-3'}`}>
          &ldquo;{quote.text}&rdquo;
        </p>
        {isLong && (
          <button
            onClick={() => setExpanded((v) => !v)}
            className="text-[#3b82f6] text-xs mt-1.5 hover:text-[#60a5fa] transition-colors"
          >
            {expanded ? 'Show less' : 'Read more'}
          </button>
        )}
      </div>

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

export default function QuoteCards({
  redditSentiment,
  twitterSentiment,
  claimEvidenceMap = [],
  activeClaimId = null,
  controversyItems = [],
  activeAspect = null,
  onClearAspect = () => {},
}) {
  const quotes = useMemo(
    () => [
      ...(redditSentiment?.representativeQuotes ?? []).map((quote) => ({ ...quote, platform: 'Reddit' })),
      ...(twitterSentiment?.representativeQuotes ?? []).map((quote) => ({ ...quote, platform: 'Twitter' })),
    ],
    [redditSentiment?.representativeQuotes, twitterSentiment?.representativeQuotes]
  )

  const selectedClaim = claimEvidenceMap.find((claim) => claim.claimId === activeClaimId) || null
  const claimUrls = new Set(selectedClaim?.evidenceUrls || [])
  const selectedAspectItem = controversyItems.find((item) => item.aspect === activeAspect) || null
  const aspectUrls = new Set((selectedAspectItem?.quotes || []).map((quote) => quote.url).filter(Boolean))

  const hasClaimFilter = claimUrls.size > 0
  const hasAspectFilter = Boolean(activeAspect && selectedAspectItem)

  const visibleQuotes = quotes.filter((quote) => {
    if (hasClaimFilter && !claimUrls.has(quote.url)) return false
    if (hasAspectFilter && !aspectUrls.has(quote.url)) return false
    return true
  })

  if (quotes.length === 0) return null

  const showingQuotes = visibleQuotes.length > 0 ? visibleQuotes : quotes

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-2 mb-3">
        <p className="text-[#4b5563] text-xs uppercase tracking-widest font-medium">
          What People Are Saying
        </p>
        <div className="flex flex-wrap gap-1.5">
          {selectedClaim && (
            <span className="text-[11px] text-[#86efac] border border-[#14532d]/50 bg-[#14532d]/20 rounded-full px-2 py-0.5">
              Claim Filter {selectedClaim.claimId}
            </span>
          )}
          {selectedAspectItem && (
            <button
              onClick={onClearAspect}
              className="text-[11px] text-[#93c5fd] border border-[#1d4ed8]/50 bg-[#1d4ed8]/20 rounded-full px-2 py-0.5 hover:bg-[#1d4ed8]/30 transition-colors"
            >
              Aspect Filter {selectedAspectItem.aspect}
            </button>
          )}
        </div>
      </div>

      {visibleQuotes.length === 0 && (hasClaimFilter || hasAspectFilter) && (
        <p className="text-xs text-[#9ca3af] mb-3">
          No quote matches both filters. Showing the full quote set.
        </p>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {showingQuotes.map((quote, index) => (
          <QuoteCard
            key={`${quote.url || quote.text}-${index}`}
            quote={quote}
            index={index}
            highlighted={claimUrls.has(quote.url)}
            aspectMatched={aspectUrls.has(quote.url)}
            dimmed={(hasClaimFilter && !claimUrls.has(quote.url))
              || (hasAspectFilter && !aspectUrls.has(quote.url))}
          />
        ))}
      </div>
    </div>
  )
}
