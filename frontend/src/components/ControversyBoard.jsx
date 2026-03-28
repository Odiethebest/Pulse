function heatColor(heat) {
  if (heat >= 70) return 'bg-[#ef4444]'
  if (heat >= 40) return 'bg-[#eab308]'
  return 'bg-[#22c55e]'
}

export default function ControversyBoard({ topics = [] }) {
  if (!topics.length) return null

  return (
    <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl p-4">
      <p className="text-[#4b5563] text-xs uppercase tracking-widest mb-3 font-medium">
        Controversy Board
      </p>

      <div className="space-y-3">
        {topics.slice(0, 6).map((topic, index) => {
          const heat = Math.max(0, Math.min(100, Number(topic?.heat ?? 0)))
          return (
            <div key={index} className="border border-[#2a2a2a] rounded-lg p-3 bg-[#111111]">
              <div className="flex items-center justify-between gap-2 mb-2">
                <p className="text-sm text-[#e5e7eb] font-medium">{topic?.aspect || 'General'}</p>
                <span className="text-xs text-[#9ca3af]">Heat {heat}</span>
              </div>

              <div className="w-full h-1.5 rounded-full bg-[#2a2a2a] overflow-hidden mb-2">
                <div
                  className={`h-full ${heatColor(heat)}`}
                  style={{ width: `${heat}%` }}
                />
              </div>

              <p className="text-xs text-[#9ca3af] leading-relaxed">
                {topic?.summary || 'No summary available.'}
              </p>
            </div>
          )
        })}
      </div>
    </div>
  )
}
