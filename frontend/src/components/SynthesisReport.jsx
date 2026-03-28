import { useMemo, useState } from 'react'
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

const REPORTER_SECTION_ORDER = [
  'Lead',
  'Frontline Clash',
  'Top Controversies',
  'Flip Risk Watch',
  'Why It Matters',
  'Reporter Note',
]

function parseReporterSections(markdown) {
  const text = typeof markdown === 'string' ? markdown.replace(/\r\n/g, '\n') : ''
  if (!text.trim()) return null

  const headingRegex = /^##\s+(Lead|Frontline Clash|Top Controversies|Flip Risk Watch|Why It Matters|Reporter Note)\s*$/gm
  const matches = []
  let match
  while ((match = headingRegex.exec(text)) !== null) {
    matches.push({ title: match[1], index: match.index, headingLength: match[0].length })
  }
  if (matches.length === 0) return null

  const sections = {}
  for (let i = 0; i < matches.length; i++) {
    const current = matches[i]
    const start = current.index + current.headingLength
    const end = i + 1 < matches.length ? matches[i + 1].index : text.length
    sections[current.title] = text.slice(start, end).trim()
  }
  return sections
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
  claimEvidenceMap = [],
  activeClaimId = null,
  onClaimSelect = () => {},
  revisionDelta = [],
}) {
  if (!synthesis) return null

  const reporterSections = useMemo(() => parseReporterSections(synthesis), [synthesis])

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

          {claimEvidenceMap.length > 0 && (
            <section className="mb-7">
              <h3 className="text-sm uppercase tracking-widest text-[#6b7280] mb-3">Core Claims</h3>
              <div className="space-y-2">
                {claimEvidenceMap.slice(0, 3).map((claim) => {
                  const active = claim.claimId === activeClaimId
                  return (
                    <button
                      key={claim.claimId}
                      onClick={() => onClaimSelect(claim.claimId)}
                      className={`w-full text-left rounded-lg border px-3 py-2.5 transition-colors ${
                        active
                          ? 'border-[#22c55e]/50 bg-[#14532d]/20'
                          : 'border-[#2a2a2a] bg-[#111111] hover:bg-[#151515]'
                      }`}
                    >
                      <p className="text-[11px] uppercase tracking-widest text-[#6b7280] mb-1">{claim.claimId}</p>
                      <p className="text-sm text-[#e5e7eb] leading-relaxed">{claim.claim}</p>
                      <p className="text-xs text-[#6b7280] mt-1.5">
                        Evidence links: {claim.evidenceUrls?.length ?? 0}
                      </p>
                    </button>
                  )
                })}
              </div>
              <p className="text-xs text-[#6b7280] mt-2">Click a claim to highlight related quote cards.</p>
            </section>
          )}

          {reporterSections ? (
            REPORTER_SECTION_ORDER.map((title) => {
              const content = reporterSections[title]
              if (!content) return null
              return (
                <section key={title} className="mb-7 last:mb-0">
                  <h3 className="text-sm uppercase tracking-widest text-[#6b7280] mb-2">{title}</h3>
                  {title === 'Top Controversies' ? (
                    <div className="border border-[#2a2a2a] rounded-lg p-3 bg-[#111111]">
                      <ReactMarkdown components={mdComponents}>
                        {content}
                      </ReactMarkdown>
                    </div>
                  ) : (
                    <ReactMarkdown components={mdComponents}>
                      {content}
                    </ReactMarkdown>
                  )}
                </section>
              )
            })
          ) : (
            <ReactMarkdown components={mdComponents}>
              {synthesis}
            </ReactMarkdown>
          )}

          {/* Accordions */}
          {(critique?.unsupportedClaims?.length > 0
            || critique?.biasConcerns?.length > 0
            || critique?.evidenceGaps?.length > 0
            || critique?.fluffFindings?.length > 0
            || revisionDelta?.length > 0) && (
            <div className="mt-8 space-y-3">
              <Accordion title="Unsupported Claims" items={critique?.unsupportedClaims} />
              <Accordion title="Bias Concerns"      items={critique?.biasConcerns} />
              <Accordion title="Evidence Gaps"      items={critique?.evidenceGaps} />
              <Accordion title="Fluff Findings"     items={critique?.fluffFindings} />
              <Accordion title="Revision Delta"     items={revisionDelta} />
            </div>
          )}

        </div>
      </div>
    </div>
  )
}
