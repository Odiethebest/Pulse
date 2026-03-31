# Pulse Operations and Maintenance

## Runtime requirements

1. Java 21
2. Node.js 22.12 or newer
3. OpenAI API key
4. Tavily API key

Primary config files:

1. `backend/src/main/resources/application.properties`
2. `backend/.env` for local development

## Standard run commands

### Local development

1. `cd backend && ./mvnw spring-boot:run`
2. `cd frontend && npm run dev`

### Production package run

1. `cd backend && ./mvnw clean package`
2. `cd backend/target && java -jar pulse-*.jar`

Backend packaging includes frontend build and static asset copy.

## Health checks

### HTTP checks

1. `GET /api/actuator/health`
2. `POST /api/pulse/analyze`
3. `GET /api/pulse/stream`

### Log signals to monitor

1. `Starting analysis for topic`
2. `Relevance filter tightened`
3. `QuickTake Phase2 guard adjusted citation pairing`
4. `Analysis complete`
5. `failed and fallback is used`

### Report level health indicators

1. `crawlerStats.coveragePercent`
2. `crawlerStats.coverageLevel`
3. `crawlerStats.unassignedCount`
4. `crawlerStats.redditCount`
5. `crawlerStats.twitterCount`

## Current configuration baseline

Crawler baseline:

1. `CRAWLER_TARGET_TOTAL=16`
2. `TAVILY_MAX_RESULTS=4`
3. `CRAWLER_RELEVANCE_MIN_SCORE=4`
4. `CRAWLER_RELEVANCE_MIN_RETAIN_COUNT=2`
5. `CRAWLER_RELEVANCE_MIN_RETAIN_RATIO=0.15`
6. `CRAWLER_RELEVANCE_MAX_HASHTAGS=2`
7. `CRAWLER_RELEVANCE_PLATFORM_CAP=8`

Quality baseline:

1. `debate.confidence.threshold=60`
2. `debate.quality.min-density=55`
3. `debate.quality.min-claim-coverage=60`

## Incident handling guide

### Tavily quality or quota issues

Symptoms:

1. Low coverage
2. High noise ratio
3. Frequent warning or critical coverage level

Actions:

1. Validate Tavily key and quota.
2. Check `TAVILY_MAX_RESULTS` and query quality.
3. Inspect `hardRejected` and `strictRejected` logs.

### OpenAI timeout or model failures

Symptoms:

1. Analyze failure
2. Frequent fallback output

Actions:

1. Validate OpenAI key and model access.
2. Verify outbound network reliability.
3. Keep fallback behavior enabled during mitigation.

### Frontend SSE or API transport issues

Symptoms:

1. Loading view stalls
2. Event stream stops
3. UI status moves to error

Actions:

1. Verify `/api/pulse/stream` availability.
2. Verify `VITE_API_BASE` and proxy config.
3. Check browser console for CORS and network errors.

## Release gate

Run all checks before release:

1. `cd backend && ./mvnw test`
2. `cd frontend && npm test`
3. `cd frontend && npm run build`
4. Manual smoke run with one real query
5. Mobile report check for bottom overlap regressions

## Cost and capacity guidance

1. Control candidate size at fetch stage.
2. Keep strict relevance filtering to reduce low value downstream cost.
3. Prioritize service continuity with graceful degradation under load.
