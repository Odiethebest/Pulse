# Pulse 🔍

> A multi-agent public opinion analysis system. Input any topic or event — Pulse dispatches a team of specialized AI agents to scrape, analyze, debate, and synthesize what the internet actually thinks about it.

---

## What It Does

Most sentiment tools give you a number. Pulse gives you a **reasoned report**.

You type in a topic — say, *"OpenAI releases GPT-5"* — and Pulse:

1. Breaks it down into targeted search queries across Reddit and Twitter/X
2. Dispatches parallel agents to fetch real public discussions via Tavily Search
3. Runs independent sentiment analysis on each platform
4. Synthesizes a cross-platform opinion report
5. Runs a **Critic agent** that challenges the report for bias, unsupported claims, and echo chamber effects
6. If confidence is low, triggers a second synthesis round to correct the conclusions
7. Streams every agent's execution state in real time via SSE

The result isn't just "60% positive." It's: *here's what Reddit thinks, here's what Twitter thinks, here's where they diverge, here's why you should or shouldn't fully trust this conclusion.*

---

## Architecture

```
user input (topic)
        │
        ▼
 QueryPlannerAgent        generates targeted search queries per platform
        │
        ▼
   ┌────┴────┐
   ▼         ▼
RedditAgent  TwitterAgent    parallel Tavily search, raw post extraction
   │         │
   ▼         ▼
SentimentAgent (×2)          sentiment classification + representative quote extraction
   │         │
   └────┬────┘
        ▼
 SynthesisAgent              merges both platforms, identifies divergence
        │
        ▼
  CriticAgent                LLM-as-Judge: bias check, confidence scoring
        │
   score < 60?
    yes │      no │
        ▼          ▼
 SynthesisAgent   final output
  (round 2)
        │
        ▼
   PulseReport
```

All agent execution events are published in real time via SSE, making the entire reasoning process observable from the frontend.

---

## Agent Responsibilities

### QueryPlannerAgent
Converts a vague user topic into a concrete search strategy. Generates 2–3 search angles per platform (supporter view, skeptic view, neutral discussion). Reddit queries are domain-scoped; Twitter queries use hashtag-style phrasing.

### RedditAgent / TwitterAgent
Each agent calls the Tavily Search API with platform-specific domain filters. Fetches the top results per query and returns raw post content with source URLs. No analysis at this layer — just clean data collection.

### SentimentAgent
Runs independently on Reddit and Twitter data. Extracts:
- Sentiment distribution (positive / negative / neutral ratios)
- 2–3 main controversy points
- 3–5 representative verbatim quotes with source links

### SynthesisAgent
Merges both sentiment results and identifies cross-platform divergence (Reddit and Twitter audiences often react very differently to the same event). Called twice in the debate loop: once for the initial report, once with critic feedback for correction.

### CriticAgent
Implements the LLM-as-Judge pattern. Asks three core questions:
1. Are there claims in the report that aren't supported by the data?
2. Is there sampling bias or echo chamber risk in the sources?
3. Does the conclusion overreach beyond what the data can support?

Outputs a 0–100 confidence score. Scores below 60 trigger a second synthesis round.

---

## Data Model

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
    int confidenceScore,
    String revisionSuggestions
)

record AgentEvent(
    String agentName,
    String status,        // STARTED | COMPLETED | FAILED
    String summary,
    long durationMs,
    Instant timestamp
)
```

---

## API

### Run an analysis
```
POST /pulse/analyze
Content-Type: application/json

{ "topic": "OpenAI releases GPT-5" }
```

Returns a `PulseReport` JSON object.

### Stream agent execution events
```
GET /pulse/stream
Accept: text/event-stream
```

Returns a real-time SSE stream of `AgentEvent` objects. Connect before calling `/analyze` to see the full execution trace.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Backend framework | Spring Boot 3.4 |
| AI orchestration | Spring AI 1.0 |
| LLM | OpenAI GPT-4o-mini |
| Web search | Tavily Search API |
| Real-time streaming | Spring WebFlux SSE (Reactor `Sinks`) |
| Observability | Spring Boot Actuator |
| Frontend (planned) | React + React Flow |

---

## Local Setup

### Prerequisites
- Java 21
- Maven 3.9+
- OpenAI API key
- Tavily API key (free tier at [app.tavily.com](https://app.tavily.com))

### Configuration

Create a `.env` file in the project root (never commit this):

```
OPENAI_API_KEY=sk-...
TAVILY_API_KEY=tvly-...
```

### Run

```bash
./mvnw spring-boot:run
```

The server starts on `http://localhost:8080`.

### Test a query

```bash
curl -X POST http://localhost:8080/pulse/analyze \
  -H "Content-Type: application/json" \
  -d '{"topic": "OpenAI releases GPT-5"}'
```

---

## Design Decisions

**Why parallel agent execution?**
Reddit and Twitter searches are independent. Running them concurrently with `CompletableFuture` cuts total latency roughly in half compared to sequential execution.

**Why a Critic-Synthesis debate loop?**
A single synthesis pass has no mechanism to catch its own overreach. The Critic agent applies consistent evaluation criteria — sampling bias, echo chamber risk, data scope — that the synthesis agent isn't optimized to self-apply. This pattern is adapted from LLM-as-Judge evaluation work in production scoring pipelines.

**Why cap the debate loop at 2 rounds?**
Confidence doesn't always converge. A hard cap prevents runaway loops while still giving the system one correction opportunity. The confidence threshold (default: 60) is externalized to configuration so it can be tuned without code changes.

**Why Tavily instead of direct Reddit/Twitter APIs?**
Reddit's API access has become significantly restricted. Twitter/X requires paid API access for meaningful search volume. Tavily provides clean, aggregated web search results with domain filtering — enough to demonstrate the architecture without API approval overhead.

---

## Roadmap

- [ ] React + React Flow frontend with live agent execution visualization
- [ ] Benchmark page: compare report quality with vs. without the Critic agent
- [ ] Redis-backed semantic caching for repeated topics
- [ ] Support for additional platforms (Hacker News, LinkedIn)
- [ ] Confidence trend tracking across multiple queries on the same topic

---

## Inspiration

Architecture inspired by the Spring AI multi-agent workshop at JavaOne 2026. Domain, agent design, Critic-Synthesis debate loop, and all implementation are original.