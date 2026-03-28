function stateMeta(overallState) {
  if (overallState === 'running') {
    return {
      label: 'Agents Running',
      tone: 'text-[#93c5fd] border-[#1d4ed8]/50 bg-[#1d4ed8]/20',
      dot: 'bg-[#3b82f6]',
    }
  }
  if (overallState === 'complete') {
    return {
      label: 'All Agents Completed',
      tone: 'text-[#86efac] border-[#14532d]/50 bg-[#14532d]/20',
      dot: 'bg-[#22c55e]',
    }
  }
  if (overallState === 'warning') {
    return {
      label: 'Completed With Fallbacks',
      tone: 'text-[#fde68a] border-[#78350f]/50 bg-[#78350f]/20',
      dot: 'bg-[#eab308]',
    }
  }
  if (overallState === 'failed') {
    return {
      label: 'Run Failed',
      tone: 'text-[#fca5a5] border-[#7f1d1d]/50 bg-[#7f1d1d]/20',
      dot: 'bg-[#ef4444]',
    }
  }
  return {
    label: 'Awaiting Run',
    tone: 'text-[#9ca3af] border-[#2a2a2a] bg-[#111111]',
    dot: 'bg-[#6b7280]',
  }
}

function CountPill({ label, value, tone }) {
  return (
    <span className={`text-[11px] px-2 py-0.5 rounded-full border ${tone}`}>
      {label} {value}
    </span>
  )
}

export default function GlobalRunStatus({
  runStatus = 'idle',
  agentSummary = null,
  onOpenTrace = () => {},
}) {
  const summary = agentSummary ?? {
    running: 0,
    completed: 0,
    failed: 0,
    total: 0,
    overallState: runStatus === 'loading' ? 'running' : runStatus,
  }
  const meta = stateMeta(summary.overallState)
  const canOpen = runStatus !== 'idle'

  return (
    <div className="global-run-status border border-[#2a2a2a] bg-[#101010]/95 rounded-xl px-3 py-2.5 shadow-[0_8px_30px_rgba(0,0,0,0.35)] backdrop-blur-sm">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <span className={`w-2 h-2 rounded-full shrink-0 ${meta.dot}`} />
          <span className={`text-xs px-2 py-0.5 rounded-full border ${meta.tone}`}>{meta.label}</span>
        </div>
        <button
          onClick={onOpenTrace}
          disabled={!canOpen}
          className="text-xs text-[#d1d5db] border border-[#2a2a2a] rounded-lg px-2.5 py-1 hover:bg-[#181818] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          View Trace
        </button>
      </div>

      <div className="flex flex-wrap gap-1.5 mt-2">
        <CountPill
          label="Running"
          value={summary.running}
          tone="text-[#93c5fd] border-[#1d4ed8]/50 bg-[#1d4ed8]/20"
        />
        <CountPill
          label="Completed"
          value={summary.completed}
          tone="text-[#86efac] border-[#14532d]/50 bg-[#14532d]/20"
        />
        <CountPill
          label="Failed"
          value={summary.failed}
          tone="text-[#fca5a5] border-[#7f1d1d]/50 bg-[#7f1d1d]/20"
        />
      </div>
    </div>
  )
}
