import { ChevronDown, Hash, MessageSquare, Orbit, Sparkles } from 'lucide-react'
import { AnimatePresence, motion } from 'framer-motion'
import { useEffect, useMemo, useState } from 'react'

const INITIAL_VISIBLE_COUNT = 6
const LOAD_STEP = 6
const HIGHLIGHT_SCORE_THRESHOLD = 85
const GAP_PATTERN = [2, 3]

function heatTone(heat) {
  if (heat >= 70) return 'bg-rose-400'
  if (heat >= 50) return 'bg-amber-400'
  return 'bg-cyan-400'
}

function sentimentTone(sentiment) {
  const value = String(sentiment ?? '').toLowerCase()
  if (value.includes('pos') || value.includes('support')) {
    return 'text-emerald-400 bg-emerald-400/10'
  }
  if (value.includes('neg') || value.includes('oppose')) {
    return 'text-rose-400 bg-rose-400/10'
  }
  return 'text-zinc-400 bg-zinc-400/10'
}

function normalizePlatform(platform) {
  const value = String(platform ?? '').toLowerCase()
  if (value.includes('twitter') || value === 'x') return 'Twitter'
  return 'Reddit'
}

function platformIcon(platform) {
  if (platform === 'Twitter') {
    return <Hash size={13} className="text-sky-300" />
  }
  return <MessageSquare size={13} className="text-orange-300" />
}

function platformDot(platform) {
  if (platform === 'Twitter') return 'bg-sky-300'
  return 'bg-rose-300'
}

function isHighlightedQuote(quote) {
  const score = Number(quote?.evidenceScore)
  return Number.isFinite(score) && score >= HIGHLIGHT_SCORE_THRESHOLD
}

function buildRhythmicQuotes(quotes) {
  if (!Array.isArray(quotes) || quotes.length === 0) return []

  const highlights = []
  const standard = []

  quotes.forEach((quote) => {
    if (isHighlightedQuote(quote)) {
      highlights.push(quote)
    } else {
      standard.push(quote)
    }
  })

  if (!highlights.length) return [...standard]

  const arranged = [highlights.shift()]
  let gapIndex = 0

  while (highlights.length > 0) {
    const preferredGap = GAP_PATTERN[gapIndex % GAP_PATTERN.length]
    const remainingHighlightsAfterNext = highlights.length - 1
    const maxGapKeepingSeparation = standard.length - remainingHighlightsAfterNext
    const gap = standard.length === 0
      ? 0
      : Math.max(1, Math.min(preferredGap, maxGapKeepingSeparation > 0 ? maxGapKeepingSeparation : 1))

    for (let i = 0; i < gap && standard.length > 0; i++) {
      arranged.push(standard.shift())
    }

    arranged.push(highlights.shift())
    gapIndex += 1
  }

  if (standard.length > 0) {
    arranged.push(...standard)
  }

  return arranged
}

function TopicChip({ topic, active, onClick }) {
  const chipClass = active
    ? 'bg-zinc-100 text-zinc-900 border-transparent font-medium'
    : 'bg-zinc-900/50 border border-zinc-800 text-zinc-400'

  return (
    <button
      type="button"
      onClick={onClick}
      className={`shrink-0 rounded-full px-3 py-1.5 md:px-4 md:py-2 cursor-pointer transition-colors inline-flex items-center gap-2 ${chipClass}`}
    >
      <span className="text-xs md:text-sm capitalize truncate max-w-[220px]">{topic.name}</span>
      <span className="w-5 h-1 rounded-full bg-zinc-700 overflow-hidden">
        <span
          className={`h-full block ${heatTone(topic.heat)}`}
          style={{ width: `${Math.max(20, Math.min(100, topic.heat))}%` }}
        />
      </span>
    </button>
  )
}

function PlatformToggle({ platform, active, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`shrink-0 rounded-full px-3 py-1.5 border transition-colors inline-flex items-center gap-1.5 text-xs ${
        active
          ? 'bg-zinc-100 text-zinc-900 border-transparent'
          : 'bg-zinc-900/50 border-zinc-800 text-zinc-500'
      }`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${platformDot(platform)}`} />
      {platform}
    </button>
  )
}

function QuoteCard({ quote, topicNameMap }) {
  const platform = normalizePlatform(quote.platform)
  const sentimentClass = sentimentTone(quote.sentiment)
  const evidenceScore = typeof quote.evidenceScore === 'number' ? quote.evidenceScore : null
  const isHighlight = isHighlightedQuote(quote)
  const tags = (quote.topicIds ?? [])
    .map((id) => topicNameMap.get(id))
    .filter(Boolean)
  const shellClass = isHighlight
    ? 'relative overflow-hidden bg-gradient-to-br from-zinc-800/80 to-zinc-900/40 border border-zinc-700/50 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] hover:border-zinc-600/50'
    : 'bg-zinc-900/35 border border-zinc-800/80 hover:border-zinc-700/80'

  return (
    <motion.div
      layout="position"
      initial={{ opacity: 0, y: 20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.2 } }}
      transition={{ type: 'spring', stiffness: 260, damping: 20 }}
      className="inline-block w-full break-inside-avoid mb-6"
    >
      <article className={`rounded-xl p-4 md:p-5 transition-colors ${shellClass}`}>
        {isHighlight && (
          <div className="mb-3 h-px rounded-full bg-gradient-to-r from-transparent via-zinc-300/40 to-transparent" />
        )}

        <div className="flex items-center justify-between gap-2 mb-3">
          <div className="inline-flex items-center gap-1.5 text-xs text-zinc-400 min-w-0">
            {platformIcon(platform)}
            <span className="truncate">{platform}</span>
          </div>
          <span className={`text-xs rounded-full px-2 py-0.5 ${sentimentClass}`}>
            {quote.sentiment || 'Neutral'}
          </span>
        </div>

        {isHighlight && (
          <div className="mb-3 inline-flex items-center gap-1.5 text-[11px] uppercase tracking-[0.14em] text-zinc-300/85 bg-zinc-800/40 border border-zinc-700/60 rounded-full px-2.5 py-1">
            <Sparkles size={11} className="text-zinc-400" />
            High Signal
          </div>
        )}

        <p
          className={`${
            isHighlight
              ? 'text-lg md:text-xl font-serif text-zinc-100 leading-relaxed'
              : 'text-sm text-zinc-300 leading-relaxed'
          } break-words whitespace-normal`}
        >
          &ldquo;{quote.text || 'No quote text available.'}&rdquo;
        </p>

        <div className="mt-4 pt-3 border-t border-zinc-800/60 flex flex-wrap gap-1.5 min-w-0">
          {tags.map((tag) => (
            <span
              key={`${quote.id}-${tag}`}
              className="text-xs text-zinc-500 border border-zinc-800 rounded px-2 py-0.5 break-words whitespace-normal"
            >
              #{String(tag).replace(/\s+/g, '_').toLowerCase()}
            </span>
          ))}
          {evidenceScore !== null && (
            <span className="text-xs text-zinc-500 border border-zinc-800 rounded px-2 py-0.5 break-words whitespace-normal">
              Evidence {evidenceScore}
            </span>
          )}
        </div>
      </article>
    </motion.div>
  )
}
export default function ControversyAccordion({ data }) {
  const topics = data?.topics ?? []
  const quotes = data?.quotes ?? []
  const [activeTopic, setActiveTopic] = useState(null)
  const [activePlatforms, setActivePlatforms] = useState(['Reddit', 'Twitter'])
  const [visibleCount, setVisibleCount] = useState(INITIAL_VISIBLE_COUNT)

  const topicNameMap = useMemo(
    () => new Map(topics.map((topic) => [topic.id, topic.name])),
    [topics]
  )

  const filteredQuotes = useMemo(
    () => quotes.filter((quote) => {
      const topicMatch = !activeTopic || (quote.topicIds ?? []).includes(activeTopic)
      const platform = normalizePlatform(quote.platform)
      const platformMatch = activePlatforms.includes(platform)
      return topicMatch && platformMatch
    }),
    [quotes, activeTopic, activePlatforms]
  )
  const rhythmicQuotes = useMemo(
    () => buildRhythmicQuotes(filteredQuotes),
    [filteredQuotes]
  )
  const displayedQuotes = useMemo(
    () => rhythmicQuotes.slice(0, visibleCount),
    [rhythmicQuotes, visibleCount]
  )
  const canLoadMore = visibleCount < rhythmicQuotes.length

  useEffect(() => {
    setVisibleCount(INITIAL_VISIBLE_COUNT)
  }, [activeTopic, activePlatforms])

  const togglePlatform = (platform) => {
    setActivePlatforms((prev) => (
      prev.includes(platform)
        ? prev.filter((item) => item !== platform)
        : [...prev, platform]
    ))
  }

  if (!topics.length || !quotes.length) return null

  return (
    <section className="bg-zinc-900/30 border border-zinc-800 rounded-xl overflow-hidden">
      <div className="sticky top-0 z-30 md:z-20 pt-4 pb-3 md:pb-4 bg-zinc-950/70 md:bg-zinc-950/80 backdrop-blur-xl md:backdrop-blur-md border-b border-zinc-800/50 md:border-white/5 px-4 md:px-5">
        <div className="flex items-center gap-2 mb-2 md:mb-1.5">
          <Orbit size={14} className="text-zinc-500" />
          <p className="text-[11px] font-bold tracking-widest text-zinc-500 uppercase">Controversy Lenses</p>
        </div>
        <p className="hidden md:block text-sm text-zinc-400 mb-4">Select a lens and inspect the raw signal feed without hidden folders.</p>

        <div className="relative">
          <div
            className="flex flex-nowrap md:flex-wrap overflow-x-auto md:overflow-visible whitespace-nowrap md:whitespace-normal scrollbar-hide overscroll-x-contain [&::-webkit-scrollbar]:hidden [scrollbar-width:none] gap-2 pr-8 md:pr-0"
            style={{
              WebkitMaskImage: 'linear-gradient(to right, black 85%, transparent 100%)',
              maskImage: 'linear-gradient(to right, black 85%, transparent 100%)',
            }}
          >
            <button
              type="button"
              onClick={() => setActiveTopic(null)}
              className={`shrink-0 rounded-full px-3 py-1.5 md:px-4 md:py-2 cursor-pointer transition-colors text-xs md:text-sm ${
                activeTopic === null
                  ? 'bg-zinc-100 text-zinc-900 border-transparent font-medium'
                  : 'bg-zinc-900/50 border border-zinc-800 text-zinc-400'
              }`}
            >
              All Topics
            </button>

            {topics.map((topic) => (
              <TopicChip
                key={topic.id}
                topic={topic}
                active={activeTopic === topic.id}
                onClick={() => setActiveTopic(topic.id)}
              />
            ))}

          </div>
          <div className="pointer-events-none absolute top-0 right-0 h-full w-8 bg-gradient-to-l from-zinc-950/95 to-transparent" />
        </div>

        <div className="flex items-center md:flex-wrap gap-3 md:gap-2 mt-3">
          <PlatformToggle
            platform="Reddit"
            active={activePlatforms.includes('Reddit')}
            onClick={() => togglePlatform('Reddit')}
          />
          <PlatformToggle
            platform="Twitter"
            active={activePlatforms.includes('Twitter')}
            onClick={() => togglePlatform('Twitter')}
          />
        </div>
      </div>

      <div id="signal-feed" className="px-4 md:px-5 pt-4 md:pt-4 pb-5 md:pb-5">
        {filteredQuotes.length > 0 ? (
          <motion.div className="columns-2 lg:columns-3 gap-4 md:gap-6 mt-1 md:mt-2">
            <AnimatePresence mode="popLayout">
              {displayedQuotes.map((quote) => (
                <QuoteCard
                  key={quote.id}
                  quote={quote}
                  topicNameMap={topicNameMap}
                />
              ))}
            </AnimatePresence>
          </motion.div>
        ) : (
          <motion.div
            layout
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.2 } }}
            transition={{ type: 'spring', stiffness: 300, damping: 25 }}
            className="border border-zinc-800 rounded-xl p-4 md:p-5 text-center"
          >
            <p className="text-sm text-zinc-500">No signals under the current topic and platform filters.</p>
          </motion.div>
        )}

        {canLoadMore && (
          <button
            type="button"
            onClick={() => setVisibleCount((count) => count + LOAD_STEP)}
            className="w-full md:w-auto mx-auto mt-8 px-6 py-3 rounded-full border border-zinc-800 text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800/50 transition-all flex items-center justify-center gap-2"
          >
            <span>Load More</span>
            <ChevronDown size={16} />
          </button>
        )}
      </div>
    </section>
  )
}
