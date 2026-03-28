import { useEffect } from 'react'
import { usePulse } from './hooks/usePulse'
import { keepAlive } from './lib/api'
import SearchBar from './components/SearchBar'
import AgentGraph from './components/AgentGraph'
import ConfidenceGauge from './components/ConfidenceGauge'
import LiveOutput from './components/LiveOutput'
import SentimentChart from './components/SentimentChart'
import QuoteCards from './components/QuoteCards'
import SynthesisReport from './components/SynthesisReport'
import './App.css'

function MetricCard({ label, value, tone = 'blue' }) {
  const tones = {
    blue: 'text-[#60a5fa] border-[#1d4ed8]/40 bg-[#1d4ed8]/10',
    red: 'text-[#f87171] border-[#7f1d1d]/40 bg-[#7f1d1d]/10',
    amber: 'text-[#fbbf24] border-[#78350f]/40 bg-[#78350f]/10',
    green: 'text-[#4ade80] border-[#14532d]/40 bg-[#14532d]/10',
  }
  return (
    <div className="border border-[#2a2a2a] rounded-lg p-3 bg-[#111111]">
      <p className="text-[11px] uppercase tracking-widest text-[#6b7280] mb-1">{label}</p>
      <span className={`text-lg font-semibold px-2 py-0.5 rounded-md border ${tones[tone]}`}>
        {value ?? '--'}
      </span>
    </div>
  )
}

export default function App() {
  useEffect(() => keepAlive(), [])

  const { status, agentEvents, report, liveText, metrics, submit } = usePulse()

  const isIdle     = status === 'idle'
  const isLoading  = status === 'loading'
  const isComplete = status === 'complete'
  const isError    = status === 'error'
  const hasResult  = isLoading || isComplete || isError
  const quickTake  = report?.quickTake ?? []

  return (
    <div className="min-h-screen bg-[#0f0f0f] flex flex-col">

      {/* SearchBar — transitions from vertically centered to top */}
      <div
        style={{
          paddingTop: isIdle ? 'calc(50vh - 100px)' : '48px',
          transition: 'padding-top 0.5s ease',
        }}
      >
        <SearchBar onSubmit={submit} isLoading={isLoading} />
      </div>

      {/* Result sections */}
      {hasResult && (
        <div className="flex flex-col gap-6 md:gap-8 w-full max-w-5xl mx-auto px-4 md:px-8 pb-16 mt-8">

          {/* AgentGraph — stable render, no animation to avoid replay on state transitions */}
          <div>
            <p className="text-[#4b5563] text-xs uppercase tracking-widest mb-3 font-medium">
              Agent Execution
            </p>
            <AgentGraph agentEvents={agentEvents} runStatus={status} />
          </div>

          {/* ConfidenceGauge + LiveOutput row — appears on loading */}
          <div className="animate-fade-up flex flex-col sm:flex-row gap-4 md:gap-6" style={{ animationDelay: '100ms' }}>
            <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl p-4 shrink-0 w-full sm:w-[310px]">
              <p className="text-[#4b5563] text-xs uppercase tracking-widest mb-3 font-medium">
                Drama Snapshot
              </p>
              <div className="grid grid-cols-2 gap-2.5 mb-4">
                <MetricCard label="Drama" value={metrics.drama} tone="red" />
                <MetricCard label="Polarization" value={metrics.polarization} tone="amber" />
                <MetricCard label="Heat" value={metrics.heat} tone="blue" />
                <MetricCard label="Flip Risk" value={metrics.flipRisk} tone="green" />
              </div>
              <div className="border border-[#2a2a2a] rounded-xl p-3 bg-[#121212]">
                <ConfidenceGauge
                  score={report?.confidenceScore ?? null}
                  debateTriggered={report?.debateTriggered ?? false}
                  breakdown={report?.confidenceBreakdown ?? null}
                />
              </div>
            </div>
            <div className="flex-1 bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl p-4 min-w-0">
              <LiveOutput liveText={liveText} isLoading={isLoading} />
            </div>
          </div>

          {(quickTake.length > 0 || isLoading) && (
            <div className="animate-fade-up bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl p-4" style={{ animationDelay: '140ms' }}>
              <p className="text-[#4b5563] text-xs uppercase tracking-widest mb-2 font-medium">Three-Line Recap</p>
              {quickTake.length > 0 ? (
                <ul className="space-y-1.5">
                  {quickTake.slice(0, 3).map((line, i) => (
                    <li key={i} className="text-sm text-[#d1d5db] leading-relaxed flex items-start gap-2">
                      <span className="text-[#3b82f6] mt-1">•</span>
                      <span>{line}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-[#6b7280]">Building recap from ongoing agent outputs...</p>
              )}
            </div>
          )}

          {/* Error state */}
          {isError && (
            <p className="text-[#ef4444] text-sm text-center py-4">
              Something went wrong. Check the backend and try again.
            </p>
          )}

          {/* Complete-only sections — staggered fade-in */}
          {isComplete && (
            <>
              <div className="animate-fade-up" style={{ animationDelay: '0ms' }}>
                <SentimentChart
                  redditSentiment={report.redditSentiment}
                  twitterSentiment={report.twitterSentiment}
                  platformDiff={report.platformDiff}
                />
              </div>

              <div className="animate-fade-up" style={{ animationDelay: '100ms' }}>
                <QuoteCards
                  redditSentiment={report.redditSentiment}
                  twitterSentiment={report.twitterSentiment}
                />
              </div>

              <div className="animate-fade-up" style={{ animationDelay: '200ms' }}>
                <SynthesisReport
                  synthesis={report.synthesis}
                  critique={report.critique}
                  debateTriggered={report.debateTriggered}
                  quickTake={report.quickTake}
                  controversyTopics={report.controversyTopics}
                  flipSignals={report.flipSignals}
                  revisionDelta={report.revisionDelta}
                />
              </div>
            </>
          )}


        </div>
      )}
    </div>
  )
}
