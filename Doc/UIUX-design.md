# Pulse UIUX Design

## Why This UI Exists

Pulse is built for teams that need a fast read on public conflict and cannot spend hours digging through raw posts.
The UI is designed to answer three questions in order:

1. What is happening right now.
2. How reliable is this conclusion.
3. What should we do next.

## What Users Get in One Run

This is the product level output contract the UI is built around.

1. A frontline verdict that can be read in seconds.
2. Cross-platform sentiment and camp split from X and Reddit.
3. Controversy lenses with source-grounded quote cards.
4. Confidence, heat, polarization, and flip risk signals.
5. A visible execution trace to explain how the conclusion was built.

## How We Designed the Experience

### 1. Start With One Input, Not a Complex Form

We intentionally keep the entry point to one query box.
Most users are under time pressure, so the interface should not require setup before first value.

Design purpose:

1. Reduce onboarding friction.
2. Let non technical users run analysis immediately.
3. Keep the product focused on outcome, not configuration.

### 2. Show Process While Analysis Is Running

We do not hide the analysis behind a spinner.
Users see a live execution view with agent progress and logs.

Design purpose:

1. Improve trust by showing work in progress.
2. Reduce perceived wait time.
3. Make failures visible and diagnosable.

### 3. Put the Main Verdict at the Top

The first block is the Frontline Verdict, because users need the decision line first.
After that, we show supporting context in layers.

Design purpose:

1. Give a clear top line in seconds.
2. Prevent users from getting lost in secondary details.
3. Support executive level reading behavior.

### 4. Use Progressive Depth

The page moves from summary to evidence:

1. Frontline Verdict
2. Confidence and risk signals
3. Camp split and sentiment
4. Controversy lenses with real quote cards
5. Data integrity and revision trail

Design purpose:

1. Serve both quick readers and deep reviewers.
2. Keep cognitive load manageable.
3. Make evidence accessible without forcing everyone to read everything.

### 5. Keep Every Important Claim Traceable

Citations are interactive in the verdict area.
Users can inspect source snippets and jump to the evidence feed.

Design purpose:

1. Turn claims into verifiable statements.
2. Help teams defend conclusions in meetings.
3. Lower risk of over trust in generated summaries.

### 6. Design the Controversy Feed for Signal, Not Noise

Controversy cards support topic and platform filtering.
Higher value items are visually emphasized and feed growth is controlled by load more behavior.

Design purpose:

1. Surface the most relevant posts faster.
2. Let users compare Reddit and Twitter viewpoints directly.
3. Keep long feeds usable on real work sessions.

### 7. Treat Integrity as a Core UI Block

Data Integrity is not hidden in settings.
It appears in the main report with evidence gaps, bias concerns, and revision trace.

Design purpose:

1. Make uncertainty explicit.
2. Prevent blind confidence in a single score.
3. Support risk aware decisions.

### 8. Keep Action Controls Always Available

The bottom actions support sharing and immediate rerun.
The page reserves enough space so controls do not hide report content.

Design purpose:

1. Move from insight to team action quickly.
2. Keep collaboration native to the report flow.
3. Avoid accidental content obstruction on small screens.

## Mobile Design Strategy

Mobile is not a scaled down desktop screen.
We designed a dedicated mobile behavior model:

1. Tabbed loading view for Console and Execution.
2. Two row log line layout for readability.
3. Jump to latest control when user scrolls away.
4. Safe area aware spacing near bottom actions.

Design purpose:

1. Keep core information readable on narrow screens.
2. Reduce vertical scrolling fatigue during live runs.
3. Preserve full report access without overlap bugs.

## What Clients Get From This Design

1. Faster decision speed from query to usable conclusion.
2. Better confidence calibration through visible risk and integrity signals.
3. Stronger cross team communication through shareable, evidence linked output.
4. Consistent usability across desktop and mobile.

## Practical Success Criteria

1. A first time user can run one topic and understand the main verdict within one minute.
2. Key claims can be traced to evidence directly from the report UI.
3. Mobile users can read the full report and use bottom actions without content overlap.
4. Teams can share a report and discuss both conclusion and uncertainty in one artifact.
