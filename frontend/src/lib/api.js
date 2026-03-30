const API_BASE = (import.meta.env.VITE_API_BASE || '/api').replace(/\/+$/, '')
const PULSE_BASE = `${API_BASE}/pulse`
const DEFAULT_ANALYZE_TIMEOUT_MS = 120_000

const ANALYZE_TIMEOUT_MS = (() => {
  const raw = Number(import.meta.env.VITE_ANALYZE_TIMEOUT_MS)
  return Number.isFinite(raw) && raw > 0 ? raw : DEFAULT_ANALYZE_TIMEOUT_MS
})()

const clampScore = (v) => Math.max(0, Math.min(100, Number.isFinite(v) ? Math.round(v) : 0))
const asArray = (v) => Array.isArray(v) ? v : []
const normalizeRunId = (runId) => {
  const value = String(runId ?? '').trim()
  return value.length > 0 ? value : null
}

function normalizePlatformLabel(platform) {
  const value = String(platform ?? '').toLowerCase()
  if (value.includes('twitter') || value === 'x') return 'Twitter'
  if (value.includes('reddit')) return 'Reddit'
  return platform || 'Unknown'
}

function normalizeCrawledPost(post) {
  const evidenceScore = Number(post?.evidenceScore)
  const recencyScore = Number(post?.recencyScore)
  const sortScore = Number(post?.sortScore)

  return {
    platform: normalizePlatformLabel(post?.platform),
    title: post?.title || '',
    snippet: post?.snippet || '',
    url: post?.url || '',
    evidenceScore: Number.isFinite(evidenceScore) ? clampScore(evidenceScore) : null,
    recencyScore: Number.isFinite(recencyScore) ? clampScore(recencyScore) : null,
    sortScore: Number.isFinite(sortScore) ? clampScore(sortScore) : null,
    classificationMethod: post?.classificationMethod || null,
  }
}

function normalizeTopicBuckets(topicBuckets) {
  return asArray(topicBuckets).map((bucket, index) => ({
    topicId: bucket?.topicId || `t${index + 1}`,
    topicName: bucket?.topicName || `Topic ${index + 1}`,
    posts: asArray(bucket?.posts).map(normalizeCrawledPost),
  }))
}

function normalizeCrawlerStats(stats, allPosts) {
  const targetTotal = Number(stats?.targetTotal)
  const fetchedTotal = Number(stats?.fetchedTotal)
  const dedupedCount = Number(stats?.dedupedCount)
  const redditCount = Number(stats?.redditCount)
  const twitterCount = Number(stats?.twitterCount)
  const unassignedCount = Number(stats?.unassignedCount)
  const coveragePercent = Number(stats?.coveragePercent)

  return {
    targetTotal: Number.isFinite(targetTotal) && targetTotal > 0 ? Math.round(targetTotal) : 50,
    fetchedTotal: Number.isFinite(fetchedTotal) && fetchedTotal >= 0 ? Math.round(fetchedTotal) : allPosts.length,
    dedupedCount: Number.isFinite(dedupedCount) && dedupedCount >= 0 ? Math.round(dedupedCount) : allPosts.length,
    redditCount: Number.isFinite(redditCount) && redditCount >= 0 ? Math.round(redditCount) : null,
    twitterCount: Number.isFinite(twitterCount) && twitterCount >= 0 ? Math.round(twitterCount) : null,
    unassignedCount: Number.isFinite(unassignedCount) && unassignedCount >= 0 ? Math.round(unassignedCount) : null,
    coveragePercent: Number.isFinite(coveragePercent) && coveragePercent >= 0 ? clampScore(coveragePercent) : null,
    coverageLevel: typeof stats?.coverageLevel === 'string' ? stats.coverageLevel : 'ok',
    coverageAlerts: asArray(stats?.coverageAlerts)
      .map((item) => String(item ?? '').trim())
      .filter(Boolean),
  }
}

function normalizeQuote(quote) {
  const sentiment = (quote?.sentiment || 'neutral').toLowerCase()
  const camp = quote?.camp || (
    sentiment === 'positive' ? 'support'
      : sentiment === 'negative' ? 'oppose'
      : 'neutral'
  )
  const evidenceWeight = typeof quote?.evidenceWeight === 'number'
    ? Math.max(0, Math.min(1, quote.evidenceWeight))
    : 0.5

  return {
    text: quote?.text || '',
    url: quote?.url || '',
    sentiment,
    camp,
    evidenceWeight,
  }
}

function normalizeSentiment(sentiment, platformLabel) {
  const positiveRatio = Number(sentiment?.positiveRatio ?? 0)
  const negativeRatio = Number(sentiment?.negativeRatio ?? 0)
  const neutralRatio = Number(sentiment?.neutralRatio ?? 0)
  const total = positiveRatio + negativeRatio + neutralRatio || 1

  const normalized = {
    platform: sentiment?.platform || platformLabel.toLowerCase(),
    positiveRatio: positiveRatio / total,
    negativeRatio: negativeRatio / total,
    neutralRatio: neutralRatio / total,
    mainControversies: asArray(sentiment?.mainControversies),
    representativeQuotes: asArray(sentiment?.representativeQuotes).map(normalizeQuote),
    stanceDistribution: sentiment?.stanceDistribution || {
      support: positiveRatio / total,
      oppose: negativeRatio / total,
      neutral: neutralRatio / total,
    },
    aspectSentiments: asArray(sentiment?.aspectSentiments),
  }

  if (normalized.aspectSentiments.length === 0) {
    normalized.aspectSentiments = normalized.mainControversies.slice(0, 3).map((aspect) => ({
      aspect,
      heat: 55,
      summary: aspect,
    }))
  }

  return normalized
}

function normalizeClaimEvidenceMap(rawMap, quickTake, redditSentiment, twitterSentiment) {
  const normalized = asArray(rawMap)
    .map((item, i) => ({
      claimId: item?.claimId || `C${i + 1}`,
      claim: item?.claim || '',
      evidenceUrls: asArray(item?.evidenceUrls).filter((url) => typeof url === 'string' && url.length > 0),
    }))
    .filter((item) => item.claim.length > 0)

  if (normalized.length > 0) return normalized

  const quoteUrls = [
    ...asArray(redditSentiment?.representativeQuotes),
    ...asArray(twitterSentiment?.representativeQuotes),
  ]
    .map((q) => q?.url)
    .filter((url) => typeof url === 'string' && url.length > 0)

  return asArray(quickTake).slice(0, 3).map((claim, i) => ({
    claimId: `C${i + 1}`,
    claim,
    evidenceUrls: quoteUrls.slice(i, i + 2),
  }))
}

function normalizeReport(payload) {
  const redditSentiment = normalizeSentiment(payload?.redditSentiment, 'Reddit')
  const twitterSentiment = normalizeSentiment(payload?.twitterSentiment, 'Twitter')
  const allPosts = asArray(payload?.allPosts).map(normalizeCrawledPost)
  const topicBuckets = normalizeTopicBuckets(payload?.topicBuckets)
  const crawlerStats = normalizeCrawlerStats(payload?.crawlerStats, allPosts)

  const campDistribution = payload?.campDistribution || {
    support: ((redditSentiment.stanceDistribution?.support ?? 0) + (twitterSentiment.stanceDistribution?.support ?? 0)) / 2,
    oppose: ((redditSentiment.stanceDistribution?.oppose ?? 0) + (twitterSentiment.stanceDistribution?.oppose ?? 0)) / 2,
    neutral: ((redditSentiment.stanceDistribution?.neutral ?? 0) + (twitterSentiment.stanceDistribution?.neutral ?? 0)) / 2,
  }

  const confidenceScore = clampScore(payload?.confidenceScore ?? 0)
  const heatScore = clampScore(
    payload?.heatScore ??
    ((redditSentiment.negativeRatio + twitterSentiment.negativeRatio) * 50 + 35)
  )
  const polarizationScore = clampScore(
    payload?.polarizationScore ??
    ((1 - (campDistribution.neutral ?? 0)) * 65 + Math.abs((campDistribution.support ?? 0) - (campDistribution.oppose ?? 0)) * 35) * 100
  )
  const flipRiskScore = clampScore(
    payload?.flipRiskScore ??
    (100 - confidenceScore + ((payload?.debateTriggered ? 8 : 0)))
  )
  const dramaScore = clampScore(
    payload?.dramaScore ??
    (heatScore * 0.45 + polarizationScore * 0.35 + 20)
  )

  const controversyTopics = asArray(payload?.controversyTopics)
  const fallbackTopics = [
    ...redditSentiment.aspectSentiments,
    ...twitterSentiment.aspectSentiments,
  ]
  const normalizedTopics = (controversyTopics.length ? controversyTopics : fallbackTopics)
    .slice(0, 6)
    .map((t) => ({
      aspect: t?.aspect || 'General controversy',
      heat: clampScore(t?.heat ?? 50),
      summary: t?.summary || t?.aspect || 'No summary',
    }))

  const flipSignals = asArray(payload?.flipSignals).map((s) => ({
    signal: s?.signal || 'Potential narrative drift',
    severity: clampScore(s?.severity ?? flipRiskScore),
    summary: s?.summary || s?.signal || 'Signal detected',
  }))

  const critique = {
    unsupportedClaims: asArray(payload?.critique?.unsupportedClaims),
    biasConcerns: asArray(payload?.critique?.biasConcerns),
    exceedsDataScope: Boolean(payload?.critique?.exceedsDataScope),
    confidenceScore: clampScore(payload?.critique?.confidenceScore ?? confidenceScore),
    revisionSuggestions: payload?.critique?.revisionSuggestions || '',
    evidenceGaps: asArray(payload?.critique?.evidenceGaps),
    deltaHighlights: asArray(payload?.critique?.deltaHighlights),
    fluffFindings: asArray(payload?.critique?.fluffFindings),
    informationDensityScore: payload?.critique?.informationDensityScore ?? null,
    claimEvidenceCoverage: payload?.critique?.claimEvidenceCoverage ?? null,
  }

  const confidenceBreakdown = payload?.confidenceBreakdown || {
    coverage: clampScore(confidenceScore + 5),
    diversity: clampScore(confidenceScore - 3),
    agreement: clampScore(confidenceScore),
    evidenceSupport: clampScore(confidenceScore - 6),
    stability: clampScore(confidenceScore - 8),
  }

  const revisionDelta = asArray(payload?.revisionDelta).length
    ? asArray(payload?.revisionDelta)
    : critique.deltaHighlights

  const quickTake = asArray(payload?.quickTake).length
    ? asArray(payload?.quickTake).slice(0, 3)
    : [
      `Support ${Math.round((campDistribution.support ?? 0) * 100)}% vs oppose ${Math.round((campDistribution.oppose ?? 0) * 100)}%.`,
      `Top fight zone: ${normalizedTopics[0]?.aspect || 'general sentiment split'}.`,
      `Flip risk ${flipRiskScore}/100${payload?.debateTriggered ? ', critic revision triggered.' : '.'}`,
    ]

  const claimEvidenceMap = normalizeClaimEvidenceMap(
    payload?.claimEvidenceMap,
    quickTake,
    redditSentiment,
    twitterSentiment
  )

  return {
    topic: payload?.topic || '',
    topicSummary: payload?.topicSummary || '',
    redditSentiment,
    twitterSentiment,
    platformDiff: payload?.platformDiff || '',
    synthesis: payload?.synthesis || '',
    critique,
    confidenceScore,
    debateTriggered: Boolean(payload?.debateTriggered),
    executionTrace: asArray(payload?.executionTrace),
    quickTake,
    dramaScore,
    polarizationScore,
    heatScore,
    flipRiskScore,
    confidenceBreakdown,
    campDistribution,
    controversyTopics: normalizedTopics,
    flipSignals,
    revisionDelta,
    claimEvidenceMap,
    allPosts,
    topicBuckets,
    crawlerStats,
  }
}

/**
 * POST /api/pulse/analyze
 * @param {string} topic
 * @param {string|null} runId
 * @returns {Promise<PulseReport>}
 */
export async function analyzeTopic(topic, runId = null) {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), ANALYZE_TIMEOUT_MS)
  const normalizedRunId = normalizeRunId(runId)
  const requestBody = normalizedRunId ? { topic, runId: normalizedRunId } : { topic }

  try {
    try {
      const res = await fetch(`${PULSE_BASE}/analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
        signal: controller.signal,
      })
      if (!res.ok) throw new Error(`analyze failed: ${res.status}`)
      const payload = await res.json()
      return normalizeReport(payload)
    } catch (err) {
      if (err?.name === 'AbortError') {
        throw new Error(`analyze timed out after ${Math.round(ANALYZE_TIMEOUT_MS / 1000)}s`)
      }
      throw err
    }
  } finally {
    clearTimeout(timeout)
  }
}

/**
 * GET /api/pulse/stream (SSE)
 * @param {string|null} runId
 * @param {(event: AgentEvent) => void} onEvent
 * @param {() => void} onError
 * @returns {{ cleanup: () => void, ready: Promise<void> }}
 *   cleanup — closes the EventSource
 *   ready   — resolves when connection is OPEN, first message arrives, or 500ms elapses
 */
export function connectSSE(runId, onEvent, onError) {
  const normalizedRunId = normalizeRunId(runId)
  const streamUrl = normalizedRunId
    ? `${PULSE_BASE}/stream?runId=${encodeURIComponent(normalizedRunId)}`
    : `${PULSE_BASE}/stream`
  const es = new EventSource(streamUrl)

  let resolveReady
  const ready = new Promise((resolve) => {
    resolveReady = resolve
    if (es.readyState === EventSource.OPEN) resolve()
    setTimeout(resolve, 500) // maximum wait fallback
  })

  es.onopen = () => resolveReady()

  es.onmessage = (e) => {
    resolveReady() // also resolve on first message
    try {
      onEvent(JSON.parse(e.data))
    } catch {
      // malformed event — skip silently
    }
  }

  es.onerror = () => {
    es.close()
    onError()
  }

  return { cleanup: () => es.close(), ready }
}

/**
 * Pings GET /api/actuator/health immediately, then every 10 minutes.
 * @returns {() => void} cleanup function that clears the interval
 */
export function keepAlive() {
  const ping = () => fetch(`${API_BASE}/actuator/health`).catch(() => {})
  ping()
  const id = setInterval(ping, 10 * 60 * 1000)
  return () => clearInterval(id)
}
