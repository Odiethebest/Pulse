import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer,
} from 'recharts'

function buildData(redditSentiment, twitterSentiment) {
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
  const data = buildData(redditSentiment, twitterSentiment)

  return (
    <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl p-5">
      <p className="text-[#4b5563] text-xs uppercase tracking-widest mb-4 font-medium">Sentiment</p>

      <ResponsiveContainer width="100%" height={200}>
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
          <Bar dataKey="Positive" fill="#22c55e" radius={[3, 3, 0, 0]} animationDuration={800} />
          <Bar dataKey="Neutral"  fill="#6b7280" radius={[3, 3, 0, 0]} animationDuration={900} />
          <Bar dataKey="Negative" fill="#ef4444" radius={[3, 3, 0, 0]} animationDuration={1000} />
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
