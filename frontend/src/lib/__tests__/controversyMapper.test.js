import { describe, expect, it } from 'vitest'
import { buildControversyBoardData } from '../controversyMapper'

describe('buildControversyBoardData', () => {
  it('ensures every topic has dense mixed-platform coverage', () => {
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
    expect(data.quotes.length).toBeGreaterThanOrEqual(18)

    data.topics.forEach((topic) => {
      const topicQuotes = data.quotes.filter((quote) => quote.topicIds.includes(topic.id))
      expect(topicQuotes.length).toBeGreaterThanOrEqual(6)
      expect(topicQuotes.some((quote) => quote.platform === 'Reddit')).toBe(true)
      expect(topicQuotes.some((quote) => quote.platform === 'Twitter')).toBe(true)
    })
  })
})
