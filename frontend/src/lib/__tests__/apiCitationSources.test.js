import { describe, expect, it } from 'vitest'
import { buildCanonicalCitationSources } from '../api'

describe('buildCanonicalCitationSources', () => {
  it('preserves backend Q order with url-based dedupe', () => {
    const redditSentiment = {
      representativeQuotes: [
        { text: 'reddit first', url: 'https://reddit.com/r/1', sentiment: 'positive', camp: 'support', evidenceWeight: 0.9 },
        { text: 'reddit second', url: 'https://reddit.com/r/2', sentiment: 'neutral', camp: 'neutral', evidenceWeight: 0.8 },
      ],
    }
    const twitterSentiment = {
      representativeQuotes: [
        { text: 'duplicate of reddit second', url: 'HTTPS://REDDIT.COM/r/2', sentiment: 'negative', camp: 'oppose', evidenceWeight: 0.4 },
        { text: 'twitter unique', url: 'https://x.com/1', sentiment: 'negative', camp: 'oppose', evidenceWeight: 0.7 },
      ],
    }

    const sources = buildCanonicalCitationSources(redditSentiment, twitterSentiment)
    expect(sources.map((item) => item.url)).toEqual([
      'https://reddit.com/r/1',
      'https://reddit.com/r/2',
      'https://x.com/1',
    ])
    expect(sources.map((item) => item.platform)).toEqual(['Reddit', 'Reddit', 'Twitter'])
  })

  it('keeps empty-text sources to avoid citation index shift', () => {
    const redditSentiment = {
      representativeQuotes: [
        { text: 'first quote', url: 'https://reddit.com/r/10', sentiment: 'positive', camp: 'support', evidenceWeight: 0.9 },
        { text: '', url: 'https://reddit.com/r/11', sentiment: 'neutral', camp: 'neutral', evidenceWeight: 0.6 },
      ],
    }
    const twitterSentiment = { representativeQuotes: [] }

    const sources = buildCanonicalCitationSources(redditSentiment, twitterSentiment)
    expect(sources).toHaveLength(2)
    expect(sources[1].url).toBe('https://reddit.com/r/11')
    expect(sources[1].text).toBe('')
  })
})
