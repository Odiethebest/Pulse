import { ChevronDown, Hash, MessageSquare, Orbit } from 'lucide-react'
import { AnimatePresence, motion } from 'framer-motion'
import { useEffect, useMemo, useState } from 'react'

const INITIAL_VISIBLE_COUNT = 6
const LOAD_STEP = 6

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

function TopicChip({ topic, active, onClick }) {
  const chipClass = active
    ? 'bg-zinc-100 text-zinc-900 border-transparent font-medium'
    : 'bg-zinc-900/50 border border-zinc-800 text-zinc-400'

  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full px-4 py-2 cursor-pointer transition-colors inline-flex items-center gap-2 ${chipClass}`}
    >
      <span className="text-sm capitalize">{topic.name}</span>
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
      className={`rounded-full px-3 py-1.5 border transition-colors inline-flex items-center gap-1.5 text-xs ${
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

function QuoteCard({ quote, topicNameMap, isHero = false }) {
  const platform = normalizePlatform(quote.platform)
  const sentimentClass = sentimentTone(quote.sentiment)
  const tags = (quote.topicIds ?? [])
    .map((id) => topicNameMap.get(id))
    .filter(Boolean)
  const cardClass = isHero
    ? 'col-span-1 bg-zinc-900/60 border-zinc-700/50 md:col-span-2 lg:col-span-2'
    : 'col-span-1 bg-zinc-900/40 border-zinc-800/80'

  return (
    <motion.article
      layout
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.2 } }}
      transition={{ type: 'spring', stiffness: 300, damping: 25 }}
      className={`border rounded-xl p-5 hover:border-zinc-700 transition-colors ${cardClass}`}
    >
      <div className="flex items-center justify-between gap-2 mb-3">
        <div className="inline-flex items-center gap-1.5 text-xs text-zinc-400">
          {platformIcon(platform)}
          <span>{platform}</span>
        </div>
        <span className={`text-xs rounded-full px-2 py-0.5 ${sentimentClass}`}>
          {quote.sentiment || 'Neutral'}
        </span>
      </div>

      <p className={`text-zinc-200 ${isHero ? 'text-base md:text-lg leading-relaxed' : 'text-sm leading-relaxed'}`}>
        &ldquo;{quote.text || 'No quote text available.'}&rdquo;
      </p>

      <div className="mt-4 pt-3 border-t border-zinc-800/60 flex flex-wrap gap-1.5">
        {tags.map((tag) => (
          <span
            key={`${quote.id}-${tag}`}
            className="text-xs text-zinc-500 border border-zinc-800 rounded px-2 py-0.5"
          >
            #{String(tag).replace(/\s+/g, '_').toLowerCase()}
          </span>
        ))}
        {typeof quote.evidenceScore === 'number' && (
          <span className="text-xs text-zinc-500 border border-zinc-800 rounded px-2 py-0.5">
            Evidence {quote.evidenceScore}
          </span>
        )}
      </div>
    </motion.article>
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
  const displayedQuotes = useMemo(
    () => filteredQuotes.slice(0, visibleCount),
    [filteredQuotes, visibleCount]
  )
  const canLoadMore = visibleCount < filteredQuotes.length

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
    <section className="bg-zinc-900/30 border border-zinc-800 rounded-xl p-4 md:p-5">
      <div className="sticky top-0 z-20 bg-zinc-950/80 backdrop-blur-md border-b border-white/5 pb-4 pt-4 mb-6">
        <div className="flex items-center gap-2 mb-1.5">
          <Orbit size={14} className="text-zinc-500" />
          <p className="text-xs uppercase tracking-widest text-zinc-500 font-medium">Controversy Lenses</p>
        </div>
        <p className="text-sm text-zinc-400 mb-4">Select a lens and inspect the raw signal feed without hidden folders.</p>

        <div className="flex flex-wrap gap-2 mb-4">
          <button
            type="button"
            onClick={() => setActiveTopic(null)}
            className={`rounded-full px-4 py-2 cursor-pointer transition-colors text-sm ${
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

        <div className="flex flex-wrap items-center gap-2">
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

      {filteredQuotes.length > 0 ? (
        <motion.div layout className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <AnimatePresence mode="popLayout">
            {displayedQuotes.map((quote, index) => (
              <QuoteCard
                key={quote.id}
                quote={quote}
                topicNameMap={topicNameMap}
                isHero={index === 0}
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
          className="border border-zinc-800 rounded-xl p-8 text-center"
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
    </section>
  )
}
