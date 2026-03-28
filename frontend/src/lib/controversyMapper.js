function normalize(value) {
  return String(value ?? '').toLowerCase()
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
