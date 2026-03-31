# Pulse Design Principles

## Product intent

Pulse is a full stack system that turns one topic query into a report with source grounded evidence.

1. Show what people are arguing about across platforms.
2. Keep each key claim tied to real source content.
3. Balance speed quality and cost for daily production use.

## Core engineering principles

### Evidence first

1. Do not show synthetic comments as real user content.
2. Keep source links traceable from verdict to report sections.
3. Rank evidence by semantic relevance and evidence strength.

### Explainability first

1. Every major score must have plain language meaning.
2. Critic findings must be visible in the report.
3. Crawler quality must be measurable through structured stats.

### Reliable degradation

1. External dependency failures must not break the full run by default.
2. Single platform failure must degrade to partial output.
3. Logs and events must allow fast root cause analysis.

### Clean separation

1. Backend separates fetch analysis synthesis and assembly.
2. Frontend separates transport state and presentation.
3. Mobile and desktop behavior stay isolated to avoid cross regressions.

### Pragmatic iteration

1. Fix user visible quality issues before adding new features.
2. Ship incremental improvements with tests.
3. Keep documents aligned with production behavior.

## Decision checklist

Use this checklist for any major change.

1. Does this change increase evidence quality or report clarity.
2. Does this change preserve graceful degradation.
3. Does this change increase coupling between unrelated modules.
4. Does this change include regression tests.
5. Does this change require documentation updates.

## Documentation discipline

1. Keep active implementation guidance in `Doc`.
2. Move outdated material to `Doc/history`.
3. Keep language direct concrete and implementation focused.
