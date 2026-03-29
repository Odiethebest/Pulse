import { Check, Circle, X } from 'lucide-react'
import { motion } from 'framer-motion'
import { useEffect, useMemo, useRef } from 'react'

const AGENT_STEPS = [
  {
    id: 'queryPlanner',
    label: 'Query Planner',
    depth: 0,
    match: (event) => /queryplanner/i.test(event.agentName || ''),
  },
  {
    id: 'reddit',
    label: 'Reddit Collector',
    depth: 1,
    match: (event) => /reddit/i.test(event.agentName || '') && !/sentiment/i.test(event.agentName || ''),
  },
  {
    id: 'twitter',
    label: 'Twitter Collector',
    depth: 1,
    match: (event) => /twitter/i.test(event.agentName || '') && !/sentiment/i.test(event.agentName || ''),
  },
  {
    id: 'sentiment',
    label: 'Sentiment Analyzer',
    depth: 2,
    match: (event) => /sentiment/i.test(event.agentName || ''),
  },
  {
    id: 'stance',
    label: 'Stance Classifier',
    depth: 2,
    match: (event) => /stance/i.test(event.agentName || ''),
  },
  {
    id: 'conflict',
    label: 'Conflict Mapper',
    depth: 2,
    match: (event) => /conflict/i.test(event.agentName || ''),
  },
  {
    id: 'aspect',
    label: 'Aspect Extractor',
    depth: 2,
    match: (event) => /aspect/i.test(event.agentName || ''),
  },
  {
    id: 'flipRisk',
    label: 'Flip Risk Estimator',
    depth: 2,
    match: (event) => /fliprisk/i.test(event.agentName || ''),
  },
  {
    id: 'synthesis',
    label: 'Synthesis Reporter',
    depth: 0,
    match: (event) => /synthesis/i.test(event.agentName || ''),
  },
  {
    id: 'critic',
    label: 'Critic Agent',
    depth: 0,
    match: (event) => /critic/i.test(event.agentName || ''),
  },
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
  if (status === 'FAILED') return 'text-rose-300'
  return 'text-indigo-300'
}

function NodeDot({ state }) {
  if (state === 'completed') {
    return (
      <div className="h-5 w-5 rounded-full bg-emerald-500/90 border border-emerald-300/60 flex items-center justify-center">
        <Check size={12} className="text-[#08110b]" strokeWidth={3} />
      </div>
    )
  }

  if (state === 'failed') {
    return (
      <div className="h-5 w-5 rounded-full bg-rose-500/85 border border-rose-300/60 flex items-center justify-center">
        <X size={11} className="text-[#18090b]" strokeWidth={3} />
      </div>
    )
  }

  if (state === 'running') {
    return (
      <div className="relative h-5 w-5 flex items-center justify-center">
        <motion.div
          className="absolute inset-0 rounded-full border border-indigo-400/70"
          animate={{ scale: [1, 1.2, 1], opacity: [0.5, 1, 0.5] }}
          transition={{ duration: 1.2, repeat: Infinity, ease: 'easeInOut' }}
        />
        <div className="h-2.5 w-2.5 rounded-full bg-indigo-400 shadow-[0_0_10px_rgba(99,102,241,0.9)]" />
      </div>
    )
  }

  return (
    <div className="h-5 w-5 rounded-full border border-zinc-600 bg-transparent flex items-center justify-center">
      <Circle size={7} className="text-zinc-600" fill="currentColor" />
    </div>
  )
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
    logRef.current.scrollTop = logRef.current.scrollHeight
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
      className="w-full max-w-7xl mx-auto min-h-[60vh] flex flex-col justify-center mt-12"
    >
      <div className="w-full border border-zinc-800/80 rounded-2xl bg-zinc-950/45 shadow-[0_30px_80px_rgba(0,0,0,0.35)] overflow-hidden">
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
            <span className="rounded-full border border-rose-500/30 px-2.5 py-1 text-rose-300">Failed {failedCount}</span>
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
                const lineTone = node.state === 'completed'
                  ? 'bg-emerald-500/70'
                  : node.state === 'running'
                    ? 'bg-indigo-400/60'
                    : node.state === 'failed'
                      ? 'bg-rose-400/60'
                      : 'bg-zinc-700/70'

                return (
                  <div key={node.id} className="relative py-1.5" style={{ paddingLeft: `${node.depth * 14}px` }}>
                    <div className="flex items-start gap-3 min-w-0">
                      <div className="flex flex-col items-center shrink-0">
                        <NodeDot state={node.state} />
                        {index < nodes.length - 1 && (
                          <span className={`mt-1 h-6 w-px ${lineTone}`} />
                        )}
                      </div>
                      <div className="min-w-0">
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
                      </div>
                    </div>
                  </div>
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
                <div className="space-y-1.5">
                  {safeEvents.map((event, index) => (
                    <div key={`${event.agentName}-${event.timestamp}-${index}`} className="flex items-start gap-2 min-w-0">
                      <span className="text-zinc-600 shrink-0">{formatClock(event.timestamp)}</span>
                      <span className={`shrink-0 ${statusTone(event.status)}`}>{event.status}</span>
                      <span className="text-sky-300 shrink-0">{event.agentName}</span>
                      <span className="text-zinc-300 break-words whitespace-normal min-w-0 flex-1">{event.summary}</span>
                      {event.durationMs > 0 && (
                        <span className="text-zinc-500 shrink-0">{event.durationMs}ms</span>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-zinc-500 break-words whitespace-normal">
                  Waiting for first agent event...
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  )
}
