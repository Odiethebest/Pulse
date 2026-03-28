# CLAUDE.md — Pulse Backend (Current State)

This document reflects the current backend implementation under `backend/`.

## 1. Scope

- Service type: Spring Boot API + SSE + static frontend hosting.
- Core capability: multi-agent sentiment synthesis for a topic across Reddit and Twitter/X.
- Source-of-truth code root: `backend/src/main/java/com/odieyang/pulse`.

## 2. Tech Stack

- Java 21
- Spring Boot 3.4.4
- Spring AI 1.0.0 (`ChatClient` + OpenAI model)
- Spring Web + WebFlux (SSE streaming)
- Reactor `Sinks.Many` for in-process event fan-out
- Maven build with frontend bundling integration

## 3. Runtime Architecture

Pipeline entrypoint is `PulseOrchestrator#analyze(String topic)`.

Execution stages:

1. `QueryPlannerAgent` builds Reddit/Twitter query sets + topic summary.
2. `RedditAgent` and `TwitterAgent` fetch posts in parallel using Tavily.
3. `SentimentAgent` runs in parallel per platform.
4. `SynthesisAgent` creates first synthesis report.
5. `CriticAgent` critiques report and emits confidence score.
6. If `confidenceScore < debate.confidence.threshold` (default 60), `SynthesisAgent` runs one revision pass with critic suggestions.
7. Orchestrator assembles `PulseReport` with full trace.

All stages emit `AgentEvent` (`STARTED`, `COMPLETED`, `FAILED`) through `AgentEventPublisher`.

## 4. Package Map (Actual Files)

```text
backend/src/main/java/com/odieyang/pulse/
├── PublicOpinionAnalysisSystemApplication.java
├── agent/
│   ├── QueryPlannerAgent.java
│   ├── RedditAgent.java
│   ├── TwitterAgent.java
│   ├── SentimentAgent.java
│   ├── SynthesisAgent.java
│   └── CriticAgent.java
├── config/
│   ├── AiConfig.java
│   ├── CorsConfig.java
│   └── SpaFallbackFilter.java
├── controller/
│   ├── PulseController.java
│   └── ApiHealthController.java
├── model/
│   ├── AgentEvent.java
│   ├── CriticResult.java
│   ├── PulseReport.java
│   ├── QueryPlan.java
│   ├── Quote.java
│   ├── RawPost.java
│   ├── RawPosts.java
│   └── SentimentResult.java
├── orchestrator/
│   └── PulseOrchestrator.java
└── service/
    ├── AgentEventPublisher.java
    └── TavilySearchService.java
```

## 5. HTTP + SSE Contract

Primary API paths:

- `POST /api/pulse/analyze`
- `GET /api/pulse/stream`
- `GET /api/actuator/health`

Legacy compatibility paths still accepted:

- `POST /pulse/analyze`
- `GET /pulse/stream`

Notes:

- `/api/actuator/health` is a wrapper endpoint from `ApiHealthController`.
- SSE endpoint emits JSON-serialized `AgentEvent`.

## 6. Configuration

Runtime properties in `backend/src/main/resources/application.properties`.

Required env vars:

- `OPENAI_API_KEY`
- `TAVILY_API_KEY`

Optional env vars/properties:

- `CORS_ALLOWED_ORIGINS` (comma-separated)
- `debate.confidence.threshold` (default `60`)

Default OpenAI model:

- `spring.ai.openai.chat.options.model=gpt-4o-mini`

## 7. Tavily Integration

`TavilySearchService` uses `RestClient` to call:

- `POST https://api.tavily.com/search`

Request shape:

- `api_key`
- `query`
- `include_domains` (`reddit.com` or `twitter.com`/`x.com`)
- `max_results=5`

Empty/invalid Tavily payloads degrade to an empty list.

## 8. Event Streaming Semantics

- `AgentEventPublisher` uses `Sinks.many().multicast().onBackpressureBuffer()`.
- `PulseController#stream()` returns `publisher.stream()` as SSE.
- `PulseOrchestrator` subscribes to publisher stream per request and captures events into `executionTrace`.

Implementation caveat:

- Stream is global in-process broadcast, not per-request isolated channel.

## 9. Frontend Hosting in Backend

- Maven `prepare-package` installs Node `v22.12.0` + npm `10.8.2`.
- Runs frontend `npm install` and `npm run build`.
- Copies `frontend/dist` to backend output static directory.
- `SpaFallbackFilter` forwards non-API HTML GET routes to `/index.html`.

Result: one Spring Boot jar can serve API + frontend.

## 10. Testing Status

Current automated tests:

- `PublicOpinionAnalysisSystemApplicationTests#contextLoads` only.

Recommended next tests:

- Controller contract tests (`/api/pulse/analyze`, `/api/pulse/stream`)
- Orchestrator unit tests (with mocked agents)
- Model serialization tests for API/SSE payload stability
