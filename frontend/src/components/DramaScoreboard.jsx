import ConfidenceGauge from './ConfidenceGauge'
import ConfidenceRadar from './ConfidenceRadar'
import {
  clampScore,
  CONFIDENCE_MAP,
  getConfidenceBand,
  getMetricLevel,
  METRIC_META,
  metricLabel,
  normalizeMetrics,
  buildSnapshotReadout,
} from '../lib/metricSemantics'

function MetricCard({ metricKey, value }) {
  const meta = METRIC_META[metricKey]
  const level = getMetricLevel(metricKey, value)
  const tones = {
    blue: 'text-[#60a5fa] border-[#1d4ed8]/40 bg-[#1d4ed8]/10',
    red: 'text-[#f87171] border-[#7f1d1d]/40 bg-[#7f1d1d]/10',
    amber: 'text-[#fbbf24] border-[#78350f]/40 bg-[#78350f]/10',
    green: 'text-[#4ade80] border-[#14532d]/40 bg-[#14532d]/10',
  }

  return (
    <div className="border border-[#2a2a2a] rounded-lg p-3 bg-[#111111]">
      <p className="text-[11px] uppercase tracking-widest text-[#6b7280] mb-1">{meta.label}</p>
      <div className="flex items-center justify-between gap-2 mb-2">
        <span className={`text-lg font-semibold px-2 py-0.5 rounded-md border ${tones[meta.tone]}`}>
          {value ?? '--'}
        </span>
        <span className="text-[11px] text-[#9ca3af]">{level.tag}</span>
      </div>
      <p className="text-xs text-[#6b7280] leading-relaxed mb-1">{meta.guide}</p>
      <p className="text-xs text-[#9ca3af] leading-relaxed">{level.meaning}</p>
    </div>
  )
}

function SnapshotChip({ metricKey, value }) {
  const score = clampScore(value)
  const tone = score === null
    ? 'text-[#9ca3af] border-[#2a2a2a] bg-[#111111]'
    : score >= 70
      ? 'text-[#fca5a5] border-[#7f1d1d]/50 bg-[#7f1d1d]/20'
      : score >= 40
        ? 'text-[#fde68a] border-[#78350f]/50 bg-[#78350f]/20'
        : 'text-[#86efac] border-[#14532d]/50 bg-[#14532d]/20'
  return (
    <span className={`text-[11px] px-2 py-0.5 rounded-full border ${tone}`}>
      {metricLabel(metricKey)} {score ?? '--'}
    </span>
  )
}

function MappingRow({ row, breakdown, metrics }) {
  const score = clampScore(breakdown?.[row.key])
  return (
    <div className="border border-[#2a2a2a] rounded-lg p-3 bg-[#111111]">
      <div className="flex items-center justify-between gap-2 mb-2">
        <p className="text-sm text-[#d1d5db] font-medium">{row.label}</p>
        <span className="text-xs text-[#60a5fa] font-semibold">{score ?? '--'}</span>
      </div>

      <div className="w-full h-1.5 rounded-full bg-[#2a2a2a] overflow-hidden mb-2">
        <div
          className="h-full bg-[#3b82f6]"
          style={{ width: `${score ?? 0}%` }}
        />
      </div>

      <div className="flex flex-wrap gap-1.5 mb-1.5">
        {row.drivers.map((metricKey) => (
          <SnapshotChip
            key={`${row.key}-${metricKey}`}
            metricKey={metricKey}
            value={metrics?.[metricKey]}
          />
        ))}
      </div>
      <p className="text-xs text-[#6b7280] leading-relaxed">{row.summary}</p>
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
  const confidence = clampScore(confidenceScore)
  const confidenceInfo = getConfidenceBand(confidence)
  const readout = buildSnapshotReadout(normalizedMetrics, confidence)

  return (
    <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl p-4 md:p-5">
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-2 mb-4">
        <div>
          <p className="text-[#4b5563] text-xs uppercase tracking-widest mb-1 font-medium">
            Signal Dashboard
          </p>
          <h3 className="text-white text-lg font-semibold leading-tight">Snapshot and Confidence Map</h3>
          <p className="text-sm text-[#9ca3af] mt-1">
            Read snapshot metrics first, then verify how each metric affects confidence dimensions.
          </p>
        </div>
        {debateTriggered && (
          <span className="text-xs text-[#eab308] border border-[#eab308]/30 bg-[#eab308]/5 rounded-full px-3 py-1 leading-none w-fit">
            Revised after critic review
          </span>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-2.5 mb-4">
        <MetricCard metricKey="drama" value={normalizedMetrics.drama} />
        <MetricCard metricKey="polarization" value={normalizedMetrics.polarization} />
        <MetricCard metricKey="heat" value={normalizedMetrics.heat} />
        <MetricCard metricKey="flipRisk" value={normalizedMetrics.flipRisk} />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[280px_320px_1fr] gap-4">
        <div className="border border-[#2a2a2a] rounded-xl p-3 bg-[#121212]">
          <ConfidenceGauge
            score={confidence}
            debateTriggered={false}
            breakdown={confidenceBreakdown}
          />
          <p className="text-sm text-[#d1d5db] mt-2">{confidenceInfo.label}</p>
          <p className="text-xs text-[#6b7280] mt-1 leading-relaxed">{confidenceInfo.note}</p>
        </div>

        <ConfidenceRadar breakdown={confidenceBreakdown} />

        <div className="border border-[#2a2a2a] rounded-xl p-3 bg-[#121212]">
          <p className="text-[11px] uppercase tracking-widest text-[#6b7280] mb-2">Snapshot to Confidence Mapping</p>
          <div className="grid grid-cols-1 gap-2.5">
            {CONFIDENCE_MAP.map((row) => (
              <MappingRow
                key={row.key}
                row={row}
                breakdown={confidenceBreakdown}
                metrics={normalizedMetrics}
              />
            ))}
          </div>
        </div>
      </div>

      {readout.length > 0 && (
        <div className="mt-4 border border-[#2a2a2a] rounded-xl p-3 bg-[#121212]">
          <p className="text-[11px] uppercase tracking-widest text-[#6b7280] mb-2">Quick Readout</p>
          <ul className="space-y-1.5">
            {readout.map((line, idx) => (
              <li key={idx} className="text-sm text-[#d1d5db] leading-relaxed flex items-start gap-2">
                <span className="text-[#3b82f6] mt-1">•</span>
                <span>{line}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
