import ConfidenceGauge from './ConfidenceGauge'

function MetricCard({ label, value, tone = 'blue' }) {
  const tones = {
    blue: 'text-[#60a5fa] border-[#1d4ed8]/40 bg-[#1d4ed8]/10',
    red: 'text-[#f87171] border-[#7f1d1d]/40 bg-[#7f1d1d]/10',
    amber: 'text-[#fbbf24] border-[#78350f]/40 bg-[#78350f]/10',
    green: 'text-[#4ade80] border-[#14532d]/40 bg-[#14532d]/10',
  }

  return (
    <div className="border border-[#2a2a2a] rounded-lg p-3 bg-[#111111]">
      <p className="text-[11px] uppercase tracking-widest text-[#6b7280] mb-1">{label}</p>
      <span className={`text-lg font-semibold px-2 py-0.5 rounded-md border ${tones[tone]}`}>
        {value ?? '--'}
      </span>
    </div>
  )
}

export default function DramaScoreboard({
  metrics,
  confidenceScore,
  debateTriggered,
  confidenceBreakdown,
}) {
  return (
    <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl p-4 shrink-0 w-full sm:w-[310px]">
      <p className="text-[#4b5563] text-xs uppercase tracking-widest mb-3 font-medium">
        Drama Snapshot
      </p>

      <div className="grid grid-cols-2 gap-2.5 mb-4">
        <MetricCard label="Drama" value={metrics?.drama} tone="red" />
        <MetricCard label="Polarization" value={metrics?.polarization} tone="amber" />
        <MetricCard label="Heat" value={metrics?.heat} tone="blue" />
        <MetricCard label="Flip Risk" value={metrics?.flipRisk} tone="green" />
      </div>

      <div className="border border-[#2a2a2a] rounded-xl p-3 bg-[#121212]">
        <ConfidenceGauge
          score={confidenceScore}
          debateTriggered={debateTriggered}
          breakdown={confidenceBreakdown}
        />
      </div>
    </div>
  )
}
