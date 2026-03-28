import { ChevronDown, ExternalLink, Hash, MessageSquare } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { collectQuotes } from '../lib/controversyMapper'

function clampHeat(value) {
  const n = Number(value ?? 0)
  if (Number.isNaN(n)) return 0
  return Math.max(0, Math.min(100, Math.round(n)))
}

function heatTone(value) {
  if (value >= 70) return 'bg-rose-400'
  if (value >= 40) return 'bg-amber-400'
  return 'bg-cyan-400'
}

function normalize(value) {
  return String(value ?? '').toLowerCase()
}

function platformKey(value) {
  const source = normalize(value)
  if (source.includes('twitter') || source === 'x') return 'Twitter'
  return 'Reddit'
}

function splitKeywords(value) {
  return normalize(value)
    .split(/[^a-z0-9]+/i)
    .filter((word) => word.length >= 3)
}

function matchScore(text, keywords) {
  if (!text || keywords.length === 0) return 0
  const source = normalize(text)
  let score = 0
  for (const keyword of keywords) {
    if (source.includes(keyword)) score += 1
  }
  return score
}

function dedupeQuotes(quotes) {
  const seen = new Set()
  return quotes.filter((quote) => {
    const key = `${quote.url || ''}::${quote.text || ''}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

function evidenceScore(quote) {
  if (typeof quote?.evidenceScore === 'number') {
    return Math.max(0, Math.min(100, Math.round(quote.evidenceScore)))
  }
  if (typeof quote?.evidenceWeight === 'number') {
    return Math.max(0, Math.min(100, Math.round(quote.evidenceWeight * 100)))
  }
  return null
}

function resolveTopicQuotes(item, allQuotes, claimUrls) {
  const topicQuotes = item?.quotes ?? []
  const keywords = splitKeywords(item?.aspect || item?.topic || '')
  const matchedFromAll = allQuotes
    .map((quote) => ({
      quote,
      score: matchScore(`${quote.text} ${quote.url}`, keywords),
    }))
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score)
    .map((entry) => entry.quote)

  const fallback = [
    ...allQuotes.filter((quote) => platformKey(quote.platform) === 'Reddit').slice(0, 1),
    ...allQuotes.filter((quote) => platformKey(quote.platform) === 'Twitter').slice(0, 1),
    ...allQuotes.slice(0, 2),
  ]

  const baseQuotes = dedupeQuotes([
    ...topicQuotes,
    ...matchedFromAll,
    ...fallback,
  ]).slice(0, 8)

  const claimMatchedQuotes = claimUrls.size > 0
    ? baseQuotes.filter((quote) => quote?.url && claimUrls.has(quote.url))
    : []

  const hasClaimFallback = claimUrls.size > 0 && claimMatchedQuotes.length === 0
  const prioritizedQuotes = claimMatchedQuotes.length > 0
    ? dedupeQuotes([
      ...claimMatchedQuotes,
      ...baseQuotes.filter((quote) => !(quote?.url && claimUrls.has(quote.url))),
    ])
    : baseQuotes
  const visibleQuotes = prioritizedQuotes.slice(0, 6)
  const redditQuotes = visibleQuotes.filter((quote) => platformKey(quote.platform) === 'Reddit').slice(0, 3)
  const twitterQuotes = visibleQuotes.filter((quote) => platformKey(quote.platform) === 'Twitter').slice(0, 3)

  return {
    redditQuotes,
    twitterQuotes,
    hasClaimFallback,
  }
}

function PillTag({ platform, label }) {
  const dotClass = platform === 'Reddit' ? 'bg-orange-300' : 'bg-sky-300'

  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-zinc-800 px-2 py-0.5 text-[11px] text-zinc-400">
      <span className={`h-1.5 w-1.5 rounded-full ${dotClass}`} />
      {label}
    </span>
  )
}

function MetaTag({ children }) {
  return (
    <span className="text-xs text-zinc-500 border border-zinc-800 rounded px-2 py-0.5 leading-none">
      {children}
    </span>
  )
}

function platformIcon(platform) {
  if (platform === 'Twitter') {
    return <Hash size={13} className="text-sky-300" />
  }
  return <MessageSquare size={13} className="text-orange-300" />
}

function QuoteCard({ quote, platform, claimMatched }) {
  const sentiment = quote?.sentiment ? String(quote.sentiment) : 'Neutral'
  const score = evidenceScore(quote)

  return (
    <article className="rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-3 flex flex-col gap-2.5">
      <div className="inline-flex items-center gap-1.5 text-xs text-zinc-400">
        {platformIcon(platform)}
        <span>{platform}</span>
      </div>

      <p className="text-sm text-zinc-200 leading-relaxed">
        &ldquo;{quote?.text || 'No evidence text available.'}&rdquo;
      </p>

      <div className="flex flex-wrap gap-1.5 mt-auto">
        <MetaTag>{sentiment}</MetaTag>
        {score !== null && <MetaTag>Evidence {score}</MetaTag>}
        {claimMatched && <MetaTag>Claim Match</MetaTag>}
      </div>

      {quote?.url && (
        <a
          href={quote.url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 text-xs text-zinc-500 hover:text-zinc-300 transition-colors mt-0.5"
        >
          <ExternalLink size={12} />
          Source
        </a>
      )}
    </article>
  )
}

function PlatformColumn({ platform, quotes, claimUrls }) {
  return (
    <div className="rounded-lg border border-zinc-800/80 bg-zinc-900/40 p-3">
      <div className="flex items-center gap-1.5 text-xs text-zinc-400 mb-2.5">
        {platformIcon(platform)}
        <span>{platform}</span>
        <span className="text-zinc-500">({quotes.length})</span>
      </div>

      {quotes.length > 0 ? (
        <div className="space-y-2.5">
          {quotes.map((quote, index) => (
            <QuoteCard
              key={`${platform}-${quote.url || quote.text}-${index}`}
              quote={quote}
              platform={platform}
              claimMatched={Boolean(quote.url && claimUrls.has(quote.url))}
            />
          ))}
        </div>
      ) : (
        <div className="rounded-lg border border-dashed border-zinc-800 px-3 py-5 text-center">
          <p className="text-xs text-zinc-500">No representative {platform} quote for this topic.</p>
        </div>
      )}
    </div>
  )
}

export default function ControversyAccordion({
  items = [],
  report = null,
  claimEvidenceMap = [],
  activeClaimId = null,
  activeAspect = null,
  onAspectSelect = () => {},
}) {
  const [openAspect, setOpenAspect] = useState(activeAspect ?? null)

  useEffect(() => {
    setOpenAspect(activeAspect ?? null)
  }, [activeAspect])

  const allQuotes = useMemo(() => collectQuotes(report), [report])
  const selectedClaim = claimEvidenceMap.find((claim) => claim.claimId === activeClaimId) || null
  const claimUrls = useMemo(() => new Set(selectedClaim?.evidenceUrls ?? []), [selectedClaim])

  const resolvedItems = useMemo(
    () => items.map((item) => ({
      ...item,
      quotePack: resolveTopicQuotes(item, allQuotes, claimUrls),
    })),
    [items, allQuotes, claimUrls]
  )

  if (!resolvedItems.length) return null

  return (
    <section className="bg-zinc-900/30 border border-zinc-800 rounded-xl p-4 md:p-5">
      <div className="flex flex-wrap items-start justify-between gap-2 mb-3">
        <div>
          <p className="text-xs uppercase tracking-widest text-zinc-500 font-medium">Controversy Accordion</p>
          <p className="text-sm text-zinc-400 mt-1">Expand a topic to inspect Reddit and Twitter voices side by side.</p>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          {selectedClaim && (
            <span className="text-xs text-zinc-400 border border-zinc-800 rounded-full px-2 py-0.5">
              Claim filter {selectedClaim.claimId}
            </span>
          )}
          {openAspect && (
            <button
              type="button"
              onClick={() => {
                setOpenAspect(null)
                onAspectSelect(null)
              }}
              className="text-xs text-zinc-400 border border-zinc-800 rounded-full px-2 py-0.5 hover:bg-zinc-800/50 transition-colors"
            >
              Clear topic filter
            </button>
          )}
        </div>
      </div>

      <div className="space-y-2.5">
        {resolvedItems.map((item) => {
          const aspect = item?.aspect || item?.topic || 'General'
          const isOpen = openAspect === aspect
          const heat = clampHeat(item?.heat)
          const heatClass = heatTone(heat)
          const { redditQuotes, twitterQuotes, hasClaimFallback } = item.quotePack
          const platformTags = item.platformTags ?? []

          return (
            <div
              key={item.id}
              className="rounded-xl border border-zinc-800 bg-zinc-900/40 overflow-hidden"
            >
              <button
                type="button"
                onClick={() => {
                  const next = isOpen ? null : aspect
                  setOpenAspect(next)
                  onAspectSelect(next)
                }}
                className="w-full px-3.5 py-3 text-left hover:bg-zinc-800/50 transition-colors"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap mb-2">
                      <p className="text-sm font-medium text-zinc-100">{aspect}</p>
                      <div className="inline-flex items-center gap-2 text-xs text-zinc-400">
                        <span>Heat {heat}</span>
                        <span className="w-14 h-1 rounded-full bg-zinc-800 overflow-hidden">
                          <span className={`h-full block ${heatClass}`} style={{ width: `${heat}%` }} />
                        </span>
                      </div>
                    </div>

                    <p className="text-xs text-zinc-400 leading-relaxed line-clamp-2">{item.summary}</p>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <div className="hidden md:flex items-center gap-1">
                      {platformTags.map((tag) => (
                        <PillTag key={`${item.id}-${tag.platform}-${tag.label}`} platform={tag.platform} label={tag.label} />
                      ))}
                    </div>
                    <ChevronDown
                      size={15}
                      className={`text-zinc-500 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
                    />
                  </div>
                </div>
              </button>

              <div
                className={`grid transition-all duration-300 ease-out ${
                  isOpen ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'
                }`}
              >
                <div className="overflow-hidden">
                  <div className="px-3.5 pb-3.5">
                    <div className="rounded-xl border border-zinc-800 bg-[#0a0a0a] p-3 md:p-4">
                      {hasClaimFallback && (
                        <p className="text-xs text-zinc-500 mb-3">
                          No direct claim evidence matched this topic. Showing closest topic voices.
                        </p>
                      )}

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <PlatformColumn platform="Reddit" quotes={redditQuotes} claimUrls={claimUrls} />
                        <PlatformColumn platform="Twitter" quotes={twitterQuotes} claimUrls={claimUrls} />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </section>
  )
}
