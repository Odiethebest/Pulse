# Pulse UI and UX Implementation Guide

## Scope

This document covers runtime UI behavior for the report page and maps each behavior to component and style implementation locations.

## Information architecture and owning components

Main page file:
`frontend/src/App.jsx`

Display order and implementation:

1. Search and run controls
   `SearchBar`
2. Loading theater
   `AgentTheaterLoading`
3. Frontline verdict
   inline citation rendering with `parseCitations`
4. Metrics and confidence dashboard
   `DramaScoreboard`
5. Sentiment and camp split
   `SentimentChart`, `CampBattleBoard`
6. Controversy signal feed
   `ControversyAccordion`
7. Data integrity panel
   `SynthesisReport`
8. Bottom action bar
   fixed share and new query controls in `App.jsx`

## Citation UX behavior

### Rules

1. Citation chips in frontline text must resolve to stable source indexes.
2. Citation click must move the user to the signal feed section.
3. Tooltip text should show source snippet or fallback text when missing.

### Implementation locations

1. Citation parsing and chip rendering
   `frontend/src/components/SemanticSourceChip.jsx`
   `parseCitations`, `InteractiveCitation`
2. Canonical source ordering and URL dedupe
   `frontend/src/lib/api.js`
   `buildCanonicalCitationSources`
3. Signal feed anchor
   `id="signal-feed"` in `ControversyAccordion.jsx`

### Tests

1. `frontend/src/components/__tests__/SemanticSourceChip.test.jsx`
2. `frontend/src/lib/__tests__/apiCitationSources.test.js`
3. `frontend/src/lib/__tests__/apiNormalizeReport.test.js`

## Controversy lenses UX behavior

### Rules

1. Feed cards must prefer backend `topicBuckets` and keep ranking metadata.
2. Feed must support topic filter and platform filter.
3. Feed should progressively disclose more cards by load more.
4. Twitter shell text must be filtered.

### Implementation locations

1. Mapper
   `frontend/src/lib/controversyMapper.js`
   `buildControversyBoardData`, `buildDataFromTopicBuckets`, `isTwitterShellText`
2. UI interaction
   `frontend/src/components/ControversyAccordion.jsx`
   topic chips, platform toggles, `LOAD_STEP`
3. Card style rhythm and high signal emphasis
   `buildRhythmicQuotes`, `isHighlightedQuote`, `HIGHLIGHT_SCORE_THRESHOLD`

### Tests

1. `frontend/src/lib/__tests__/controversyMapper.test.js`
2. `frontend/src/components/__tests__/ControversyAccordion.test.jsx`

## Loading theater UX behavior

### Desktop behavior

1. Split view with execution tree on the left and console on the right.
2. Preserve structural classes for desktop layout.

Implementation:
`frontend/src/components/AgentTheaterLoadingDesktop.jsx`

### Mobile behavior

1. Tabbed layout with Console and Execution tabs.
2. Console log line uses two row layout.
   Row 1: time status agent duration
   Row 2: message full width
3. Auto scroll only when user is already at bottom.
4. Jump to latest button appears when user scrolls away.
5. Execution tab shows focused steps first and expandable full chain.

Implementation:
`frontend/src/components/AgentTheaterLoadingMobile.jsx`

### Device routing

Implementation:
`frontend/src/components/AgentTheaterLoading.jsx`
media query switch for max width 767px

### Tests

1. `frontend/src/components/__tests__/AgentTheaterLoading.test.jsx`

## Mobile and desktop isolation rules

### Component isolation

1. Keep mobile behavior in `AgentTheaterLoadingMobile.jsx`.
2. Keep desktop behavior in `AgentTheaterLoadingDesktop.jsx`.
3. `AgentTheaterLoading.jsx` must only route and not merge behaviors.

### Style namespace isolation

1. Mobile theater classes must use `.theater-mobile-*` namespace.
2. Mobile theater classes live in `frontend/src/App.css`.
3. Do not repurpose desktop structural utility classes for mobile fixes.

### Behavior isolation

1. Mobile specific auto scroll and execution summary logic stays in mobile component.
2. Desktop keeps `md:flex-row` split structure and wide console behavior.

## Report footer and bottom action bar behavior

### Rules

1. Bottom action controls must remain visible.
2. Report content must reserve enough bottom space to avoid overlap.
3. Mobile and desktop spacing should be tuned separately.

### Implementation locations

1. Fixed action bar container
   `frontend/src/App.jsx`
   class `fixed bottom-6 sm:bottom-8 ...`
2. Report body bottom reserve
   `App.jsx` report container uses `pb-32 md:pb-16`
3. Mobile theater console extra safe area reserve
   `App.css` `.theater-mobile-console`
   `padding-bottom: calc(84px + env(safe-area-inset-bottom, 0px));`

## Data integrity panel behavior

Component:
`frontend/src/components/SynthesisReport.jsx`

Rules and implementation:

1. Always show compact health badges
   `healthBadges`
2. Show action items list with mobile disclosure
   `mobileActionOpen`
3. Keep revision anchors addressable by id
   `revisionAnchors` mapped to DOM anchors

## UI quality gates

Mandatory checks before merge:

1. `cd frontend && npm test`
2. `cd frontend && npm run build`
3. Manual check on narrow width
   bottom of report remains readable and action controls do not cover data integrity section
4. Desktop loading view still has split layout and no `.theater-mobile-*` classes
