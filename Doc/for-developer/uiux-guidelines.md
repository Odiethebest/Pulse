# Pulse UIUX Guidelines

## Primary user goals

The report must answer three questions quickly.

1. What is the core conflict now.
2. How stable is the current verdict.
3. How strong is the evidence.

## Report information order

Keep this order in the main report view.

1. Search input and run controls.
2. Frontline verdict with source mapped citations.
3. Signal section with drama heat polarization and flip risk.
4. Controversy section with topic buckets and representative quotes.
5. Synthesis and data integrity section.
6. Bottom action bar for share and new query.

## Interaction rules

### Citation behavior

1. The verdict must link back to source evidence.
2. Source ordering must follow relevance not fixed index patterns.
3. Data integrity details must remain visible and actionable.

### Loading behavior

1. Loading view must show progress without blocking final report reading flow.
2. Logs and execution chain must be expandable.
3. Mobile layout must prioritize readability over density.

### Bottom action bar behavior

1. Bottom actions must never cover report content.
2. Report container must reserve bottom scroll space.
3. Position rules must be separate for mobile and desktop.

## Mobile and desktop isolation

### Component isolation

1. Keep dedicated mobile loading component.
2. Keep dedicated desktop loading component.
3. Avoid mixed branch logic that merges both layouts in one component.

### Style isolation

1. Keep mobile namespace classes under `theater-mobile`.
2. Do not modify desktop structural classes during mobile fixes.

### Behavior isolation

1. Mobile may use two line log rows and focused execution summary.
2. Desktop keeps wide layout and full chain visibility.

## Visual readability rules

1. Long text must wrap safely.
2. Strong hierarchy should come from layout and typography.
3. Status colors must stay semantically stable.

## UI release checks

1. Mobile report end section is fully visible with no overlap.
2. Desktop layout structure remains unchanged.
3. Citation mapping still resolves to correct sources.
4. Data integrity panel is visible and interactive.
5. Frontend test and build commands pass.
