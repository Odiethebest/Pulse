# Pulse Engineering Principles

## Purpose

This document defines non negotiable engineering invariants for Pulse and maps each invariant to concrete code enforcement points.

## Invariant set

### 1. Evidence must be real and traceable

Rule:

1. No synthetic quote placeholders in controversy feed.
2. Claims in quick take must carry traceable evidence references.
3. Citation source order must remain stable and URL deduped.

Enforcement in code:

1. Backend claim to evidence mapping
   `PulseOrchestrator.buildClaimEvidenceMap`
2. Backend quick take rendering
   `PulseOrchestrator.buildQuickTake`
3. Frontend source canonicalization
   `frontend/src/lib/api.js`
   `buildCanonicalCitationSources`
4. Controversy feed data assembly without synthetic filler
   `frontend/src/lib/controversyMapper.js`
   `buildControversyBoardData`

Regression tests:

1. `backend/src/test/java/com/odieyang/pulse/orchestrator/PulseOrchestratorV2Tests.java`
   `quickTakeShouldSpreadCitationsBeyondFirstTwoSources`
2. `frontend/src/lib/__tests__/apiCitationSources.test.js`
3. `frontend/src/lib/__tests__/controversyMapper.test.js`

### 2. Crawler quality must be high precision under fixed budget

Rule:

1. Keep total posts small and relevant.
2. Remove low signal and shell pages early.
3. Rank globally before assigning to topic buckets.

Enforcement in code:

1. Pre analysis strict filtering
   `PulseOrchestrator.tightenCrawledPosts`
2. Hard irrelevant and noise checks
   `PulseOrchestrator.isHardIrrelevantPost`
   `PulseOrchestrator.looksLikeLowSignalNoise`
3. Global relevance merge with per platform cap
   `PulseOrchestrator.projectCrawledPosts`
4. Twitter shell filtering at fetch time
   `TwitterAgent.isTwitterJavascriptShell`

Regression tests:

1. `PulseOrchestratorV2Tests`
   `analyzeShouldTightenNoisyCrawlerPostsByRelevance`
   `analyzeShouldApplyStrictGateAndPlatformCapForHighRelevanceOnly`
   `analyzeShouldPreferGlobalTopRelevanceInsteadOfArrivalOrder`
   `analyzeShouldMeetPhase4CoverageTargetsAtTop16`
2. `backend/src/test/java/com/odieyang/pulse/agent/TwitterAgentTests.java`
   `fetchShouldFilterJavascriptShellPages`

### 3. Citation selection must avoid mechanical patterns

Rule:

1. Do not let frontline claim citations collapse into fixed offset patterns.
2. Prefer semantically relevant evidence across both platforms.
3. Maintain diversity when enough sources exist.

Enforcement in code:

1. Backend quick take anti pattern guard
   `PulseOrchestrator.applyQuickTakeMechanicalPairingGuard`
2. Synthesis prompt side candidate pool generation
   `SynthesisAgent.buildSectionCitationPools`
3. Synthesis output validation for fixed offset patterns
   `SynthesisAgent.hasFrontlineFixedOffsetCitationPairing`
   `SynthesisAgent.collectCriticalViolations`

Regression tests:

1. `PulseOrchestratorV2Tests`
   `quickTakeShouldAvoidLegacyFixedOffsetCitationPairing`
   `quickTakeShouldRepairMechanicalPairingWhenFirstTwoClaimsAlignByOffset`
   `mechanicalPairingGuardShouldRewriteSecondClaimWhenOffsetPatternDetected`
2. `backend/src/test/java/com/odieyang/pulse/agent/SynthesisAgentFormattingTests.java`
   `collectCriticalViolationsShouldFlagFrontlineFixedOffsetPairing`
   `collectCriticalViolationsShouldAllowNonMechanicalFrontlinePairing`

### 4. Degradation must be graceful not catastrophic

Rule:

1. One failed agent must not kill the full run.
2. One failed source platform must still produce a valid partial report.
3. SSE and API transport errors should move UI state to explicit failure state.

Enforcement in code:

1. Backend guarded execution wrapper
   `PulseOrchestrator.safeRun`
2. Default fallback payload constructors in orchestrator
   `defaultStanceResult`, `defaultConflictResult`, `defaultAspectResult`, `defaultFlipRiskResult`, `emptyRawPosts`
3. Frontend error state transition
   `usePulse.submit` and `usePulse.cancelRun`

Regression tests:

1. `PulseOrchestratorV2Tests`
   `analyzeShouldFallbackWhenOptionalAgentsFail`
   `analyzeShouldDegradeWhenRedditFetchFailsButTwitterStillWorks`
   `analyzeShouldFallbackToInitialSynthesisWhenRevisionFails`
2. `frontend/src/hooks/__tests__/usePulseV2.test.js`
   `falls back to error state when analyze request fails`
   `cancels active run and ignores late analyze result`

### 5. Mobile and desktop loading UI must stay isolated

Rule:

1. Mobile behavior changes must not mutate desktop layout structure.
2. Mobile CSS must remain namespaced.
3. Execution tree and console behavior can diverge by device.

Enforcement in code:

1. Component level split
   `AgentTheaterLoadingDesktop.jsx`
   `AgentTheaterLoadingMobile.jsx`
2. Runtime router by media query
   `AgentTheaterLoading.jsx`
3. Mobile namespace classes
   `.theater-mobile-*` in `frontend/src/App.css`

Regression tests:

1. `frontend/src/components/__tests__/AgentTheaterLoading.test.jsx`
   `keeps desktop structure with original split layout classes`
   `uses mobile tabbed layout with execution summary and expandable full chain`
   `renders mobile console log line as two-row layout`
   `auto-scrolls only when console is at bottom on mobile`

## Engineering decision checklist for every change

1. Which invariant does this change affect.
2. Which implementation points will be modified.
3. Which regression tests already cover this behavior.
4. Which new test should be added if coverage is missing.
5. Which document in `Doc/for-developer` must be updated in the same change.

## PR quality bar

1. No behavior only changes without test updates in impacted high risk areas.
2. No hidden contract changes between backend `PulseReport` and frontend `normalizeReport`.
3. No mobile fixes that alter desktop `md:flex-row` loading layout behavior.
4. No crawler parameter changes without validating top citation stability and relevance.
