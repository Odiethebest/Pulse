const API_BASE = (import.meta.env.VITE_API_BASE || '/api').replace(/\/+$/, '')
const PULSE_BASE = `${API_BASE}/pulse`

/**
 * POST /api/pulse/analyze
 * @param {string} topic
 * @returns {Promise<PulseReport>}
 */
export async function analyzeTopic(topic) {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 60_000)

  try {
    const res = await fetch(`${PULSE_BASE}/analyze`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ topic }),
      signal: controller.signal,
    })
    if (!res.ok) throw new Error(`analyze failed: ${res.status}`)
    return res.json()
  } finally {
    clearTimeout(timeout)
  }
}

/**
 * GET /api/pulse/stream (SSE)
 * @param {(event: AgentEvent) => void} onEvent
 * @param {() => void} onError
 * @returns {{ cleanup: () => void, ready: Promise<void> }}
 *   cleanup — closes the EventSource
 *   ready   — resolves when connection is OPEN, first message arrives, or 500ms elapses
 */
export function connectSSE(onEvent, onError) {
  const es = new EventSource(`${PULSE_BASE}/stream`)

  let resolveReady
  const ready = new Promise((resolve) => {
    resolveReady = resolve
    if (es.readyState === EventSource.OPEN) resolve()
    setTimeout(resolve, 500) // maximum wait fallback
  })

  es.onopen = () => resolveReady()

  es.onmessage = (e) => {
    resolveReady() // also resolve on first message
    try {
      onEvent(JSON.parse(e.data))
    } catch {
      // malformed event — skip silently
    }
  }

  es.onerror = () => {
    es.close()
    onError()
  }

  return { cleanup: () => es.close(), ready }
}

/**
 * Pings GET /api/actuator/health immediately, then every 10 minutes.
 * @returns {() => void} cleanup function that clears the interval
 */
export function keepAlive() {
  const ping = () => fetch(`${API_BASE}/actuator/health`).catch(() => {})
  ping()
  const id = setInterval(ping, 10 * 60 * 1000)
  return () => clearInterval(id)
}
