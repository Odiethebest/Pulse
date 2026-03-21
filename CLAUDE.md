# CLAUDE.md — Pulse

## Project Overview

Pulse is a multi-agent public opinion analysis system built with Spring Boot 3.4 + Spring AI 1.0. Users input a topic or event; the system dispatches specialized agents to fetch, analyze, debate, and synthesize public sentiment from Reddit and Twitter/X.

**Key architectural pattern:** Critic-Synthesis debate loop — the Synthesis agent produces an initial report, the Critic agent evaluates it for bias and confidence, and if confidence < 60 a second synthesis round is triggered with correction guidance.

---

## Tech Stack

- **Java 21**, Spring Boot 3.4.4, Spring AI 1.0.0
- **LLM:** OpenAI GPT-4o-mini via Spring AI `ChatClient`
- **Web search:** Tavily Search API (called via plain HTTP, no SDK)
- **Streaming:** Spring WebFlux SSE using Reactor `Sinks.Many`
- **Build:** Maven

---

## Project Structure

```
src/main/java/com/odieyang/pulse/
├── PulseApplication.java
├── controller/
│   └── PulseController.java        # POST /pulse/analyze, GET /pulse/stream
├── orchestrator/
│   └── PulseOrchestrator.java      # coordinates all agents, owns debate loop
├── agent/
│   ├── QueryPlannerAgent.java
│   ├── RedditAgent.java
│   ├── TwitterAgent.java
│   ├── SentimentAgent.java
│   ├── SynthesisAgent.java
│   └── CriticAgent.java
├── model/
│   ├── PulseReport.java
│   ├── QueryPlan.java
│   ├── RawPosts.java
│   ├── SentimentResult.java
│   ├── Quote.java
│   ├── CriticResult.java
│   └── AgentEvent.java
├── service/
│   ├── TavilySearchService.java    # HTTP client wrapper for Tavily API
│   └── AgentEventPublisher.java    # Reactor Sinks SSE publisher
└── config/
    └── AiConfig.java               # ChatClient bean configuration
```

---

## Data Flow

```
POST /pulse/analyze { topic }
        │
        ▼
PulseOrchestrator.analyze(topic)
        │
        ├─ QueryPlannerAgent.plan(topic) → QueryPlan
        │
        ├─ [parallel] RedditAgent.fetch(queries) → RawPosts
        ├─ [parallel] TwitterAgent.fetch(queries) → RawPosts
        │
        ├─ [parallel] SentimentAgent.analyze(redditPosts) → SentimentResult
        ├─ [parallel] SentimentAgent.analyze(twitterPosts) → SentimentResult
        │
        ├─ SynthesisAgent.synthesize(reddit, twitter) → String
        │
        ├─ CriticAgent.critique(synthesis, reddit, twitter) → CriticResult
        │
        ├─ if CriticResult.confidenceScore < 60:
        │       SynthesisAgent.synthesize(reddit, twitter, critique) → String
        │
        └─ return PulseReport
```

All agents publish `AgentEvent(STARTED)` and `AgentEvent(COMPLETED)` via `AgentEventPublisher` at the start and end of execution.

---

## Key Data Models

```java
record PulseReport(
    String topic,
    String topicSummary,
    SentimentResult redditSentiment,
    SentimentResult twitterSentiment,
    String platformDiff,
    String synthesis,
    CriticResult critique,
    int confidenceScore,
    boolean debateTriggered,
    List<AgentEvent> executionTrace
)

record SentimentResult(
    String platform,
    double positiveRatio,
    double negativeRatio,
    double neutralRatio,
    List<String> mainControversies,
    List<Quote> representativeQuotes
)

record CriticResult(
    List<String> unsupportedClaims,
    List<String> biasConcerns,
    boolean exceedsDataScope,
    int confidenceScore,           // 0-100, triggers round 2 if < 60
    String revisionSuggestions
)

record AgentEvent(
    String agentName,
    String status,                 // STARTED | COMPLETED | FAILED
    String summary,
    long durationMs,
    Instant timestamp
)

record QueryPlan(
    List<String> redditQueries,
    List<String> twitterQueries,
    String topicSummary
)

record RawPosts(
    String platform,
    List<RawPost> posts
)

record RawPost(
    String title,
    String snippet,
    String url
)

record Quote(
    String text,
    String url,
    String sentiment
)
```

---

## Agent Implementation Guidelines

### All agents follow this pattern

```java
@Component
@RequiredArgsConstructor
public class XxxAgent {

    private final ChatClient chatClient;
    private final AgentEventPublisher publisher;

    public Result doWork(Input input) {
        publisher.publish(AgentEvent.started("XxxAgent", inputSummary));
        long start = System.currentTimeMillis();

        // call chatClient here

        publisher.publish(AgentEvent.completed("XxxAgent", summary, System.currentTimeMillis() - start));
        return result;
    }
}
```

### ChatClient usage

Always use structured output where possible:

```java
SomeRecord result = chatClient.prompt()
    .system(SYSTEM_PROMPT)
    .user(userPrompt)
    .call()
    .entity(SomeRecord.class);
```

For free-form text output:

```java
String result = chatClient.prompt()
    .system(SYSTEM_PROMPT)
    .user(userPrompt)
    .call()
    .content();
```

### Prompts

- Define prompts as `private static final String` constants at the top of each agent class
- System prompts define the agent's role and output format
- User prompts inject runtime data
- Always specify JSON output format explicitly when using structured output

---

## TavilySearchService

Tavily is called via plain HTTP POST, not a Spring AI integration. The service wraps the Tavily `/search` endpoint:

```
POST https://api.tavily.com/search
{
  "api_key": "${TAVILY_API_KEY}",
  "query": "...",
  "include_domains": ["reddit.com"],   // or ["twitter.com", "x.com"]
  "max_results": 5
}
```

Use `RestClient` (Spring 6) for the HTTP call. Return a list of `RawPost` records.

---

## AgentEventPublisher

```java
@Component
public class AgentEventPublisher {

    private final Sinks.Many<AgentEvent> sink =
        Sinks.many().multicast().onBackpressureBuffer();

    public void publish(AgentEvent event) {
        sink.tryEmitNext(event);
    }

    public Flux<AgentEvent> stream() {
        return sink.asFlux();
    }
}
```

---

## PulseOrchestrator

Parallel execution pattern using `CompletableFuture`:

```java
// Parallel fetch
CompletableFuture<RawPosts> redditFuture =
    CompletableFuture.supplyAsync(() -> redditAgent.fetch(plan.redditQueries()));
CompletableFuture<RawPosts> twitterFuture =
    CompletableFuture.supplyAsync(() -> twitterAgent.fetch(plan.twitterQueries()));

RawPosts reddit = redditFuture.join();
RawPosts twitter = twitterFuture.join();
```

Same pattern for parallel SentimentAgent calls.

---

## API Endpoints

```
POST /pulse/analyze
Body: { "topic": "string" }
Response: PulseReport (JSON)

GET /pulse/stream
Response: text/event-stream of AgentEvent
```

CORS is configured to allow `http://localhost:5173` for frontend development.

---

## Configuration

`application.properties`:

```properties
spring.application.name=pulse
spring.ai.openai.api-key=${OPENAI_API_KEY}
spring.ai.openai.chat.options.model=gpt-4o-mini
tavily.api-key=${TAVILY_API_KEY}
management.endpoints.web.exposure.include=health,info
debate.confidence.threshold=60
```

All secrets loaded from environment variables. Never hardcode API keys.

---

## Implementation Order

Build in this sequence — each step is independently testable:

1. `AiConfig.java` — ChatClient bean
2. `AgentEventPublisher.java` — SSE sink
3. `TavilySearchService.java` — test with a hardcoded query first
4. `QueryPlannerAgent.java` — test with a few topics, verify QueryPlan output
5. `RedditAgent.java` + `TwitterAgent.java` — verify raw posts are returned
6. `SentimentAgent.java` — verify sentiment ratios and quotes look reasonable
7. `SynthesisAgent.java` — verify report reads well
8. `CriticAgent.java` — verify confidence scores are meaningful
9. `PulseOrchestrator.java` — wire everything together, test debate loop
10. `PulseController.java` — expose endpoints, test SSE stream

---

## What NOT To Do

- Do not add Spring Security — unnecessary complexity for a demo project
- Do not use `@Transactional` or any database — this is a stateless pipeline
- Do not catch and swallow exceptions silently — always log and rethrow or return a failed AgentEvent
- Do not call agents sequentially when they can run in parallel
- Do not hardcode API keys anywhere in source code
- Do not use `Thread.sleep()` for any purpose