import { Check } from 'lucide-react'
import { AnimatePresence, motion } from 'framer-motion'
import { useEffect, useMemo, useRef, useState } from 'react'

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

function scrollToBottom(node) {
  if (!node) return
  if (typeof node.scrollTo === 'function') {
    node.scrollTo({ top: node.scrollHeight, behavior: 'smooth' })
    return
  }
  node.scrollTop = node.scrollHeight
}

function formatClock(value) {
  const date = value ? new Date(value) : null
  if (!date || Number.isNaN(date.getTime())) return '--:--:--'
  return date.toLocaleTimeString([], { hour12: false })
}

function statusTone(status) {
  if (status === 'COMPLETED') return 'theater-mobile-status theater-mobile-status--completed'
  if (status === 'FAILED') return 'theater-mobile-status theater-mobile-status--failed'
  if (status === 'STARTED') return 'theater-mobile-status theater-mobile-status--running'
  return 'theater-mobile-status theater-mobile-status--muted'
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

function NodeDot({ state }) {
  if (state === 'running') {
    return <span className="theater-mobile-dot theater-mobile-dot--running" />
  }
  if (state === 'completed') {
    return (
      <span className="theater-mobile-dot theater-mobile-dot--completed">
        <Check size={10} strokeWidth={2.5} />
      </span>
    )
  }
  if (state === 'failed') {
    return <span className="theater-mobile-dot theater-mobile-dot--failed" />
  }
  return <span className="theater-mobile-dot theater-mobile-dot--pending" />
}

function ExecutionTree({ nodes }) {
  return (
    <div className="theater-mobile-tree" data-testid="theater-mobile-tree">
      {nodes.map((node) => (
        <div
          key={node.id}
          className="theater-mobile-tree-row"
          style={{ paddingLeft: `${node.depth * 14}px` }}
        >
          <NodeDot state={node.state} />
          <div className="theater-mobile-tree-meta">
            <p className="theater-mobile-tree-label">{node.label}</p>
            <p className="theater-mobile-tree-sub">
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
      ))}
    </div>
  )
}

export default function AgentTheaterLoadingMobile({
  runStatus = 'loading',
  agentEvents = [],
  liveText = '',
}) {
  const [activeTab, setActiveTab] = useState('console')
  const [isAtBottom, setIsAtBottom] = useState(true)
  const logRef = useRef(null)

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
  const completedCount = nodes.filter((node) => node.state === 'completed').length
  const runningCount = nodes.filter((node) => node.state === 'running').length
  const failedCount = nodes.filter((node) => node.state === 'failed').length
  const allGreen = runStatus === 'complete' && failedCount === 0 && completedCount === nodes.length

  const updateBottomState = () => {
    if (!logRef.current) return
    const node = logRef.current
    const distanceToBottom = node.scrollHeight - (node.scrollTop + node.clientHeight)
    setIsAtBottom(distanceToBottom <= 24)
  }

  const jumpToLatest = () => {
    if (!logRef.current) return
    scrollToBottom(logRef.current)
    setIsAtBottom(true)
  }

  useEffect(() => {
    if (activeTab !== 'console' || !isAtBottom || !logRef.current) {
      return
    }
    scrollToBottom(logRef.current)
  }, [activeTab, isAtBottom, logLines.length])

  useEffect(() => {
    if (!logRef.current || activeTab !== 'console') return
    updateBottomState()
  }, [activeTab])

  return (
    <motion.section
      initial={{ opacity: 0, y: 10, filter: 'blur(2px)' }}
      animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
      exit={{ opacity: 0, filter: 'blur(10px)', transition: { duration: 0.6, ease: 'easeOut' } }}
      className="theater-mobile-shell"
      data-testid="theater-mobile-shell"
    >
      <div className="theater-mobile-card">
        <header className="theater-mobile-header">
          <p className="theater-mobile-title">Pulse Command Center</p>
          <p className="theater-mobile-subtitle">Live execution stream for mobile.</p>
          <div className="theater-mobile-badges">
            <span className="theater-mobile-badge">Done {completedCount}</span>
            <span className="theater-mobile-badge theater-mobile-badge--running">Running {runningCount}</span>
            <span className="theater-mobile-badge">Failed {failedCount}</span>
            {allGreen && <span className="theater-mobile-badge theater-mobile-badge--green">All Systems Green</span>}
          </div>
        </header>

        <div className="theater-mobile-tabs" role="tablist" aria-label="Mobile loading tabs">
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'console'}
            className={`theater-mobile-tab ${activeTab === 'console' ? 'theater-mobile-tab--active' : ''}`}
            onClick={() => setActiveTab('console')}
          >
            Console
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'execution'}
            className={`theater-mobile-tab ${activeTab === 'execution' ? 'theater-mobile-tab--active' : ''}`}
            onClick={() => setActiveTab('execution')}
          >
            Execution
          </button>
        </div>

        <div className="theater-mobile-body">
          <AnimatePresence mode="wait" initial={false}>
            {activeTab === 'console' ? (
              <motion.div
                key="console"
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.16 }}
                className="theater-mobile-console-wrap"
              >
                <div
                  ref={logRef}
                  className="theater-mobile-console"
                  data-testid="theater-mobile-console"
                  onScroll={updateBottomState}
                >
                  {logLines.map((line) => (
                    <div key={line.id} className="theater-mobile-logline">
                      <div className="theater-mobile-logmeta">
                        <span className="theater-mobile-time">{line.time}</span>
                        <span className={statusTone(line.status)}>{line.status}</span>
                        <span className="theater-mobile-agent">{line.agent}</span>
                        {line.duration && <span className="theater-mobile-duration">{line.duration}</span>}
                      </div>
                      <p className="theater-mobile-logmsg">{line.message}</p>
                    </div>
                  ))}
                </div>
                {!isAtBottom && (
                  <button
                    type="button"
                    className="theater-mobile-jump"
                    onClick={jumpToLatest}
                  >
                    Jump to latest
                  </button>
                )}
              </motion.div>
            ) : (
              <motion.div
                key="execution"
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.16 }}
              >
                <ExecutionTree nodes={nodes} />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </motion.section>
  )
}
