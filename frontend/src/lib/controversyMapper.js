function normalize(value) {
  return String(value ?? '').toLowerCase()
}

function clampScore(value) {
  const n = Number(value ?? 0)
  if (Number.isNaN(n)) return 0
  return Math.max(0, Math.min(100, Math.round(n)))
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
    if (source.includes(keyword)) {
      score += 1
    }
  }
  return score
}

function buildPlatformTags(aspect, redditControversies, twitterControversies, quotes) {
  const tags = []
  const aspectKeywords = splitKeywords(aspect)
  const redditMatch = (redditControversies ?? []).some((item) => matchScore(item, aspectKeywords) > 0)
  const twitterMatch = (twitterControversies ?? []).some((item) => matchScore(item, aspectKeywords) > 0)

  if (redditMatch) {
    tags.push({ platform: 'Reddit', label: 'Reddit focus' })
  }
  if (twitterMatch) {
    tags.push({ platform: 'Twitter', label: 'Twitter focus' })
  }

  if (tags.length > 0) return tags

  const platforms = new Set((quotes ?? []).map((quote) => quote.platform))
  if (platforms.has('Reddit')) tags.push({ platform: 'Reddit', label: 'Reddit voices' })
  if (platforms.has('Twitter')) tags.push({ platform: 'Twitter', label: 'Twitter voices' })
  return tags
}

function platformKey(value) {
  const source = normalize(value)
  if (source.includes('twitter') || source === 'x') return 'Twitter'
  return 'Reddit'
}

function normalizeSentiment(quote) {
  const sentiment = normalize(quote?.sentiment)
  if (sentiment.includes('pos')) return 'positive'
  if (sentiment.includes('neg')) return 'negative'
  if (sentiment.includes('support')) return 'positive'
  if (sentiment.includes('oppose')) return 'negative'

  const camp = normalize(quote?.camp)
  if (camp.includes('support')) return 'positive'
  if (camp.includes('oppose')) return 'negative'
  return 'neutral'
}

function extractEvidenceScore(quote) {
  if (typeof quote?.evidenceScore === 'number') {
    return clampScore(quote.evidenceScore)
  }
  if (typeof quote?.evidenceWeight === 'number') {
    return clampScore(quote.evidenceWeight * 100)
  }
  return null
}

function normalizeSentimentValue(value) {
  const sentiment = normalize(value)
  if (sentiment.includes('pos') || sentiment.includes('support')) return 'positive'
  if (sentiment.includes('neg') || sentiment.includes('oppose')) return 'negative'
  return 'neutral'
}

function buildTopicIdsForQuote(quote, topics, index) {
  const matchedTopicIds = topics
    .filter((topic) => matchScore(`${quote?.text} ${quote?.url}`, splitKeywords(topic.name)) > 0)
    .map((topic) => topic.id)

  const topicIds = matchedTopicIds.length > 0
    ? matchedTopicIds
    : [topics[index % topics.length]?.id].filter(Boolean)

  if (topicIds.length === 1 && topics.length > 1 && index % 4 === 0) {
    const neighbor = topics[(index + 1) % topics.length]?.id
    if (neighbor && !topicIds.includes(neighbor)) {
      topicIds.push(neighbor)
    }
  }

  return topicIds
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

function resolvePostText(post) {
  const text = String(post?.text ?? post?.snippet ?? post?.title ?? '').replace(/\s+/g, ' ').trim()
  return text
}

function isTwitterShellText(value) {
  const text = normalize(value)
  if (!text) return false

  const hasJsBlocked =
    text.includes('javascript is disabled in this browser')
    || text.includes('javascript is not available')
  const hasEnablePrompt =
    text.includes('please enable javascript')
    || text.includes('switch to a supported browser')
  const hasHelpOrTerms =
    (text.includes('supported browsers') && text.includes('help center'))
    || (text.includes('terms of service') && text.includes('privacy policy'))

  return hasJsBlocked || (hasEnablePrompt && hasHelpOrTerms)
}

function bucketHeatByName(report) {
  const map = new Map()
  const topics = Array.isArray(report?.controversyTopics) ? report.controversyTopics : []
  topics.forEach((topic) => {
    const name = String(topic?.aspect ?? '').trim()
    if (!name) return
    map.set(name.toLowerCase(), clampScore(topic?.heat ?? 50))
  })
  return map
}

function buildDataFromTopicBuckets(report) {
  const buckets = Array.isArray(report?.topicBuckets) ? report.topicBuckets : []
  if (buckets.length === 0) return null

  const heatLookup = bucketHeatByName(report)
  const topics = buckets.map((bucket, index) => {
    const topicId = String(bucket?.topicId || `t${index + 1}`)
    const topicName = String(bucket?.topicName || `topic ${index + 1}`).trim()
    const normalizedName = topicName.toLowerCase()
    const fallbackHeat = topicId.toLowerCase() === 'unassigned' ? 35 : 50
    const heat = heatLookup.has(normalizedName)
      ? heatLookup.get(normalizedName)
      : fallbackHeat

    return {
      id: topicId,
      name: topicName || `topic ${index + 1}`,
      heat: clampScore(heat),
    }
  })

  const quoteMap = new Map()
  buckets.forEach((bucket) => {
    const bucketId = String(bucket?.topicId || '').trim()
    if (!bucketId) return

    const posts = Array.isArray(bucket?.posts) ? bucket.posts : []
    posts.forEach((post) => {
      const text = resolvePostText(post)
      if (!text) return
      if (isTwitterShellText(text)) return

      const link = String(post?.url || '').trim() || null
      const platform = platformKey(post?.platform)
      const key = `${platform}::${link || ''}::${text.toLowerCase()}`

      if (quoteMap.has(key)) {
        const existing = quoteMap.get(key)
        if (!existing.topicIds.includes(bucketId)) {
          existing.topicIds.push(bucketId)
        }
        const nextEvidence = extractEvidenceScore(post)
        const nextSort = typeof post?.sortScore === 'number' ? clampScore(post.sortScore) : null
        const nextRecency = typeof post?.recencyScore === 'number' ? clampScore(post.recencyScore) : null
        if (nextEvidence !== null && (existing.evidenceScore === null || nextEvidence > existing.evidenceScore)) {
          existing.evidenceScore = nextEvidence
        }
        if (nextSort !== null && (existing.sortScore === null || nextSort > existing.sortScore)) {
          existing.sortScore = nextSort
        }
        if (nextRecency !== null && (existing.recencyScore === null || nextRecency > existing.recencyScore)) {
          existing.recencyScore = nextRecency
        }
        if (!existing.classificationMethod && post?.classificationMethod) {
          existing.classificationMethod = post.classificationMethod
        }
        return
      }

      quoteMap.set(key, {
        platform,
        sentiment: normalizeSentimentValue(post?.sentiment || post?.camp || 'neutral'),
        evidenceScore: extractEvidenceScore(post),
        recencyScore: typeof post?.recencyScore === 'number' ? clampScore(post.recencyScore) : null,
        sortScore: typeof post?.sortScore === 'number' ? clampScore(post.sortScore) : null,
        classificationMethod: post?.classificationMethod || null,
        text,
        topicIds: [bucketId],
        link,
      })
    })
  })

  const quotes = Array.from(quoteMap.values())
    .sort((a, b) => {
      const sortGap = (b.sortScore ?? -1) - (a.sortScore ?? -1)
      if (sortGap !== 0) return sortGap
      return (b.evidenceScore ?? -1) - (a.evidenceScore ?? -1)
    })
    .map((quote, index) => ({
      ...quote,
      id: `q-${index + 1}`,
    }))

  if (!topics.length || !quotes.length) return null
  return {
    topics,
    quotes,
    crawlerStats: report?.crawlerStats ?? null,
  }
}

function selectBalancedQuotes(scoredQuotes, fallbackQuotes) {
  const base = dedupeQuotes([...scoredQuotes, ...fallbackQuotes])
  const reddit = base.filter((quote) => platformKey(quote.platform) === 'Reddit').slice(0, 2)
  const twitter = base.filter((quote) => platformKey(quote.platform) === 'Twitter').slice(0, 2)
  const picked = dedupeQuotes([...reddit, ...twitter])

  if (picked.length >= 4) {
    return picked.slice(0, 4)
  }

  const remaining = base.filter((quote) => {
    const key = `${quote.url || ''}::${quote.text || ''}`
    return !picked.some((current) => `${current.url || ''}::${current.text || ''}` === key)
  })

  return dedupeQuotes([...picked, ...remaining]).slice(0, 6)
}

export function collectQuotes(report) {
  return [
    ...((report?.redditSentiment?.representativeQuotes ?? []).map((quote) => ({ ...quote, platform: 'Reddit' }))),
    ...((report?.twitterSentiment?.representativeQuotes ?? []).map((quote) => ({ ...quote, platform: 'Twitter' }))),
  ].filter((quote) => !isTwitterShellText(quote?.text))
}

export function buildControversyItems(report) {
  const topics = report?.controversyTopics ?? []
  const quotes = collectQuotes(report)
  const redditControversies = report?.redditSentiment?.mainControversies ?? []
  const twitterControversies = report?.twitterSentiment?.mainControversies ?? []

  return topics.slice(0, 6).map((topic, index) => {
    const aspect = topic?.aspect || 'General'
    const keywords = splitKeywords(aspect)
    const scoredQuotes = quotes
      .map((quote) => ({
        quote,
        score: matchScore(`${quote.text} ${quote.url}`, keywords),
      }))
      .filter((item) => item.score > 0)
      .sort((a, b) => b.score - a.score)
      .map((item) => item.quote)

    const fallbackQuotes = [
      ...quotes.filter((quote) => platformKey(quote.platform) === 'Reddit').slice(0, 1),
      ...quotes.filter((quote) => platformKey(quote.platform) === 'Twitter').slice(0, 1),
      ...quotes.slice(0, 2),
    ]
    const matchedQuotes = selectBalancedQuotes(scoredQuotes, fallbackQuotes)
    const platformTags = buildPlatformTags(aspect, redditControversies, twitterControversies, matchedQuotes)

    return {
      id: `${normalize(aspect).replace(/\s+/g, '-') || 'topic'}-${index}`,
      aspect,
      heat: topic?.heat ?? 0,
      summary: topic?.summary || 'No summary available.',
      quotes: matchedQuotes,
      platformTags,
    }
  })
}

export function buildControversyBoardData(report) {
  const bucketData = buildDataFromTopicBuckets(report)
  if (bucketData) return bucketData

  const topicSource = report?.controversyTopics ?? []
  const topics = topicSource.slice(0, 8).map((topic, index) => ({
    id: `t${index + 1}`,
    name: topic?.aspect || `topic ${index + 1}`,
    heat: clampScore(topic?.heat),
  }))

  const sourceQuotes = dedupeQuotes(collectQuotes(report))
  if (topics.length === 0) {
    return { topics: [], quotes: [] }
  }

  const quotes = sourceQuotes
    .map((quote, index) => {
      const text = String(quote?.text ?? '').trim()
      if (!text) return null

      return {
        platform: platformKey(quote?.platform),
        sentiment: normalizeSentimentValue(normalizeSentiment(quote)),
        evidenceScore: extractEvidenceScore(quote),
        text,
        topicIds: buildTopicIdsForQuote(quote, topics, index),
        link: quote?.url || null,
      }
    })
    .filter(Boolean)
    .map((quote, index) => ({
    ...quote,
    id: `q-${index + 1}`,
  }))

  return {
    topics,
    quotes,
    crawlerStats: report?.crawlerStats ?? null,
  }
}
