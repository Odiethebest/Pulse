import { describe, expect, it } from 'vitest'
import { buildControversyBoardData } from '../controversyMapper'

describe('buildControversyBoardData', () => {
  it('keeps only real source quotes without synthetic padding', () => {
    const report = {
      controversyTopics: [
        { aspect: 'album quality', heat: 74 },
        { aspect: 'cultural impact', heat: 68 },
        { aspect: 'fan culture', heat: 61 },
      ],
      redditSentiment: {
        representativeQuotes: [
          {
            text: 'The album has sharper songwriting than people admit.',
            evidenceWeight: 0.82,
            sentiment: 'positive',
            camp: 'support',
            url: 'https://reddit.com/r/music/1',
          },
        ],
      },
      twitterSentiment: {
        representativeQuotes: [
          {
            text: 'Cultural impact is overstated and driven by fandom volume.',
            evidenceWeight: 0.75,
            sentiment: 'negative',
            camp: 'oppose',
            url: 'https://x.com/post/1',
          },
        ],
      },
    }

    const data = buildControversyBoardData(report)
    expect(data.topics).toHaveLength(3)
    expect(data.quotes).toHaveLength(2)
    expect(data.quotes.map((quote) => quote.text)).toEqual([
      'The album has sharper songwriting than people admit.',
      'Cultural impact is overstated and driven by fandom volume.',
    ])
    expect(data.quotes.every((quote) => quote.id.startsWith('q-'))).toBe(true)
    expect(data.quotes.every((quote) => Array.isArray(quote.topicIds) && quote.topicIds.length > 0)).toBe(true)
    expect(
      data.quotes.some((quote) => /every week we get a new|timeline is split|hot take/i.test(quote.text))
    ).toBe(false)
  })

  it('prefers topic bucket posts and keeps ranking metadata', () => {
    const report = {
      topicBuckets: [
        {
          topicId: 't1',
          topicName: 'pricing',
          posts: [
            {
              platform: 'reddit',
              title: 'Price argument',
              snippet: 'Thread exploded after update.',
              url: 'https://reddit.com/r/music/99',
              evidenceScore: 78,
              recencyScore: 64,
              sortScore: 80,
              classificationMethod: 'rule+llm',
            },
          ],
        },
      ],
      controversyTopics: [{ aspect: 'pricing', heat: 71 }],
      crawlerStats: { fetchedTotal: 1, targetTotal: 50 },
    }

    const data = buildControversyBoardData(report)
    expect(data.topics).toHaveLength(1)
    expect(data.quotes).toHaveLength(1)
    expect(data.quotes[0].text).toMatch(/thread exploded/i)
    expect(data.quotes[0].evidenceScore).toBe(78)
    expect(data.quotes[0].sortScore).toBe(80)
    expect(data.quotes[0].classificationMethod).toBe('rule+llm')
  })
})
