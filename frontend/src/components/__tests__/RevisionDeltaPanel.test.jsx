import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import RevisionDeltaPanel from '../RevisionDeltaPanel'

describe('RevisionDeltaPanel', () => {
  it('renders revision anchors and triggers jump callback', () => {
    const onAnchorSelect = vi.fn()

    render(
      <RevisionDeltaPanel
        revisionDelta={['Removed weak claim']}
        critique={{ evidenceGaps: ['Need one more source'] }}
        revisionAnchors={[
          {
            anchorId: 'rev-1',
            section: 'Lead',
            title: 'Revision 1',
            detail: 'Removed weak claim',
          },
        ]}
        onAnchorSelect={onAnchorSelect}
      />
    )

    expect(screen.getByText('Jump to revised sections')).toBeInTheDocument()
    expect(screen.getByText('Lead')).toBeInTheDocument()
    expect(screen.getByText('Revision 1')).toBeInTheDocument()
    expect(screen.getByText('Remaining evidence gaps')).toBeInTheDocument()

    fireEvent.click(screen.getByText('Removed weak claim'))
    expect(onAnchorSelect).toHaveBeenCalledWith('rev-1')
  })
})
