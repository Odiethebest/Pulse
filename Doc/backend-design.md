# Pulse Backend Design

## 1. Scope

This document defines the backend design for Pulse.  
It covers backend runtime behavior, module boundaries, configuration, and build concerns.

It does not define cross-system communication contracts.  
See `Doc/structure.md` for API and backend-frontend interaction details.

## 2. Design Objectives

- Provide deterministic backend orchestration for a multi-agent sentiment pipeline.
- Keep domain modeling explicit with strongly typed records.
- Preserve runtime observability through structured execution events.
- Maintain deployability as a single Spring Boot service.

## 3. Technology Baseline

- Java 21
- Spring Boot 3.4.4
- Spring AI 1.0.0
- Reactor (SSE event stream publishing)
- Maven

## 4. Code Organization

Backend source root: `backend/src/main/java/com/odieyang/pulse`

Package responsibilities:

- `agent`
  - Pure task units for planning, data acquisition, sentiment extraction, synthesis, and critique.
  - Each agent emits execution events and encapsulates its own prompt contract.
- `orchestrator`
  - Coordinates analysis lifecycle and debate-loop control flow.
  - Owns concurrency boundaries (`CompletableFuture`) and final report assembly.
- `service`
  - Infrastructure services (`TavilySearchService`, `AgentEventPublisher`).
- `controller`
  - HTTP entry points and actuator compatibility mapping.
- `config`
  - Bean wiring and runtime behavior toggles (CORS, SPA fallback, AI client).
- `model`
  - Immutable domain records exchanged between components.

## 5. Runtime Behavior

### 5.1 Orchestration

`PulseOrchestrator` is the coordination entry point for topic analysis.  
It executes parallel fetch and parallel sentiment stages, then runs synthesis and critique stages.

### 5.2 Debate Loop

Confidence threshold is controlled by `debate.confidence.threshold`.  
If the critic score is below the threshold, synthesis is re-run once with revision guidance.

### 5.3 Execution Trace

All agents publish `AgentEvent` records via `AgentEventPublisher`.  
The orchestrator subscribes to the event stream during each analysis run and embeds the captured trace in `PulseReport`.

## 6. Configuration Model

Main runtime configuration file:
- `backend/src/main/resources/application.properties`

Required external configuration:
- `OPENAI_API_KEY`
- `TAVILY_API_KEY`

Optional operational settings:
- `CORS_ALLOWED_ORIGINS` (comma-separated)
- `debate.confidence.threshold`

## 7. Error Handling Policy

- Agent-level failures are converted to runtime exceptions after publishing a `FAILED` event.
- Tavily empty payloads degrade gracefully to empty result lists.
- Controller methods return successful responses only when orchestration completes without unhandled exceptions.

## 8. Build and Packaging

Backend build entry point:
- `backend/pom.xml`

Build responsibilities:

- Compile backend sources.
- Produce a single executable Spring Boot jar.

Cross-system packaging integration is specified in `Doc/structure.md`.

## 9. Test Surface

Current automated coverage:
- Spring context boot test (`PublicOpinionAnalysisSystemApplicationTests`)

Recommended next additions:
- Controller contract tests (`/api/pulse/analyze`, `/api/pulse/stream`)
- Orchestrator unit tests with mocked agent boundaries
- Serialization tests for model records
