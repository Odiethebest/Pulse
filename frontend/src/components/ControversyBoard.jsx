import { useEffect, useState } from 'react'

function clampHeat(value) {
  const n = Number(value ?? 0)
  if (Number.isNaN(n)) return 0
  return Math.max(0, Math.min(100, Math.round(n)))
}

function heatColor(heat) {
  if (heat >= 70) return 'bg-[#ef4444]'
  if (heat >= 40) return 'bg-[#eab308]'
  return 'bg-[#22c55e]'
}

function platformTone(platform) {
  if (platform === 'Reddit') {
    return 'text-[#fdba74] border-[#9a3412]/60 bg-[#7c2d12]/20'
  }
  return 'text-[#93c5fd] border-[#1d4ed8]/50 bg-[#1d4ed8]/20'
}

function Chevron({ open }) {
  return (
    <svg
      width={14}
      height={14}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ transform: open ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.25s ease' }}
      className="text-[#6b7280]"
    >
      <polyline points="6 9 12 15 18 9" />
    </svg>
  )
}

function QuoteBubble({ quote }) {
  return (
    <div className="rounded-lg border border-[#2a2a2a] bg-[#0f0f0f] px-3 py-2">
      <p className="text-xs text-[#d1d5db] leading-relaxed line-clamp-3">
        &ldquo;{quote?.text || 'No quote text'}&rdquo;
      </p>
      {quote?.platform && (
        <span className={`inline-flex mt-2 text-[11px] rounded-full border px-2 py-0.5 ${platformTone(quote.platform)}`}>
          {quote.platform}
        </span>
      )}
    </div>
  )
}

export default function ControversyBoard({
  items = [],
  activeAspect = null,
  onAspectSelect = () => {},
}) {
  const [openAspect, setOpenAspect] = useState(null)

  useEffect(() => {
    if (activeAspect) {
      setOpenAspect(activeAspect)
    }
  }, [activeAspect])

  if (!items.length) return null

  return (
    <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl p-4">
      <p className="text-[#4b5563] text-xs uppercase tracking-widest mb-3 font-medium">
        Controversy Board
      </p>

      <div className="space-y-2.5">
        {items.map((item) => {
          const heat = clampHeat(item?.heat)
          const isOpen = openAspect === item.aspect
          const isActive = activeAspect === item.aspect

          return (
            <div
              key={item.id}
              className={`border rounded-lg overflow-hidden transition-colors ${
                isActive
                  ? 'border-[#3b82f6]/50 bg-[#0f172a]/35'
                  : 'border-[#2a2a2a] bg-[#111111]'
              }`}
            >
              <button
                type="button"
                onClick={() => {
                  const next = isOpen ? null : item.aspect
                  setOpenAspect(next)
                  onAspectSelect(next)
                }}
                className="w-full px-3 py-3 text-left flex items-start justify-between gap-3 hover:bg-white/[0.02] transition-colors"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 mb-2 flex-wrap">
                    <p className="text-sm text-[#e5e7eb] font-medium">{item?.aspect || 'General'}</p>
                    <span className="text-xs text-[#9ca3af]">Heat {heat}</span>
                    {item.platformTags?.map((tag) => (
                      <span
                        key={`${item.id}-${tag.platform}`}
                        className={`text-[11px] rounded-full border px-2 py-0.5 ${platformTone(tag.platform)}`}
                      >
                        {tag.label}
                      </span>
                    ))}
                  </div>

                  <div className="w-full h-1.5 rounded-full bg-[#2a2a2a] overflow-hidden mb-2">
                    <div
                      className={`h-full ${heatColor(heat)}`}
                      style={{ width: `${heat}%` }}
                    />
                  </div>

                  <p className="text-xs text-[#9ca3af] leading-relaxed line-clamp-2">
                    {item?.summary || 'No summary available.'}
                  </p>
                </div>
                <Chevron open={isOpen} />
              </button>

              {isOpen && (
                <div className="px-3 pb-3">
                  <div className="border-t border-[#2a2a2a] pt-3">
                    <p className="text-[11px] uppercase tracking-widest text-[#6b7280] mb-2">Representative Voices</p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                      {(item.quotes ?? []).slice(0, 4).map((quote, index) => (
                        <QuoteBubble key={`${item.id}-quote-${index}`} quote={quote} />
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
