import { useEffect, useMemo, useState } from 'react'
import { usePulse } from './hooks/usePulse'
import { keepAlive } from './lib/api'
import SearchBar from './components/SearchBar'
import DramaScoreboard from './components/DramaScoreboard'
import SentimentChart from './components/SentimentChart'
import ControversyAccordion from './components/ControversyAccordion'
import SynthesisReport from './components/SynthesisReport'
import CampBattleBoard from './components/CampBattleBoard'
import RevisionDeltaPanel from './components/RevisionDeltaPanel'
import GlobalRunStatus from './components/GlobalRunStatus'
import AgentTraceDrawer from './components/AgentTraceDrawer'
import { buildControversyBoardData } from './lib/controversyMapper'
import './App.css'

export default function App() {
  useEffect(() => keepAlive(), [])

  const { runId, status, agentEvents, report, liveText, metrics, agentSummary, submit } = usePulse()
  const [traceOpen, setTraceOpen] = useState(false)

  useEffect(() => {
    setTraceOpen(false)
  }, [runId])

  const isIdle     = status === 'idle'
  const isLoading  = status === 'loading'
  const isComplete = status === 'complete'
  const isError    = status === 'error'
  const hasResult  = isLoading || isComplete || isError
  const quickTake  = report?.quickTake ?? []
  const controversyBoardData = useMemo(() => buildControversyBoardData(report), [report])
  const heroLine = quickTake[0]
    ?? (isLoading
      ? 'Scanning cross platform chatter and extracting the dominant conflict line.'
      : report?.topicSummary
        ?? 'No summary available for this run.')
  const heroSubline = quickTake[1]
    ?? (isLoading
      ? 'Agent results are still streaming. Confidence and evidence mapping will update automatically.'
      : quickTake[0]
        ? 'The line above is the primary conclusion. Use the dashboard to validate confidence and volatility.'
        : 'Run another query to generate a new public opinion snapshot.')
  const handleAnchorSelect = (anchorId) => {
    if (!anchorId) return
    const target = document.getElementById(anchorId)
    if (target) {
      target.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }
  }

  return (
    <div className="pulse-shell min-h-screen bg-[#0f0f0f] flex flex-col">
      {!isIdle && (
        <div className="pulse-topbar">
          <div className="pulse-topbar-inner">
            <GlobalRunStatus
              runStatus={status}
              agentSummary={agentSummary}
              onOpenTrace={() => setTraceOpen(true)}
            />
          </div>
        </div>
      )}

      {/* SearchBar — transitions from vertically centered to top */}
      <div
        className="pulse-content"
        style={{
          paddingTop: isIdle ? 'calc(50vh - 100px)' : '88px',
          transition: 'padding-top 0.5s ease',
        }}
      >
        <SearchBar onSubmit={submit} isLoading={isLoading} />
      </div>

      {/* Result sections */}
      {hasResult && (
        <div className="pulse-content flex flex-col gap-6 md:gap-8 w-full max-w-5xl mx-auto px-4 md:px-8 pb-16 mt-8">

          <div className="drama-module animate-fade-up bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl p-5 md:p-6" style={{ animationDelay: '20ms' }}>
            <p className="stage-title text-[#4b5563] text-xs uppercase tracking-widest mb-2 font-medium">
              Frontline Verdict
            </p>
            <h2 className="text-white text-xl md:text-2xl leading-snug font-semibold tracking-tight">
              {heroLine}
            </h2>
            <p className="text-sm text-[#9ca3af] leading-relaxed mt-2">
              {heroSubline}
            </p>
            <p className="text-xs text-[#6b7280] mt-3">Camp split percentages are centralized in Camp Battle below.</p>
          </div>

          <div className="drama-module animate-fade-up bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl p-4" style={{ animationDelay: '80ms' }}>
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
              <div>
                <p className="stage-title text-[#4b5563] text-xs uppercase tracking-widest mb-1 font-medium">Execution Trace</p>
                <p className="text-sm text-[#9ca3af]">Execution details are available in the trace drawer and no longer interrupt report reading.</p>
              </div>
              <button
                onClick={() => setTraceOpen(true)}
                className="text-sm text-[#d1d5db] border border-[#2a2a2a] rounded-lg px-3 py-1.5 hover:bg-[#181818] transition-colors w-fit"
              >
                Open Agent Trace
              </button>
            </div>
          </div>

          <div className="drama-module animate-fade-up" style={{ animationDelay: '120ms' }}>
            <DramaScoreboard
              metrics={metrics}
              confidenceScore={report?.confidenceScore ?? null}
              debateTriggered={report?.debateTriggered ?? false}
              confidenceBreakdown={report?.confidenceBreakdown ?? null}
            />
          </div>

          {(quickTake.length > 0 || isLoading) && (
            <div className="drama-module animate-fade-up bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl p-4" style={{ animationDelay: '160ms' }}>
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
              <div className="space-y-16 md:space-y-24">
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
                  <ControversyAccordion
                    data={controversyBoardData}
                  />
                </div>
              </div>

              <div className="animate-fade-up mt-16" style={{ animationDelay: '160ms' }}>
                <RevisionDeltaPanel
                  revisionDelta={report.revisionDelta}
                  critique={report.critique}
                  revisionAnchors={report.revisionAnchors}
                  onAnchorSelect={handleAnchorSelect}
                />
              </div>

              <div className="animate-fade-up mt-8" style={{ animationDelay: '220ms' }}>
                <SynthesisReport
                  synthesis={report.synthesis}
                  critique={report.critique}
                  revisionDelta={report.revisionDelta}
                  revisionAnchors={report.revisionAnchors}
                />
              </div>
            </>
          )}


        </div>
      )}

      <AgentTraceDrawer
        open={traceOpen}
        onClose={() => setTraceOpen(false)}
        runId={runId}
        runStatus={status}
        agentEvents={agentEvents}
        liveText={liveText}
        isLoading={isLoading}
      />
    </div>
  )
}
