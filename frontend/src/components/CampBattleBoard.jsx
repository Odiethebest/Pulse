function pct(v) {
  const n = Number(v ?? 0)
  return `${Math.round(Math.max(0, Math.min(1, n)) * 100)}%`
}

function CampCard({ label, value, color, blurb }) {
  return (
    <div className="border border-[#2a2a2a] rounded-lg p-3 bg-[#111111]">
      <div className="flex items-center justify-between gap-2 mb-1">
        <span className="text-xs uppercase tracking-wider text-[#6b7280]">{label}</span>
        <span className={`text-sm font-semibold ${color}`}>{pct(value)}</span>
      </div>
      <p className="text-xs text-[#9ca3af] leading-relaxed">{blurb}</p>
    </div>
  )
}

export default function CampBattleBoard({ campDistribution }) {
  if (!campDistribution) return null

  return (
    <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl p-4">
      <p className="text-[#4b5563] text-xs uppercase tracking-widest mb-3 font-medium">
        Camp Battle
      </p>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <CampCard
          label="Support"
          value={campDistribution.support}
          color="text-[#22c55e]"
          blurb="Backing the topic and amplifying positive narratives."
        />
        <CampCard
          label="Oppose"
          value={campDistribution.oppose}
          color="text-[#ef4444]"
          blurb="Rejecting claims and pushing counter arguments."
        />
        <CampCard
          label="Neutral"
          value={campDistribution.neutral}
          color="text-[#9ca3af]"
          blurb="Watching, questioning, or sharing without strong stance."
        />
      </div>
    </div>
  )
}
