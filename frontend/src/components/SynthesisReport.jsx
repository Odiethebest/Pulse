import { ChevronDown } from 'lucide-react'
import { useMemo, useState } from 'react'
import ReactMarkdown from 'react-markdown'

const markdownComponents = {
  p: ({ children }) => <p className="text-zinc-500 text-sm leading-relaxed mb-3 last:mb-0">{children}</p>,
  strong: ({ children }) => <strong className="text-zinc-300 font-medium">{children}</strong>,
  ul: ({ children }) => <ul className="space-y-1.5 mb-3">{children}</ul>,
  ol: ({ children }) => <ol className="space-y-1.5 mb-3 list-decimal list-inside">{children}</ol>,
  li: ({ children }) => <li className="text-zinc-500 text-sm leading-relaxed">{children}</li>,
}

function normalizeList(items = []) {
  const seen = new Set()
  return items
    .map((item) => String(item ?? '').trim())
    .filter(Boolean)
    .filter((item) => {
      if (seen.has(item)) return false
      seen.add(item)
      return true
    })
}

function parseSections(markdown) {
  const text = typeof markdown === 'string' ? markdown.replace(/\r\n/g, '\n') : ''
  if (!text.trim()) return {}

  const headingRegex = /^##\s+(.+?)\s*$/gm
  const matches = []
  let match
  while ((match = headingRegex.exec(text)) !== null) {
    matches.push({ title: match[1].trim(), index: match.index, headingLength: match[0].length })
  }
  if (matches.length === 0) return {}

  const sections = {}
  for (let i = 0; i < matches.length; i++) {
    const current = matches[i]
    const start = current.index + current.headingLength
    const end = i + 1 < matches.length ? matches[i + 1].index : text.length
    sections[current.title] = text.slice(start, end).trim()
  }
  return sections
}

export default function SynthesisReport({
  synthesis,
  critique,
  revisionDelta = [],
  revisionAnchors = [],
}) {
  const [open, setOpen] = useState(false)
  const sections = useMemo(() => parseSections(synthesis), [synthesis])
  const reporterNote = sections['Reporter Note'] || ''
  const biasConcerns = normalizeList(critique?.biasConcerns || [])
  const evidenceGaps = normalizeList(critique?.evidenceGaps || [])
  const unsupportedClaims = normalizeList(critique?.unsupportedClaims || [])
  const fluffItems = normalizeList(critique?.fluffFindings || [])
  const revisionItems = normalizeList(
    revisionDelta.length ? revisionDelta : (critique?.deltaHighlights || [])
  )
  const anchorNotes = normalizeList(
    (revisionAnchors || []).map((anchor) => `${anchor.title || 'Revision'}: ${anchor.detail || ''}`)
  )
  const hiddenGroups = useMemo(
    () => [
      revisionItems.length > 0
        ? { title: 'Revision Delta', items: revisionItems }
        : null,
      fluffItems.length > 0
        ? { title: 'Fluff Findings', items: fluffItems }
        : null,
      anchorNotes.length > 0
        ? { title: 'Revision Anchors', items: anchorNotes }
        : null,
    ].filter(Boolean),
    [anchorNotes, fluffItems, revisionItems]
  )
  const hasSummary =
    Boolean(reporterNote)
    || biasConcerns.length > 0
    || evidenceGaps.length > 0
    || unsupportedClaims.length > 0
    || hiddenGroups.length > 0

  if (!hasSummary) return null

  return (
    <section className="border border-zinc-800 rounded-xl bg-zinc-900/30">
      {(revisionAnchors || []).map((anchor) => (
        <span key={anchor.anchorId} id={anchor.anchorId} className="block relative -top-20" />
      ))}

      <div className="px-4 md:px-5 pt-4 pb-3 border-b border-zinc-800">
        <p className="font-mono uppercase tracking-widest text-xs text-zinc-500">AI Transparency &amp; Audit Log</p>
        <p className="text-zinc-600 text-xs mt-1">Execution summary remains visible. Detailed revisions are collapsible below.</p>
      </div>

      <div className="px-4 md:px-5 pt-4 pb-5 space-y-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          <div className="border border-zinc-800 rounded-lg px-3 py-2">
            <p className="text-[11px] uppercase tracking-widest text-zinc-600">Bias</p>
            <p className="text-zinc-300 text-sm mt-1">{biasConcerns.length}</p>
          </div>
          <div className="border border-zinc-800 rounded-lg px-3 py-2">
            <p className="text-[11px] uppercase tracking-widest text-zinc-600">Evidence Gaps</p>
            <p className="text-zinc-300 text-sm mt-1">{evidenceGaps.length}</p>
          </div>
          <div className="border border-zinc-800 rounded-lg px-3 py-2">
            <p className="text-[11px] uppercase tracking-widest text-zinc-600">Unsupported</p>
            <p className="text-zinc-300 text-sm mt-1">{unsupportedClaims.length}</p>
          </div>
          <div className="border border-zinc-800 rounded-lg px-3 py-2">
            <p className="text-[11px] uppercase tracking-widest text-zinc-600">Revisions</p>
            <p className="text-zinc-300 text-sm mt-1">{revisionItems.length}</p>
          </div>
        </div>

        {reporterNote && (
          <section>
            <h4 className="text-xs uppercase tracking-widest text-zinc-600 mb-2">Reporter Note</h4>
            <ReactMarkdown components={markdownComponents}>{reporterNote}</ReactMarkdown>
          </section>
        )}

        {unsupportedClaims.length > 0 && (
          <section>
            <h4 className="text-xs uppercase tracking-widest text-zinc-600 mb-2">Unsupported Claims Snapshot</h4>
            <ul className="space-y-1.5">
              {unsupportedClaims.slice(0, 3).map((item, index) => (
                <li key={`unsupported-${index}`} className="text-sm text-zinc-500 leading-relaxed">
                  {item}
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>

      {hiddenGroups.length > 0 && (
        <>
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="w-full flex items-center justify-between px-4 md:px-5 py-3.5 text-left hover:bg-zinc-800/40 transition-colors border-t border-zinc-800"
          >
            <div>
              <p className="text-zinc-400 text-sm font-medium">Detailed Revision Trace</p>
              <p className="text-zinc-600 text-xs mt-0.5">Revision Delta and Fluff Findings are stored here.</p>
            </div>
            <ChevronDown
              size={16}
              className={`text-zinc-500 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
            />
          </button>

          <div
            className={`grid transition-all duration-300 ease-out ${
              open ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'
            }`}
          >
            <div className="overflow-hidden">
              <div className="px-4 md:px-5 pb-5 border-t border-zinc-800 space-y-5 pt-4">
                {hiddenGroups.map((group) => (
                  <section key={group.title}>
                    <h4 className="text-xs uppercase tracking-widest text-zinc-600 mb-2">{group.title}</h4>
                    <ul className="space-y-1.5">
                      {group.items.map((item, index) => (
                        <li key={`${group.title}-${index}`} className="text-sm text-zinc-500 leading-relaxed">
                          {item}
                        </li>
                      ))}
                    </ul>
                  </section>
                ))}
              </div>
            </div>
          </div>
        </>
      )}
    </section>
  )
}
