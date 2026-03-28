import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import QuoteCards from '../QuoteCards'

describe('QuoteCards', () => {
  it('applies claim and aspect filters and allows clearing aspect filter', () => {
    const onClearAspect = vi.fn()

    render(
      <QuoteCards
        redditSentiment={{
          representativeQuotes: [
            {
              text: 'Reddit quote about pricing',
              url: 'https://reddit.com/r/1',
              sentiment: 'negative',
              camp: 'oppose',
              evidenceWeight: 0.8,
            },
          ],
        }}
        twitterSentiment={{
          representativeQuotes: [
            {
              text: 'Twitter quote about quality',
              url: 'https://x.com/1',
              sentiment: 'positive',
              camp: 'support',
              evidenceWeight: 0.7,
            },
          ],
        }}
        claimEvidenceMap={[
          { claimId: 'C1', claim: 'Claim', evidenceUrls: ['https://reddit.com/r/1'] },
        ]}
        activeClaimId="C1"
        controversyItems={[
          {
            id: 'pricing-0',
            aspect: 'Pricing',
            quotes: [{ url: 'https://x.com/1', text: 'Twitter quote about quality', platform: 'Twitter' }],
          },
        ]}
        activeAspect="Pricing"
        onClearAspect={onClearAspect}
      />
    )

    expect(screen.getByText('Claim Filter C1')).toBeInTheDocument()
    expect(screen.getByText('Aspect Filter Pricing')).toBeInTheDocument()
    expect(screen.getByText('No quote matches both filters. Showing the full quote set.')).toBeInTheDocument()

    fireEvent.click(screen.getByText('Aspect Filter Pricing'))
    expect(onClearAspect).toHaveBeenCalledTimes(1)
  })
})
