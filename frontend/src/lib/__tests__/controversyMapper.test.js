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
})
