import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import DramaScoreboard from '../DramaScoreboard'

describe('DramaScoreboard', () => {
  it('renders top bottom confidence layout with radar and metric cards', () => {
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

    expect(screen.getByLabelText('confidence-profile-dashboard')).toBeInTheDocument()
    expect(screen.getAllByText('Drama 0').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Polarization 100').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Heat 74').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Flip Risk 39').length).toBeGreaterThan(0)
    expect(screen.getByText('Confidence Profile')).toBeInTheDocument()
    expect(screen.getByText('Confidence')).toBeInTheDocument()
    expect(screen.getByText('High')).toBeInTheDocument()
    expect(screen.getAllByText('Coverage').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Diversity').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Agreement').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Evidence').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Stability').length).toBeGreaterThan(0)
    expect(screen.getByText('Strongest:')).toBeInTheDocument()
    expect(screen.getByText('Weakest:')).toBeInTheDocument()
    expect(screen.getByText('Coverage 100')).toBeInTheDocument()
    expect(screen.getByText('Stability 35')).toBeInTheDocument()
    expect(screen.getByTestId('metric-card-coverage')).toBeInTheDocument()
    expect(screen.getByTestId('metric-card-diversity')).toBeInTheDocument()
    expect(screen.getByTestId('metric-card-agreement')).toBeInTheDocument()
    expect(screen.getByTestId('metric-card-evidence')).toBeInTheDocument()
    expect(screen.getByTestId('metric-card-stability')).toBeInTheDocument()
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

    expect(screen.getByText('Pending')).toBeInTheDocument()
    expect(screen.getByText('Run analysis to compute confidence.')).toBeInTheDocument()
  })
})
