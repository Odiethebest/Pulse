# Pulse Developer Documentation

This folder is the active engineering reference for Pulse.  
The target reader is a full stack engineer working in this repository.

## Scope

1. Backend runtime pipeline from `POST /api/pulse/analyze` to `PulseReport`.
2. Frontend runtime pipeline from search submit to report rendering.
3. Crawler strategy, citation strategy, mobile and desktop UI isolation, and quality gates.
4. Operations, troubleshooting, release checks, and regression tests.

## Codebase map

1. Backend runtime code
   `backend/src/main/java/com/odieyang/pulse`
2. Backend tests
   `backend/src/test/java/com/odieyang/pulse`
3. Frontend runtime code
   `frontend/src`
4. Frontend tests
   `frontend/src/**/__tests__`

## Documents in this folder

1. `architecture-and-core-logic.md`
   End to end runtime architecture and implementation map with file and method locations.
2. `design-principles.md`
   Engineering invariants and the concrete enforcement points in code and tests.
3. `uiux-guidelines.md`
   Report page behavior spec with component level and CSS namespace mapping.
4. `operations-maintenance.md`
   Runtime configuration, packaging, diagnostics, and production maintenance runbook.
5. `testing-quality.md`
   Automated and manual quality gates with risk to test mapping.

## Working rules

1. When behavior changes in code, update the matching document in this folder in the same change set.
2. Keep examples and defaults aligned with current runtime code in `backend` and `frontend`.
3. Move superseded plans and one off phase notes to `Doc/history`.
4. Keep this folder implementation oriented and executable, not product marketing text.

## History policy

1. `Doc/history` stores superseded or phase specific material.
2. `Doc/history` is ignored by git by project policy.
