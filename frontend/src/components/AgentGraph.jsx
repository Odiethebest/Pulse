import { useMemo } from 'react'
import { ReactFlow, Handle, Position } from '@xyflow/react'
import '@xyflow/react/dist/style.css'

// --- agent name → node id resolution ---
const MATCH = {
  queryPlanner:     (e) => /queryplanner/i.test(e.agentName),
  reddit:           (e) => /reddit/i.test(e.agentName) && !/sentiment/i.test(e.agentName),
  twitter:          (e) => /twitter/i.test(e.agentName) && !/sentiment/i.test(e.agentName),
  sentimentReddit:  (e) =>
    /sentiment/i.test(e.agentName) && /reddit/i.test(e.summary || ''),
  sentimentTwitter: (e) =>
    /sentiment/i.test(e.agentName) && /twitter/i.test(e.summary || ''),
  stance:           (e) => /stance/i.test(e.agentName),
  conflict:         (e) => /conflict/i.test(e.agentName),
  aspect:           (e) => /aspect/i.test(e.agentName),
  flipRisk:         (e) => /fliprisk/i.test(e.agentName),
  synthesis:        (e) => /synthesis/i.test(e.agentName),
  critic:           (e) => /critic/i.test(e.agentName),
}

function resolveState(id, events, runStatus) {
  if (id === 'final') {
    if (runStatus === 'complete') return 'complete'
    if (runStatus === 'error') return 'failed'
    if (runStatus === 'loading' && events.length > 0) return 'running'
    return 'idle'
  }

  const m = MATCH[id]
  const evts = events.filter(m)
  if (evts.some(e => e.status === 'FAILED'))    return 'failed'
  if (evts.some(e => e.status === 'COMPLETED')) return 'complete'
  if (evts.some(e => e.status === 'STARTED'))   return 'running'
  return 'idle'
}

function resolveDuration(id, events) {
  if (id === 'final') return null
  const m = MATCH[id]
  return events.find(e => m(e) && e.status === 'COMPLETED')?.durationMs ?? null
}

// --- static layout ---
const CY = 94   // center row y
const TY = 20   // top parallel y
const BY = 170  // bottom parallel y
const XS = 180  // x step between columns

const STATIC_NODES = [
  { id: 'queryPlanner',     label: 'QueryPlanner',      x: 0,      y: CY },
  { id: 'reddit',           label: 'Reddit',             x: XS,     y: TY },
  { id: 'twitter',          label: 'Twitter',            x: XS,     y: BY },
  { id: 'sentimentReddit',  label: 'Sentiment·Reddit',   x: XS * 2, y: TY },
  { id: 'sentimentTwitter', label: 'Sentiment·Twitter',  x: XS * 2, y: BY },
  { id: 'stance',           label: 'Stance',             x: XS * 3, y: 0 },
  { id: 'conflict',         label: 'Conflict',           x: XS * 3, y: 64 },
  { id: 'aspect',           label: 'Aspect',             x: XS * 3, y: 128 },
  { id: 'flipRisk',         label: 'FlipRisk',           x: XS * 3, y: 192 },
  { id: 'synthesis',        label: 'Synthesis',          x: XS * 4, y: CY },
  { id: 'critic',           label: 'Critic',             x: XS * 5, y: CY },
  { id: 'final',            label: 'Final',              x: XS * 6, y: CY },
]

const STATIC_EDGES = [
  { id: 'e-qp-r',  source: 'queryPlanner',     target: 'reddit' },
  { id: 'e-qp-t',  source: 'queryPlanner',     target: 'twitter' },
  { id: 'e-r-sr',  source: 'reddit',           target: 'sentimentReddit' },
  { id: 'e-t-st',  source: 'twitter',          target: 'sentimentTwitter' },
  { id: 'e-sr-st', source: 'sentimentReddit',  target: 'stance' },
  { id: 'e-st-st', source: 'sentimentTwitter', target: 'stance' },
  { id: 'e-sr-co', source: 'sentimentReddit',  target: 'conflict' },
  { id: 'e-st-co', source: 'sentimentTwitter', target: 'conflict' },
  { id: 'e-sr-as', source: 'sentimentReddit',  target: 'aspect' },
  { id: 'e-st-as', source: 'sentimentTwitter', target: 'aspect' },
  { id: 'e-sr-fr', source: 'sentimentReddit',  target: 'flipRisk' },
  { id: 'e-st-fr', source: 'sentimentTwitter', target: 'flipRisk' },
  { id: 'e-stn-sy', source: 'stance',          target: 'synthesis' },
  { id: 'e-cf-sy',  source: 'conflict',        target: 'synthesis' },
  { id: 'e-as-sy',  source: 'aspect',          target: 'synthesis' },
  { id: 'e-fr-sy',  source: 'flipRisk',        target: 'synthesis' },
  { id: 'e-sy-cr', source: 'synthesis',        target: 'critic' },
  { id: 'e-cr-fn', source: 'critic',           target: 'final' },
]

// --- custom node component ---
function AgentNode({ data }) {
  const { label, state, duration } = data
  const isRunning = state === 'running'
  const isDimmed  = state === 'idle'

  const borderColor = {
    idle:     '#2a2a2a',
    running:  '#3b82f6',
    complete: '#22c55e',
    failed:   '#ef4444',
  }[state]

  return (
    <div
      className={isRunning ? 'agent-node-pulse' : ''}
      style={{
        width: 155,
        background: '#1a1a1a',
        border: `1px solid ${borderColor}`,
        borderRadius: 10,
        padding: '10px 14px 10px 11px',
        position: 'relative',
        opacity: isDimmed ? 0.45 : 1,
        transition: 'border-color 0.3s ease, opacity 0.3s ease',
      }}
    >
      <Handle
        type="target"
        position={Position.Left}
        style={{ opacity: 0, width: 1, height: 1, minWidth: 1, minHeight: 1 }}
      />

      <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
        <StatusIcon state={state} />
        <span style={{
          color: isDimmed ? '#6b7280' : '#e5e7eb',
          fontSize: 13,
          fontWeight: 500,
          fontFamily: 'Inter, system-ui, sans-serif',
          letterSpacing: '0.01em',
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          transition: 'color 0.3s ease',
        }}>
          {label}
        </span>
      </div>

      {state === 'complete' && duration !== null && (
        <span style={{
          position: 'absolute',
          bottom: 4,
          right: 7,
          fontSize: 11,
          color: '#4b5563',
          fontFamily: 'Inter, system-ui, sans-serif',
          letterSpacing: '0.02em',
        }}>
          {(duration / 1000).toFixed(1)}s
        </span>
      )}

      <Handle
        type="source"
        position={Position.Right}
        style={{ opacity: 0, width: 1, height: 1, minWidth: 1, minHeight: 1 }}
      />
    </div>
  )
}

function StatusIcon({ state }) {
  if (state === 'running') {
    return (
      <svg className="animate-spin" width={15} height={15} viewBox="0 0 24 24" fill="none" stroke="#3b82f6" strokeWidth="2.5" style={{ flexShrink: 0 }}>
        <circle cx="12" cy="12" r="10" strokeOpacity="0.25" />
        <path d="M12 2a10 10 0 0 1 10 10" strokeLinecap="round" />
      </svg>
    )
  }
  if (state === 'complete') {
    return (
      <svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
        <polyline points="20 6 9 17 4 12" />
      </svg>
    )
  }
  if (state === 'failed') {
    return (
      <svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2.5" strokeLinecap="round" style={{ flexShrink: 0 }}>
        <line x1="18" y1="6" x2="6" y2="18" />
        <line x1="6" y1="6" x2="18" y2="18" />
      </svg>
    )
  }
  // idle
  return (
    <svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke="#374151" strokeWidth="2" style={{ flexShrink: 0 }}>
      <circle cx="12" cy="12" r="8" />
    </svg>
  )
}

const nodeTypes = { agentNode: AgentNode }

export default function AgentGraph({ agentEvents = [], runStatus = 'idle' }) {
  const safeEvents = useMemo(
    () => (Array.isArray(agentEvents) ? agentEvents.filter((e) => e && typeof e === 'object') : []),
    [agentEvents]
  )

  const nodes = useMemo(() =>
    STATIC_NODES.map(({ id, label, x, y }) => ({
      id,
      type: 'agentNode',
      position: { x, y },
      data: {
        label,
        state: resolveState(id, safeEvents, runStatus),
        duration: resolveDuration(id, safeEvents),
      },
      draggable: false,
      selectable: false,
      connectable: false,
    })),
    [safeEvents, runStatus]
  )

  const edges = useMemo(() =>
    STATIC_EDGES.map(({ id, source, target }) => {
      const srcState = resolveState(source, safeEvents, runStatus)
      const stroke =
        srcState === 'complete' ? '#22c55e' :
        srcState === 'running'  ? '#3b82f6' :
        '#2a2a2a'
      return {
        id,
        source,
        target,
        animated: srcState === 'running',
        style: { stroke, strokeWidth: 1.5 },
      }
    }),
    [safeEvents, runStatus]
  )

  return (
    <div className="overflow-x-auto rounded-xl border border-[#2a2a2a]">
      <div style={{ height: 300, minWidth: 1220 }}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        fitView
        fitViewOptions={{ padding: 0.12 }}
        nodesDraggable={false}
        nodesConnectable={false}
        elementsSelectable={false}
        panOnDrag={false}
        zoomOnScroll={false}
        zoomOnPinch={false}
        zoomOnDoubleClick={false}
        preventScrolling={false}
        proOptions={{ hideAttribution: true }}
        style={{ background: '#0f0f0f' }}
      />
      </div>
    </div>
  )
}
