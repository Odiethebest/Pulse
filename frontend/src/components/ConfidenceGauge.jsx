import { useEffect, useState } from 'react'

const CX = 80
const CY = 80
const R  = 65

// Counter-clockwise sweep (sweep=0) goes from left → over top → right
const ARC_PATH = `M ${CX - R} ${CY} A ${R} ${R} 0 0 0 ${CX + R} ${CY}`
const ARC_LEN  = Math.PI * R  // ≈ 204.2

function arcColor(score) {
  if (score <= 40) return '#ef4444'
  if (score <= 60) return '#eab308'
  return '#22c55e'
}

export default function ConfidenceGauge({ score = null, debateTriggered = false }) {
  const [animScore, setAnimScore] = useState(0)

  useEffect(() => {
    setAnimScore(0)
    const t = setTimeout(() => setAnimScore(score ?? 0), 50)
    return () => clearTimeout(t)
  }, [score])

  const offset = ARC_LEN * (1 - animScore / 100)
  const color  = arcColor(score ?? 0)
  const label  = score !== null ? String(score) : '--'

  return (
    <div className="flex flex-col items-center gap-3">
      <svg width={160} height={108} viewBox="0 0 160 108">
        {/* Track arc */}
        <path
          d={ARC_PATH}
          fill="none"
          stroke="#2a2a2a"
          strokeWidth={10}
          strokeLinecap="round"
        />

        {/* Fill arc */}
        <path
          d={ARC_PATH}
          fill="none"
          stroke={color}
          strokeWidth={10}
          strokeLinecap="round"
          strokeDasharray={ARC_LEN}
          strokeDashoffset={offset}
          style={{ transition: 'stroke-dashoffset 0.9s cubic-bezier(0.4, 0, 0.2, 1), stroke 0.3s ease' }}
        />

        {/* Score */}
        <text
          x={CX}
          y={64}
          textAnchor="middle"
          dominantBaseline="middle"
          fill="white"
          fontSize={38}
          fontWeight={700}
          fontFamily="Inter, system-ui, sans-serif"
          style={{ letterSpacing: '-1px' }}
        >
          {label}
        </text>

        {/* "Confidence" label */}
        <text
          x={CX}
          y={97}
          textAnchor="middle"
          dominantBaseline="middle"
          fill="#6b7280"
          fontSize={12}
          fontFamily="Inter, system-ui, sans-serif"
        >
          Confidence
        </text>
      </svg>

      {debateTriggered && (
        <span className="text-xs text-[#eab308] border border-[#eab308]/30 bg-[#eab308]/5 rounded-full px-3 py-1 leading-none">
          🔄 Revised after critic review
        </span>
      )}
    </div>
  )
}
