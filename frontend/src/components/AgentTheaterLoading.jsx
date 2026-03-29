import { Check, Circle, X } from 'lucide-react'
import { AnimatePresence, motion } from 'framer-motion'
import { useEffect, useMemo, useRef } from 'react'

const AGENT_STEPS = [
  { id: 'queryPlanner', label: 'Query Planner', depth: 0, match: (e) => /queryplanner/i.test(e.agentName || '') },
  { id: 'reddit', label: 'Reddit Collector', depth: 1, match: (e) => /reddit/i.test(e.agentName || '') && !/sentiment/i.test(e.agentName || '') },
  { id: 'twitter', label: 'Twitter Collector', depth: 1, match: (e) => /twitter/i.test(e.agentName || '') && !/sentiment/i.test(e.agentName || '') },
  { id: 'sentiment', label: 'Sentiment Analyzer', depth: 2, match: (e) => /sentiment/i.test(e.agentName || '') },
  { id: 'stance', label: 'Stance Classifier', depth: 2, match: (e) => /stance/i.test(e.agentName || '') },
  { id: 'conflict', label: 'Conflict Mapper', depth: 2, match: (e) => /conflict/i.test(e.agentName || '') },
  { id: 'aspect', label: 'Aspect Extractor', depth: 2, match: (e) => /aspect/i.test(e.agentName || '') },
  { id: 'flipRisk', label: 'Flip Risk Estimator', depth: 2, match: (e) => /fliprisk/i.test(e.agentName || '') },
  { id: 'synthesis', label: 'Synthesis Reporter', depth: 0, match: (e) => /synthesis/i.test(e.agentName || '') },
  { id: 'critic', label: 'Critic Agent', depth: 0, match: (e) => /critic/i.test(e.agentName || '') },
]

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

function formatClock(value) {
  const date = value ? new Date(value) : null
  if (!date || Number.isNaN(date.getTime())) return '--:--:--'
  return date.toLocaleTimeString([], { hour12: false })
}

function statusTone(status) {
  if (status === 'COMPLETED') return 'text-emerald-300'
  if (status === 'FAILED') return 'text-zinc-400'
  return 'text-indigo-300'
}

function NodeDot({ state }) {
  if (state === 'running') {
    return (
      <div className="relative flex items-center justify-center w-4 h-4">
        <motion.div
          className="absolute inset-0 rounded-full border border-indigo-400/50"
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
        <div className="absolute inset-0 rounded-full border border-emerald-400/40 bg-emerald-500/20" />
        <Check size={11} className="text-emerald-300 z-10" strokeWidth={2.5} />
      </div>
    )
  }

  if (state === 'failed') {
    return (
      <div className="relative flex items-center justify-center w-4 h-4">
        <div className="absolute inset-0 rounded-full border border-zinc-500/50 bg-zinc-600/20" />
        <X size={11} className="text-zinc-300 z-10" strokeWidth={2.5} />
      </div>
    )
  }

  return (
    <div className="relative flex items-center justify-center w-4 h-4">
      <div className="absolute inset-0 rounded-full border border-zinc-600/70 bg-transparent" />
      <Circle size={6} className="text-zinc-600 z-10" fill="currentColor" />
    </div>
  )
}

function ConnectorLine({ nextState }) {
  if (nextState === 'running') {
    return (
      <motion.span
        className="absolute inset-0 bg-indigo-500/30"
        animate={{ opacity: [0.2, 0.7, 0.2] }}
        transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut' }}
      />
    )
  }

  if (nextState === 'completed') {
    return <span className="absolute inset-0 bg-emerald-500/30" />
  }

  if (nextState === 'failed') {
    return <span className="absolute inset-0 bg-zinc-500/35" />
  }

  return <span className="absolute inset-0 bg-zinc-700/70" />
}

export default function AgentTheaterLoading({
  runStatus = 'loading',
  agentEvents = [],
  liveText = '',
}) {
  const safeEvents = useMemo(
    () => (Array.isArray(agentEvents) ? agentEvents.filter((event) => event && typeof event === 'object') : []),
    [agentEvents]
  )
  const nodes = useMemo(
    () => AGENT_STEPS.map((step) => ({
      ...step,
      state: resolveNodeState(step, safeEvents),
      duration: resolveNodeDuration(step, safeEvents),
    })),
    [safeEvents]
  )
  const logRef = useRef(null)

  useEffect(() => {
    if (!logRef.current) return
    const target = logRef.current
    requestAnimationFrame(() => {
      target.scrollTo({ top: target.scrollHeight, behavior: 'smooth' })
    })
  }, [safeEvents.length, liveText])

  const completedCount = nodes.filter((node) => node.state === 'completed').length
  const runningCount = nodes.filter((node) => node.state === 'running').length
  const failedCount = nodes.filter((node) => node.state === 'failed').length
  const allGreen = runStatus === 'complete' && failedCount === 0 && completedCount === nodes.length

  return (
    <motion.div
      initial={{ opacity: 0, y: 10, filter: 'blur(2px)' }}
      animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
      exit={{ opacity: 0, filter: 'blur(10px)', transition: { duration: 0.6, ease: 'easeOut' } }}
      className="relative w-full max-w-7xl mx-auto min-h-[60vh] flex flex-col justify-center mt-12"
    >
      <motion.div
        className="absolute inset-0 pointer-events-none bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-indigo-900/10 via-zinc-950/0 to-transparent blur-3xl"
        animate={{ opacity: [0.4, 0.8, 0.4] }}
        transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
      />

      <div className="relative z-10 w-full border border-zinc-800/80 rounded-2xl bg-zinc-950/45 overflow-hidden">
        <div className="px-7 py-5 border-b border-zinc-800/80 flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-zinc-500 text-xs uppercase tracking-[0.16em]">Pulse Command Center</p>
            <p className="text-zinc-300 text-sm mt-1 break-words whitespace-normal">
              Live execution tree and terminal logs are running in real time.
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

        <div className="grid grid-cols-1 xl:grid-cols-[380px_minmax(0,1fr)] gap-12 xl:gap-16 p-7 md:p-10 min-h-[520px]">
          <div className="min-h-[500px] rounded-xl border border-zinc-800/70 bg-zinc-950/60 p-5">
            <p className="text-zinc-500 text-xs uppercase tracking-[0.15em] mb-4">Execution Tree</p>
            <div className="space-y-0">
              {nodes.map((node, index) => {
                const runningShell = node.state === 'running'
                  ? 'shadow-[inset_0_1px_0_rgba(99,102,241,0.2)] bg-indigo-500/5 border border-indigo-500/20'
                  : 'border border-transparent'

                return (
                  <motion.div
                    key={node.id}
                    className="relative py-1.5"
                    style={{ paddingLeft: `${node.depth * 14}px` }}
                    layout="position"
                  >
                    <div className="flex items-start gap-3 min-w-0">
                      <div className="flex flex-col items-center shrink-0">
                        <NodeDot state={node.state} />
                        {index < nodes.length - 1 && (
                          <div className="mt-1 relative h-6 w-px overflow-hidden">
                            <ConnectorLine nextState={nodes[index + 1].state} />
                          </div>
                        )}
                      </div>

                      <motion.div
                        className={`min-w-0 rounded-lg px-2 py-1.5 ${runningShell}`}
                        animate={node.state === 'running' ? { opacity: [0.65, 1, 0.65] } : { opacity: 1 }}
                        transition={node.state === 'running' ? { duration: 3, repeat: Infinity, ease: 'easeInOut' } : { duration: 0.2 }}
                      >
                        <p className="text-sm text-zinc-200 break-words whitespace-normal">{node.label}</p>
                        <p className="text-[11px] text-zinc-500 mt-0.5 break-words whitespace-normal">
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
                )
              })}
            </div>
          </div>

          <div className="min-w-0 min-h-[500px] rounded-xl border border-zinc-800/70 bg-zinc-950/60 p-5">
            <p className="text-zinc-500 text-xs uppercase tracking-[0.15em] mb-3">Agent Logs</p>
            <div
              ref={logRef}
              className="bg-black rounded-lg p-4 h-[500px] overflow-y-auto font-mono text-sm leading-relaxed border border-zinc-800"
            >
              {safeEvents.length > 0 ? (
                <AnimatePresence initial={false}>
                  <div className="space-y-1.5">
                    {safeEvents.map((event, index) => (
                      <motion.div
                        key={`${event.agentName}-${event.timestamp}-${index}`}
                        initial={{ opacity: 0, y: 5 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.2 }}
                        className="flex items-start gap-2 min-w-0"
                      >
                        <span className="text-zinc-600 shrink-0">{formatClock(event.timestamp)}</span>
                        <span className={`shrink-0 ${statusTone(event.status)}`}>{event.status}</span>
                        <span className="text-sky-300 shrink-0">{event.agentName}</span>
                        <span className="text-zinc-300 break-words whitespace-normal min-w-0 flex-1">{event.summary}</span>
                        {event.durationMs > 0 && (
                          <span className="text-zinc-500 shrink-0">{event.durationMs}ms</span>
                        )}
                      </motion.div>
                    ))}
                  </div>
                </AnimatePresence>
              ) : (
                <p className="text-zinc-500 break-words whitespace-normal">
                  Waiting for first agent event...
                </p>
              )}

              <div className="mt-2 flex items-center text-zinc-500">
                <span className="text-[11px] tracking-wide uppercase">stream</span>
                <motion.span
                  animate={{ opacity: [1, 0, 1] }}
                  transition={{ duration: 0.8, repeat: Infinity, ease: 'linear' }}
                  className="inline-block w-2 h-3 ml-1 bg-indigo-500 rounded-[1px]"
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  )
}
