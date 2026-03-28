export default function RevisionDeltaPanel({ revisionDelta = [], critique = null }) {
  const delta = revisionDelta.length
    ? revisionDelta
    : (critique?.deltaHighlights || [])

  const gaps = critique?.evidenceGaps || []
  const hasAny = delta.length > 0 || gaps.length > 0
  if (!hasAny) return null

  return (
    <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl p-4">
      <p className="text-[#4b5563] text-xs uppercase tracking-widest mb-3 font-medium">
        Revision Delta
      </p>

      {delta.length > 0 && (
        <div className="mb-3">
          <p className="text-xs text-[#9ca3af] mb-2">What changed after critic review</p>
          <ul className="space-y-1.5">
            {delta.slice(0, 6).map((item, i) => (
              <li key={i} className="text-sm text-[#d1d5db] leading-relaxed flex items-start gap-2">
                <span className="text-[#22c55e] mt-1">✓</span>
                <span>{item}</span>
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
