# Pulse
> A multi-agent public opinion analysis system. Input any topic or event, and Pulse dispatches specialized AI agents to scrape, analyze, debate, and synthesize what the internet actually thinks.

When trending events break, most teams waste time doing manual tab switching across X and Reddit.
Pulse is built to replace that workflow with one query and one defensible report.

## What You Get

1. A frontline verdict you can read in seconds.
2. Cross-platform sentiment and camp split from X and Reddit.
3. Controversy lenses with source-grounded quote cards.
4. Confidence, heat, polarization, and flip risk signals.
5. A live execution trace so the process is visible, not a black box.

## Under the Hood in One Minute

1. Query planner converts one topic into platform-specific retrieval strategy.
2. Reddit and Twitter agents fetch raw public discussions in parallel.
3. Analysis agents extract sentiment, stance, conflict, aspect, and flip-risk signals.
4. Synthesis agent drafts the report and critic agent audits quality.
5. If quality is weak, one guided rewrite runs before final output.

## Quick Start

Local development:

```bash
cd backend
cp .env.example .env
./mvnw spring-boot:run
```

In another terminal:

```bash
cd frontend
npm install
npm run dev
```

Container build:

```bash
docker build -t pulse:latest .
```

## Documentation

Product docs:

1. [Inspiration](Doc/inspiration.md)
2. [UIUX design](Doc/UIUX-design.md)
3. [Agent system design](Doc/agent-design.md)

Developer docs:

1. [Developer docs index](Doc/for-developer/README.md)
2. [Architecture and core logic](Doc/for-developer/architecture-and-core-logic.md)
3. [API contract](Doc/for-developer/api-contract.md)
4. [Design principles](Doc/for-developer/design-principles.md)
5. [UIUX implementation guide](Doc/for-developer/uiux-guidelines.md)
6. [Operations and maintenance](Doc/for-developer/operations-maintenance.md)
7. [Testing and quality](Doc/for-developer/testing-quality.md)

## Built By

By **Odie Yang**.

Live demo: **[pulse.odieyang.com](https://pulse.odieyang.com)**

More work: **[odieyang.com](https://odieyang.com)**
