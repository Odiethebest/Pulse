import {
  AlertTriangle,
  ChevronDown,
  FileWarning,
  RefreshCcw,
  ShieldAlert,
} from 'lucide-react'
import { useMemo, useState } from 'react'

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

function compactText(value, max = 140) {
  const text = String(value ?? '').replace(/\s+/g, ' ').trim()
  if (text.length <= max) return text
  return `${text.slice(0, max - 1)}…`
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

function sanitizeMarkdownBlock(text) {
  return String(text ?? '')
    .replace(/^[*-]\s+/gm, '')
    .replace(/\n+/g, ' ')
    .trim()
}

function healthTone(count) {
  if (count === 0) {
    return 'text-emerald-300/80 border-emerald-500/20 bg-emerald-500/5'
  }
  if (count <= 2) {
    return 'text-amber-200/80 border-amber-500/20 bg-amber-500/5'
  }
  return 'text-rose-200/80 border-rose-500/20 bg-rose-500/5'
}

export default function SynthesisReport({
  synthesis,
  critique,
  revisionDelta = [],
  revisionAnchors = [],
}) {
  const [open, setOpen] = useState(false)
  const sections = useMemo(() => parseSections(synthesis), [synthesis])
  const reporterNote = compactText(sanitizeMarkdownBlock(sections['Reporter Note']), 180)
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

  const healthBadges = useMemo(
    () => [
      { key: 'gaps', label: 'Evidence Gaps', count: evidenceGaps.length, icon: AlertTriangle },
      { key: 'bias', label: 'Bias Concerns', count: biasConcerns.length, icon: ShieldAlert },
      { key: 'unsupported', label: 'Unsupported Claims', count: unsupportedClaims.length, icon: FileWarning },
      { key: 'revisions', label: 'Revisions Applied', count: revisionItems.length, icon: RefreshCcw },
    ],
    [biasConcerns.length, evidenceGaps.length, revisionItems.length, unsupportedClaims.length]
  )

  const actionItems = useMemo(
    () => [
      ...evidenceGaps.map((text) => ({ label: 'EVIDENCE', text: compactText(text), dot: 'bg-amber-400/80' })),
      ...biasConcerns.map((text) => ({ label: 'BIAS', text: compactText(text), dot: 'bg-amber-300/80' })),
      ...unsupportedClaims.map((text) => ({ label: 'CLAIM', text: compactText(text), dot: 'bg-rose-400/80' })),
      ...(reporterNote ? [{ label: 'REPORTER', text: compactText(reporterNote), dot: 'bg-zinc-500/80' }] : []),
    ].slice(0, 8),
    [biasConcerns, evidenceGaps, reporterNote, unsupportedClaims]
  )

  const hiddenGroups = useMemo(
    () => [
      revisionItems.length > 0
        ? { title: 'Revision Trace', items: revisionItems }
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
    healthBadges.some((item) => item.count > 0)
    || actionItems.length > 0
    || hiddenGroups.length > 0

  if (!hasSummary) return null

  return (
    <section className="border border-zinc-800 rounded-xl bg-zinc-900/30 overflow-hidden">
      {(revisionAnchors || []).map((anchor) => (
        <span key={anchor.anchorId} id={anchor.anchorId} className="block relative -top-20" />
      ))}

      <div className="px-4 md:px-5 py-4 border-b border-zinc-800">
        <p className="font-mono uppercase tracking-[0.18em] text-xs text-zinc-500">Data Integrity &amp; Trust</p>
        <p className="text-zinc-600 text-xs mt-1">Critic checks are condensed into status badges and a compact action queue.</p>
      </div>

      <div className="px-4 md:px-5 py-4 space-y-4">
        <div className="flex flex-wrap gap-2">
          {healthBadges.map((item) => {
            const Icon = item.icon
            return (
              <div
                key={item.key}
                className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs ${healthTone(item.count)}`}
              >
                <Icon size={13} />
                <span>{item.label}</span>
                <span className="font-semibold">{item.count}</span>
              </div>
            )
          })}
        </div>

        <div className="rounded-lg border border-zinc-800 bg-[#0f0f0f] px-3 py-3">
          <div className="flex items-center justify-between gap-2 mb-2">
            <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-zinc-500">Action Items</p>
            <p className="text-[11px] text-zinc-600">{actionItems.length} open</p>
          </div>

          {actionItems.length > 0 ? (
            <ul className="space-y-1.5">
              {actionItems.map((item, index) => (
                <li
                  key={`${item.label}-${index}`}
                  className="flex items-start gap-2 text-sm text-zinc-400 leading-relaxed"
                >
                  <span className={`h-1.5 w-1.5 rounded-full mt-1.5 shrink-0 ${item.dot}`} />
                  <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-zinc-600 mt-0.5">{item.label}</span>
                  <span className="flex-1 min-w-0">{item.text}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="font-mono text-xs text-emerald-300/80">No open integrity action items for this run.</p>
          )}
        </div>
      </div>

      {hiddenGroups.length > 0 && (
        <>
          <button
            type="button"
            onClick={() => setOpen((value) => !value)}
            className="w-full flex items-center justify-between px-4 md:px-5 py-3.5 text-left hover:bg-zinc-800/40 transition-colors border-t border-zinc-800"
          >
            <div>
              <p className="text-zinc-400 text-sm font-medium">Inspect Detailed Audit Trail</p>
              <p className="text-zinc-600 text-xs mt-0.5">Granular revision notes and fluff diagnostics.</p>
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
