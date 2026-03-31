# Pulse

**One query. Two platforms. One clear take.**

Pulse is a multi-agent system for fast-moving internet debates.  
You type a topic once, and Pulse turns cross-platform noise into a readable report with evidence, confidence, and risk signals.

## What You Get

1. A frontline verdict you can read in seconds.
2. Cross-platform sentiment and camp split from Reddit and X.
3. Controversy lenses with source-grounded quote cards.
4. Confidence, heat, polarization, and narrative flip risk.
5. A visible execution trace so the process is not a black box.

## Quick Start

Requirements:

1. Java 21
2. Node.js 22.12 or newer
3. OpenAI API key
4. Tavily API key

Setup:

```bash
cd backend
cp .env.example .env
cd ../frontend
npm install
```

Run in two terminals:

Terminal A

```bash
cd backend
./mvnw spring-boot:run
```

Terminal B

```bash
cd frontend
npm run dev
```

Local endpoints:

1. Frontend: `http://localhost:5173`
2. Backend: `http://localhost:8080`

## API

1. `POST /api/pulse/analyze`
2. `GET /api/pulse/stream`
3. `GET /api/actuator/health`

Compatibility routes remain available:

1. `POST /pulse/analyze`
2. `GET /pulse/stream`

## Documentation Map

Product-facing docs:

1. [Inspiration story](Doc/inspiration.md)
2. [UIUX design narrative](Doc/UIUX-design.md)
3. [Agent system design narrative](Doc/agent-design.md)

Developer docs:

1. [Developer docs index](Doc/for-developer/README.md)
2. [Architecture and core logic](Doc/for-developer/architecture-and-core-logic.md)
3. [Design principles](Doc/for-developer/design-principles.md)
4. [UIUX implementation guide](Doc/for-developer/uiux-guidelines.md)
5. [Operations and maintenance](Doc/for-developer/operations-maintenance.md)
6. [Testing and quality](Doc/for-developer/testing-quality.md)

## Built By

Built by **Odie Yang**.  
Want to see it in action right now? Try the live demo at **[pulse.odieyang.com](https://pulse.odieyang.com)**.  
For more projects and updates, check out **[odieyang.com](https://odieyang.com)**.
