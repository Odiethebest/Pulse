# Pulse Operations and Maintenance

## Runtime prerequisites

1. Java 21
2. Node.js 22.12.0 and npm 10.8.2 for packaging path in Maven
3. OpenAI API key
4. Tavily API key

Reference files:

1. Backend property baseline
   `backend/src/main/resources/application.properties`
2. Backend env template
   `backend/.env.example`
3. Frontend scripts and toolchain
   `frontend/package.json`

## Runtime configuration map

### Required keys

1. `OPENAI_API_KEY`
2. `TAVILY_API_KEY`

### Important service properties and owning logic

1. `tavily.max-results`
   Used by `TavilySearchService`
2. `debate.confidence.threshold`
   Used by `PulseOrchestrator.buildRewriteGuidance`
3. `crawler.target-total`
   Used by `PulseOrchestrator.projectCrawledPosts` and `buildCrawlerStats`
4. `crawler.relevance.min-score`
   Used by `PulseOrchestrator.tightenCrawledPosts`
5. `crawler.relevance.min-retain-count`
   Used by `tightenCrawledPosts`
6. `crawler.relevance.min-retain-ratio`
   Used by `tightenCrawledPosts`
7. `crawler.relevance.max-hashtags`
   Used by `isHardIrrelevantPost` and `postRelevanceScore`
8. `crawler.relevance.platform-cap`
   Used by `tightenCrawledPosts` and `projectCrawledPosts`
9. `cors.allowed-origins`
   Used by `backend/src/main/java/com/odieyang/pulse/config/CorsConfig.java`

## Standard run commands

### Local development

1. Backend
   `cd backend && ./mvnw spring-boot:run`
2. Frontend
   `cd frontend && npm run dev`

### Production package and run

1. Build
   `cd backend && ./mvnw clean package`
2. Run
   `cd backend/target && java -jar pulse-*.jar`

## Build and packaging flow

Defined in:
`backend/pom.xml`

Packaging sequence in `prepare-package`:

1. Install Node and npm via `frontend-maven-plugin`
2. Run `npm install` in `../frontend`
3. Run `npm run build` in `../frontend`
4. Remove old static directory in backend target classes
5. Copy `frontend/dist` into backend static resources
6. Build Spring Boot jar with embedded frontend assets

## API and transport health checks

### HTTP checks

1. `GET /api/actuator/health`
2. `POST /api/pulse/analyze`
3. `GET /api/pulse/stream`

### Frontend transport path

1. Analyze call
   `frontend/src/lib/api.js` `analyzeTopic`
2. SSE
   `frontend/src/lib/api.js` `connectSSE`
3. Keep alive ping
   `frontend/src/lib/api.js` `keepAlive`

## Logging and observability

### Primary backend log markers

1. `Starting analysis for topic`
   from `PulseOrchestrator.analyze`
2. `Relevance filter tightened`
   from `tightenCrawledPosts`
3. `QuickTake Phase2 guard adjusted citation pairing`
   from `applyQuickTakeMechanicalPairingGuard`
4. `Analysis complete`
   from `PulseOrchestrator.analyze`
5. `failed and fallback is used`
   from `safeRun`

### Runtime report diagnostics fields

1. `crawlerStats.coveragePercent`
2. `crawlerStats.coverageLevel`
3. `crawlerStats.coverageAlerts`
4. `crawlerStats.unassignedCount`
5. `crawlerStats.redditCount`
6. `crawlerStats.twitterCount`

## Incident runbook

### A. Low quality or noisy crawl output

Symptoms:

1. Many low value cards in controversy feed
2. Low `coveragePercent` with high `unassignedCount`
3. Query feels semantically off topic

Primary diagnostics:

1. `PulseOrchestrator.tightenCrawledPosts`
2. `PulseOrchestrator.isHardIrrelevantPost`
3. `PulseOrchestrator.projectCrawledPosts`

Actions:

1. Verify Tavily quota and response quality.
2. Check `tavily.max-results` and crawler relevance properties.
3. Inspect logs for `hardRejected` and `strictRejected` behavior.

### B. Twitter shell page contamination

Symptoms:

1. Post text contains JavaScript blocked boilerplate.
2. Controversy cards show browser support copy.

Primary diagnostics:

1. `TwitterAgent.isTwitterJavascriptShell`
2. Frontend fallback filter `controversyMapper.isTwitterShellText`

Actions:

1. Confirm backend Twitter shell filtering is active.
2. Confirm frontend filter still removes fallback shell text.
3. Add regression case if new shell pattern appears.

### C. OpenAI model failure or timeout

Symptoms:

1. Analyze call fails or degrades heavily.
2. Output fallback appears frequently.

Primary diagnostics:

1. `PulseOrchestrator.safeRun`
2. `SynthesisAgent.doSynthesize`
3. `CriticAgent.critique`

Actions:

1. Validate API key and model access.
2. Confirm outbound network path.
3. Keep graceful degradation enabled while mitigated.

### D. SSE or frontend transport failure

Symptoms:

1. Loading view stalls without progression.
2. UI switches to error during active run.

Primary diagnostics:

1. `connectSSE` in frontend
2. `AgentEventPublisher.stream` in backend
3. Browser network and console traces

Actions:

1. Verify `/api/pulse/stream` from browser environment.
2. Validate frontend `VITE_API_BASE` and Vite proxy config.
3. Validate CORS property for deployment domain.

## Release checklist

1. `cd backend && ./mvnw test`
2. `cd frontend && npm test`
3. `cd frontend && npm run build`
4. Smoke test analyze and SSE with one real topic
5. Mobile check
   report bottom section visible and not covered by action controls
6. Citation check
   frontline references are not fixed pattern pairs

## Capacity and cost notes

1. Keep crawl size bounded by `crawler.target-total` and per platform cap.
2. Keep strict relevance filtering enabled to reduce downstream LLM token load.
3. Preserve fallback behavior to avoid full run failure under partial dependency outages.
