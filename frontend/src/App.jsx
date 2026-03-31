import { useEffect, useMemo, useState } from 'react'
import { Download, Plus, Share2, Sparkles } from 'lucide-react'
import { AnimatePresence, motion } from 'framer-motion'
import { usePulse } from './hooks/usePulse'
import { keepAlive } from './lib/api'
import SearchBar from './components/SearchBar'
import DramaScoreboard from './components/DramaScoreboard'
import SentimentChart from './components/SentimentChart'
import ControversyAccordion from './components/ControversyAccordion'
import SynthesisReport from './components/SynthesisReport'
import CampBattleBoard from './components/CampBattleBoard'
import AgentTheaterLoading from './components/AgentTheaterLoading'
import { parseCitations } from './components/SemanticSourceChip'
import { buildControversyBoardData } from './lib/controversyMapper'
import './App.css'

export default function App() {
  useEffect(() => keepAlive(), [])

  const { status, agentEvents, report, liveText, metrics, agentSummary, submit, cancelRun } = usePulse()
  const [showLoadingTheater, setShowLoadingTheater] = useState(false)
  const [dashboardReady, setDashboardReady] = useState(false)

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
  const isGenerating = isLoading
  const isComplete = status === 'complete'
  const isError    = status === 'error'
  const shouldRenderDashboard = isComplete && dashboardReady && !showLoadingTheater
  const shouldRenderErrorState = isError && dashboardReady && !showLoadingTheater
  const quickTake  = report?.quickTake ?? []
  const recapLines = useMemo(() => {
    const normalize = (value) => String(value ?? '').replace(/\s+/g, ' ').trim().toLowerCase()
    const excluded = new Set([normalize(quickTake[0]), normalize(quickTake[1])].filter(Boolean))
    const seen = new Set(excluded)
    const lines = []

    const addLine = (line) => {
      const cleaned = String(line ?? '').trim()
      if (!cleaned) return
      const key = normalize(cleaned)
      if (!key || seen.has(key)) return
      seen.add(key)
      lines.push(cleaned)
    }

    addLine(quickTake[2])

    const topTopic = report?.controversyTopics?.[0]
    if (topTopic?.summary) {
      addLine(`Flashpoint: ${topTopic.summary}`)
    } else if (topTopic?.aspect) {
      addLine(`Flashpoint: ${topTopic.aspect} remains the most contested angle.`)
    }

    if (report?.platformDiff) {
      addLine(`Platform split: ${report.platformDiff}`)
    }

    const topFlipSignal = report?.flipSignals?.[0]
    if (topFlipSignal?.summary) {
      addLine(`Watchpoint: ${topFlipSignal.summary}`)
    }

    for (const line of quickTake) {
      if (lines.length >= 3) break
      addLine(line)
    }

    return lines.slice(0, 3)
  }, [quickTake, report])
  const controversyBoardData = useMemo(() => buildControversyBoardData(report), [report])
  const citationSources = useMemo(() => {
    const canonical = Array.isArray(report?.citationSources) ? report.citationSources : []
    if (canonical.length > 0) return canonical

    const reddit = (report?.redditSentiment?.representativeQuotes ?? []).map((quote) => ({
      ...quote,
      platform: quote?.platform || 'Reddit',
    }))
    const twitter = (report?.twitterSentiment?.representativeQuotes ?? []).map((quote) => ({
      ...quote,
      platform: quote?.platform || 'Twitter',
    }))
    return [...reddit, ...twitter]
  }, [report])
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

  useEffect(() => {
    if (!isGenerating) return undefined
    const onKeydown = (event) => {
      if (event.key === 'Escape') {
        cancelRun()
      }
    }
    window.addEventListener('keydown', onKeydown)
    return () => window.removeEventListener('keydown', onKeydown)
  }, [isGenerating, cancelRun])

  const handleExportShare = async () => {
    if (!report) return

    const title = `Pulse Report${report.topic ? `: ${report.topic}` : ''}`
    const summary = (report.quickTake || []).join('\n')

    if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
      try {
        await navigator.share({
          title,
          text: summary || report.topicSummary || 'Pulse report generated.',
          url: window.location.href,
        })
        return
      } catch (error) {
        if (error?.name === 'AbortError') return
      }
    }

    const exportPayload = {
      topic: report.topic,
      generatedAt: new Date().toISOString(),
      quickTake: report.quickTake,
      confidenceScore: report.confidenceScore,
      confidenceBreakdown: report.confidenceBreakdown,
      campDistribution: report.campDistribution,
      platformDiff: report.platformDiff,
      controversyTopics: report.controversyTopics,
      critique: report.critique,
      revisionDelta: report.revisionDelta,
    }

    const blob = new Blob([JSON.stringify(exportPayload, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = `pulse-report-${(report.topic || 'snapshot').replace(/\s+/g, '-').toLowerCase()}.json`
    document.body.appendChild(anchor)
    anchor.click()
    anchor.remove()
    URL.revokeObjectURL(url)
  }

  const handleNewPulseQuery = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' })
    requestAnimationFrame(() => {
      const input = document.getElementById('pulse-query-input')
      input?.focus()
      input?.select?.()
    })
  }

  return (
    <div className="pulse-shell min-h-screen bg-[#0f0f0f] flex flex-col">
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
          className="pulse-content flex flex-col gap-5 md:gap-8 w-full max-w-5xl mx-auto px-4 md:px-8 pb-32 md:pb-16 mt-8"
        >

          <div className="drama-module animate-fade-up bg-indigo-900/10 md:bg-indigo-500/5 border border-indigo-500/20 rounded-lg md:rounded-xl p-4 md:p-5 overflow-hidden" style={{ animationDelay: '20ms' }}>
            <p className="stage-title text-[#4b5563] text-xs uppercase tracking-widest mb-2 font-medium">
              Frontline Verdict
            </p>
            <h2 className="text-base md:text-xl font-serif text-indigo-50 leading-relaxed break-words whitespace-normal">
              {parseCitations(heroLine, citationSources)}
            </h2>
            <p className="text-xs md:text-sm text-indigo-100/75 leading-relaxed mt-1.5 md:mt-2 break-words whitespace-normal">
              {parseCitations(heroSubline, citationSources)}
            </p>
            <p className="text-[11px] md:text-xs text-indigo-200/50 mt-2 md:mt-3 break-words whitespace-normal">Camp split percentages are centralized in Camp Battle below.</p>
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

          {recapLines.length > 0 && (
            <div className="drama-module animate-fade-up bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl overflow-hidden p-4 md:p-5" style={{ animationDelay: '160ms' }}>
              <p className="stage-title text-[#4b5563] text-xs uppercase tracking-widest mb-2 font-medium">Three-Line Recap</p>
              <div className="bg-zinc-900/40 rounded-xl overflow-hidden border-l-4 border-indigo-500/70 p-4 md:p-5">
                <div className="space-y-3">
                  {recapLines.map((line, i) => (
                    <div key={i} className="stagger-1 flex items-start gap-3">
                      <Sparkles size={15} className="text-indigo-400 mt-0.5 shrink-0" />
                      <p className="text-zinc-300 leading-relaxed text-sm break-words whitespace-normal min-w-0">
                        {parseCitations(line, citationSources)}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          <div className="space-y-5 md:space-y-8">
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

            <div>
              <ControversyAccordion
                data={controversyBoardData}
              />
            </div>
          </div>

          <motion.div {...revealProps}>
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

      {isGenerating ? (
        <button
          type="button"
          onClick={cancelRun}
          className="fixed bottom-4 sm:bottom-8 left-1/2 -translate-x-1/2 px-5 py-2 rounded-full text-sm font-medium bg-rose-600/90 text-white hover:bg-rose-500 transition-colors shadow-2xl z-50"
        >
          Stop capture (Esc)
        </button>
      ) : shouldRenderDashboard && (
        <div
          className="fixed bottom-6 sm:bottom-8 pulse-frosted-chip left-1/2 -translate-x-1/2 w-[calc(100vw-1.5rem)] sm:w-auto max-w-[24rem] sm:max-w-none flex items-center justify-center gap-2 sm:gap-3 p-1.5 rounded-full z-50"
        >
          <button
            type="button"
            onClick={handleExportShare}
            className="flex-1 sm:flex-none min-w-0 px-3 sm:px-4 py-2 rounded-full text-xs sm:text-sm font-medium text-zinc-300 hover:text-white hover:bg-zinc-800 transition-colors inline-flex items-center justify-center gap-2 whitespace-nowrap"
          >
            <Share2 size={14} />
            <Download size={14} />
            <span className="sm:hidden">Share</span>
            <span className="hidden sm:inline">Export / Share</span>
          </button>
          <button
            type="button"
            onClick={handleNewPulseQuery}
            className="flex-1 sm:flex-none min-w-0 px-4 sm:px-5 py-2 rounded-full text-xs sm:text-sm font-medium bg-indigo-600 text-white hover:bg-indigo-500 transition-colors shadow-[0_0_15px_rgba(79,70,229,0.3)] inline-flex items-center justify-center gap-1.5 whitespace-nowrap"
          >
            <Plus size={15} />
            <span className="sm:hidden">New Query</span>
            <span className="hidden sm:inline">New Pulse Query</span>
          </button>
        </div>
      )}
    </div>
  )
}
