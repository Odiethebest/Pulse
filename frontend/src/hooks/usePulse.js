import { useState, useRef, useCallback, useMemo } from 'react'
import { analyzeTopic, connectSSE } from '../lib/api'

function formatLine(event) {
  const { status, agentName, summary, durationMs } = event
  const duration = status === 'COMPLETED' && durationMs > 0 ? ` (${durationMs}ms)` : ''
  const tag = status === 'COMPLETED' ? '[COMPLETED]'
            : status === 'FAILED'    ? '[FAILED]'
            :                          '[STARTED]'
  return `${tag} ${agentName} — ${summary}${duration}`
}

export function usePulse() {
  const [status,      setStatus]      = useState('idle')
  const [runId,       setRunId]       = useState(0)
  const [agentEvents, setAgentEvents] = useState([])
  const [report,      setReport]      = useState(null)
  const [liveText,    setLiveText]    = useState('')
  const [metrics,     setMetrics]     = useState({
    drama: null,
    polarization: null,
    heat: null,
    flipRisk: null,
  })

  const closeSSE = useRef(null)

  const agentSummary = useMemo(() => {
    const counts = agentEvents.reduce((acc, event) => {
      if (!event || typeof event !== 'object') return acc
      if (event.status === 'STARTED') acc.started += 1
      if (event.status === 'COMPLETED') acc.completed += 1
      if (event.status === 'FAILED') acc.failed += 1
      return acc
    }, { started: 0, completed: 0, failed: 0 })

    const running = Math.max(0, counts.started - counts.completed - counts.failed)
    const total = counts.started + counts.completed + counts.failed

    let overallState = 'idle'
    if (status === 'error') {
      overallState = 'failed'
    } else if (status === 'loading') {
      overallState = 'running'
    } else if (status === 'complete' && counts.failed > 0) {
      overallState = 'warning'
    } else if (status === 'complete') {
      overallState = 'complete'
    }

    return {
      running,
      completed: counts.completed,
      failed: counts.failed,
      total,
      overallState,
    }
  }, [agentEvents, status])

  const submit = useCallback(async (topic) => {
    // 1. Reset state
    setRunId((id) => id + 1)
    setStatus('loading')
    setAgentEvents([])
    setReport(null)
    setLiveText('')
    setMetrics({
      drama: null,
      polarization: null,
      heat: null,
      flipRisk: null,
    })

    // Close any lingering SSE from a previous run
    closeSSE.current?.()

    // 2. Open SSE and wait until connection is confirmed open
    const { cleanup, ready } = connectSSE(
      (event) => {
        // 3. Accumulate events and formatted log lines
        setAgentEvents(prev => [...prev, event])
        setLiveText(prev => (prev ? prev + '\n' : '') + formatLine(event))
      },
      () => {
        // SSE error — only mark error if we haven't already completed
        setStatus(s => s === 'loading' ? 'error' : s)
      }
    )
    closeSSE.current = cleanup

    await ready // ensure SSE is OPEN before events start flowing

    try {
      // 4. Kick off analysis
      const result = await analyzeTopic(topic)
      // 5. Success
      console.log('[usePulse] analyze complete', result)
      setReport(result)
      setMetrics({
        drama: result?.dramaScore ?? null,
        polarization: result?.polarizationScore ?? null,
        heat: result?.heatScore ?? null,
        flipRisk: result?.flipRiskScore ?? null,
      })
      setStatus('complete')
    } catch (err) {
      // 6. Network / server error
      console.error('[usePulse] analyze error', err)
      setStatus('error')
    } finally {
      // Always close SSE when analyze settles
      closeSSE.current?.()
      closeSSE.current = null
    }
  }, [])

  return { runId, status, agentEvents, report, liveText, metrics, agentSummary, submit }
}
