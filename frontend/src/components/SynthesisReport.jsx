import { useState } from 'react'
import ReactMarkdown from 'react-markdown'

const mdComponents = {
  h1: ({ children }) => <h2 className="text-xl font-semibold text-white mt-8 mb-3 first:mt-0">{children}</h2>,
  h2: ({ children }) => <h2 className="text-lg font-semibold text-white mt-8 mb-3 first:mt-0">{children}</h2>,
  h3: ({ children }) => <h3 className="text-base font-semibold text-[#e5e7eb] mt-6 mb-2">{children}</h3>,
  p:  ({ children }) => <p className="text-[#d1d5db] text-base leading-[1.8] mb-4 last:mb-0">{children}</p>,
  strong: ({ children }) => <strong className="text-white font-semibold">{children}</strong>,
  em:     ({ children }) => <em className="text-[#d1d5db] italic">{children}</em>,
  ul: ({ children }) => <ul className="space-y-1.5 mb-4 pl-1">{children}</ul>,
  ol: ({ children }) => <ol className="space-y-1.5 mb-4 pl-1 list-decimal list-inside">{children}</ol>,
  li: ({ children }) => (
    <li className="flex items-start gap-2.5 text-[#d1d5db] leading-relaxed">
      <span className="text-[#4b5563] mt-[7px] shrink-0 text-xs">▸</span>
      <span>{children}</span>
    </li>
  ),
  blockquote: ({ children }) => (
    <blockquote className="border-l-2 border-[#3b82f6] pl-4 my-4 text-[#9ca3af] italic">{children}</blockquote>
  ),
  hr: () => <hr className="border-[#2a2a2a] my-6" />,
}

function ChevronIcon({ open }) {
  return (
    <svg
      width={16} height={16} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"
      style={{ transform: open ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.3s ease' }}
      className="text-[#6b7280] shrink-0"
    >
      <polyline points="6 9 12 15 18 9" />
    </svg>
  )
}

function Accordion({ title, items }) {
  const [open, setOpen] = useState(false)

  if (!items?.length) return null

  return (
    <div className="border border-[#2a2a2a] rounded-xl overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-5 py-3.5 text-left hover:bg-white/[0.02] transition-colors"
      >
        <span className="text-[#9ca3af] text-sm font-medium">{title}</span>
        <div className="flex items-center gap-2">
          <span className="text-[#4b5563] text-xs">{items.length}</span>
          <ChevronIcon open={open} />
        </div>
      </button>

      {/* grid-template-rows trick for smooth height animation without JS measurement */}
      <div style={{
        display: 'grid',
        gridTemplateRows: open ? '1fr' : '0fr',
        transition: 'grid-template-rows 0.3s ease',
      }}>
        <div style={{ overflow: 'hidden' }}>
          <ul className="px-5 pb-4 pt-1 space-y-2 border-t border-[#2a2a2a]">
            {items.map((item, i) => (
              <li key={i} className="flex items-start gap-2.5 text-sm text-[#9ca3af] leading-relaxed">
                <span className="text-[#3b3b3b] mt-[5px] shrink-0">•</span>
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  )
}

function TopicHeat({ topic }) {
  const heat = Math.max(0, Math.min(100, Number(topic?.heat ?? 0)))
  const tone = heat >= 70 ? 'text-[#ef4444] border-[#ef4444]/30 bg-[#ef4444]/10'
    : heat >= 40 ? 'text-[#eab308] border-[#eab308]/30 bg-[#eab308]/10'
      : 'text-[#22c55e] border-[#22c55e]/30 bg-[#22c55e]/10'
  return (
    <span className={`text-xs rounded-full px-2 py-0.5 border ${tone}`}>
      Heat {heat}
    </span>
  )
}

export default function SynthesisReport({
  synthesis,
  critique,
  debateTriggered,
  quickTake = [],
  controversyTopics = [],
  flipSignals = [],
  revisionDelta = [],
}) {
  if (!synthesis) return null

  return (
    <div>
      <h2 className="text-2xl font-bold text-white mb-4">Analysis</h2>

      <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl p-5 md:p-8">
        <div className="max-w-[720px] mx-auto">

          {/* Debate banner */}
          {debateTriggered && (
            <div className="flex items-center gap-3 border-l-2 border-[#eab308] pl-4 py-1 mb-6">
              <span className="text-base leading-none">🔄</span>
              <p className="text-[#eab308] text-sm leading-relaxed">
                This report was revised following critic review.
              </p>
            </div>
          )}

          {quickTake.length > 0 && (
            <section className="mb-7">
              <h3 className="text-sm uppercase tracking-widest text-[#6b7280] mb-2">Quick Take</h3>
              <ul className="space-y-2">
                {quickTake.slice(0, 3).map((line, i) => (
                  <li key={i} className="text-[#e5e7eb] text-sm leading-relaxed flex items-start gap-2">
                    <span className="text-[#3b82f6] mt-1">•</span>
                    <span>{line}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {controversyTopics.length > 0 && (
            <section className="mb-7">
              <h3 className="text-sm uppercase tracking-widest text-[#6b7280] mb-3">Controversy Heatmap</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {controversyTopics.slice(0, 6).map((topic, i) => (
                  <div key={i} className="border border-[#2a2a2a] rounded-lg p-3 bg-[#111111]">
                    <div className="flex items-center justify-between gap-2 mb-1.5">
                      <p className="text-[#d1d5db] text-sm font-medium">{topic?.aspect || 'General'}</p>
                      <TopicHeat topic={topic} />
                    </div>
                    <p className="text-[#9ca3af] text-xs leading-relaxed">{topic?.summary || 'No summary provided'}</p>
                  </div>
                ))}
              </div>
            </section>
          )}

          {flipSignals.length > 0 && (
            <section className="mb-7">
              <h3 className="text-sm uppercase tracking-widest text-[#6b7280] mb-2">Flip Risk Watch</h3>
              <ul className="space-y-2">
                {flipSignals.slice(0, 5).map((signal, i) => (
                  <li key={i} className="text-sm text-[#fca5a5] leading-relaxed">
                    {signal?.summary || signal?.signal || 'Narrative instability detected'}
                  </li>
                ))}
              </ul>
            </section>
          )}

          {/* Synthesis prose — rendered as markdown */}
          <ReactMarkdown components={mdComponents}>
            {synthesis}
          </ReactMarkdown>

          {/* Accordions */}
          {(critique?.unsupportedClaims?.length > 0
            || critique?.biasConcerns?.length > 0
            || critique?.evidenceGaps?.length > 0
            || revisionDelta?.length > 0) && (
            <div className="mt-8 space-y-3">
              <Accordion title="Unsupported Claims" items={critique?.unsupportedClaims} />
              <Accordion title="Bias Concerns"      items={critique?.biasConcerns} />
              <Accordion title="Evidence Gaps"      items={critique?.evidenceGaps} />
              <Accordion title="Revision Delta"     items={revisionDelta} />
            </div>
          )}

        </div>
      </div>
    </div>
  )
}
