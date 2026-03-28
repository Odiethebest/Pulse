import { useEffect } from 'react'
import AgentGraph from './AgentGraph'
import LiveOutput from './LiveOutput'

function stateText(runStatus) {
  if (runStatus === 'loading') return 'Running'
  if (runStatus === 'complete') return 'Completed'
  if (runStatus === 'error') return 'Failed'
  return 'Idle'
}

export default function AgentTraceDrawer({
  open = false,
  onClose = () => {},
  runId = 0,
  runStatus = 'idle',
  agentEvents = [],
  liveText = '',
  isLoading = false,
}) {
  useEffect(() => {
    if (!open) return undefined
    const onKeydown = (event) => {
      if (event.key === 'Escape') {
        onClose()
      }
    }
    window.addEventListener('keydown', onKeydown)
    return () => window.removeEventListener('keydown', onKeydown)
  }, [open, onClose])

  if (!open) return null

  return (
    <div className="trace-drawer-root">
      <button
        aria-label="Close agent trace drawer"
        className="trace-drawer-backdrop"
        onClick={onClose}
      />

      <aside className="trace-drawer-panel">
        <div className="trace-drawer-header">
          <div>
            <p className="text-[#6b7280] text-xs uppercase tracking-widest mb-1">Execution Trace</p>
            <h3 className="text-white text-lg font-semibold leading-tight">Agent Chain and Logs</h3>
            <p className="text-sm text-[#9ca3af] mt-1">Status: {stateText(runStatus)}</p>
          </div>
          <button
            onClick={onClose}
            className="text-sm text-[#d1d5db] border border-[#2a2a2a] rounded-lg px-3 py-1.5 hover:bg-[#181818] transition-colors"
          >
            Close
          </button>
        </div>

        <div className="trace-drawer-body">
          <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl p-4">
            <p className="stage-title text-[#4b5563] text-xs uppercase tracking-widest mb-3 font-medium">
              Agent Execution
            </p>
            <AgentGraph key={runId} agentEvents={agentEvents} runStatus={runStatus} />
          </div>

          <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl p-4">
            <LiveOutput liveText={liveText} isLoading={isLoading} />
          </div>
        </div>
      </aside>
    </div>
  )
}
