import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import ControversyAccordion from '../ControversyAccordion'

describe('ControversyAccordion', () => {
  it('expands topic card and renders cross platform evidence columns', () => {
    const onAspectSelect = vi.fn()

    render(
      <ControversyAccordion
        items={[
          {
            id: 'healthcare-0',
            aspect: 'Healthcare',
            heat: 70,
            summary: 'Debate focuses on healthcare reforms and policy tradeoffs.',
            platformTags: [
              { platform: 'Reddit', label: 'Reddit focus' },
              { platform: 'Twitter', label: 'Twitter focus' },
            ],
            quotes: [
              {
                platform: 'Reddit',
                sentiment: 'Neutral',
                evidenceScore: 75,
                text: 'I want a more rounded understanding.',
                url: 'https://reddit.com/r/healthcare/1',
              },
              {
                platform: 'Twitter',
                sentiment: 'Oppose',
                evidenceScore: 80,
                text: 'Policy direction creates deeper division.',
                url: 'https://x.com/post/1',
              },
            ],
          },
        ]}
        report={null}
        claimEvidenceMap={[{ claimId: 'C1', claim: 'Claim', evidenceUrls: ['https://x.com/post/1'] }]}
        activeClaimId="C1"
        activeAspect={null}
        onAspectSelect={onAspectSelect}
      />
    )

    expect(screen.getByText('Controversy Accordion')).toBeInTheDocument()
    expect(screen.getByText('Claim filter C1')).toBeInTheDocument()
    expect(screen.getByText('Healthcare')).toBeInTheDocument()
    expect(screen.getByText('Heat 70')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /Healthcare/i }))
    expect(onAspectSelect).toHaveBeenCalledWith('Healthcare')
    expect(screen.getAllByText('Reddit').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Twitter').length).toBeGreaterThan(0)
    expect(screen.getByText(/I want a more rounded understanding/i)).toBeInTheDocument()
    expect(screen.getByText(/Policy direction creates deeper division/i)).toBeInTheDocument()
    expect(screen.getAllByText('Claim Match').length).toBeGreaterThan(0)
  })
})
