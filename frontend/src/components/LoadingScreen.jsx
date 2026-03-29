import { useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'

const BOOT_SEQUENCE = [
  '> Initializing Pulse runtime...',
  '> Fetching Reddit signals...',
  '> Fetching X and Twitter signals...',
  '> Running stance and conflict extraction...',
  '> Running Critic Agent diagnostics...',
  '> Synthesis complete. Preparing dashboard...',
]

export default function LoadingScreen({ runId, isLoading, onSequenceComplete }) {
  const [visibleCount, setVisibleCount] = useState(1)
  const completeRef = useRef(false)

  useEffect(() => {
    if (!isLoading) return

    completeRef.current = false
    setVisibleCount(1)

    let cursor = 1
    let finishTimer = null
    const intervalId = setInterval(() => {
      if (cursor >= BOOT_SEQUENCE.length) {
        clearInterval(intervalId)
        if (!completeRef.current) {
          completeRef.current = true
          finishTimer = setTimeout(() => {
            onSequenceComplete?.()
          }, 360)
        }
        return
      }

      cursor += 1
      setVisibleCount(cursor)
    }, 320)

    return () => {
      clearInterval(intervalId)
      if (finishTimer) clearTimeout(finishTimer)
    }
  }, [isLoading, onSequenceComplete, runId])

  const progress = Math.min(100, Math.round((visibleCount / BOOT_SEQUENCE.length) * 100))

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, transition: { duration: 0.35, ease: 'easeOut' } }}
      className="fixed inset-0 z-[35] bg-[#0f0f0f]/88 backdrop-blur-sm flex items-center justify-center px-4"
    >
      <motion.div
        initial={{ opacity: 0, y: 10, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 8, scale: 0.98, transition: { duration: 0.25 } }}
        className="w-full max-w-2xl bg-zinc-950 border border-zinc-800 rounded-xl overflow-hidden shadow-[0_16px_80px_rgba(0,0,0,0.52)]"
      >
        <div className="px-5 py-4 border-b border-zinc-800 flex items-center justify-between gap-3">
          <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-zinc-500">Pulse Boot Sequence</p>
          <p className="font-mono text-xs text-zinc-400">{progress}%</p>
        </div>

        <div className="p-5 space-y-3 bg-[linear-gradient(180deg,rgba(255,255,255,0.01),rgba(255,255,255,0))]">
          <div className="h-1.5 rounded-full bg-zinc-800 overflow-hidden">
            <motion.div
              initial={{ width: '0%' }}
              animate={{ width: `${progress}%` }}
              transition={{ type: 'spring', stiffness: 220, damping: 26 }}
              className="h-full bg-gradient-to-r from-cyan-400/80 to-blue-400/80 shadow-[0_0_18px_rgba(56,189,248,0.35)]"
            />
          </div>

          <div className="rounded-lg border border-zinc-800 bg-[#0d0d0d] px-4 py-3 min-h-[210px]">
            <div className="space-y-2">
              {BOOT_SEQUENCE.slice(0, visibleCount).map((line, index) => (
                <motion.p
                  key={`${line}-${index}`}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.2 }}
                  className="font-mono text-[13px] text-zinc-300 leading-relaxed break-words whitespace-normal"
                >
                  {line}
                </motion.p>
              ))}
            </div>
          </div>
        </div>
      </motion.div>
    </motion.div>
  )
}
