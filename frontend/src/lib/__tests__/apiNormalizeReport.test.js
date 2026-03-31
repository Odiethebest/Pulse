import { afterEach, describe, expect, it, vi } from 'vitest'
import { analyzeTopic } from '../api'

describe('analyzeTopic normalizeReport citation alignment', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('keeps citationSources in backend Q order instead of reordered topic bucket order', async () => {
    const payload = {
      topic: 'Taylor Swift and Ed Sheeran friendship debate',
      quickTake: [
        'Claim one [Q1] [Q3]',
        'Claim two [Q2]',
      ],
      redditSentiment: {
        platform: 'reddit',
        positiveRatio: 0.5,
        negativeRatio: 0.3,
        neutralRatio: 0.2,
        representativeQuotes: [
          {
            text: 'Reddit source one',
            url: 'https://reddit.com/r/1',
            sentiment: 'positive',
            camp: 'support',
            evidenceWeight: 0.91,
          },
          {
            text: 'Reddit source two',
            url: 'https://reddit.com/r/2',
            sentiment: 'neutral',
            camp: 'neutral',
            evidenceWeight: 0.84,
          },
        ],
      },
      twitterSentiment: {
        platform: 'twitter',
        positiveRatio: 0.3,
        negativeRatio: 0.5,
        neutralRatio: 0.2,
        representativeQuotes: [
          {
            text: 'Duplicate url should be deduped by url',
            url: 'HTTPS://REDDIT.COM/r/2',
            sentiment: 'negative',
            camp: 'oppose',
            evidenceWeight: 0.2,
          },
          {
            text: 'Twitter source three',
            url: 'https://x.com/3',
            sentiment: 'negative',
            camp: 'oppose',
            evidenceWeight: 0.79,
          },
        ],
      },
      topicBuckets: [
        {
          topicId: 't1',
          topicName: 'pricing',
          posts: [
            {
              platform: 'twitter',
              snippet: 'Reordered bucket source',
              url: 'https://x.com/3',
              sortScore: 100,
            },
            {
              platform: 'reddit',
              snippet: 'Another reordered bucket source',
              url: 'https://reddit.com/r/1',
              sortScore: 99,
            },
          ],
        },
      ],
      controversyTopics: [{ aspect: 'pricing', heat: 70, summary: 'Pricing flashpoint' }],
    }

    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => payload,
    })

    const report = await analyzeTopic('Taylor Swift and Ed Sheeran friendship debate', 'run-phase4')

    expect(report.citationSources.map((item) => item.url)).toEqual([
      'https://reddit.com/r/1',
      'https://reddit.com/r/2',
      'https://x.com/3',
    ])
    expect(report.citationSources.map((item) => item.text)).toEqual([
      'Reddit source one',
      'Reddit source two',
      'Twitter source three',
    ])
  })
})
