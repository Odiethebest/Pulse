import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import ControversyBoard from '../ControversyBoard'

describe('ControversyBoard', () => {
  it('renders accordion items and notifies aspect selection', () => {
    const onAspectSelect = vi.fn()

    render(
      <ControversyBoard
        items={[
          {
            id: 'pricing-0',
            aspect: 'Pricing',
            heat: 74,
            summary: 'Price fairness is contested.',
            platformTags: [{ platform: 'Reddit', label: 'Reddit focus' }],
            quotes: [{ text: 'Pricing is too high', platform: 'Reddit' }],
          },
        ]}
        activeAspect={null}
        onAspectSelect={onAspectSelect}
      />
    )

    expect(screen.getByText('Controversy Board')).toBeInTheDocument()
    expect(screen.getByText('Pricing')).toBeInTheDocument()
    expect(screen.getByText('Heat 74')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button'))
    expect(onAspectSelect).toHaveBeenCalledWith('Pricing')
    expect(screen.getByText('Representative Voices')).toBeInTheDocument()
    expect(screen.getByText(/Pricing is too high/i)).toBeInTheDocument()
  })
})
