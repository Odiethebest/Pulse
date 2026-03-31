# Pulse Architecture and Core Logic

## Repository topology

1. Backend runtime
   `backend/src/main/java/com/odieyang/pulse`
2. Backend tests
   `backend/src/test/java/com/odieyang/pulse`
3. Frontend runtime
   `frontend/src`
4. Frontend tests
   `frontend/src/**/__tests__`

## Backend runtime architecture

### Request entrypoints

1. Analyze API
   `backend/src/main/java/com/odieyang/pulse/controller/PulseController.java`
   Method: `analyze`
2. SSE stream API
   `backend/src/main/java/com/odieyang/pulse/controller/PulseController.java`
   Method: `stream`
3. Health API
   `backend/src/main/java/com/odieyang/pulse/controller/ApiHealthController.java`
   Method: `health`

### Orchestration center

Core coordinator:
`backend/src/main/java/com/odieyang/pulse/orchestrator/PulseOrchestrator.java`

Primary method:
`analyze(String topic, String requestedRunId, String locale)`

### End to end analyze pipeline with implementation locations

1. Resolve locale and run id, register run scoped stream
   `resolveLocale`, `resolveRunId`, `publisher.registerRun`, `publisher.stream`
2. Build query plan
   `QueryPlannerAgent.plan`
   File: `backend/src/main/java/com/odieyang/pulse/agent/QueryPlannerAgent.java`
3. Fetch Reddit and Twitter in parallel
   `RedditAgent.fetch`, `TwitterAgent.fetch`
4. Tight relevance gate on fetched posts before analysis
   `tightenCrawledPosts`
5. Run analysis agents in parallel
   `SentimentAgent.analyze`, `StanceAgent.analyze`, `ConflictAgent.analyze`, `AspectAgent.analyze`, `FlipRiskAgent.analyze`
6. Run synthesis and critic
   `SynthesisAgent.synthesizeWithCoreEntity`, `CriticAgent.critique`
7. Optional single rewrite on quality gate failure
   `buildRewriteGuidance` then second `synthesizeWithCoreEntity(...)` call
8. Build evidence linked claims and quick take
   `buildClaimEvidenceMap`, `buildQuickTake`
9. Repair mechanical citation pairing in quick take
   `applyQuickTakeMechanicalPairingGuard`
10. Project final crawled posts with global relevance ranking
    `projectCrawledPosts`
11. Build topic buckets and crawler diagnostics
    `buildTopicBuckets`, `buildCrawlerStats`
12. Build report level critic mapping
    `buildRevisionAnchors`, `buildClaimAnnotations`, `buildRiskFlags`
13. Validate synthesis format and fallback to deterministic reporter template if needed
    `finalizeSynthesis`, `isValidReporterSynthesis`, `buildReporterFallback`
14. Return `PulseReport`
    Model file: `backend/src/main/java/com/odieyang/pulse/model/PulseReport.java`

### Agent layer implementation map

1. Query planning
   `QueryPlannerAgent.plan`
2. Source fetching
   `RedditAgent.fetch`, `TwitterAgent.fetch`
3. Twitter shell page filtering
   `TwitterAgent.isTwitterJavascriptShell`
4. Sentiment normalization and quote camp normalization
   `SentimentAgent.normalizeResult`, `SentimentAgent.normalizeQuotes`
5. Stance to camp conversion helper
   `StanceResult.toCampDistribution`
6. Synthesis rendering, citation rules, boundary classifier
   `SynthesisAgent.doSynthesize`, `SynthesisAgent.buildUserPrompt`, `SynthesisAgent.collectCriticalViolations`,
   `SynthesisAgent.buildSectionCitationPools`, `SynthesisAgent.classifyBoundaryTopicIndexes`
7. Critic quality signals
   `CriticAgent.critique`

### Crawler and relevance logic map

All core logic is in `PulseOrchestrator`.

1. Pre analysis strict filtering
   `tightenCrawledPosts`
2. Anchor construction
   `buildRelevanceAnchors`, `collectAnchorTokens`
3. Hard reject and low signal noise checks
   `isHardIrrelevantPost`, `looksLikeLowSignalNoise`, `hashtagCount`
4. Relevance scoring
   `postRelevanceScore`, `crawledPostRelevanceScore`
5. Global dedupe and top N merge
   `projectCrawledPosts`
6. Topic assignment rule scoring
   `scorePostAcrossTopics`, `topicMatchScore`
7. Boundary LLM classification for ambiguous posts
   `buildTopicBuckets` calling `SynthesisAgent.classifyBoundaryTopicIndexes`
8. Bucket ranking
   `recencyScore`, `evidenceScore`, `sortScore`
9. Coverage diagnostics
   `buildCrawlerStats`

### Citation and quick take logic map

1. Evidence quote collection
   `collectEvidenceQuotes`, `addEvidenceQuotes`
2. Claim level evidence ranking
   `rankEvidenceForClaim`, `pickEvidenceUrlsForClaim`
3. Citation index extraction and pairing checks
   `buildCitationIndexByUrl`, `extractCitationPair`, `isMechanicalCitationPairing`
4. Anti pattern rewrite of second claim citations
   `pickAlternativeUrlsForSecondClaim`, `findBestNonMechanicalPair`
5. Quick take final rendering
   `buildQuickTake`, `renderEvidenceRefs`

## Frontend runtime architecture

### State machine and transport

1. Main hook
   `frontend/src/hooks/usePulse.js`
2. Run states
   `idle`, `loading`, `complete`, `error`
3. SSE first then analyze request flow
   `connectSSE` then `analyzeTopic` in `submit`
4. Run cancellation
   `cancelRun` in `usePulse`

### API normalization and contract shaping

Main file:
`frontend/src/lib/api.js`

Key functions:

1. `analyzeTopic`
   HTTP call and timeout
2. `normalizeReport`
   Converts backend payload to render safe frontend object
3. `buildCanonicalCitationSources`
   Preserves backend source order and URL based dedupe
4. `connectSSE`
   EventSource wrapper with readiness promise
5. `keepAlive`
   Periodic health ping

### Report rendering composition

Main screen:
`frontend/src/App.jsx`

Section composition:

1. Search and submit
   `SearchBar`
2. Loading theater
   `AgentTheaterLoading`
3. Frontline verdict with inline citations
   `parseCitations` from `SemanticSourceChip`
4. Confidence and metric dashboard
   `DramaScoreboard`
5. Sentiment and camp split
   `SentimentChart`, `CampBattleBoard`
6. Controversy feed
   `ControversyAccordion`
7. Integrity panel
   `SynthesisReport`
8. Bottom action bar
   fixed share and new query controls

### Controversy data mapping

File:
`frontend/src/lib/controversyMapper.js`

Flow:

1. Prefer backend `topicBuckets` when present
   `buildDataFromTopicBuckets`
2. Filter Twitter JS shell artifacts
   `isTwitterShellText`
3. Preserve ranking metadata from backend posts
   `evidenceScore`, `recencyScore`, `sortScore`, `classificationMethod`
4. Fallback to representative quotes when buckets are missing
   `buildControversyBoardData`

### Mobile and desktop loading isolation

1. Device switch wrapper
   `frontend/src/components/AgentTheaterLoading.jsx`
2. Desktop implementation
   `frontend/src/components/AgentTheaterLoadingDesktop.jsx`
3. Mobile implementation
   `frontend/src/components/AgentTheaterLoadingMobile.jsx`
4. Mobile CSS namespace
   `frontend/src/App.css`
   Classes prefixed with `.theater-mobile-`

## API contract essentials

### Public endpoints

1. `POST /api/pulse/analyze`
2. `GET /api/pulse/stream`
3. `GET /api/actuator/health`

Compatibility routes:

1. `POST /pulse/analyze`
2. `GET /pulse/stream`

### Backend response model

Canonical payload type:
`backend/src/main/java/com/odieyang/pulse/model/PulseReport.java`

Frontend critical fields and owning logic:

1. `quickTake`
   built in orchestrator `buildQuickTake`
2. `claimEvidenceMap`
   built in orchestrator `buildClaimEvidenceMap`
3. `allPosts`, `topicBuckets`, `crawlerStats`
   built in orchestrator `projectCrawledPosts`, `buildTopicBuckets`, `buildCrawlerStats`
4. `claimAnnotations`, `riskFlags`, `revisionAnchors`
   built in orchestrator `buildClaimAnnotations`, `buildRiskFlags`, `buildRevisionAnchors`
5. `citationSources`
   frontend derived field in `buildCanonicalCitationSources`

## Configuration and packaging

### Runtime properties

Property file:
`backend/src/main/resources/application.properties`

Critical groups:

1. OpenAI model and API key
2. Tavily key and result cap
3. CORS origins
4. Crawler limits and relevance thresholds
5. Debate confidence threshold

### Build pipeline

Build file:
`backend/pom.xml`

Packaging behavior:

1. Install Node and npm in Maven `prepare-package`
2. Run frontend `npm install`
3. Run frontend `npm run build`
4. Copy `frontend/dist` into `backend` static resources
5. Produce one Spring Boot jar containing API plus frontend assets
