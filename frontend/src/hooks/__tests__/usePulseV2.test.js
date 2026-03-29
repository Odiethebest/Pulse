import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { usePulse } from '../usePulse'
import { analyzeTopic, connectSSE } from '../../lib/api'

vi.mock('../../lib/api', () => ({
  analyzeTopic: vi.fn(),
  connectSSE: vi.fn(),
}))

describe('usePulse V2 flow', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('completes V2 state flow and converges after SSE events', async () => {
    let runIdFromSse
    let sseOnEvent
    let sseOnError
    const cleanup = vi.fn()

    connectSSE.mockImplementation((runId, onEvent, onError) => {
      runIdFromSse = runId
      sseOnEvent = onEvent
      sseOnError = onError
      return { cleanup, ready: Promise.resolve() }
    })

    analyzeTopic.mockResolvedValue({
      topic: 'Chip war',
      confidenceScore: 71,
      debateTriggered: true,
      dramaScore: 68,
      polarizationScore: 57,
      heatScore: 74,
      flipRiskScore: 39,
    })

    const { result } = renderHook(() => usePulse())

    await act(async () => {
      const submitPromise = result.current.submit('Chip war')
      sseOnEvent({
        status: 'STARTED',
        agentName: 'QueryPlannerAgent',
        summary: 'Planning queries',
        durationMs: 0,
      })
      sseOnEvent({
        status: 'COMPLETED',
        agentName: 'QueryPlannerAgent',
        summary: 'Done',
        durationMs: 15,
      })
      await submitPromise
    })

    await waitFor(() => expect(result.current.status).toBe('complete'))
    expect(typeof runIdFromSse).toBe('string')
    expect(runIdFromSse.length).toBeGreaterThan(0)
    expect(analyzeTopic).toHaveBeenCalledWith('Chip war', runIdFromSse)
    expect(result.current.report.topic).toBe('Chip war')
    expect(result.current.agentEvents).toHaveLength(2)
    expect(result.current.liveText).toContain('[STARTED] QueryPlannerAgent')
    expect(result.current.liveText).toContain('[COMPLETED] QueryPlannerAgent')
    expect(result.current.metrics).toEqual({
      drama: 68,
      polarization: 57,
      heat: 74,
      flipRisk: 39,
    })
    expect(result.current.agentSummary).toEqual({
      running: 0,
      completed: 1,
      failed: 0,
      total: 2,
      overallState: 'complete',
    })
    expect(cleanup).toHaveBeenCalledTimes(1)

    act(() => sseOnError())
    expect(result.current.status).toBe('complete')
  })

  it('falls back to error state when analyze request fails', async () => {
    const cleanup = vi.fn()
    connectSSE.mockReturnValue({ cleanup, ready: Promise.resolve() })
    analyzeTopic.mockRejectedValue(new Error('network down'))

    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const { result } = renderHook(() => usePulse())

    await act(async () => {
      await result.current.submit('Broken topic')
    })

    await waitFor(() => expect(result.current.status).toBe('error'))
    expect(result.current.report).toBeNull()
    expect(result.current.metrics).toEqual({
      drama: null,
      polarization: null,
      heat: null,
      flipRisk: null,
    })
    expect(result.current.agentSummary.overallState).toBe('failed')
    expect(cleanup).toHaveBeenCalledTimes(1)
    consoleErrorSpy.mockRestore()
  })

  it('cancels active run and ignores late analyze result', async () => {
    const cleanup = vi.fn()
    connectSSE.mockReturnValue({ cleanup, ready: Promise.resolve() })

    let resolveAnalyze
    analyzeTopic.mockImplementation(() => new Promise((resolve) => {
      resolveAnalyze = resolve
    }))

    const { result } = renderHook(() => usePulse())

    act(() => {
      result.current.submit('Cancel topic')
    })

    await waitFor(() => expect(result.current.status).toBe('loading'))

    act(() => {
      result.current.cancelRun()
    })

    expect(result.current.status).toBe('idle')

    await act(async () => {
      resolveAnalyze({
        topic: 'Cancel topic',
        dramaScore: 61,
        polarizationScore: 52,
        heatScore: 59,
        flipRiskScore: 48,
      })
      await Promise.resolve()
    })

    expect(result.current.status).toBe('idle')
    expect(result.current.report).toBeNull()
    expect(cleanup).toHaveBeenCalledTimes(1)
  })
})
