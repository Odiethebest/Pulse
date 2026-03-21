package com.odieyang.pulse.orchestrator;

import com.odieyang.pulse.agent.*;
import com.odieyang.pulse.model.*;
import com.odieyang.pulse.service.AgentEventPublisher;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.CompletableFuture;

@Component
@RequiredArgsConstructor
public class PulseOrchestrator {

    private static final Logger log = LoggerFactory.getLogger(PulseOrchestrator.class);

    private final QueryPlannerAgent queryPlannerAgent;
    private final RedditAgent redditAgent;
    private final TwitterAgent twitterAgent;
    private final SentimentAgent sentimentAgent;
    private final SynthesisAgent synthesisAgent;
    private final CriticAgent criticAgent;
    private final AgentEventPublisher publisher;

    @Value("${debate.confidence.threshold:60}")
    private int confidenceThreshold;

    public PulseReport analyze(String topic) {
        log.info("Starting analysis for topic: {}", topic);
        List<AgentEvent> trace = new ArrayList<>();

        // Step 1: Plan queries
        QueryPlan plan = queryPlannerAgent.plan(topic);

        // Step 2: Fetch posts in parallel
        CompletableFuture<RawPosts> redditFuture =
                CompletableFuture.supplyAsync(() -> redditAgent.fetch(plan.redditQueries()));
        CompletableFuture<RawPosts> twitterFuture =
                CompletableFuture.supplyAsync(() -> twitterAgent.fetch(plan.twitterQueries()));

        RawPosts reddit = redditFuture.join();
        RawPosts twitter = twitterFuture.join();

        // Step 3: Analyze sentiment in parallel
        CompletableFuture<SentimentResult> redditSentimentFuture =
                CompletableFuture.supplyAsync(() -> sentimentAgent.analyze(reddit));
        CompletableFuture<SentimentResult> twitterSentimentFuture =
                CompletableFuture.supplyAsync(() -> sentimentAgent.analyze(twitter));

        SentimentResult redditSentiment = redditSentimentFuture.join();
        SentimentResult twitterSentiment = twitterSentimentFuture.join();

        // Step 4: Initial synthesis
        String synthesis = synthesisAgent.synthesize(reddit, twitter, redditSentiment, twitterSentiment);

        // Step 5: Critic evaluation
        CriticResult critique = criticAgent.critique(synthesis, reddit, twitter);

        // Step 6: Debate loop — re-synthesize if confidence is below threshold
        boolean debateTriggered = false;
        if (critique.confidenceScore() < confidenceThreshold) {
            log.info("Confidence score {} below threshold {}, triggering revision",
                    critique.confidenceScore(), confidenceThreshold);
            debateTriggered = true;
            synthesis = synthesisAgent.synthesize(
                    reddit, twitter, redditSentiment, twitterSentiment,
                    critique.revisionSuggestions());
        }

        String platformDiff = buildPlatformDiff(redditSentiment, twitterSentiment);

        log.info("Analysis complete for '{}', confidence={}, debateTriggered={}",
                topic, critique.confidenceScore(), debateTriggered);

        return new PulseReport(
                topic,
                plan.topicSummary(),
                redditSentiment,
                twitterSentiment,
                platformDiff,
                synthesis,
                critique,
                critique.confidenceScore(),
                debateTriggered,
                trace
        );
    }

    private String buildPlatformDiff(SentimentResult reddit, SentimentResult twitter) {
        double posDiff = reddit.positiveRatio() - twitter.positiveRatio();
        double negDiff = reddit.negativeRatio() - twitter.negativeRatio();
        return "Reddit vs Twitter/X — Positive diff: %+.0f%%, Negative diff: %+.0f%%".formatted(
                posDiff * 100, negDiff * 100);
    }
}
