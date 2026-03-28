const API_BASE = (import.meta.env.VITE_API_BASE || '/api').replace(/\/+$/, '')
const PULSE_BASE = `${API_BASE}/pulse`

const clampScore = (v) => Math.max(0, Math.min(100, Number.isFinite(v) ? Math.round(v) : 0))
const asArray = (v) => Array.isArray(v) ? v : []

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

function normalizeReport(payload) {
  const redditSentiment = normalizeSentiment(payload?.redditSentiment, 'Reddit')
  const twitterSentiment = normalizeSentiment(payload?.twitterSentiment, 'Twitter')

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
  }
}

/**
 * POST /api/pulse/analyze
 * @param {string} topic
 * @returns {Promise<PulseReport>}
 */
export async function analyzeTopic(topic) {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 60_000)

  try {
    const res = await fetch(`${PULSE_BASE}/analyze`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ topic }),
      signal: controller.signal,
    })
    if (!res.ok) throw new Error(`analyze failed: ${res.status}`)
    const payload = await res.json()
    return normalizeReport(payload)
  } finally {
    clearTimeout(timeout)
  }
}

/**
 * GET /api/pulse/stream (SSE)
 * @param {(event: AgentEvent) => void} onEvent
 * @param {() => void} onError
 * @returns {{ cleanup: () => void, ready: Promise<void> }}
 *   cleanup — closes the EventSource
 *   ready   — resolves when connection is OPEN, first message arrives, or 500ms elapses
 */
export function connectSSE(onEvent, onError) {
  const es = new EventSource(`${PULSE_BASE}/stream`)

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
