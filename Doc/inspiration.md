# Inspiration

Pulse started from a very ordinary problem.

One night I was scrolling X and saw a thread explode:
**"Is LeBron actually the GOAT?"**

The replies were flying. Some were posting rings. Some were posting longevity stats. Some were just posting bait. I wanted a fast read on what people really thought, so I jumped to Reddit and searched the same topic.

Reddit had better long-form arguments, but now I was trapped in tab switching:

1. X for speed and momentum
2. Reddit for depth and structure
3. endless manual comparison in my head

After twenty minutes I had a mess of tabs and no clean answer to three basic questions:

1. What are the main camps right now?
2. How split is the conversation across platforms?
3. Is the current narrative stable or about to flip?

That was the trigger for Pulse.

The idea was not to build another social app.
The idea was to build a fast, reliable way to synthesize public opinion without living inside two feeds.

## Product Intent

From the beginning, the product goals were strict:

1. One query in, one coherent cross-platform report out.
2. Use real public posts, not generic model opinions.
3. Keep conclusions tied to visible evidence.
4. Show confidence and risk, not just sentiment percentages.
5. Make the full workflow observable so users can trust the process.

## Why Multi-Agent

The problem is naturally modular, so Pulse was designed as a multi-agent system:

1. A planner agent turns a vague topic into targeted retrieval strategy.
2. Platform agents gather raw posts from X and Reddit in parallel.
3. Sentiment agents analyze each platform independently.
4. A synthesis agent merges findings into one narrative.
5. A critic agent challenges unsupported claims and bias.

This structure is faster than a monolithic pass and more reliable under noisy inputs.

## Why Process Visibility Matters

Most opinion tools return a final score with no transparency.
Pulse does the opposite.

The full execution trace streams live to the frontend so users can watch:

1. what was searched
2. what data was collected
3. how conclusions were formed
4. where the critic forced revisions

That visibility is a core product feature, not a developer debug view.

## Core Promise

Pulse is built for people who need signal quickly in fast-moving conversations:
product teams, operators, founders, creators, and anyone tracking public narrative shifts.

The promise is simple:

**Less tab switching. More evidence. Faster, defensible context.**
