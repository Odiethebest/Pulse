import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import ControversyAccordion from '../ControversyAccordion'

describe('ControversyAccordion', () => {
  it('filters signal feed by topic and platform toggles', async () => {
    render(
      <ControversyAccordion
        data={{
          topics: [
            { id: 't1', name: 'leadership perception', heat: 70 },
            { id: 't2', name: 'political future', heat: 75 },
            { id: 't3', name: 'election integrity', heat: 60 },
          ],
          quotes: [
            {
              id: 'q1',
              platform: 'Reddit',
              sentiment: 'positive',
              evidenceScore: 80,
              text: "Yes, the majority believes he's a good leader.",
              topicIds: ['t1', 't2'],
            },
            {
              id: 'q2',
              platform: 'Twitter',
              sentiment: 'negative',
              evidenceScore: 80,
              text: 'Lol. Hit a nerve here have we? Best change your profile...',
              topicIds: ['t1'],
            },
            {
              id: 'q3',
              platform: 'Reddit',
              sentiment: 'negative',
              evidenceScore: 90,
              text: 'He is a far-right fascist who murderers political opponents.',
              topicIds: ['t1', 't2', 't3'],
            },
          ],
        }}
      />
    )

    expect(screen.getByText('Controversy Lenses')).toBeInTheDocument()
    expect(screen.getByText(/majority believes he.s a good leader/i)).toBeInTheDocument()
    expect(screen.getByText(/hit a nerve here have we/i)).toBeInTheDocument()
    expect(screen.getByText(/far-right fascist/i)).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /political future/i }))
    expect(screen.getByText(/majority believes he.s a good leader/i)).toBeInTheDocument()
    await waitFor(() => {
      expect(screen.queryByText(/hit a nerve here have we/i)).not.toBeInTheDocument()
    })
    expect(screen.getByText(/far-right fascist/i)).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /reddit/i }))
    expect(screen.queryByText(/majority believes he.s a good leader/i)).not.toBeInTheDocument()
    expect(screen.getByText('No signals under the current topic and platform filters.')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /all topics/i }))
    expect(screen.queryByText('No signals under the current topic and platform filters.')).not.toBeInTheDocument()
    expect(screen.getByText(/Lol. Hit a nerve here have we/i)).toBeInTheDocument()
  })

  it('uses progressive disclosure with load more control', async () => {
    render(
      <ControversyAccordion
        data={{
          topics: [{ id: 't1', name: 'leadership perception', heat: 70 }],
          quotes: Array.from({ length: 8 }, (_, index) => ({
            id: `q-${index + 1}`,
            platform: index % 2 === 0 ? 'Reddit' : 'Twitter',
            sentiment: index % 3 === 0 ? 'positive' : 'negative',
            evidenceScore: 70 + index,
            text: `Quote ${index + 1} about leadership perception`,
            topicIds: ['t1'],
          })),
        }}
      />
    )

    expect(screen.getByText(/quote 1 about leadership perception/i)).toBeInTheDocument()
    expect(screen.queryByText(/quote 7 about leadership perception/i)).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /load more/i })).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /load more/i }))
    await waitFor(() => {
      expect(screen.getByText(/quote 7 about leadership perception/i)).toBeInTheDocument()
    })
    expect(screen.queryByRole('button', { name: /load more/i })).not.toBeInTheDocument()
  })

  it('shows crawler coverage level and alerts when provided', () => {
    render(
      <ControversyAccordion
        data={{
          topics: [{ id: 't1', name: 'pricing', heat: 70 }],
          quotes: [
            {
              id: 'q1',
              platform: 'Reddit',
              sentiment: 'neutral',
              evidenceScore: 68,
              text: 'Price changes sparked another argument.',
              topicIds: ['t1'],
            },
          ],
          crawlerStats: {
            targetTotal: 50,
            fetchedTotal: 24,
            dedupedCount: 24,
            unassignedCount: 9,
            coveragePercent: 48,
            coverageLevel: 'critical',
            coverageAlerts: [
              'Critical crawl coverage: 48% (<45% target).',
              'High unassigned ratio: 38% posts could not be confidently mapped.',
            ],
          },
        }}
      />
    )

    expect(screen.getByText(/coverage 48%/i)).toBeInTheDocument()
    expect(screen.getByText(/critical crawl coverage/i)).toBeInTheDocument()
    expect(screen.getByText(/high unassigned ratio/i)).toBeInTheDocument()
  })
})
