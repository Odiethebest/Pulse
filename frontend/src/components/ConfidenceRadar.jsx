import {
  PolarAngleAxis,
  PolarGrid,
  Radar,
  RadarChart,
  ResponsiveContainer,
  Tooltip,
} from 'recharts'
import { normalizeConfidenceBreakdown } from '../lib/metricSemantics'

function RadarTooltip({ active, payload }) {
  if (!active || !payload?.length) return null
  const item = payload[0]?.payload
  if (!item) return null
  return (
    <div className="bg-[#0f0f0f] border border-[#2a2a2a] rounded-lg px-2.5 py-1.5 shadow-lg">
      <p className="text-xs text-[#9ca3af]">{item.label}</p>
      <p className="text-sm text-[#d1d5db] font-semibold mt-0.5">{item.value ?? '--'}</p>
    </div>
  )
}

export default function ConfidenceRadar({ breakdown = null }) {
  const data = normalizeConfidenceBreakdown(breakdown)
  const hasData = data.some((item) => item.value !== null)
  const chartData = data.map((item) => ({
    ...item,
    value: item.value ?? 0,
  }))

  return (
    <div className="border border-[#2a2a2a] rounded-xl p-3 bg-[#121212]">
      <p className="text-[11px] uppercase tracking-widest text-[#6b7280] mb-2">Confidence Profile</p>
      {hasData ? (
        <div className="h-[220px] w-full">
          <ResponsiveContainer width="100%" height="100%" minWidth={260} minHeight={220}>
            <RadarChart data={chartData} outerRadius="72%">
              <PolarGrid stroke="#2a2a2a" />
              <PolarAngleAxis dataKey="label" tick={{ fill: '#6b7280', fontSize: 11 }} />
              <Tooltip content={<RadarTooltip />} />
              <Radar
                dataKey="value"
                stroke="#3b82f6"
                fill="#3b82f6"
                fillOpacity={0.24}
                strokeWidth={2}
              />
            </RadarChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <div className="h-[220px] w-full flex items-center justify-center text-sm text-[#6b7280]">
          Waiting for confidence breakdown data.
        </div>
      )}
    </div>
  )
}
