# Pulse Architecture and Core Logic

## Repository structure

1. `backend` holds orchestration agents domain models and service integration.
2. `frontend` holds report rendering state management and client transport code.
3. `Doc` holds active engineering documentation.

## Backend architecture

### Main modules

1. `agent`
   Query planning fetch sentiment stance conflict aspect flip risk synthesis and critic modules.
2. `orchestrator`
   `PulseOrchestrator` controls run lifecycle concurrency and report assembly.
3. `model`
   Immutable records for all transport and report payloads.
4. `service`
   Tavily integration and event stream publishing.
5. `controller`
   HTTP endpoints for analyze stream and health.
6. `config`
   AI client CORS and SPA routing behavior.

### Runtime flow

`PulseOrchestrator.analyze` executes this sequence.

1. Build query plan.
2. Fetch Reddit and Twitter in parallel.
3. Apply crawler relevance gate in `tightenCrawledPosts`.
4. Run sentiment and structure analysis in parallel.
5. Generate synthesis and run critic.
6. Apply one controlled rewrite when quality thresholds fail.
7. Build claim evidence map and quick take lines.
8. Apply citation anti pattern guard to avoid mechanical pair selection.
9. Merge crawled posts using global relevance ranking in `projectCrawledPosts`.
10. Build topic buckets and crawler stats.
11. Return final `PulseReport`.

### Crawler policy in production

1. Target total is 16.
2. Relevance minimum score is 4.
3. Minimum retain count is 2.
4. Minimum retain ratio is 0.15.
5. Maximum hashtags is 2.
6. Per platform cap is 8.

## Frontend architecture

### State and transport

1. `usePulse` owns run state with values idle loading complete and error.
2. SSE stream opens before analyze request.
3. Agent events append to graph state and live log.
4. SSE closes when analyze completes or fails.

### API normalization

`frontend/src/lib/api.js` normalizes backend payloads before render.

1. Normalizes `allPosts` `topicBuckets` and `crawlerStats`.
2. Builds canonical citation source list.
3. Applies safe fallback values for missing fields.

### Report rendering layout

1. `App.jsx` controls screen level layout and transitions.
2. Loading view is isolated by device specific theater components.
3. Report view includes verdict metrics controversy and integrity sections.

## API contract essentials

### Endpoints

1. `POST /api/pulse/analyze`
2. `GET /api/pulse/stream`
3. `GET /api/actuator/health`

Legacy compatibility endpoints remain available.

1. `POST /pulse/analyze`
2. `GET /pulse/stream`

### Fields required by frontend

1. `quickTake`
2. `allPosts`
3. `topicBuckets`
4. `crawlerStats`
5. `claimEvidenceMap`
6. `claimAnnotations`
7. `riskFlags`
8. `revisionAnchors`

## Configuration and packaging

### Runtime configuration

Primary file is `backend/src/main/resources/application.properties`.

Required keys:

1. `OPENAI_API_KEY`
2. `TAVILY_API_KEY`

Important crawler and quality settings:

1. `CRAWLER_TARGET_TOTAL`
2. `CRAWLER_RELEVANCE_MIN_SCORE`
3. `CRAWLER_RELEVANCE_PLATFORM_CAP`
4. `debate.confidence.threshold`
5. `debate.quality.min-density`
6. `debate.quality.min-claim-coverage`

### Build integration

`backend/pom.xml` runs frontend install and build during backend package.

1. Installs Node and npm.
2. Runs frontend dependency install.
3. Builds frontend assets.
4. Copies `frontend/dist` into backend static output.

Result is one deployable backend artifact with embedded frontend.
