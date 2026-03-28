import { useState } from 'react'

function clampRatio(value) {
  const n = Number(value ?? 0)
  if (Number.isNaN(n)) return 0
  return Math.max(0, Math.min(1, n))
}

function pct(value) {
  return `${Math.round(clampRatio(value) * 100)}%`
}

const CAMP_META = {
  support: {
    label: 'Support',
    textColor: 'text-[#86efac]',
    barColor: 'bg-[#22c55e]',
    blurb: 'Backing the topic and amplifying positive narratives.',
  },
  oppose: {
    label: 'Oppose',
    textColor: 'text-[#fca5a5]',
    barColor: 'bg-[#ef4444]',
    blurb: 'Rejecting claims and pushing direct counter arguments.',
  },
  neutral: {
    label: 'Neutral',
    textColor: 'text-[#cbd5e1]',
    barColor: 'bg-[#64748b]',
    blurb: 'Watching, questioning, or sharing without fixed alignment.',
  },
}

function Segment({ campKey, ratio, activeCamp, onHover, onLeave }) {
  const meta = CAMP_META[campKey]
  const width = `${Math.max(2, Math.round(ratio * 100))}%`
  const active = activeCamp === campKey
  const dimmed = activeCamp && !active

  return (
    <button
      type="button"
      onMouseEnter={() => onHover(campKey)}
      onMouseLeave={onLeave}
      onFocus={() => onHover(campKey)}
      onBlur={onLeave}
      className={`${meta.barColor} h-full transition-opacity duration-150 ${dimmed ? 'opacity-35' : 'opacity-100'}`}
      style={{ width }}
      aria-label={`${meta.label} ${pct(ratio)}`}
    />
  )
}

export default function CampBattleBoard({ campDistribution }) {
  if (!campDistribution) return null

  const support = clampRatio(campDistribution.support)
  const oppose = clampRatio(campDistribution.oppose)
  const neutral = clampRatio(campDistribution.neutral)
  const total = support + oppose + neutral || 1
  const normalized = {
    support: support / total,
    oppose: oppose / total,
    neutral: neutral / total,
  }

  const defaultCamp = normalized.support >= normalized.oppose
    ? (normalized.support >= normalized.neutral ? 'support' : 'neutral')
    : (normalized.oppose >= normalized.neutral ? 'oppose' : 'neutral')

  const [hoveredCamp, setHoveredCamp] = useState(null)
  const activeCamp = hoveredCamp ?? defaultCamp

  return (
    <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl p-4">
      <p className="text-[#4b5563] text-xs uppercase tracking-widest mb-2 font-medium">
        Camp Battle
      </p>
      <p className="text-sm text-[#9ca3af] leading-relaxed mb-3">
        This is the primary split view for stance distribution across the full report.
      </p>

      <div className="rounded-xl border border-[#2a2a2a] bg-[#111111] p-3">
        <div className="h-6 w-full rounded-lg overflow-hidden flex border border-[#2a2a2a]">
          <Segment
            campKey="support"
            ratio={normalized.support}
            activeCamp={activeCamp}
            onHover={setHoveredCamp}
            onLeave={() => setHoveredCamp(null)}
          />
          <Segment
            campKey="oppose"
            ratio={normalized.oppose}
            activeCamp={activeCamp}
            onHover={setHoveredCamp}
            onLeave={() => setHoveredCamp(null)}
          />
          <Segment
            campKey="neutral"
            ratio={normalized.neutral}
            activeCamp={activeCamp}
            onHover={setHoveredCamp}
            onLeave={() => setHoveredCamp(null)}
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-2 mt-3">
          {['support', 'oppose', 'neutral'].map((campKey) => {
            const meta = CAMP_META[campKey]
            return (
              <div
                key={campKey}
                className="border border-[#2a2a2a] rounded-lg px-2.5 py-2 bg-[#0f0f0f]"
              >
                <div className="flex items-center justify-between gap-2 mb-1">
                  <span className="text-xs uppercase tracking-wider text-[#6b7280]">{meta.label}</span>
                  <span className={`text-sm font-semibold ${meta.textColor}`}>
                    {pct(normalized[campKey])}
                  </span>
                </div>
                <p className="text-xs text-[#9ca3af] leading-relaxed">{meta.blurb}</p>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
