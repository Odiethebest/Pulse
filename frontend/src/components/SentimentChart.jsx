import { useMemo, useState } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer,
} from 'recharts'

function buildSentimentData(redditSentiment, twitterSentiment) {
  const pct = (v) => Math.round((v ?? 0) * 100)
  return [
    {
      platform: 'Reddit',
      Positive: pct(redditSentiment?.positiveRatio),
      Neutral:  pct(redditSentiment?.neutralRatio),
      Negative: pct(redditSentiment?.negativeRatio),
    },
    {
      platform: 'Twitter',
      Positive: pct(twitterSentiment?.positiveRatio),
      Neutral:  pct(twitterSentiment?.neutralRatio),
      Negative: pct(twitterSentiment?.negativeRatio),
    },
  ]
}

function buildCampData(redditSentiment, twitterSentiment) {
  const pct = (v) => Math.round((v ?? 0) * 100)
  const redditCamp = redditSentiment?.stanceDistribution || {
    support: redditSentiment?.positiveRatio,
    oppose: redditSentiment?.negativeRatio,
    neutral: redditSentiment?.neutralRatio,
  }
  const twitterCamp = twitterSentiment?.stanceDistribution || {
    support: twitterSentiment?.positiveRatio,
    oppose: twitterSentiment?.negativeRatio,
    neutral: twitterSentiment?.neutralRatio,
  }

  return [
    {
      platform: 'Reddit',
      Support: pct(redditCamp?.support),
      Neutral: pct(redditCamp?.neutral),
      Oppose: pct(redditCamp?.oppose),
    },
    {
      platform: 'Twitter',
      Support: pct(twitterCamp?.support),
      Neutral: pct(twitterCamp?.neutral),
      Oppose: pct(twitterCamp?.oppose),
    },
  ]
}

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  return (
    <div style={{
      background: '#1a1a1a',
      border: '1px solid #2a2a2a',
      borderRadius: 8,
      padding: '8px 12px',
    }}>
      <p style={{ color: '#9ca3af', fontSize: 12, marginBottom: 6 }}>{label}</p>
      {payload.map((entry) => (
        <p key={entry.name} style={{ color: entry.fill, fontSize: 13, margin: '2px 0' }}>
          {entry.name}: <strong>{entry.value}%</strong>
        </p>
      ))}
    </div>
  )
}

function CustomLegend({ payload }) {
  return (
    <div style={{ display: 'flex', gap: 16, justifyContent: 'flex-end', paddingBottom: 8 }}>
      {payload.map((entry) => (
        <div key={entry.value} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <span style={{
            width: 8, height: 8, borderRadius: '50%',
            background: entry.color, display: 'inline-block', flexShrink: 0,
          }} />
          <span style={{ color: '#9ca3af', fontSize: 12 }}>{entry.value}</span>
        </div>
      ))}
    </div>
  )
}

export default function SentimentChart({ redditSentiment, twitterSentiment, platformDiff }) {
  const [view, setView] = useState('sentiment')
  const data = useMemo(
    () => view === 'sentiment'
      ? buildSentimentData(redditSentiment, twitterSentiment)
      : buildCampData(redditSentiment, twitterSentiment),
    [view, redditSentiment, twitterSentiment]
  )
  const series = view === 'sentiment'
    ? [
      { key: 'Positive', color: '#22c55e', duration: 800 },
      { key: 'Neutral', color: '#6b7280', duration: 900 },
      { key: 'Negative', color: '#ef4444', duration: 1000 },
    ]
    : [
      { key: 'Support', color: '#22c55e', duration: 800 },
      { key: 'Neutral', color: '#6b7280', duration: 900 },
      { key: 'Oppose', color: '#ef4444', duration: 1000 },
    ]

  return (
    <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl px-5 py-6 pb-8">
      <div className="flex items-center justify-between gap-2 mb-4">
        <p className="text-[#4b5563] text-xs uppercase tracking-widest font-medium">Sentiment</p>
        <div className="flex items-center gap-1 bg-[#111111] border border-[#2a2a2a] rounded-lg p-1">
          <button
            onClick={() => setView('sentiment')}
            className={`px-2.5 py-1 text-xs rounded-md transition-colors ${view === 'sentiment' ? 'bg-[#2a2a2a] text-[#e5e7eb]' : 'text-[#6b7280] hover:text-[#9ca3af]'}`}
          >
            Emotion
          </button>
          <button
            onClick={() => setView('camp')}
            className={`px-2.5 py-1 text-xs rounded-md transition-colors ${view === 'camp' ? 'bg-[#2a2a2a] text-[#e5e7eb]' : 'text-[#6b7280] hover:text-[#9ca3af]'}`}
          >
            Camp
          </button>
        </div>
      </div>

      <ResponsiveContainer width="100%" height={188}>
        <BarChart data={data} barCategoryGap="35%" barGap={3}>
          <CartesianGrid vertical={false} stroke="#2a2a2a" strokeDasharray="0" />
          <XAxis
            dataKey="platform"
            tick={{ fill: '#9ca3af', fontSize: 13, fontFamily: 'Inter, system-ui' }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            domain={[0, 100]}
            tickFormatter={(v) => `${v}%`}
            tick={{ fill: '#6b7280', fontSize: 11, fontFamily: 'Inter, system-ui' }}
            axisLine={false}
            tickLine={false}
            width={38}
            ticks={[0, 25, 50, 75, 100]}
          />
          <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255,255,255,0.03)' }} />
          <Legend verticalAlign="top" content={<CustomLegend />} />
          {series.map((item) => (
            <Bar
              key={item.key}
              dataKey={item.key}
              fill={item.color}
              radius={[3, 3, 0, 0]}
              animationDuration={item.duration}
            />
          ))}
        </BarChart>
      </ResponsiveContainer>

      {platformDiff && (
        <p className="text-[#6b7280] text-sm italic mt-3 flex items-start gap-1.5 leading-relaxed">
          <span className="not-italic shrink-0 mt-px">↔</span>
          <span>{platformDiff}</span>
        </p>
      )}
    </div>
  )
}
