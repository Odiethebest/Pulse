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
        confidenceBreakdown={null}
      />
    )

    expect(screen.getByText('Drama')).toBeInTheDocument()
    expect(screen.getByText('Polarization')).toBeInTheDocument()
    expect(screen.getByText('Heat')).toBeInTheDocument()
    expect(screen.getByText('Flip Risk')).toBeInTheDocument()
    expect(screen.getByText('Snapshot to Confidence Mapping')).toBeInTheDocument()
    expect(screen.getByText('Coverage')).toBeInTheDocument()
    expect(screen.getByText('Diversity')).toBeInTheDocument()
    expect(screen.getByText('Evidence Support')).toBeInTheDocument()
    expect(screen.getByText('Stability')).toBeInTheDocument()
    expect(screen.getByText('0')).toBeInTheDocument()
    expect(screen.getByText('100')).toBeInTheDocument()
    expect(screen.getByText('74')).toBeInTheDocument()
    expect(screen.getByText('39')).toBeInTheDocument()
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
    expect(screen.getByText('Run analysis to compute confidence.')).toBeInTheDocument()
  })
})
