export default function InlineCriticNote({ annotation }) {
  if (!annotation) return null

  return (
    <div
      id={annotation.anchorId || undefined}
      className="border border-dashed border-[#3b82f6]/50 bg-[#0f172a]/35 rounded-lg px-3 py-2 mb-3"
    >
      <div className="flex items-center gap-2 mb-1">
        <span className="text-[11px] text-[#93c5fd] uppercase tracking-widest">Critic Agent</span>
        {annotation.claimId && (
          <span className="text-[11px] text-[#86efac] border border-[#14532d]/50 bg-[#14532d]/20 rounded-full px-2 py-0.5">
            {annotation.claimId}
          </span>
        )}
      </div>
      <p className="text-xs text-[#d1d5db] leading-relaxed">
        {annotation.note || 'This segment was revised for stronger evidence alignment.'}
      </p>
      {annotation.criticMessage && (
        <p className="text-[11px] text-[#6b7280] leading-relaxed mt-1">
          {annotation.criticMessage}
        </p>
      )}
    </div>
  )
}
