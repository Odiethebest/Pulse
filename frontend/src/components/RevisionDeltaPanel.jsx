export default function RevisionDeltaPanel({
  revisionDelta = [],
  critique = null,
  revisionAnchors = [],
  onAnchorSelect = () => {},
}) {
  const delta = revisionDelta.length
    ? revisionDelta
    : (critique?.deltaHighlights || [])

  const anchors = revisionAnchors?.length
    ? revisionAnchors
    : delta.map((item, index) => ({
      anchorId: `rev-fallback-${index + 1}`,
      title: `Revision ${index + 1}`,
      detail: item,
      section: 'Reporter Note',
    }))

  const gaps = critique?.evidenceGaps || []
  const hasAny = anchors.length > 0 || gaps.length > 0
  if (!hasAny) return null

  return (
    <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl p-4">
      <p className="text-[#4b5563] text-xs uppercase tracking-widest mb-3 font-medium">
        Revision Delta
      </p>

      {anchors.length > 0 && (
        <div className="mb-3">
          <p className="text-xs text-[#9ca3af] mb-2">Jump to revised sections</p>
          <ul className="space-y-1.5">
            {anchors.slice(0, 8).map((anchor, i) => (
              <li key={anchor.anchorId || i}>
                <button
                  onClick={() => onAnchorSelect(anchor.anchorId)}
                  className="w-full text-left border border-[#2a2a2a] rounded-lg px-3 py-2 bg-[#111111] hover:bg-[#151515] transition-colors"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs text-[#6b7280]">{anchor.section || 'Reporter Note'}</span>
                    <span className="text-[11px] text-[#3b82f6]">{anchor.title || `Revision ${i + 1}`}</span>
                  </div>
                  <p className="text-sm text-[#d1d5db] leading-relaxed mt-1">
                    {anchor.detail || 'Revision detail unavailable.'}
                  </p>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {gaps.length > 0 && (
        <div>
          <p className="text-xs text-[#9ca3af] mb-2">Remaining evidence gaps</p>
          <ul className="space-y-1.5">
            {gaps.slice(0, 6).map((item, i) => (
              <li key={i} className="text-sm text-[#fca5a5] leading-relaxed flex items-start gap-2">
                <span className="text-[#ef4444] mt-1">!</span>
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
