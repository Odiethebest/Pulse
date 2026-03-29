import { useEffect, useMemo, useState } from 'react'
import { Sparkles } from 'lucide-react'
import { AnimatePresence, motion } from 'framer-motion'
import { usePulse } from './hooks/usePulse'
import { keepAlive } from './lib/api'
import SearchBar from './components/SearchBar'
import DramaScoreboard from './components/DramaScoreboard'
import SentimentChart from './components/SentimentChart'
import ControversyAccordion from './components/ControversyAccordion'
import SynthesisReport from './components/SynthesisReport'
import CampBattleBoard from './components/CampBattleBoard'
import GlobalRunStatus from './components/GlobalRunStatus'
import AgentTraceDrawer from './components/AgentTraceDrawer'
import AgentTheaterLoading from './components/AgentTheaterLoading'
import { buildControversyBoardData } from './lib/controversyMapper'
import './App.css'

export default function App() {
  useEffect(() => keepAlive(), [])

  const { runId, status, agentEvents, report, liveText, metrics, agentSummary, submit } = usePulse()
  const [traceOpen, setTraceOpen] = useState(false)
  const [showLoadingTheater, setShowLoadingTheater] = useState(false)
  const [dashboardReady, setDashboardReady] = useState(false)

  useEffect(() => {
    setTraceOpen(false)
  }, [runId])

  useEffect(() => {
    if (status === 'loading') {
      setShowLoadingTheater(true)
      setDashboardReady(false)
      return
    }

    if (!showLoadingTheater) {
      if (status === 'complete' || status === 'error') {
        setDashboardReady(true)
      }
      return
    }

    const allSystemsGreen =
      status === 'complete'
      && agentSummary.running === 0
      && agentSummary.failed === 0
      && agentSummary.completed > 0
    const delay = allSystemsGreen ? 800 : 0

    const timer = setTimeout(() => {
      setShowLoadingTheater(false)
    }, delay)

    return () => clearTimeout(timer)
  }, [
    status,
    showLoadingTheater,
    agentSummary.running,
    agentSummary.failed,
    agentSummary.completed,
  ])

  const isIdle     = status === 'idle'
  const isLoading  = status === 'loading'
  const isComplete = status === 'complete'
  const isError    = status === 'error'
  const shouldRenderDashboard = isComplete && dashboardReady && !showLoadingTheater
  const shouldRenderErrorState = isError && dashboardReady && !showLoadingTheater
  const quickTake  = report?.quickTake ?? []
  const controversyBoardData = useMemo(() => buildControversyBoardData(report), [report])
  const primaryBiasConcern = report?.critique?.biasConcerns?.[0] ?? null
  const primaryEvidenceGap = report?.critique?.evidenceGaps?.[0] ?? null
  const revealProps = {
    initial: { opacity: 0, y: 30 },
    whileInView: { opacity: 1, y: 0 },
    viewport: { once: true, margin: '-50px' },
    transition: { duration: 0.6, ease: 'easeOut' },
  }
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
  return (
    <div className="pulse-shell min-h-screen bg-[#0f0f0f] flex flex-col">
      {showLoadingTheater && (
        <motion.div
          className="pointer-events-none fixed inset-0 z-[2] bg-[radial-gradient(1000px_520px_at_50%_18%,rgba(99,102,241,0.18),transparent_72%)]"
          animate={{ opacity: [0.03, 0.08, 0.03] }}
          transition={{ duration: 10, repeat: Infinity, ease: 'easeInOut' }}
        />
      )}

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

      <AnimatePresence
        onExitComplete={() => {
          if (status === 'complete' || status === 'error') {
            setDashboardReady(true)
          }
        }}
      >
        {showLoadingTheater && (
          <div className="pulse-content px-4 md:px-8">
            <AgentTheaterLoading
              runStatus={status}
              agentEvents={agentEvents}
              liveText={liveText}
            />
          </div>
        )}
      </AnimatePresence>

      {/* Final dashboard after theater dismissal */}
      {shouldRenderDashboard && (
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
          className="pulse-content flex flex-col gap-6 md:gap-8 w-full max-w-5xl mx-auto px-4 md:px-8 pb-16 mt-8"
        >

          <div className="drama-module animate-fade-up bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl p-5 md:p-6 overflow-hidden" style={{ animationDelay: '20ms' }}>
            <p className="stage-title text-[#4b5563] text-xs uppercase tracking-widest mb-2 font-medium">
              Frontline Verdict
            </p>
            <h2 className="text-white text-xl md:text-2xl leading-snug font-semibold tracking-tight break-words whitespace-normal">
              {heroLine}
            </h2>
            <p className="text-sm text-[#9ca3af] leading-relaxed mt-2 break-words whitespace-normal">
              {heroSubline}
            </p>
            <p className="text-xs text-[#6b7280] mt-3 break-words whitespace-normal">Camp split percentages are centralized in Camp Battle below.</p>
          </div>

          <div className="drama-module animate-fade-up bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl overflow-hidden p-4" style={{ animationDelay: '80ms' }}>
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
              <div className="min-w-0">
                <p className="stage-title text-[#4b5563] text-xs uppercase tracking-widest mb-1 font-medium">Execution Trace</p>
                <p className="text-sm text-[#9ca3af] break-words whitespace-normal">Execution details are available in the trace drawer and no longer interrupt report reading.</p>
              </div>
              <button
                onClick={() => setTraceOpen(true)}
                className="text-sm text-[#d1d5db] border border-[#2a2a2a] rounded-lg px-3 py-1.5 hover:bg-[#181818] transition-colors w-fit"
              >
                Open Agent Trace
              </button>
            </div>
          </div>

          <motion.div className="drama-module" {...revealProps}>
            <DramaScoreboard
              metrics={metrics}
              confidenceScore={report?.confidenceScore ?? null}
              debateTriggered={report?.debateTriggered ?? false}
              confidenceBreakdown={report?.confidenceBreakdown ?? null}
              criticNote={primaryBiasConcern}
            />
          </motion.div>

          {quickTake.length > 0 && (
            <div className="drama-module animate-fade-up bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl overflow-hidden p-4" style={{ animationDelay: '160ms' }}>
              <p className="stage-title text-[#4b5563] text-xs uppercase tracking-widest mb-2 font-medium">Three-Line Recap</p>
              <div className="bg-zinc-900/40 rounded-xl overflow-hidden border-l-4 border-indigo-500/70 p-6">
                <div className="space-y-3">
                  {quickTake.slice(0, 3).map((line, i) => (
                    <div key={i} className="stagger-1 flex items-start gap-3">
                      <Sparkles size={15} className="text-indigo-400 mt-0.5 shrink-0" />
                      <p className="text-zinc-300 leading-relaxed text-sm break-words whitespace-normal min-w-0">{line}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          <div className="space-y-16 md:space-y-24">
            <div className="animate-fade-up" style={{ animationDelay: '0ms' }}>
              <SentimentChart
                redditSentiment={report.redditSentiment}
                twitterSentiment={report.twitterSentiment}
                platformDiff={report.platformDiff}
              />
            </div>

            <motion.div {...revealProps}>
              <CampBattleBoard
                campDistribution={report.campDistribution}
                criticNote={primaryEvidenceGap}
              />
            </motion.div>

            <motion.div {...revealProps}>
              <ControversyAccordion
                data={controversyBoardData}
              />
            </motion.div>
          </div>

          <motion.div className="mt-8" {...revealProps}>
            <SynthesisReport
              synthesis={report.synthesis}
              critique={report.critique}
              revisionDelta={report.revisionDelta}
              revisionAnchors={report.revisionAnchors}
            />
          </motion.div>
        </motion.div>
      )}

      {shouldRenderErrorState && (
        <div className="pulse-content w-full max-w-3xl mx-auto px-4 md:px-8 mt-8">
          <p className="text-[#ef4444] text-sm text-center py-4">
            Something went wrong. Check the backend and try again.
          </p>
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
