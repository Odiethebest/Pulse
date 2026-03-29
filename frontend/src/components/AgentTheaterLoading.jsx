import { Check } from 'lucide-react'
import { AnimatePresence, motion } from 'framer-motion'
import { useEffect, useMemo, useRef } from 'react'

const AGENT_STEPS = [
  { id: 'queryPlanner', label: 'Query Planner', depth: 0, match: (event) => /queryplanner/i.test(event.agentName || '') },
  { id: 'reddit', label: 'Reddit Collector', depth: 1, match: (event) => /reddit/i.test(event.agentName || '') },
  { id: 'twitter', label: 'Twitter Collector', depth: 1, match: (event) => /twitter/i.test(event.agentName || '') },
  { id: 'sentiment', label: 'Sentiment Analyzer', depth: 2, match: (event) => /sentiment/i.test(event.agentName || '') },
  { id: 'stance', label: 'Stance Classifier', depth: 2, match: (event) => /stance/i.test(event.agentName || '') },
  { id: 'conflict', label: 'Conflict Mapper', depth: 2, match: (event) => /conflict|aspect|fliprisk/i.test(event.agentName || '') },
  { id: 'synthesis', label: 'Synthesis Reporter', depth: 0, match: (event) => /synthesis/i.test(event.agentName || '') },
  { id: 'critic', label: 'Critic Agent', depth: 0, match: (event) => /critic/i.test(event.agentName || '') },
]

const BOOT_LINES = [
  'Initializing Pulse command core...',
  'Allocating retrieval workers...',
  'Warming sentiment and stance models...',
  'Awaiting first live agent signal...',
]

function formatClock(value) {
  const date = value ? new Date(value) : null
  if (!date || Number.isNaN(date.getTime())) return '--:--:--'
  return date.toLocaleTimeString([], { hour12: false })
}

function statusTone(status) {
  if (status === 'COMPLETED') return 'text-emerald-300'
  if (status === 'FAILED') return 'text-zinc-400'
  if (status === 'STARTED') return 'text-indigo-300'
  return 'text-zinc-400'
}

function resolveNodeState(node, events) {
  const matched = events.filter(node.match)
  if (matched.some((event) => event.status === 'FAILED')) return 'failed'
  if (matched.some((event) => event.status === 'COMPLETED')) return 'completed'
  if (matched.some((event) => event.status === 'STARTED')) return 'running'
  return 'pending'
}

function resolveNodeDuration(node, events) {
  const completed = events.find((event) => node.match(event) && event.status === 'COMPLETED')
  return completed?.durationMs ?? null
}

function NodeDot({ state }) {
  if (state === 'running') {
    return (
      <div className="relative flex items-center justify-center w-4 h-4">
        <motion.div
          className="absolute inset-0 rounded-full border border-indigo-500/50"
          animate={{ scale: [1, 2.5], opacity: [0.8, 0] }}
          transition={{ duration: 2, repeat: Infinity, ease: 'easeOut' }}
        />
        <div className="w-2 h-2 rounded-full bg-indigo-500 z-10" />
      </div>
    )
  }

  if (state === 'completed') {
    return (
      <div className="relative flex items-center justify-center w-4 h-4">
        <div className="absolute inset-0 rounded-full border border-emerald-400/40 bg-emerald-500/25" />
        <Check size={11} className="text-emerald-300 z-10" strokeWidth={2.5} />
      </div>
    )
  }

  if (state === 'failed') {
    return (
      <div className="relative flex items-center justify-center w-4 h-4">
        <div className="absolute inset-0 rounded-full border border-zinc-500/60 bg-zinc-500/10" />
        <span className="w-1.5 h-1.5 rounded-full bg-zinc-500 z-10" />
      </div>
    )
  }

  return (
    <div className="relative flex items-center justify-center w-4 h-4">
      <div className="absolute inset-0 rounded-full border border-zinc-600/80" />
    </div>
  )
}

function ConnectorLine({ nextState, loading }) {
  if (nextState === 'completed') {
    return <span className="absolute inset-0 bg-emerald-500/35" />
  }

  if (nextState === 'failed') {
    return <span className="absolute inset-0 bg-zinc-500/35" />
  }

  if (loading) {
    return (
      <motion.span
        className="absolute inset-0 bg-indigo-500/30"
        animate={{ opacity: [0.2, 0.7, 0.2] }}
        transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut' }}
      />
    )
  }

  return <span className="absolute inset-0 bg-zinc-700/70" />
}

function buildLogLines(events, liveText) {
  if (events.length > 0) {
    return events.map((event, index) => ({
      id: `${event.agentName || 'agent'}-${event.timestamp || index}-${event.status || 'INFO'}-${index}`,
      time: formatClock(event.timestamp),
      status: event.status || 'INFO',
      agent: event.agentName || 'PulseAgent',
      message: event.summary || 'Processing...',
      duration: event.durationMs > 0 ? `${event.durationMs}ms` : null,
    }))
  }

  const liveLines = String(liveText || '')
    .split(/\r?\n/g)
    .map((line) => line.trim())
    .filter(Boolean)

  if (liveLines.length > 0) {
    return liveLines.map((line, index) => ({
      id: `stream-${index}-${line.slice(0, 20)}`,
      time: '--:--:--',
      status: 'LIVE',
      agent: 'PulseStream',
      message: line,
      duration: null,
    }))
  }

  return BOOT_LINES.map((line, index) => ({
    id: `boot-${index}`,
    time: '--:--:--',
    status: 'BOOT',
    agent: 'PulseCore',
    message: line,
    duration: null,
  }))
}

export default function AgentTheaterLoading({
  runStatus = 'loading',
  agentEvents = [],
  liveText = '',
}) {
  const safeEvents = useMemo(() => (
    Array.isArray(agentEvents)
      ? agentEvents.filter((event) => event && typeof event === 'object')
      : []
  ), [agentEvents])
  const nodes = useMemo(() => (
    AGENT_STEPS.map((step) => ({
      ...step,
      state: resolveNodeState(step, safeEvents),
      duration: resolveNodeDuration(step, safeEvents),
    }))
  ), [safeEvents])
  const logLines = useMemo(() => buildLogLines(safeEvents, liveText), [safeEvents, liveText])
  const logRef = useRef(null)

  useEffect(() => {
    if (!logRef.current) return
    const target = logRef.current
    requestAnimationFrame(() => {
      target.scrollTo({ top: target.scrollHeight, behavior: 'smooth' })
    })
  }, [logLines.length])

  const completedCount = nodes.filter((node) => node.state === 'completed').length
  const runningCount = nodes.filter((node) => node.state === 'running').length
  const failedCount = nodes.filter((node) => node.state === 'failed').length
  const loading = runStatus === 'loading'
  const allGreen = runStatus === 'complete' && failedCount === 0 && completedCount === nodes.length

  return (
    <motion.section
      initial={{ opacity: 0, y: 10, filter: 'blur(2px)' }}
      animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
      exit={{ opacity: 0, filter: 'blur(10px)', transition: { duration: 0.6, ease: 'easeOut' } }}
      className="relative w-full max-w-5xl mx-auto min-h-[60vh] flex flex-col justify-center mt-12"
    >
      <motion.div
        className="absolute inset-0 pointer-events-none bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-indigo-900/10 via-zinc-950/0 to-transparent blur-3xl"
        animate={{ opacity: [0.4, 0.8, 0.4] }}
        transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
      />

      <div className="relative z-10 w-full rounded-2xl border border-zinc-800/70 bg-zinc-950/45 overflow-hidden shadow-[0_30px_80px_rgba(0,0,0,0.45)]">
        <div className="px-7 py-5 border-b border-zinc-800/70 flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-zinc-500 text-xs uppercase tracking-[0.18em]">Pulse Command Center</p>
            <p className="text-zinc-300 text-sm mt-1 break-words whitespace-normal">
              Agent workflow and logs are streamed live while the dashboard is preparing.
            </p>
          </div>
          <div className="flex items-center gap-2 text-xs flex-wrap">
            <span className="rounded-full border border-zinc-700 px-2.5 py-1 text-zinc-400">Done {completedCount}</span>
            <span className="rounded-full border border-indigo-500/30 px-2.5 py-1 text-indigo-300">Running {runningCount}</span>
            <span className="rounded-full border border-zinc-600/40 px-2.5 py-1 text-zinc-400">Failed {failedCount}</span>
            {allGreen && (
              <span className="rounded-full border border-emerald-500/30 px-2.5 py-1 text-emerald-300">All Systems Green</span>
            )}
          </div>
        </div>

        <div className="flex flex-col md:flex-row gap-8 md:gap-12 p-5 md:p-9 min-h-[520px]">
          <div className="w-full md:w-4/12 px-1 max-h-48 overflow-y-auto border-b border-zinc-800/50 pb-4 md:max-h-none md:overflow-visible md:border-none md:pb-0 md:min-h-[500px]">
            <p className="text-zinc-500 text-xs uppercase tracking-[0.15em] mb-4">Execution Tree</p>
            <div className="space-y-0.5">
              {nodes.map((node, index) => (
                <motion.div
                  key={node.id}
                  layout="position"
                  className="relative py-1.5"
                  style={{ paddingLeft: `${node.depth * 16}px` }}
                >
                  <div className="flex items-start gap-3 min-w-0">
                    <div className="flex flex-col items-center shrink-0">
                      <NodeDot state={node.state} />
                      {index < nodes.length - 1 && (
                        <div className="mt-1 relative h-7 w-px overflow-hidden">
                          <ConnectorLine
                            nextState={nodes[index + 1].state}
                            loading={loading}
                          />
                        </div>
                      )}
                    </div>

                    <motion.div
                      className={`min-w-0 px-2.5 py-1.5 ${
                        node.state === 'running'
                          ? 'bg-gradient-to-r from-indigo-500/10 to-transparent'
                          : ''
                      }`}
                      animate={node.state === 'running' ? { opacity: [0.7, 1, 0.7] } : { opacity: 1 }}
                      transition={node.state === 'running' ? { duration: 2.6, repeat: Infinity, ease: 'easeInOut' } : { duration: 0.2 }}
                    >
                      <p className={`text-sm break-words whitespace-normal ${node.state === 'running' ? 'text-indigo-300' : 'text-zinc-200'}`}>
                        {node.label}
                      </p>
                      <p className={`text-[11px] mt-0.5 break-words whitespace-normal ${node.state === 'running' ? 'text-indigo-300/70' : 'text-zinc-500'}`}>
                        {node.state === 'completed' && node.duration !== null
                          ? `Completed in ${node.duration}ms`
                          : node.state === 'running'
                            ? 'Running'
                            : node.state === 'failed'
                              ? 'Failed'
                              : 'Pending'}
                      </p>
                    </motion.div>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>

          <div className="w-full md:w-8/12 min-w-0 min-h-[320px] md:min-h-[500px] px-1">
            <p className="text-zinc-500 text-xs uppercase tracking-[0.15em] mb-3">Pulse Console</p>
            <div
              ref={logRef}
              className="p-2 h-[320px] md:h-[500px] overflow-y-auto font-mono text-sm leading-loose"
            >
              <div className="space-y-2">
                <AnimatePresence initial={false}>
                  {logLines.map((line) => (
                    <motion.div
                      key={line.id}
                      initial={{ opacity: 0, x: -5 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: 4, transition: { duration: 0.16 } }}
                      transition={{ duration: 0.2, ease: 'easeOut' }}
                      className="flex items-start gap-2 min-w-0"
                    >
                      <span className="text-zinc-600 shrink-0">{line.time}</span>
                      <span className={`shrink-0 ${statusTone(line.status)}`}>{line.status}</span>
                      <span className="text-indigo-300 shrink-0">{line.agent}</span>
                      <span className="text-zinc-300 break-words whitespace-normal min-w-0 flex-1">
                        {line.message}
                      </span>
                      {line.duration && (
                        <span className="text-zinc-500 shrink-0">{line.duration}</span>
                      )}
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>

              <div className="mt-3 flex items-center text-zinc-500">
                <span className="text-[11px] tracking-[0.14em] uppercase">stream</span>
                <motion.span
                  className="inline-block w-2 h-3 ml-1 bg-indigo-500 rounded-[1px]"
                  animate={{ opacity: [1, 0, 1] }}
                  transition={{ duration: 0.8, repeat: Infinity, ease: 'linear' }}
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </motion.section>
  )
}
