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

      <div
        ref={scrollRef}
        className="bg-[#0a0a0a] border border-[#2a2a2a] rounded-xl p-4 h-[180px] overflow-y-auto"
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
