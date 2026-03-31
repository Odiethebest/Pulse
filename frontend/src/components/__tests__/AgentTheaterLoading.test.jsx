import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import AgentTheaterLoadingDesktop from '../AgentTheaterLoadingDesktop'
import AgentTheaterLoadingMobile from '../AgentTheaterLoadingMobile'

function eventLine(index, status = 'STARTED') {
  return {
    status,
    agentName: status === 'COMPLETED' ? 'SynthesisAgent' : 'CriticAgent',
    summary: `line-${index}`,
    timestamp: `2026-03-30T20:14:${String(index).padStart(2, '0')}Z`,
    durationMs: status === 'COMPLETED' ? 120 + index : 0,
  }
}

describe('AgentTheaterLoading isolation', () => {
  afterEach(() => {
    cleanup()
  })

  it('keeps desktop structure with original split layout classes', () => {
    const { container } = render(
      <AgentTheaterLoadingDesktop
        runStatus="loading"
        agentEvents={[eventLine(1), eventLine(2, 'COMPLETED')]}
        liveText=""
      />
    )

    expect(screen.getByText('Pulse Command Center')).toBeInTheDocument()
    expect(screen.getByText('Execution Tree')).toBeInTheDocument()
    expect(screen.getByText('Pulse Console')).toBeInTheDocument()

    const splitRow = Array.from(container.querySelectorAll('div'))
      .find((node) => typeof node.className === 'string' && node.className.includes('md:flex-row'))
    expect(splitRow).toBeTruthy()

    const leftPane = Array.from(container.querySelectorAll('div'))
      .find((node) => typeof node.className === 'string' && node.className.includes('md:w-4/12'))
    const rightPane = Array.from(container.querySelectorAll('div'))
      .find((node) => typeof node.className === 'string' && node.className.includes('md:w-8/12'))
    expect(leftPane).toBeTruthy()
    expect(rightPane).toBeTruthy()

    const mobileNamespaceNodes = container.querySelectorAll('[class*="theater-mobile-"]')
    expect(mobileNamespaceNodes.length).toBe(0)
  })

  it('uses mobile tabbed layout with execution summary and expandable full chain', async () => {
    const phase3Events = [
      {
        status: 'COMPLETED',
        agentName: 'QueryPlanner',
        summary: 'planned query expansion',
        timestamp: '2026-03-30T20:14:00Z',
        durationMs: 40,
      },
      {
        status: 'COMPLETED',
        agentName: 'RedditCollector',
        summary: 'collected reddit posts',
        timestamp: '2026-03-30T20:14:02Z',
        durationMs: 60,
      },
      {
        status: 'COMPLETED',
        agentName: 'TwitterCollector',
        summary: 'collected twitter posts',
        timestamp: '2026-03-30T20:14:04Z',
        durationMs: 70,
      },
      {
        status: 'STARTED',
        agentName: 'SentimentAnalyzer',
        summary: 'running sentiment',
        timestamp: '2026-03-30T20:14:05Z',
        durationMs: 0,
      },
    ]

    const view = render(
      <AgentTheaterLoadingMobile
        runStatus="loading"
        agentEvents={phase3Events}
        liveText=""
      />
    )

    expect(view.getByTestId('theater-mobile-shell')).toBeInTheDocument()
    expect(view.getByRole('tab', { name: 'Console' })).toHaveAttribute('aria-selected', 'true')
    expect(view.getByTestId('theater-mobile-console')).toBeInTheDocument()
    expect(view.queryByTestId('theater-mobile-tree')).not.toBeInTheDocument()

    fireEvent.click(view.getByRole('tab', { name: 'Execution' }))
    expect(view.getByRole('tab', { name: 'Execution' })).toHaveAttribute('aria-selected', 'true')
    await waitFor(() => {
      expect(view.getByTestId('theater-mobile-execution-summary')).toBeInTheDocument()
    })
    const focusedTree = view.getByTestId('theater-mobile-tree-focused')
    expect(within(focusedTree).getByText('Sentiment Analyzer')).toBeInTheDocument()
    expect(within(focusedTree).getByText('Twitter Collector')).toBeInTheDocument()
    expect(within(focusedTree).getByText('Reddit Collector')).toBeInTheDocument()
    expect(within(focusedTree).queryByText('Query Planner')).not.toBeInTheDocument()
    expect(view.queryByTestId('theater-mobile-tree-all')).not.toBeInTheDocument()

    fireEvent.click(view.getByRole('button', { name: /show all steps/i }))
    await waitFor(() => {
      expect(view.getByTestId('theater-mobile-tree-all')).toBeInTheDocument()
    })
    expect(view.getByTestId('theater-mobile-tree-all')).toHaveTextContent('Query Planner')

    fireEvent.click(view.getByRole('button', { name: /hide all steps/i }))
    expect(view.queryByTestId('theater-mobile-tree-all')).not.toBeInTheDocument()
  })

  it('auto-scrolls only when console is at bottom on mobile', async () => {
    const first = [eventLine(1)]
    const second = [eventLine(1), eventLine(2)]
    const third = [eventLine(1), eventLine(2), eventLine(3)]

    const view = render(
      <AgentTheaterLoadingMobile
        runStatus="loading"
        agentEvents={first}
        liveText=""
      />
    )

    const consoleNode = view.getByTestId('theater-mobile-console')
    consoleNode.scrollTo = vi.fn()

    Object.defineProperty(consoleNode, 'scrollHeight', { value: 600, configurable: true, writable: true })
    Object.defineProperty(consoleNode, 'clientHeight', { value: 200, configurable: true, writable: true })
    Object.defineProperty(consoleNode, 'scrollTop', { value: 260, configurable: true, writable: true })

    fireEvent.scroll(consoleNode)
    consoleNode.scrollTo.mockClear()

    view.rerender(
      <AgentTheaterLoadingMobile
        runStatus="loading"
        agentEvents={second}
        liveText=""
      />
    )

    await waitFor(() => {
      expect(consoleNode.scrollTo).not.toHaveBeenCalled()
    })
    expect(view.getByRole('button', { name: /jump to latest/i })).toBeInTheDocument()

    consoleNode.scrollTop = 400
    fireEvent.scroll(consoleNode)
    view.rerender(
      <AgentTheaterLoadingMobile
        runStatus="loading"
        agentEvents={third}
        liveText=""
      />
    )

    await waitFor(() => {
      expect(consoleNode.scrollTo).toHaveBeenCalled()
    })
  })
})
