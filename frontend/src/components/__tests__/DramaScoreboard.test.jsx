import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import DramaScoreboard from '../DramaScoreboard'

describe('DramaScoreboard', () => {
  it('renders four core metrics including boundary values', () => {
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
    expect(screen.getByText('0')).toBeInTheDocument()
    expect(screen.getByText('100')).toBeInTheDocument()
    expect(screen.getByText('74')).toBeInTheDocument()
    expect(screen.getByText('39')).toBeInTheDocument()
  })

  it('shows placeholder when metric values are missing', () => {
    render(
      <DramaScoreboard
        metrics={null}
        confidenceScore={86}
        debateTriggered={false}
        confidenceBreakdown={null}
      />
    )

    expect(screen.getAllByText('--')).toHaveLength(4)
  })
})
