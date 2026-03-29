import { render, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { parseCitations } from '../SemanticSourceChip'

function CitationHarness({ text, quotes }) {
  return <p>{parseCitations(text, quotes)}</p>
}

describe('InteractiveCitation parser', () => {
  it('maps [Qn] tokens to interactive number anchors with quote tooltip text', () => {
    const { container } = render(
      <CitationHarness
        text="Main claim [Q1] with support [Q2]."
        quotes={[
          { platform: 'Reddit', sentiment: 'negative', text: 'Quote from reddit source' },
          { platform: 'Twitter', sentiment: 'positive', text: 'Quote from twitter source' },
        ]}
      />
    )
    const scope = within(container)

    const q1 = scope.getByTestId('interactive-citation-1')
    const q2 = scope.getByTestId('interactive-citation-2')
    expect(q1).toBeInTheDocument()
    expect(q2).toBeInTheDocument()
    expect(q1).toHaveTextContent('1')
    expect(q2).toHaveTextContent('2')
    expect(scope.getByText(/Quote from reddit source/i)).toBeInTheDocument()
    expect(scope.getByText(/Quote from twitter source/i)).toBeInTheDocument()
  })

  it('renders fallback tooltip when citation index is missing', () => {
    const { container } = render(
      <CitationHarness
        text="No mapped quote [Q3]."
        quotes={[
          { platform: 'Reddit', sentiment: 'neutral', text: 'Only one source exists' },
        ]}
      />
    )
    const scope = within(container)

    const fallback = scope.getByTestId('interactive-citation-3')
    expect(fallback).toBeInTheDocument()
    expect(fallback).toHaveTextContent('3')
    expect(scope.getByText('Source evidence not available.')).toBeInTheDocument()
  })

  it('scrolls to signal-feed when an anchor is clicked', () => {
    const target = document.createElement('div')
    target.id = 'signal-feed'
    target.scrollIntoView = vi.fn()
    document.body.appendChild(target)

    const { container } = render(
      <CitationHarness
        text="Clickable anchor [Q1]."
        quotes={[{ text: 'Bound quote evidence' }]}
      />
    )
    const scope = within(container)

    scope.getByTestId('interactive-citation-1').click()
    expect(target.scrollIntoView).toHaveBeenCalledWith({ behavior: 'smooth' })

    target.remove()
  })

  it('reads quote text from string arrays using citation index mapping', () => {
    const { container } = render(
      <CitationHarness
        text="Indexed sources [1] and [2]."
        quotes={['First raw quote text', 'Second raw quote text']}
      />
    )
    const scope = within(container)

    expect(scope.getByTestId('interactive-citation-1')).toBeInTheDocument()
    expect(scope.getByTestId('interactive-citation-2')).toBeInTheDocument()
    expect(scope.getByText(/First raw quote text/i)).toBeInTheDocument()
    expect(scope.getByText(/Second raw quote text/i)).toBeInTheDocument()
  })
})
