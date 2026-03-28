# Pulse System Structure and Dependency Model

## 1. Scope

This document specifies:

- repository-level structure
- module-level dependency relationships
- backend-frontend communication model
- data exchange contracts
- build-time coupling between backend and frontend

It is the canonical cross-system reference for Pulse.

## 2. Repository Skeleton

```text
Pulse/
├─ backend/
│  ├─ pom.xml
│  ├─ mvnw
│  └─ src/
│     ├─ main/
│     │  ├─ java/com/odieyang/pulse/
│     │  │  ├─ agent/
│     │  │  ├─ config/
│     │  │  ├─ controller/
│     │  │  ├─ model/
│     │  │  ├─ orchestrator/
│     │  │  └─ service/
│     │  └─ resources/application.properties
│     └─ test/java/com/odieyang/pulse/
├─ frontend/
│  ├─ package.json
│  ├─ vite.config.js
│  └─ src/
│     ├─ components/
│     ├─ hooks/
│     ├─ lib/
│     ├─ App.jsx
│     └─ main.jsx
└─ Doc/
   ├─ backend-design.md
   ├─ frontend-design.md
   └─ structure.md
```

## 3. Backend Dependency Relationships

## 3.1 Package-Level Dependency Graph

```text
controller -> orchestrator -> agent -> service -> external systems
      \                         \-> model
       \-> service              \-> model
config -> (framework/runtime behavior)
```

`model` is a shared domain layer consumed by `controller`, `orchestrator`, and `agent`.

## 3.2 Class-Level Dependency Map

### Controllers

- `PulseController`
  - depends on `PulseOrchestrator`
  - depends on `AgentEventPublisher`
- `ApiHealthController`
  - depends on Spring `HealthEndpoint`

### Orchestrator

- `PulseOrchestrator`
  - depends on all six agents:
    - `QueryPlannerAgent`
    - `RedditAgent`
    - `TwitterAgent`
    - `SentimentAgent`
    - `SynthesisAgent`
    - `CriticAgent`
  - depends on `AgentEventPublisher`
  - depends on model records for report assembly
  - uses `CompletableFuture` for parallel stages

### Agents

- LLM-backed agents (`QueryPlannerAgent`, `SentimentAgent`, `SynthesisAgent`, `CriticAgent`)
  - depend on `ChatClient`
  - depend on `AgentEventPublisher`
  - consume/produce model records
- Fetch agents (`RedditAgent`, `TwitterAgent`)
  - depend on `TavilySearchService`
  - depend on `AgentEventPublisher`
  - produce `RawPosts`

### Services

- `TavilySearchService`
  - depends on Spring `RestClient`
  - depends on `tavily.api-key`
  - maps HTTP response into `RawPost`
- `AgentEventPublisher`
  - depends on Reactor `Sinks.Many<AgentEvent>`
  - provides internal event stream fan-out

### Config

- `AiConfig` provides `ChatClient` bean from `OpenAiChatModel`
- `CorsConfig` reads `CORS_ALLOWED_ORIGINS` configuration
- `SpaFallbackFilter` enforces SPA routing behavior for non-API HTML requests

## 4. Frontend Dependency Relationships

## 4.1 Module-Level Graph

```text
main.jsx -> App.jsx -> usePulse hook -> api adapter -> backend endpoints
                    -> presentational components
```

## 4.2 Component and Hook Dependencies

- `main.jsx`
  - mounts `App`
- `App.jsx`
  - depends on `usePulse`
  - depends on `keepAlive` from `lib/api.js`
  - depends on rendering components:
    - `SearchBar`
    - `AgentGraph`
    - `ConfidenceGauge`
    - `LiveOutput`
    - `SentimentChart`
    - `QuoteCards`
    - `SynthesisReport`
- `hooks/usePulse.js`
  - depends on `analyzeTopic` and `connectSSE` from `lib/api.js`
  - owns submission lifecycle state machine (`idle`, `loading`, `complete`, `error`)
- `lib/api.js`
  - encapsulates `fetch` requests and `EventSource`
  - resolves base path from `VITE_API_BASE` (default `/api`)

## 4.3 Development-Time Dependency

- `vite.config.js` proxies `/api/*` to `http://localhost:8080`
- frontend has no compile-time dependency on backend source code

## 5. Runtime Communication Topology

## 5.1 Local Development

- frontend origin: `http://localhost:5173`
- backend origin: `http://localhost:8080`
- Vite proxy bridges `/api/*` to backend

## 5.2 Packaged Runtime

- Spring Boot serves:
  - `/api/*` endpoints
  - static frontend assets
- same-origin request model; CORS is optional

## 6. Transport and Protocol

Pulse uses two communication channels:

- HTTP request-response
  - analysis invocation
  - health probing
- Server-Sent Events (`text/event-stream`)
  - execution event stream for progressive UI updates

No WebSocket protocol is used.

## 7. API Contracts

## 7.1 Endpoints

- `POST /api/pulse/analyze`
- `GET /api/pulse/stream`
- `GET /api/actuator/health`

Legacy compatibility currently accepted by backend:
- `/pulse/analyze`
- `/pulse/stream`

## 7.2 Analyze Request

```json
{
  "topic": "OpenAI releases GPT-5"
}
```

## 7.3 Response Contracts

### PulseReport

```json
{
  "topic": "string",
  "topicSummary": "string",
  "redditSentiment": "SentimentResult",
  "twitterSentiment": "SentimentResult",
  "platformDiff": "string",
  "synthesis": "string",
  "critique": "CriticResult",
  "confidenceScore": 0,
  "debateTriggered": false,
  "executionTrace": ["AgentEvent"]
}
```

### SentimentResult

```json
{
  "platform": "reddit|twitter",
  "positiveRatio": 0.0,
  "negativeRatio": 0.0,
  "neutralRatio": 0.0,
  "mainControversies": ["string"],
  "representativeQuotes": ["Quote"]
}
```

### CriticResult

```json
{
  "unsupportedClaims": ["string"],
  "biasConcerns": ["string"],
  "exceedsDataScope": false,
  "confidenceScore": 0,
  "revisionSuggestions": "string"
}
```

### AgentEvent (SSE payload)

```json
{
  "agentName": "string",
  "status": "STARTED|COMPLETED|FAILED",
  "summary": "string",
  "durationMs": 0,
  "timestamp": "ISO-8601 string"
}
```

## 8. End-to-End Interaction Sequence

Standard client sequence:

1. Open SSE stream (`/api/pulse/stream`)
2. Wait for stream readiness
3. Send analyze request (`POST /api/pulse/analyze`)
4. Consume incremental `AgentEvent` payloads from SSE
5. Receive `PulseReport` from HTTP response
6. Close SSE connection

This ordering reduces early-event loss and aligns with current hook implementation.

## 9. Build-Time Dependency and Coupling

`backend/pom.xml` introduces build-time coupling to the frontend:

1. install frontend dependencies
2. execute frontend production build
3. copy `frontend/dist` into backend output static directory

Result:
- one backend package command produces a deployable full-stack artifact
- runtime can be operated as a single service

## 10. Failure and Operational Semantics

Client safeguards:

- analyze request timeout (`AbortController`, 60s)
- SSE parse failures are ignored per message
- SSE transport failure moves UI to `error` during active run

Backend behavior:

- agent failures emit `FAILED` events, then propagate exceptions
- empty Tavily responses degrade to empty post collections
- CORS is configuration-driven via `CORS_ALLOWED_ORIGINS`
