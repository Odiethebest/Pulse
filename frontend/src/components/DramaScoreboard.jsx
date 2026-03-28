import {
  PolarAngleAxis,
  PolarGrid,
  Radar,
  RadarChart,
  ResponsiveContainer,
  Tooltip,
} from 'recharts'
import {
  buildSnapshotReadout,
  clampScore,
  CONFIDENCE_MAP,
  getConfidenceBand,
  metricLabel,
  normalizeMetrics,
} from '../lib/metricSemantics'

function confidenceStatus(score) {
  if (score === null) {
    return {
      label: 'Pending',
      tone: 'text-zinc-400 bg-zinc-900/60 border border-white/5',
    }
  }
  if (score < 40) {
    return {
      label: 'Low',
      tone: 'text-orange-300 bg-orange-950/30 border border-orange-500/20',
    }
  }
  if (score < 70) {
    return {
      label: 'Medium',
      tone: 'text-amber-300 bg-amber-950/30 border border-amber-500/20',
    }
  }
  return {
    label: 'High',
    tone: 'text-cyan-300 bg-cyan-950/30 border border-cyan-500/20',
  }
}

function metricTone(value) {
  if (value === null) {
    return {
      text: 'text-zinc-400',
      bar: 'bg-zinc-600',
    }
  }
  if (value >= 80) {
    return {
      text: 'text-cyan-300',
      bar: 'bg-cyan-400',
    }
  }
  if (value >= 60) {
    return {
      text: 'text-amber-300',
      bar: 'bg-amber-400',
    }
  }
  return {
    text: 'text-orange-300',
    bar: 'bg-orange-400',
  }
}

function radarRows(breakdown) {
  return [
    { name: 'Coverage', value: clampScore(breakdown?.coverage) ?? 0 },
    { name: 'Diversity', value: clampScore(breakdown?.diversity) ?? 0 },
    { name: 'Agreement', value: clampScore(breakdown?.agreement) ?? 0 },
    { name: 'Stability', value: clampScore(breakdown?.stability) ?? 0 },
    { name: 'Evidence', value: clampScore(breakdown?.evidenceSupport) ?? 0 },
  ]
}

function detailRows(breakdown, metrics) {
  return CONFIDENCE_MAP.map((row) => {
    const value = clampScore(breakdown?.[row.key])
    return {
      name: row.label === 'Evidence Support' ? 'Evidence' : row.label,
      value,
      tags: row.drivers.map((driver) => `${metricLabel(driver)} ${clampScore(metrics?.[driver]) ?? '--'}`),
      desc: row.summary,
    }
  })
}

function RadarTooltip({ active, payload }) {
  if (!active || !payload?.length) return null
  const row = payload[0]?.payload
  return (
    <div className="bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg px-2.5 py-1.5 shadow-xl">
      <p className="text-xs text-[#9ca3af]">{row?.name}</p>
      <p className="text-sm text-[#d1d5db] font-semibold mt-0.5">{row?.value ?? '--'}</p>
    </div>
  )
}

function DetailCard({ row }) {
  const tone = metricTone(row.value)
  const width = row.value ?? 0
  const slug = row.name.toLowerCase()

  return (
    <div
      data-testid={`metric-card-${slug}`}
      className="bg-zinc-900/40 border border-zinc-800 rounded-xl p-4 transition-colors hover:bg-zinc-900/60"
    >
      <div className="flex items-center justify-between gap-2 mb-2">
        <p className="text-sm font-medium text-zinc-100">{row.name}</p>
        <p className={`text-sm font-semibold ${tone.text}`}>{row.value ?? '--'}</p>
      </div>

      <div className="h-1.5 rounded-full bg-zinc-800 overflow-hidden mb-3">
        <div className={`h-full ${tone.bar}`} style={{ width: `${width}%` }} />
      </div>

      <div className="flex flex-wrap gap-1.5 mb-3">
        {row.tags.map((tag, idx) => (
          <span
            key={`${row.name}-tag-${idx}`}
            className="text-xs text-zinc-500 border border-zinc-800/50 rounded-md px-2 py-1 leading-none"
          >
            {tag}
          </span>
        ))}
      </div>

      <p className="text-xs text-zinc-400 leading-relaxed">{row.desc}</p>
    </div>
  )
}

export default function DramaScoreboard({
  metrics,
  confidenceScore,
  debateTriggered,
  confidenceBreakdown,
}) {
  const normalizedMetrics = normalizeMetrics(metrics)
  const score = clampScore(confidenceScore)
  const band = getConfidenceBand(score)
  const status = confidenceStatus(score)
  const radarData = radarRows(confidenceBreakdown)
  const cards = detailRows(confidenceBreakdown, normalizedMetrics)
  const snapshotLines = buildSnapshotReadout(normalizedMetrics, score)
  const strongestCard = [...cards]
    .filter((row) => row.value !== null)
    .sort((a, b) => (b.value ?? 0) - (a.value ?? 0))[0]
  const weakestCard = [...cards]
    .filter((row) => row.value !== null)
    .sort((a, b) => (a.value ?? 0) - (b.value ?? 0))[0]

  return (
    <section aria-label="confidence-profile-dashboard" className="rounded-2xl p-1 md:p-2">
      <div className="flex items-center justify-between gap-2 mb-5">
        <div>
          <p className="text-zinc-500 text-xs uppercase tracking-[0.16em] mb-1 font-medium">Confidence Profile</p>
          <p className="text-sm text-zinc-400">Premium score view linked to narrative drivers and volatility signals.</p>
        </div>
        {debateTriggered && (
          <span className="inline-flex items-center gap-1.5 text-xs text-zinc-400 leading-none">
            <span className="h-1.5 w-1.5 rounded-full bg-amber-300 shadow-[0_0_8px_rgba(252,211,77,0.9)]" />
            Revised after critic review
          </span>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-5 pb-5 border-b border-white/5">
        <div className="lg:col-span-2 bg-zinc-900/50 rounded-2xl p-5 flex flex-col justify-center">
          <div
            className="text-white text-6xl md:text-7xl font-extrabold leading-none tracking-tight"
            style={{ textShadow: '0 0 22px rgba(56,189,248,0.26)' }}
          >
            {score ?? '--'}
          </div>
          <div className="flex items-center gap-2 mt-2">
            <span className="text-sm text-zinc-400">Confidence</span>
            <span className={`text-xs rounded-full px-2.5 py-0.5 ${status.tone}`}>{status.label}</span>
          </div>
          <p className="text-sm text-zinc-400 leading-relaxed mt-3">{band.note}</p>
          {(strongestCard || weakestCard) && (
            <div className="space-y-1.5 mt-4">
              {strongestCard && (
                <div className="flex items-center gap-2 text-xs text-zinc-300">
                  <span className="h-1.5 w-1.5 rounded-full bg-cyan-300 shadow-[0_0_8px_rgba(34,211,238,0.8)]" />
                  <span className="text-zinc-500 uppercase tracking-wide">Strongest:</span>
                  <span>{strongestCard.name} {strongestCard.value}</span>
                </div>
              )}
              {weakestCard && (
                <div className="flex items-center gap-2 text-xs text-zinc-300">
                  <span className="h-1.5 w-1.5 rounded-full bg-orange-300 shadow-[0_0_8px_rgba(253,186,116,0.8)]" />
                  <span className="text-zinc-500 uppercase tracking-wide">Weakest:</span>
                  <span>{weakestCard.name} {weakestCard.value}</span>
                </div>
              )}
            </div>
          )}
          {snapshotLines.length > 0 && (
            <p className="text-xs text-zinc-500 leading-relaxed mt-3">{snapshotLines[0]}</p>
          )}
        </div>

        <div className="lg:col-span-3 relative min-h-[280px]">
          <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(circle_at_35%_35%,rgba(34,211,238,0.13),transparent_58%)]" />
          <div className="h-[280px] w-full relative">
            <ResponsiveContainer width="100%" height="100%">
              <RadarChart data={radarData} outerRadius="78%">
                <PolarGrid stroke="rgba(255,255,255,0.09)" />
                <PolarAngleAxis dataKey="name" tick={{ fill: '#a1a1aa', fontSize: 11 }} />
                <Tooltip content={<RadarTooltip />} />
                <Radar
                  dataKey="value"
                  stroke="#22d3ee"
                  fill="#0891b2"
                  fillOpacity={0.4}
                  strokeWidth={2.2}
                />
              </RadarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-6 gap-3 md:gap-4 mt-5">
        {cards.map((row, index) => (
          <div
            key={row.name}
            className={index < 3 ? 'md:col-span-2' : 'md:col-span-3'}
          >
            <DetailCard row={row} />
          </div>
        ))}
      </div>
    </section>
  )
}
