# Pulse Frontend Design

## 1. Scope

This document defines the frontend design for Pulse.  
It covers UI composition, client-side state management, and build/runtime behavior for the React application.

It does not define backend contract semantics.  
See `Doc/structure.md` for protocol, data contract, and transport details.

## 2. Design Objectives

- Provide a low-latency interface for topic submission and progressive result rendering.
- Surface agent execution visibility without exposing backend implementation details.
- Keep rendering components presentational and centralize asynchronous logic in hooks.
- Preserve local development ergonomics through Vite tooling.

## 3. Technology Baseline

- React 19
- Vite 8
- Tailwind CSS 4
- Recharts (data visualization)
- React Flow (`@xyflow/react`) for agent graph visualization

## 4. Source Layout

Frontend source root: `frontend/src`

Top-level responsibilities:

- `App.jsx`
  - Screen-level composition and view-state branching (`idle`, `loading`, `complete`, `error`).
- `hooks/usePulse.js`
  - Coordinates submission lifecycle, event accumulation, and terminal status updates.
- `lib/api.js`
  - Network transport adapter for analyze request, SSE session, and health ping.
- `components/*`
  - Pure rendering components for input, timeline graph, confidence gauge, charts, quotes, and synthesis output.
- `index.css`, `App.css`
  - Global and app-level styling concerns.

## 5. State Model

Primary state container: `usePulse`.

State fields:

- `status`
- `agentEvents`
- `report`
- `liveText`

Lifecycle policy:

- Reset state before each submission.
- Open SSE stream before issuing analysis request.
- Append events incrementally to both graph state and textual trace.
- Close SSE when analysis settles (success or failure).

## 6. Rendering Policy

Render behavior is status-driven:

- `idle`: centered search-first layout
- `loading`: execution graph + live output + confidence placeholder
- `complete`: full report sections (sentiment chart, quotes, synthesis)
- `error`: explicit user-visible failure state

The UI avoids speculative rendering of report sections before analysis completion.

## 7. Configuration Model

Runtime variable:
- `VITE_API_BASE` (defaults to `/api`)

Development proxy:
- Configured in `frontend/vite.config.js`
- Routes `/api/*` to `http://localhost:8080`

## 8. Build and Operational Concerns

Build commands:

- `npm run dev`
- `npm run build`
- `npm run preview`

The production build outputs static assets in `frontend/dist`.

Cross-system packaging integration is specified in `Doc/structure.md`.

## 9. Quality Boundaries

Current quality controls:

- ESLint configuration in `frontend/eslint.config.js`
- deterministic lockfile (`frontend/package-lock.json`)

Recommended next additions:

- Component-level rendering tests for status transitions
- Hook tests for submission lifecycle and SSE teardown behavior
- Visual regression snapshots for critical report panels
