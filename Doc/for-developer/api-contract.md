# Pulse API Contract

## Scope

This document defines the runtime API contract between backend and frontend.
Code is the source of truth, and this document maps key contracts to implementation files.

Contract owners:

1. Controller
   `backend/src/main/java/com/odieyang/pulse/controller/PulseController.java`
2. Health endpoint
   `backend/src/main/java/com/odieyang/pulse/controller/ApiHealthController.java`
3. Response model
   `backend/src/main/java/com/odieyang/pulse/model/PulseReport.java`
4. Event model
   `backend/src/main/java/com/odieyang/pulse/model/AgentEvent.java`
5. Frontend normalizer
   `frontend/src/lib/api.js` `normalizeReport`

## Endpoints

Primary routes:

1. `POST /api/pulse/analyze`
2. `GET /api/pulse/stream`
3. `GET /api/actuator/health`

Compatibility routes:

1. `POST /pulse/analyze`
2. `GET /pulse/stream`

## Analyze Request Contract

Method and path:
`POST /api/pulse/analyze`

Request body:

```json
{
  "topic": "OpenAI releases GPT-5",
  "runId": "optional-run-id",
  "locale": "en-US"
}
```

Field rules:

1. `topic`
   required semantic input topic.
2. `runId`
   optional run-scoped stream key for SSE correlation.
3. `locale`
   optional; defaults to `en-US` when null or blank.

Controller contract type:
`PulseController.AnalyzeRequest`

## Analyze Response Contract

Method and path:
`POST /api/pulse/analyze`

Response body:
JSON serialization of `PulseReport`.

Model file:
`backend/src/main/java/com/odieyang/pulse/model/PulseReport.java`

Contract groups:

1. Core narrative
   `topic`, `topicSummary`, `synthesis`, `platformDiff`, `confidenceScore`, `debateTriggered`
2. Platform sentiment
   `redditSentiment`, `twitterSentiment`
3. Report headline and risk signals
   `quickTake`, `dramaScore`, `polarizationScore`, `heatScore`, `flipRiskScore`, `flipSignals`
4. Evidence and integrity
   `claimEvidenceMap`, `claimAnnotations`, `riskFlags`, `revisionAnchors`, `revisionDelta`
5. Controversy and source coverage
   `controversyTopics`, `allPosts`, `topicBuckets`, `crawlerStats`
6. Execution trace
   `executionTrace`

Backward-compatible constructors remain in `PulseReport`, so older payload variants can still deserialize in tests.

## SSE Event Contract

Method and path:
`GET /api/pulse/stream?runId=<optional>`

Response type:
`text/event-stream`

Event payload model:
`AgentEvent`

```json
{
  "agentName": "SynthesisAgent",
  "status": "COMPLETED",
  "summary": "Drafted synthesis report",
  "durationMs": 481,
  "timestamp": "2026-03-31T19:45:08.123Z"
}
```

Field rules:

1. `status` values are `STARTED`, `COMPLETED`, `FAILED`.
2. If `runId` is provided, stream isolation is run-scoped through `AgentEventPublisher`.

## Health Contract

Method and path:
`GET /api/actuator/health`

Response type:
Spring Boot Actuator `HealthComponent` JSON.

## Frontend Mapping Contract

Frontend receives backend `PulseReport` and normalizes it via:
`frontend/src/lib/api.js` `normalizeReport`.

Frontend critical dependencies:

1. `quickTake`
2. `claimEvidenceMap`
3. `allPosts`, `topicBuckets`, `crawlerStats`
4. `executionTrace`

If backend field names change, update both:

1. backend serialization tests in `backend/src/test/java/com/odieyang/pulse/model/PulseReportSerializationTests.java`
2. frontend normalization tests in `frontend/src/lib/__tests__/apiNormalizeReport.test.js`

## Minimal Smoke Calls

Analyze:

```bash
curl -X POST http://localhost:8080/api/pulse/analyze \
  -H "Content-Type: application/json" \
  -d '{"topic":"OpenAI releases GPT-5","locale":"en-US"}'
```

Stream:

```bash
curl -N "http://localhost:8080/api/pulse/stream"
```
