import { ChevronDown, Hash, MessageSquare, Orbit, ShieldCheck, Sparkles } from 'lucide-react'
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

function truncateText(text, max = 120) {
  const value = String(text ?? '').replace(/\s+/g, ' ').trim()
  if (!value) return 'No quote text available.'
  if (value.length <= max) return value
  return `${value.slice(0, max - 1)}…`
}

function sentimentBucket(sentiment) {
  const value = String(sentiment ?? '').toLowerCase()
  if (value.includes('pos') || value.includes('support')) return 'support'
  if (value.includes('neg') || value.includes('oppose')) return 'oppose'
  return 'neutral'
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
  const evidenceScore = typeof quote.evidenceScore === 'number' ? quote.evidenceScore : null
  const tags = (quote.topicIds ?? [])
    .map((id) => topicNameMap.get(id))
    .filter(Boolean)
  const primaryTopic = tags[0] ?? 'Narrative'
  const primarySignalLabel = String(primaryTopic).toUpperCase()
  const cardClass = isHero
    ? 'col-span-1 md:col-span-2 lg:col-span-2 lg:row-span-2 relative overflow-hidden bg-gradient-to-br from-zinc-800/80 via-zinc-900/70 to-zinc-900/40 border-zinc-700/60 lg:min-h-[26rem] shadow-[0_0_32px_rgba(99,102,241,0.14)]'
    : 'col-span-1 row-span-1 bg-zinc-900/40 border-zinc-800/80 min-h-[13rem]'

  return (
    <motion.article
      layout
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.2 } }}
      transition={{ type: 'spring', stiffness: 300, damping: 25 }}
      className={`border rounded-xl p-5 hover:border-zinc-700 transition-colors h-full ${cardClass}`}
    >
      {isHero && (
        <span
          aria-hidden="true"
          className="absolute right-4 top-0 text-9xl leading-none text-white/5 font-serif pointer-events-none"
        >
          "
        </span>
      )}

      {isHero ? (
        <>
          <div className="relative z-10 flex flex-wrap items-center gap-2 mb-4">
            <span className="inline-flex items-center gap-1.5 text-[11px] uppercase tracking-[0.16em] text-indigo-100 bg-indigo-500/15 border border-indigo-400/30 rounded-full px-3 py-1">
              <Sparkles size={12} className="text-indigo-200" />
              Primary Signal: {primarySignalLabel} Gap
            </span>
            <span className="inline-flex items-center gap-1.5 text-xs text-indigo-100 rounded-full px-3 py-1 border border-indigo-400/35 bg-gradient-to-r from-indigo-500/30 to-violet-500/30 shadow-[0_0_18px_rgba(99,102,241,0.22)]">
              {platformIcon(platform)}
              {platform} focus
            </span>
            {evidenceScore !== null && (
              <span className="inline-flex items-center gap-1.5 text-xs text-indigo-100 rounded-full px-3 py-1 border border-indigo-400/35 bg-gradient-to-r from-violet-500/30 to-fuchsia-500/20 shadow-[0_0_18px_rgba(168,85,247,0.24)]">
                <ShieldCheck size={13} />
                Evidence {evidenceScore}
              </span>
            )}
          </div>

          <p className="relative z-10 text-2xl md:text-3xl font-serif text-zinc-100 leading-snug">
            &ldquo;{quote.text || 'No quote text available.'}&rdquo;
          </p>

          <div className="relative z-10 mt-5 pt-4 border-t border-zinc-700/60 flex flex-wrap gap-1.5">
            <span className={`text-xs rounded-full px-2 py-0.5 ${sentimentClass}`}>
              {quote.sentiment || 'Neutral'}
            </span>
            {tags.map((tag) => (
              <span
                key={`${quote.id}-${tag}`}
                className="text-xs text-zinc-300/80 border border-zinc-700 rounded px-2 py-0.5"
              >
                #{String(tag).replace(/\s+/g, '_').toLowerCase()}
              </span>
            ))}
          </div>
        </>
      ) : (
        <>
          <div className="relative z-10 flex items-center justify-between gap-2 mb-3">
            <div className="inline-flex items-center gap-1.5 text-xs text-zinc-400">
              {platformIcon(platform)}
              <span>{platform}</span>
            </div>
            <span className={`text-xs rounded-full px-2 py-0.5 ${sentimentClass}`}>
              {quote.sentiment || 'Neutral'}
            </span>
          </div>

          <p className="relative z-10 text-sm text-zinc-200 leading-relaxed">
            &ldquo;{quote.text || 'No quote text available.'}&rdquo;
          </p>

          <div className="relative z-10 mt-4 pt-3 border-t border-zinc-800/60 flex flex-wrap gap-1.5">
            {tags.map((tag) => (
              <span
                key={`${quote.id}-${tag}`}
                className="text-xs text-zinc-500 border border-zinc-800 rounded px-2 py-0.5"
              >
                #{String(tag).replace(/\s+/g, '_').toLowerCase()}
              </span>
            ))}
            {evidenceScore !== null && (
              <span className="text-xs text-zinc-500 border border-zinc-800 rounded px-2 py-0.5">
                Evidence {evidenceScore}
              </span>
            )}
          </div>
        </>
      )}
    </motion.article>
  )
}

function SignalConsensusCard({ quotes, topicNameMap, activeTopic }) {
  const total = quotes.length || 1
  const platformCounts = { Reddit: 0, Twitter: 0 }
  const stanceCounts = { support: 0, oppose: 0, neutral: 0 }
  const topicCounts = new Map()
  let strongest = null

  quotes.forEach((quote) => {
    const platform = normalizePlatform(quote.platform)
    platformCounts[platform] = (platformCounts[platform] ?? 0) + 1

    const bucket = sentimentBucket(quote.sentiment)
    stanceCounts[bucket] += 1

    const evidence = typeof quote.evidenceScore === 'number' ? quote.evidenceScore : null
    if (evidence !== null && (!strongest || evidence > strongest.evidence)) {
      strongest = {
        evidence,
        text: quote.text,
        platform,
      }
    }

    ;(quote.topicIds ?? []).forEach((id) => {
      const topic = topicNameMap.get(id)
      if (!topic) return
      topicCounts.set(topic, (topicCounts.get(topic) ?? 0) + 1)
    })
  })

  const dominantTopic = activeTopic
    || [...topicCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0]
    || 'General Narrative'
  const redditPct = Math.round((platformCounts.Reddit / total) * 100)
  const twitterPct = 100 - redditPct
  const supportPct = Math.round((stanceCounts.support / total) * 100)
  const opposePct = Math.round((stanceCounts.oppose / total) * 100)
  const neutralPct = Math.max(0, 100 - supportPct - opposePct)
  const strongestSnippet = strongest
    ? truncateText(strongest.text, 110)
    : 'No high-evidence quote surfaced yet in the current filter window.'

  return (
    <motion.article
      layout
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.2 } }}
      transition={{ type: 'spring', stiffness: 300, damping: 25 }}
      className="col-span-1 md:col-span-2 lg:col-span-2 row-span-1 h-full border border-cyan-500/25 rounded-xl p-5 bg-gradient-to-br from-cyan-500/10 via-zinc-900/70 to-zinc-900/40 shadow-[0_0_24px_rgba(34,211,238,0.1)]"
    >
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
        <p className="text-[11px] uppercase tracking-[0.18em] text-cyan-200/85">
          Signal Consensus: {String(dominantTopic).toUpperCase()}
        </p>
        <span className="text-xs text-cyan-100/80 border border-cyan-400/30 rounded-full px-2.5 py-0.5">
          {quotes.length} signals in view
        </span>
      </div>

      <ul className="space-y-2.5">
        <li className="flex items-start gap-2 text-sm text-zinc-200 leading-relaxed">
          <span className="h-1.5 w-1.5 rounded-full bg-cyan-300 mt-1.5 shrink-0" />
          <span>Platform pressure: Reddit {redditPct}% versus Twitter {twitterPct}% in the current feed.</span>
        </li>
        <li className="flex items-start gap-2 text-sm text-zinc-200 leading-relaxed">
          <span className="h-1.5 w-1.5 rounded-full bg-indigo-300 mt-1.5 shrink-0" />
          <span>Stance balance: support {supportPct}%, oppose {opposePct}%, neutral {neutralPct}%.</span>
        </li>
        <li className="flex items-start gap-2 text-sm text-zinc-200 leading-relaxed">
          <span className="h-1.5 w-1.5 rounded-full bg-violet-300 mt-1.5 shrink-0" />
          <span>
            Evidence anchor{strongest ? ` (${strongest.platform} ${strongest.evidence})` : ''}: &ldquo;{strongestSnippet}&rdquo;
          </span>
        </li>
      </ul>
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
  const activeTopicName = activeTopic ? topicNameMap.get(activeTopic) : null

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
        <motion.div layout className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 lg:auto-rows-[minmax(180px,auto)] gap-6">
          <AnimatePresence mode="popLayout">
            {displayedQuotes.map((quote, index) => {
              if (index === 4) {
                return (
                  <SignalConsensusCard
                    key={`consensus-${activeTopic ?? 'all'}`}
                    quotes={displayedQuotes}
                    topicNameMap={topicNameMap}
                    activeTopic={activeTopicName}
                  />
                )
              }

              return (
                <QuoteCard
                  key={quote.id}
                  quote={quote}
                  topicNameMap={topicNameMap}
                  isHero={index === 0}
                />
              )
            })}
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
