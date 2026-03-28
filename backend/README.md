# Pulse - Original by Odie
> A multi-agent public opinion analysis system. Input any topic or event — Pulse dispatches a team of specialized AI agents to scrape, analyze, debate, and synthesize what the internet actually thinks about it.
When sudden trending events, major industry shifts, or blockbuster product launches happen, do you want to quickly understand public sentiment? Let Pulse handle the overwhelming noise of social media.

Enter a topic you care about, and Pulse automatically orchestrates a Multi-Agent team to capture massive amounts of discussion across Twitter and Reddit in real-time, extracting core insights just for you:

* **Overall Sentiment Trend:** Is the general public supportive or opposed?
* **Cross-Platform Comparison:** How do views diverge between Twitter and Reddit users?
* **Representative Voices:** Distills the most valuable, unvarnished user quotes.
* **Confidence Assessment:** Clearly tells you how reliable the analysis results are.

**Exclusive Feature: Panoramic Workflow Display.**
Like your own private intelligence command center, you can watch the AI team collaborate in real-time—from information retrieval and sentiment analysis to cross-validation and debate between different AI perspectives, everything is visible at a glance.

**In a nutshell:** Pulse is your dedicated public opinion monitoring station. Enter a topic, get insights in seconds.

---

## Under the Hood

Most sentiment tools just spit out a percentage. Pulse is designed to give you a reasoned, defensible report.

Here is what happens when you type in a topic (like *"OpenAI releases GPT-5"*):
1. The system breaks it down into targeted search queries for Reddit and Twitter.
2. Parallel agents fetch real, raw public discussions via web search.
3. Independent sentiment analysis runs on the data from each platform.
4. A synthesis step merges the findings into a cross-platform report.
5. A **Critic agent** steps in to challenge the report—looking for bias, unsupported claims, or echo chamber effects.
6. If the Critic's confidence score is too low, it triggers a second synthesis round to fix the blind spots.
7. Every step of this execution state streams to the frontend in real time via SSE.

The result isn't just "60% positive." It tells you exactly what Reddit thinks, what Twitter thinks, where they disagree, and whether you should actually trust the conclusion.

---

## Architecture

```text
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
Turns a vague user topic into a concrete search strategy. It figures out 2-3 search angles per platform (e.g., supporter views, skeptic views, neutral discussions). It uses domain-scoped queries for Reddit and hashtag-style phrasing for Twitter.

### RedditAgent / TwitterAgent
These handle the grunt work. They hit the Tavily Search API with platform-specific filters to grab top results and return raw post content with URLs. There is no analysis happening here—just clean data collection.

### SentimentAgent
Runs independently on the collected Reddit and Twitter data to figure out:
- The overall vibe (positive / negative / neutral split)
- 2-3 main points of controversy
- 3-5 representative verbatim quotes with source links

### SynthesisAgent
Brings everything together. It merges the sentiment results and explicitly calls out where platforms disagree (since Reddit and Twitter audiences rarely react the same way to anything). It gets called twice during the debate loop: once to draft the initial report, and again if the Critic tells it to fix something.

### CriticAgent
This is the built-in skeptic, acting as an LLM-as-Judge. It asks three hard questions:
1. Are there claims in the report that aren't backed up by the raw data?
2. Is there obvious sampling bias or an echo chamber risk?
3. Is the conclusion overreaching?

It outputs a 0-100 confidence score. If it scores below a 60, the SynthesisAgent has to try again to correct its assumptions.

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

## API Details

### Run an analysis
```http
POST /api/pulse/analyze
Content-Type: application/json

{ "topic": "OpenAI releases GPT-5" }
```
Returns a `PulseReport` JSON object.

### Stream agent execution events
```http
GET /api/pulse/stream
Accept: text/event-stream
```
Returns a real-time SSE stream of `AgentEvent` objects. Connect to this before calling `/analyze` if you want to watch the execution trace unfold.

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
- Tavily API key (grab a free tier at app.tavily.com)

### Configuration

Create a `.env` file in the root directory (make sure not to commit this):

```env
OPENAI_API_KEY=sk-...
TAVILY_API_KEY=tvly-...
```

### Run the server

```bash
./mvnw spring-boot:run
```
The server will start on `http://localhost:8080`.

### Frontend (local development)

```bash
cd ../frontend
npm install
npm run dev
```

Vite proxies `/api/*` to `http://localhost:8080`.

### Build single deploy artifact (backend + frontend)

```bash
./mvnw clean package
```

This build compiles frontend assets and embeds them into the Spring Boot jar under `static/`.

### Test it out

```bash
curl -X POST http://localhost:8080/api/pulse/analyze \
  -H "Content-Type: application/json" \
  -d '{"topic": "OpenAI releases GPT-5"}'
```

> Backward compatibility: `/pulse/*` is currently still supported during migration.

---

## Design Decisions

**Why parallel agent execution?**
Reddit and Twitter searches are completely independent. Running them concurrently with `CompletableFuture` cuts the total waiting time roughly in half compared to running them back-to-back.

**Why a Critic-Synthesis debate loop?**
A single synthesis pass can't easily catch its own mistakes. The Critic agent applies a strict set of rules—checking for bias, echo chambers, and unsupported claims—that the synthesis agent isn't naturally optimized to look for. This borrows heavily from LLM-as-Judge evaluation patterns used in production pipelines.

**Why cap the debate loop at 2 rounds?**
Confidence doesn't always converge, and we don't want infinite loops. A hard cap keeps the system responsive while still giving it one solid chance to correct itself. The confidence threshold (defaulting to 60) is externalized to configuration so you can tweak it without touching the core logic.

**Why Tavily instead of direct Reddit/Twitter APIs?**
Reddit's API access has gotten incredibly strict, and Twitter/X requires an expensive paid tier just to get meaningful search volume. Tavily provides clean, aggregated web search results with domain filtering built in, which is more than enough to prove out this architecture without dealing with API approval headaches.

---

## Inspiration

Architecture inspired by the Spring AI multi-agent workshop at JavaOne 2026. Domain, agent design, Critic-Synthesis debate loop, and all implementation are original.
```
