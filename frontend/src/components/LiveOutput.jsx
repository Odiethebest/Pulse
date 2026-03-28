import { useEffect, useRef } from 'react'

const ICONS = { STARTED: '⏳', COMPLETED: '✅', FAILED: '❌' }

const LINE_RE = /^\[(STARTED|COMPLETED|FAILED)\]\s+(.+?)\s+—\s+(.*)$/

function parseLine(raw) {
  const m = raw.match(LINE_RE)
  if (!m) return { status: 'STARTED', agentName: '', summary: raw }
  return { status: m[1], agentName: m[2], summary: m[3] }
}

export default function LiveOutput({ liveText = '', isLoading = false }) {
  const scrollRef = useRef(null)
  const lines = liveText ? liveText.split('\n').filter(Boolean) : []
  const completed = lines.filter((line) => line.startsWith('[COMPLETED]')).length
  const running = lines.filter((line) => line.startsWith('[STARTED]')).length - completed
  const failed = lines.filter((line) => line.startsWith('[FAILED]')).length

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [liveText])

  return (
    <div>
      <p className="text-[#4b5563] text-xs uppercase tracking-widest mb-2 font-medium">
        Agent Log
      </p>
      <div className="flex flex-wrap gap-1.5 mb-2">
        <span className="text-[11px] text-[#9ca3af] border border-[#2a2a2a] rounded-full px-2 py-0.5">
          Running {Math.max(0, running)}
        </span>
        <span className="text-[11px] text-[#86efac] border border-[#14532d]/50 bg-[#14532d]/20 rounded-full px-2 py-0.5">
          Completed {completed}
        </span>
        <span className="text-[11px] text-[#fca5a5] border border-[#7f1d1d]/50 bg-[#7f1d1d]/20 rounded-full px-2 py-0.5">
          Failed {failed}
        </span>
      </div>

      <div
        ref={scrollRef}
        className="bg-[#0a0a0a] border border-[#2a2a2a] rounded-xl p-4 h-[300px] overflow-y-auto"
        style={{ fontFamily: 'ui-monospace, Consolas, monospace' }}
      >
        {lines.length === 0 && (
          <span className="text-[#374151] text-sm">Waiting for agents...</span>
        )}

        {lines.map((raw, i) => {
          const { status, agentName, summary } = parseLine(raw)
          const isLast = i === lines.length - 1
          return (
            <div key={i} className="log-line flex items-baseline gap-2 text-sm leading-relaxed min-w-0">
              <span className="shrink-0 text-base leading-none mt-[1px]">
                {ICONS[status] ?? '·'}
              </span>
              <span className="text-[#3b82f6] shrink-0 font-medium">{agentName}</span>
              <span className="text-[#6b7280] shrink-0">—</span>
              <span className="text-[#e5e7eb] break-all">
                {summary}
                {isLast && isLoading && (
                  <span className="cursor-blink text-[#3b82f6] ml-0.5">█</span>
                )}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
