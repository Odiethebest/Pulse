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
      tone: 'text-[#9ca3af] border-[#2a2a2a] bg-[#111111]',
    }
  }
  if (score < 40) {
    return {
      label: 'Low',
      tone: 'text-[#fca5a5] border-[#7f1d1d]/60 bg-[#7f1d1d]/20',
    }
  }
  if (score < 70) {
    return {
      label: 'Medium',
      tone: 'text-[#fde68a] border-[#78350f]/60 bg-[#78350f]/20',
    }
  }
  return {
    label: 'High',
    tone: 'text-[#67e8f9] border-[#0e7490]/60 bg-[#0e7490]/20',
  }
}

function metricTone(value) {
  if (value === null) {
    return {
      text: 'text-[#9ca3af]',
      bar: 'bg-[#4b5563]',
      chip: 'bg-[#111827]',
      border: 'border-[#2a2a2a]',
    }
  }
  if (value >= 80) {
    return {
      text: 'text-[#67e8f9]',
      bar: 'bg-[#06b6d4]',
      border: 'border-[#0e7490]/60',
    }
  }
  if (value >= 50) {
    return {
      text: 'text-[#fde68a]',
      bar: 'bg-[#eab308]',
      border: 'border-[#a16207]/60',
    }
  }
  return {
    text: 'text-[#fdba74]',
    bar: 'bg-[#f97316]',
    border: 'border-[#9a3412]/60',
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
      className={`bg-zinc-900 border rounded-xl p-3.5 transition-colors hover:bg-zinc-800/70 ${tone.border}`}
    >
      <div className="flex items-center justify-between gap-2 mb-2">
        <p className={`text-sm font-medium ${tone.text}`}>{row.name}</p>
        <p className={`text-sm font-semibold ${tone.text}`}>{row.value ?? '--'}</p>
      </div>

      <div className="h-1.5 rounded-full bg-zinc-800 overflow-hidden mb-2.5">
        <div className={`h-full ${tone.bar}`} style={{ width: `${width}%` }} />
      </div>

      <div className="flex flex-wrap gap-1.5 mb-2.5">
        {row.tags.map((tag, idx) => (
          <span
            key={`${row.name}-tag-${idx}`}
            className="text-[11px] px-2 py-0.5 rounded-full bg-zinc-800 text-zinc-400 border border-zinc-700"
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
    <section
      aria-label="confidence-profile-dashboard"
      className="bg-[#161616] border border-[#2a2a2a] rounded-2xl p-4 md:p-5"
    >
      <div className="flex items-center justify-between gap-2 mb-4">
        <div>
          <p className="text-[#4b5563] text-xs uppercase tracking-widest mb-1 font-medium">Confidence Profile</p>
          <p className="text-sm text-[#9ca3af]">A single view from score to drivers, aligned with live drama signals.</p>
        </div>
        {debateTriggered && (
          <span className="text-xs text-[#eab308] border border-[#eab308]/30 bg-[#eab308]/5 rounded-full px-3 py-1 leading-none w-fit">
            Revised after critic review
          </span>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 mb-4">
        <div className="lg:col-span-2 border border-[#2a2a2a] bg-[#111111] rounded-xl p-4 flex flex-col justify-center">
          <div
            className="text-white text-6xl md:text-7xl font-extrabold leading-none tracking-tight"
            style={{ textShadow: '0 0 20px rgba(59,130,246,0.28)' }}
          >
            {score ?? '--'}
          </div>
          <div className="flex items-center gap-2 mt-2">
            <span className="text-sm text-[#9ca3af]">Confidence</span>
            <span className={`text-xs rounded-full border px-2 py-0.5 ${status.tone}`}>{status.label}</span>
          </div>
          <p className="text-sm text-gray-400 leading-relaxed mt-3">{band.note}</p>
          {(strongestCard || weakestCard) && (
            <div className="flex flex-wrap gap-1.5 mt-3">
              {strongestCard && (
                <span className="text-[11px] px-2 py-0.5 rounded-full bg-zinc-800 text-zinc-300 border border-zinc-700">
                  Strongest {strongestCard.name} {strongestCard.value}
                </span>
              )}
              {weakestCard && (
                <span className="text-[11px] px-2 py-0.5 rounded-full bg-zinc-800 text-zinc-300 border border-zinc-700">
                  Weakest {weakestCard.name} {weakestCard.value}
                </span>
              )}
            </div>
          )}
          {snapshotLines.length > 0 && (
            <p className="text-xs text-zinc-500 leading-relaxed mt-2">{snapshotLines[0]}</p>
          )}
        </div>

        <div className="lg:col-span-3 border border-[#2a2a2a] bg-[#111111] rounded-xl p-3">
          <div className="h-[280px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <RadarChart data={radarData} outerRadius="78%">
                <PolarGrid stroke="#2a2a2a" />
                <PolarAngleAxis dataKey="name" tick={{ fill: '#a1a1aa', fontSize: 11 }} />
                <Tooltip content={<RadarTooltip />} />
                <Radar
                  dataKey="value"
                  stroke="#22d3ee"
                  fill="#06b6d4"
                  fillOpacity={0.4}
                  strokeWidth={2.2}
                />
              </RadarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {cards.map((row) => (
          <DetailCard key={row.name} row={row} />
        ))}
      </div>
    </section>
  )
}
