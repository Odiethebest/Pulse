import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import ConfidenceGauge from '../ConfidenceGauge'

describe('ConfidenceGauge', () => {
  it('renders score state and breakdown rows', () => {
    render(
      <ConfidenceGauge
        score={72}
        debateTriggered={true}
        breakdown={{
          coverage: 100,
          diversity: 80,
          agreement: 55,
          evidenceSupport: 40,
          stability: 35,
        }}
      />
    )

    expect(screen.getByText('72')).toBeInTheDocument()
    expect(screen.getByText('High')).toBeInTheDocument()
    expect(screen.getByText('Revised after critic review')).toBeInTheDocument()
    expect(screen.getByText('Coverage')).toBeInTheDocument()
    expect(screen.getByText('Diversity')).toBeInTheDocument()
    expect(screen.getByText('Evidence')).toBeInTheDocument()
    expect(screen.getByText('Stability')).toBeInTheDocument()
  })

  it('shows pending state for missing score', () => {
    render(
      <ConfidenceGauge
        score={null}
        debateTriggered={false}
        breakdown={null}
      />
    )

    expect(screen.getByText('--')).toBeInTheDocument()
    expect(screen.getByText('Pending')).toBeInTheDocument()
  })
})
