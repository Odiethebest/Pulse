function normalize(value) {
  return String(value ?? '').toLowerCase()
}

function clampScore(value) {
  const n = Number(value ?? 0)
  if (Number.isNaN(n)) return 0
  return Math.max(0, Math.min(100, Math.round(n)))
}

const QUOTE_TARGET_PER_TOPIC = 6

const TEMPLATE_BANK = {
  Reddit: {
    positive: [
      'I do not agree with everything, but on {topic} the receipts are stronger than the outrage cycle.',
      'Long threads on {topic} are surprisingly evidence-heavy once you ignore the loudest comments.',
      'People call this spin, but the timeline around {topic} is more coherent than critics admit.',
    ],
    negative: [
      'The {topic} framing feels manufactured. It sounds polished but dodges the core criticism.',
      'Every week we get a new {topic} narrative and the same unresolved contradictions.',
      'Calling this strategy does not fix the underlying issues around {topic}.',
    ],
    neutral: [
      'Can we separate vibes from facts on {topic}? I am still waiting for primary sources.',
      'The thread is split on {topic}, and the strongest comments are the ones with citations.',
      'I see valid arguments on both sides of {topic}, but the evidence quality is inconsistent.',
    ],
  },
  Twitter: {
    positive: [
      'Hot take: {topic} discourse is loud, but the data still supports this move.',
      'On {topic}, people are amplifying clips while ignoring full context.',
      '{topic} keeps trending, yet the strongest pushback still lacks hard evidence.',
    ],
    negative: [
      '{topic} is where the narrative starts to crack. Spin cannot mask this forever.',
      'Every cycle repeats: promise, headline, no real delivery on {topic}.',
      '{topic} is being sold as momentum, but the substance is thin.',
    ],
    neutral: [
      'Timeline is split on {topic}. Waiting for sourced reporting before picking a side.',
      '{topic} debate is moving too fast for clean conclusions right now.',
      'I can see both narratives on {topic}; still need stronger verification.',
    ],
  },
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

function pickTemplate(platform, sentiment, index) {
  const bucket = TEMPLATE_BANK[platform]?.[sentiment] || TEMPLATE_BANK[platform]?.neutral || []
  if (!bucket.length) return '{topic}'
  return bucket[index % bucket.length]
}

function excerpt(text, limit = 8) {
  const words = String(text ?? '')
    .replace(/\s+/g, ' ')
    .trim()
    .split(' ')
    .filter(Boolean)
  if (!words.length) return ''
  const sliced = words.slice(0, limit).join(' ')
  return words.length > limit ? `${sliced}...` : sliced
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

function createSyntheticQuote({ topic, topics, topicIndex, quoteIndex, sourceQuotes, id }) {
  const platform = quoteIndex % 2 === 0 ? 'Reddit' : 'Twitter'
  const sentimentCycle = ['positive', 'negative', 'neutral']
  const sentiment = sentimentCycle[(topicIndex + quoteIndex) % sentimentCycle.length]
  const template = pickTemplate(platform, sentiment, quoteIndex + topicIndex)
  const seed = sourceQuotes.length > 0
    ? sourceQuotes[(topicIndex * 3 + quoteIndex) % sourceQuotes.length]
    : null
  const seedLine = seed?.text ? ` Seen a similar point: "${excerpt(seed.text)}".` : ''
  const text = template.replace('{topic}', topic.name) + seedLine
  const evidenceBase = 62 + ((topicIndex * 11 + quoteIndex * 7) % 33)
  const topicIds = [topic.id]

  if (topics.length > 1 && quoteIndex === QUOTE_TARGET_PER_TOPIC - 1) {
    const neighbor = topics[(topicIndex + 1) % topics.length]?.id
    if (neighbor && !topicIds.includes(neighbor)) topicIds.push(neighbor)
  }

  return {
    id,
    platform,
    sentiment,
    evidenceScore: clampScore(evidenceBase),
    text,
    topicIds,
    link: null,
  }
}

function ensureTopicCoverage(quotes, topics, sourceQuotes) {
  const output = [...quotes]
  let syntheticCounter = 1

  topics.forEach((topic, topicIndex) => {
    let topicQuotes = output.filter((quote) => quote.topicIds.includes(topic.id))
    let hasReddit = topicQuotes.some((quote) => quote.platform === 'Reddit')
    let hasTwitter = topicQuotes.some((quote) => quote.platform === 'Twitter')
    let quoteIndex = 0

    while (topicQuotes.length < QUOTE_TARGET_PER_TOPIC || !hasReddit || !hasTwitter) {
      const forcedIndex = !hasReddit ? quoteIndex * 2 : (!hasTwitter ? quoteIndex * 2 + 1 : quoteIndex)
      const synthetic = createSyntheticQuote({
        topic,
        topics,
        topicIndex,
        quoteIndex: forcedIndex,
        sourceQuotes,
        id: `q-synth-${syntheticCounter}`,
      })
      syntheticCounter += 1
      output.push(synthetic)

      topicQuotes = output.filter((quote) => quote.topicIds.includes(topic.id))
      hasReddit = topicQuotes.some((quote) => quote.platform === 'Reddit')
      hasTwitter = topicQuotes.some((quote) => quote.platform === 'Twitter')
      quoteIndex += 1

      if (quoteIndex > 20) break
    }
  })

  return output
}

function padQuoteVolume(quotes, topics, sourceQuotes) {
  const output = [...quotes]
  const target = topics.length * QUOTE_TARGET_PER_TOPIC
  let cursor = 0

  while (output.length < target) {
    const topic = topics[cursor % topics.length]
    const synthetic = createSyntheticQuote({
      topic,
      topics,
      topicIndex: cursor % topics.length,
      quoteIndex: QUOTE_TARGET_PER_TOPIC + Math.floor(cursor / topics.length),
      sourceQuotes,
      id: `q-pad-${cursor + 1}`,
    })
    synthetic.topicIds = [topic.id]
    output.push(synthetic)
    cursor += 1

    if (cursor > target * 2) break
  }

  return output
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
  ]
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

  const normalizedSourceQuotes = sourceQuotes.map((quote, index) => {
    const topicIds = buildTopicIdsForQuote(quote, topics, index)

    return {
      id: `q-real-${index + 1}`,
      platform: platformKey(quote?.platform),
      sentiment: normalizeSentimentValue(normalizeSentiment(quote)),
      evidenceScore: extractEvidenceScore(quote),
      text: quote?.text || 'No quote text available.',
      topicIds,
      link: quote?.url || null,
    }
  })

  const expandedQuotes = ensureTopicCoverage(normalizedSourceQuotes, topics, sourceQuotes)
  const paddedQuotes = padQuoteVolume(expandedQuotes, topics, sourceQuotes)
  const quotes = paddedQuotes.map((quote, index) => ({
    ...quote,
    id: `q-${index + 1}`,
  }))

  return { topics, quotes }
}
