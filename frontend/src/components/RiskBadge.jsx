function toneBySeverity(severity) {
  const level = String(severity ?? '').toLowerCase()
  if (level === 'high') {
    return 'text-[#fca5a5] border-[#7f1d1d]/60 bg-[#7f1d1d]/20'
  }
  if (level === 'warning') {
    return 'text-[#fde68a] border-[#78350f]/60 bg-[#78350f]/20'
  }
  return 'text-[#cbd5e1] border-[#334155]/60 bg-[#1e293b]/25'
}

export default function RiskBadge({ flag }) {
  if (!flag) return null

  const tone = toneBySeverity(flag.severity)
  const label = flag.label || 'Risk'

  return (
    <span
      className={`text-[11px] rounded-full border px-2 py-0.5 ${tone}`}
      title={flag.message || ''}
    >
      {label}
    </span>
  )
}
