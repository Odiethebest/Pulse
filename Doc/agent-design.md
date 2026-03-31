# Pulse Agent System Design

## Why We Built a Multi Agent System

Public opinion analysis is not one task.
It is a pipeline of different tasks with different failure modes:

1. Find the right data.
2. Clean low quality noise.
3. Extract sentiment and stance structure.
4. Summarize into readable conclusions.
5. Audit those conclusions for weakness and bias.

A single general model can produce a summary, but it is harder to control quality, traceability, and consistency.
So we split the work into specialized agents and orchestrate them as one system.

This design gives us better control, faster turnaround, and more reliable output.

## Design Logic

We follow four design choices.

1. Specialized roles
   Each agent has one job and one output contract.
2. Parallel execution
   Independent jobs run at the same time to reduce total runtime.
3. Quality gate and revision loop
   The critic can trigger one targeted rewrite when quality is below threshold.
4. Graceful degradation
   If one component fails, the system still returns a usable report instead of crashing.

## Agent Roles and Division of Work

### QueryPlannerAgent

Responsibility:
turn a broad user topic into focused search queries for Reddit and Twitter and a neutral topic summary.

Why this role exists:
search quality determines everything downstream.
Good planning improves relevance before any analysis starts.

### RedditAgent and TwitterAgent

Responsibility:
collect raw posts from each platform using platform constrained search.

Why split by platform:
the sources behave differently and require different query language.
Twitter also needs shell page filtering to remove non content pages.

### SentimentAgent

Responsibility:
produce sentiment ratios, main controversies, representative quotes, and aspect level heat.

Why this role exists:
it provides both quantitative shape and qualitative evidence, which are later reused by multiple downstream steps.

### StanceAgent

Responsibility:
estimate support, oppose, and neutral camp ratios with camp arguments.

Why this role exists:
sentiment alone is not enough for decision making.
teams need to know camp structure, not just positive or negative tone.

### ConflictAgent

Responsibility:
score conflict intensity and identify conflict drivers and toxic signals.

Why this role exists:
heat and volatility are critical for risk response planning.

### AspectAgent

Responsibility:
cluster discussion into controversy dimensions with per topic heat and short summary.

Why this role exists:
it turns a large mixed conversation into navigable controversy lenses.

### FlipRiskAgent

Responsibility:
estimate how likely the current narrative is to reverse and provide explicit flip signals.

Why this role exists:
clients need forward looking risk, not only current state.

### SynthesisAgent

Responsibility:
transform structured outputs into a readable report with strict citation behavior and section structure.

Why this role exists:
raw metrics are not decision ready.
the report must be readable, evidence linked, and consistent in format.

### CriticAgent

Responsibility:
audit the synthesis for unsupported claims, bias concerns, evidence gaps, and density.

Why this role exists:
it acts as an internal reviewer that challenges weak drafts before users see the final output.

## How Agents Collaborate

The orchestrator runs the agents as a coordinated chain.

### Stage 1: Planning and Collection

1. Query planner generates targeted queries.
2. Reddit and Twitter collectors run in parallel.
3. Collected posts pass through strict relevance tightening.

### Stage 2: Parallel Analysis

Sentiment, stance, conflict, aspect, and flip risk agents run in parallel on cleaned data.
This stage produces the analytical backbone for the report.

### Stage 3: Synthesis and Critique

1. Synthesis agent drafts the report.
2. Critic agent evaluates quality.
3. If quality thresholds fail, synthesis gets one guided rewrite.

### Stage 4: Evidence Mapping and Assembly

1. Claims are linked to evidence URLs.
2. Quick take lines are generated with citation guards.
3. Posts are globally ranked, deduped, and bucketed by controversy.
4. Final report is assembled with coverage and integrity signals.

## Why This Cooperation Model Is Efficient

### 1. Lower wall clock time through parallelism

Fetch jobs run in parallel.
Analysis jobs also run in parallel.
This removes unnecessary serial waiting.

### 2. Better signal quality before expensive reasoning

The crawler relevance gate removes low value noise early.
Downstream agents process a cleaner set of posts, which reduces wasted inference.

### 3. Better quality without infinite loops

The critic loop is controlled:
at most one targeted rewrite.
This gives quality uplift without open ended latency growth.

### 4. Better output reliability under failure

If a non critical agent fails, fallback outputs are used.
Users still get a report instead of a hard failure.

### 5. Better operations efficiency

Every agent emits structured progress events.
Teams can diagnose bottlenecks quickly and reduce incident resolution time.

## What This Means for Clients

1. Faster turnaround from query to report.
2. Higher trust in conclusions because evidence and risk are explicit.
3. Better consistency across runs through fixed agent contracts.
4. More actionable outputs for strategy, communications, and risk management teams.

## Practical Summary

We use a multi agent architecture because the problem is multi step by nature.
Specialized agents plus orchestration give us a better balance of speed, quality, and control than a single monolithic prompt.
