import { useEffect, useState } from 'react'
import { usePulse } from './hooks/usePulse'
import { keepAlive } from './lib/api'
import SearchBar from './components/SearchBar'
import AgentGraph from './components/AgentGraph'
import DramaScoreboard from './components/DramaScoreboard'
import LiveOutput from './components/LiveOutput'
import SentimentChart from './components/SentimentChart'
import QuoteCards from './components/QuoteCards'
import SynthesisReport from './components/SynthesisReport'
import CampBattleBoard from './components/CampBattleBoard'
import ControversyBoard from './components/ControversyBoard'
import RevisionDeltaPanel from './components/RevisionDeltaPanel'
import './App.css'

export default function App() {
  useEffect(() => keepAlive(), [])

  const { runId, status, agentEvents, report, liveText, metrics, submit } = usePulse()
  const [activeClaimId, setActiveClaimId] = useState(null)

  useEffect(() => {
    const firstClaimId = report?.claimEvidenceMap?.[0]?.claimId ?? null
    setActiveClaimId(firstClaimId)
  }, [report])

  const isIdle     = status === 'idle'
  const isLoading  = status === 'loading'
  const isComplete = status === 'complete'
  const isError    = status === 'error'
  const hasResult  = isLoading || isComplete || isError
  const quickTake  = report?.quickTake ?? []

  return (
    <div className="pulse-shell min-h-screen bg-[#0f0f0f] flex flex-col">

      {/* SearchBar — transitions from vertically centered to top */}
      <div
        className="pulse-content"
        style={{
          paddingTop: isIdle ? 'calc(50vh - 100px)' : '48px',
          transition: 'padding-top 0.5s ease',
        }}
      >
        <SearchBar onSubmit={submit} isLoading={isLoading} />
      </div>

      {/* Result sections */}
      {hasResult && (
        <div className="pulse-content flex flex-col gap-6 md:gap-8 w-full max-w-5xl mx-auto px-4 md:px-8 pb-16 mt-8">

          {/* AgentGraph — stable render, no animation to avoid replay on state transitions */}
          <div className="drama-module grid grid-cols-1 xl:grid-cols-2 gap-4 md:gap-6">
            <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl p-4">
              <p className="stage-title text-[#4b5563] text-xs uppercase tracking-widest mb-3 font-medium">
                Agent Execution
              </p>
              <AgentGraph key={runId} agentEvents={agentEvents} runStatus={status} />
            </div>

            <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl p-4">
              <LiveOutput liveText={liveText} isLoading={isLoading} />
            </div>
          </div>

          <div className="drama-module animate-fade-up" style={{ animationDelay: '100ms' }}>
            <DramaScoreboard
              metrics={metrics}
              confidenceScore={report?.confidenceScore ?? null}
              debateTriggered={report?.debateTriggered ?? false}
              confidenceBreakdown={report?.confidenceBreakdown ?? null}
            />
          </div>

          {(quickTake.length > 0 || isLoading) && (
            <div className="drama-module animate-fade-up bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl p-4" style={{ animationDelay: '140ms' }}>
              <p className="stage-title text-[#4b5563] text-xs uppercase tracking-widest mb-2 font-medium">Three-Line Recap</p>
              {quickTake.length > 0 ? (
                <ul className="space-y-1.5">
                  {quickTake.slice(0, 3).map((line, i) => (
                    <li key={i} className="stagger-1 text-sm text-[#d1d5db] leading-relaxed flex items-start gap-2">
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

              <div className="animate-fade-up" style={{ animationDelay: '60ms' }}>
                <CampBattleBoard campDistribution={report.campDistribution} />
              </div>

              <div className="animate-fade-up" style={{ animationDelay: '80ms' }}>
                <ControversyBoard topics={report.controversyTopics} />
              </div>

              <div className="animate-fade-up" style={{ animationDelay: '100ms' }}>
                <QuoteCards
                  redditSentiment={report.redditSentiment}
                  twitterSentiment={report.twitterSentiment}
                  claimEvidenceMap={report.claimEvidenceMap}
                  activeClaimId={activeClaimId}
                />
              </div>

              <div className="animate-fade-up" style={{ animationDelay: '160ms' }}>
                <RevisionDeltaPanel
                  revisionDelta={report.revisionDelta}
                  critique={report.critique}
                />
              </div>

              <div className="animate-fade-up" style={{ animationDelay: '220ms' }}>
                <SynthesisReport
                  synthesis={report.synthesis}
                  critique={report.critique}
                  debateTriggered={report.debateTriggered}
                  quickTake={report.quickTake}
                  controversyTopics={report.controversyTopics}
                  flipSignals={report.flipSignals}
                  revisionDelta={report.revisionDelta}
                  claimEvidenceMap={report.claimEvidenceMap}
                  activeClaimId={activeClaimId}
                  onClaimSelect={setActiveClaimId}
                />
              </div>
            </>
          )}


        </div>
      )}
    </div>
  )
}
