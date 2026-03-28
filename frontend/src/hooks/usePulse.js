import { useState, useRef, useCallback } from 'react'
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
  const [agentEvents, setAgentEvents] = useState([])
  const [report,      setReport]      = useState(null)
  const [liveText,    setLiveText]    = useState('')

  const closeSSE = useRef(null)

  const submit = useCallback(async (topic) => {
    // 1. Reset state
    setStatus('loading')
    setAgentEvents([])
    setReport(null)
    setLiveText('')

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

  return { status, agentEvents, report, liveText, submit }
}
