# Pulse Testing and Quality

## Quality goals

1. Keep the full run flow stable from query to final report.
2. Prevent rollback on high risk logic areas.
3. Keep frontend and backend contracts parse safe.

## Automated coverage map

### Backend suite

Primary tests:

1. `PulseOrchestratorV2Tests`
2. `PulseControllerV2Tests`
3. `PulseReportSerializationTests`
4. `TwitterAgentTests`
5. `SynthesisAgentFormattingTests`
6. `AgentEventPublisherTests`
7. `PublicOpinionAnalysisSystemApplicationTests`

Core coverage:

1. Orchestrator parallel flow and fallback behavior.
2. Crawler relevance filter and global merge ranking.
3. Citation pairing guard behavior.
4. Report serialization and API field compatibility.

### Frontend suite

Primary tests:

1. `components/__tests__`
2. `hooks/__tests__/usePulseV2.test.js`
3. `lib/__tests__`

Core coverage:

1. Component render behavior and interactions.
2. `usePulse` lifecycle behavior.
3. API normalize behavior and citation source alignment.
4. Controversy mapping logic.
5. Mobile loading view isolation behavior.

## Required gate before merge

Run all commands:

1. `cd backend && ./mvnw test`
2. `cd frontend && npm test`
3. `cd frontend && npm run build`

For crawler citation or mobile changes add focused regression tests.

## High risk regression checklist

### Crawler checks

1. `allPosts size` remains at or below 16.
2. `crawlerStats.targetTotal` remains 16.
3. Low value noise content remains filtered.
4. Merge order remains global relevance first.

### Citation checks

1. Frontline citations do not return to fixed offset patterns.
2. Claim citations remain semantically tied to query intent.
3. Citation source ordering remains stable.

### UI checks

1. Mobile bottom action bar does not cover data integrity content.
2. Mobile and desktop layouts stay isolated.
3. Critical report blocks remain readable on narrow screens.

## Manual validation template

Use at least three real queries:

1. High relevance popular topic.
2. Low relevance long tail topic.
3. Topic with high chance of noise contamination.

For each run verify:

1. Frontline line includes traceable citations.
2. Controversy buckets match query semantics.
3. Data integrity block is visible and meaningful.
4. Mobile report bottom is fully scrollable with no overlap.

## Test authoring rules

1. New strategy change requires matching tests.
2. Test names must describe behavior intent.
3. Extend existing suites before adding new files.
4. For bug fixes add failing regression case first then fix implementation.
