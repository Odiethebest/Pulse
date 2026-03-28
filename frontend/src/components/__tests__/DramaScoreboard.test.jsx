import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import DramaScoreboard from '../DramaScoreboard'

describe('DramaScoreboard', () => {
  it('renders four core metrics and confidence mapping', () => {
    render(
      <DramaScoreboard
        metrics={{
          drama: 0,
          polarization: 100,
          heat: 74,
          flipRisk: 39,
        }}
        confidenceScore={86}
        debateTriggered={false}
        confidenceBreakdown={{
          coverage: 100,
          diversity: 80,
          agreement: 55,
          evidenceSupport: 40,
          stability: 35,
        }}
      />
    )

    expect(screen.getByText('Drama')).toBeInTheDocument()
    expect(screen.getByText('Polarization')).toBeInTheDocument()
    expect(screen.getByText('Heat')).toBeInTheDocument()
    expect(screen.getByText('Flip Risk')).toBeInTheDocument()
    expect(screen.getByText('Snapshot to Confidence Mapping')).toBeInTheDocument()
    expect(screen.getByText('Confidence Profile')).toBeInTheDocument()
    expect(screen.getAllByText('Coverage').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Diversity').length).toBeGreaterThan(0)
    expect(screen.getByText('Evidence Support')).toBeInTheDocument()
    expect(screen.getAllByText('Stability').length).toBeGreaterThan(0)
    expect(screen.getAllByText('0').length).toBeGreaterThan(0)
    expect(screen.getAllByText('100').length).toBeGreaterThan(0)
    expect(screen.getAllByText('74').length).toBeGreaterThan(0)
    expect(screen.getAllByText('39').length).toBeGreaterThan(0)
  })

  it('shows pending state when metric values are missing', () => {
    render(
      <DramaScoreboard
        metrics={null}
        confidenceScore={null}
        debateTriggered={false}
        confidenceBreakdown={null}
      />
    )

    expect(screen.getAllByText('Pending report').length).toBeGreaterThan(0)
    expect(screen.getByText('Waiting for confidence breakdown data.')).toBeInTheDocument()
    expect(screen.getByText('Run analysis to compute confidence.')).toBeInTheDocument()
  })
})
