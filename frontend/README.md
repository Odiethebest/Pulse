# pulse-frontend

> React frontend for [Pulse](https://github.com/Odiethebest/pulse) — a multi-agent public opinion analysis system. Visualizes real-time agent execution, cross-platform sentiment, and AI-generated reports.

---

## Overview

pulse-frontend connects to the Pulse Spring Boot backend and provides a live, interactive interface for public opinion analysis. Users enter any topic or event; the UI streams agent execution in real time via SSE, then renders a structured report with sentiment charts, representative quotes, and a confidence assessment.

---

## Features

- **Real-time agent graph** — React Flow visualization showing each agent's execution state (idle → running → complete) as events stream in
- **Live output feed** — SSE-driven text log displaying agent activity as it happens
- **Sentiment comparison** — side-by-side Reddit vs. Twitter sentiment breakdown with grouped bar charts
- **Confidence gauge** — circular SVG gauge scored 0–100, color-coded by reliability zone
- **Representative quotes** — cards showing verbatim quotes from each platform with source links and sentiment labels
- **Synthesis report** — final AI-generated analysis with debate round indicator and expandable critic notes

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | React 19 + Vite |
| Styling | Tailwind CSS |
| Agent visualization | React Flow (`@xyflow/react`) |
| Charts | Recharts |
| State management | Custom `usePulse` hook |
| Real-time streaming | EventSource (SSE) |

---

## Prerequisites

- Node.js 18+
- [Pulse backend](https://github.com/Odiethebest/pulse) running on `http://localhost:8080`

---

## Getting Started

```bash
# Clone the repository
git clone https://github.com/Odiethebest/pulse-frontend.git
cd pulse-frontend

# Install dependencies
npm install

# Start development server
npm run dev
```

The app will be available at `http://localhost:5173`.

The Vite dev server proxies all `/api/*` requests to `http://localhost:8080`, so no CORS configuration is needed during development.

---

## Project Structure

```
src/
├── App.jsx                     # Root component, global state distribution
├── components/
│   ├── SearchBar.jsx           # Topic input and submit
│   ├── AgentGraph.jsx          # React Flow execution graph
│   ├── ConfidenceGauge.jsx     # SVG circular confidence gauge
│   ├── LiveOutput.jsx          # Streaming SSE event log
│   ├── SentimentChart.jsx      # Reddit vs. Twitter Recharts bar chart
│   ├── QuoteCards.jsx          # Representative quote grid
│   └── SynthesisReport.jsx     # Final report with critic accordion
├── hooks/
│   └── usePulse.js             # All fetching, SSE, and state logic
└── lib/
    └── api.js                  # API calls and SSE connection management
```

---

## Architecture

All data fetching and streaming logic lives in the `usePulse` hook. Components are purely presentational and receive data as props from `App.jsx`.

```
usePulse
  ├── opens SSE connection → /api/pulse/stream
  ├── calls POST /api/pulse/analyze
  ├── accumulates AgentEvent[] as SSE messages arrive
  ├── drives AgentGraph node states in real time
  └── on response → sets PulseReport, closes SSE
```

**State machine:**

```
idle → loading → complete
                    └→ idle (new query)
```

---

## Backend API

This frontend expects the following endpoints from the Pulse backend:

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/pulse/analyze` | Submit a topic, returns `PulseReport` |
| `GET` | `/api/pulse/stream` | SSE stream of `AgentEvent` objects |

### PulseReport shape

```typescript
{
  topic: string
  topicSummary: string
  redditSentiment: SentimentResult
  twitterSentiment: SentimentResult
  platformDiff: string
  synthesis: string
  critique: CriticResult
  confidenceScore: number
  debateTriggered: boolean
  executionTrace: AgentEvent[]
}
```

### AgentEvent shape

```typescript
{
  agentName: string        // e.g. "QueryPlannerAgent"
  status: "STARTED" | "COMPLETED" | "FAILED"
  summary: string
  durationMs: number
  timestamp: string
}
```

---

## Design System

- **Background:** `#0f0f0f` (page), `#1a1a1a` (cards), `#2a2a2a` (borders)
- **Accent:** `#3b82f6` (active/running states)
- **Positive:** `#22c55e` — **Negative:** `#ef4444` — **Neutral:** `#6b7280`
- **Typography:** Inter / system-ui
- **Style:** flat dark UI — no gradients, no glassmorphism

---

## Scripts

```bash
npm run dev        # Start development server (localhost:5173)
npm run build      # Production build
npm run preview    # Preview production build locally
```

---

## Related

- [pulse](https://github.com/Odiethebest/pulse) — Spring Boot backend
