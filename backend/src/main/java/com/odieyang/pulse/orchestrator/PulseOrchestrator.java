package com.odieyang.pulse.orchestrator;

import com.odieyang.pulse.agent.*;
import com.odieyang.pulse.model.*;
import com.odieyang.pulse.service.AgentEventPublisher;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import reactor.core.Disposable;

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
    private final StanceAgent stanceAgent;
    private final ConflictAgent conflictAgent;
    private final AspectAgent aspectAgent;
    private final FlipRiskAgent flipRiskAgent;
    private final SynthesisAgent synthesisAgent;
    private final CriticAgent criticAgent;
    private final AgentEventPublisher publisher;

    @Value("${debate.confidence.threshold:60}")
    private int confidenceThreshold;

    public PulseReport analyze(String topic) {
        log.info("Starting analysis for topic: {}", topic);
        List<AgentEvent> trace = new ArrayList<>();
        Disposable traceSubscription = publisher.stream().subscribe(trace::add);

        try {
        // Step 1: Plan queries
        QueryPlan plan = queryPlannerAgent.plan(topic);

        // Step 2: Fetch posts in parallel
        CompletableFuture<RawPosts> redditFuture =
                CompletableFuture.supplyAsync(() -> redditAgent.fetch(plan.redditQueries()));
        CompletableFuture<RawPosts> twitterFuture =
                CompletableFuture.supplyAsync(() -> twitterAgent.fetch(plan.twitterQueries()));

        RawPosts reddit = redditFuture.join();
        RawPosts twitter = twitterFuture.join();

        // Step 3: Analyze in parallel
        CompletableFuture<SentimentResult> redditSentimentFuture =
                CompletableFuture.supplyAsync(() -> sentimentAgent.analyze(reddit));
        CompletableFuture<SentimentResult> twitterSentimentFuture =
                CompletableFuture.supplyAsync(() -> sentimentAgent.analyze(twitter));
        CompletableFuture<StanceResult> stanceFuture =
                CompletableFuture.supplyAsync(() -> safeRun(
                        () -> stanceAgent.analyze(reddit, twitter),
                        defaultStanceResult(),
                        "StanceAgent"));
        CompletableFuture<ConflictResult> conflictFuture =
                CompletableFuture.supplyAsync(() -> safeRun(
                        () -> conflictAgent.analyze(reddit, twitter),
                        defaultConflictResult(),
                        "ConflictAgent"));
        CompletableFuture<AspectResult> aspectFuture =
                CompletableFuture.supplyAsync(() -> safeRun(
                        () -> aspectAgent.analyze(reddit, twitter),
                        defaultAspectResult(),
                        "AspectAgent"));
        CompletableFuture<FlipRiskResult> flipRiskFuture =
                CompletableFuture.supplyAsync(() -> safeRun(
                        () -> flipRiskAgent.analyze(reddit, twitter),
                        defaultFlipRiskResult(),
                        "FlipRiskAgent"));

        SentimentResult redditSentiment = redditSentimentFuture.join();
        SentimentResult twitterSentiment = twitterSentimentFuture.join();
        StanceResult stanceResult = stanceFuture.join();
        ConflictResult conflictResult = conflictFuture.join();
        AspectResult aspectResult = aspectFuture.join();
        FlipRiskResult flipRiskResult = flipRiskFuture.join();

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
        CampDistribution campDistribution = stanceResult.toCampDistribution();
        int polarizationScore = computePolarization(campDistribution);
        int heatScore = clampScore(conflictResult.heatScore());
        int flipRiskScore = clampScore(flipRiskResult.flipRiskScore());
        List<ControversyTopic> controversyTopics = chooseControversyTopics(aspectResult, redditSentiment, twitterSentiment);
        int dramaScore = computeDramaScore(heatScore, polarizationScore, controversyTopics);
        List<FlipSignal> flipSignals = chooseFlipSignals(flipRiskResult, critique);
        List<String> revisionDelta = chooseRevisionDelta(critique);
        List<String> quickTake = buildQuickTake(
                topic,
                campDistribution,
                controversyTopics,
                heatScore,
                flipRiskScore,
                debateTriggered
        );
        ConfidenceBreakdown confidenceBreakdown = buildConfidenceBreakdown(
                critique.confidenceScore(),
                reddit,
                twitter,
                controversyTopics,
                flipSignals
        );

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
                trace,
                quickTake,
                dramaScore,
                polarizationScore,
                heatScore,
                flipRiskScore,
                confidenceBreakdown,
                campDistribution,
                controversyTopics,
                flipSignals,
                revisionDelta
        );
        } finally {
            traceSubscription.dispose();
        }
    }

    private String buildPlatformDiff(SentimentResult reddit, SentimentResult twitter) {
        double posDiff = reddit.positiveRatio() - twitter.positiveRatio();
        double negDiff = reddit.negativeRatio() - twitter.negativeRatio();
        return "Reddit vs Twitter/X — Positive diff: %+.0f%%, Negative diff: %+.0f%%".formatted(
                posDiff * 100, negDiff * 100);
    }

    private int computePolarization(CampDistribution campDistribution) {
        double support = nz(campDistribution.support());
        double oppose = nz(campDistribution.oppose());
        double neutral = nz(campDistribution.neutral());
        double raw = ((Math.abs(support - oppose) + (1.0 - neutral)) / 2.0) * 100;
        return clampScore((int) Math.round(raw));
    }

    private int computeDramaScore(int heatScore, int polarizationScore, List<ControversyTopic> topics) {
        double avgAspectHeat = topics.isEmpty() ? 50.0 :
                topics.stream()
                        .mapToInt(t -> clampScore(t.heat() == null ? 50 : t.heat()))
                        .average()
                        .orElse(50.0);
        double raw = heatScore * 0.45 + polarizationScore * 0.35 + avgAspectHeat * 0.20;
        return clampScore((int) Math.round(raw));
    }

    private List<ControversyTopic> chooseControversyTopics(
            AspectResult aspectResult,
            SentimentResult redditSentiment,
            SentimentResult twitterSentiment
    ) {
        if (aspectResult.topics() != null && !aspectResult.topics().isEmpty()) {
            return aspectResult.topics();
        }

        List<ControversyTopic> fallback = new ArrayList<>();
        if (redditSentiment.mainControversies() != null) {
            redditSentiment.mainControversies().stream()
                    .limit(3)
                    .forEach(c -> fallback.add(new ControversyTopic(c, 55, "Observed on Reddit discussions")));
        }
        if (twitterSentiment.mainControversies() != null) {
            twitterSentiment.mainControversies().stream()
                    .limit(3)
                    .forEach(c -> fallback.add(new ControversyTopic(c, 60, "Observed on Twitter/X discussions")));
        }
        return fallback.stream().limit(6).toList();
    }

    private List<FlipSignal> chooseFlipSignals(FlipRiskResult flipRiskResult, CriticResult critique) {
        if (flipRiskResult.signals() != null && !flipRiskResult.signals().isEmpty()) {
            return flipRiskResult.signals();
        }
        if (critique.evidenceGaps() != null && !critique.evidenceGaps().isEmpty()) {
            return critique.evidenceGaps().stream()
                    .limit(3)
                    .map(gap -> new FlipSignal("Evidence gap", 60, gap))
                    .toList();
        }
        return List.of();
    }

    private List<String> chooseRevisionDelta(CriticResult critique) {
        if (critique.deltaHighlights() != null && !critique.deltaHighlights().isEmpty()) {
            return critique.deltaHighlights();
        }
        if (critique.evidenceGaps() != null && !critique.evidenceGaps().isEmpty()) {
            return critique.evidenceGaps().stream()
                    .limit(3)
                    .map(gap -> "Need stronger evidence: " + gap)
                    .toList();
        }
        return List.of();
    }

    private List<String> buildQuickTake(
            String topic,
            CampDistribution campDistribution,
            List<ControversyTopic> topics,
            int heatScore,
            int flipRiskScore,
            boolean debateTriggered
    ) {
        String mainAspect = topics.isEmpty() ? "overall narrative clash" : topics.getFirst().aspect();
        String campLine = "Topic \"%s\" shows support %.0f%% vs oppose %.0f%% with %.0f%% neutral watchers.".formatted(
                topic,
                nz(campDistribution.support()) * 100,
                nz(campDistribution.oppose()) * 100,
                nz(campDistribution.neutral()) * 100
        );
        String heatLine = "Fight intensity is %d/100, with the main flashpoint around %s.".formatted(heatScore, mainAspect);
        String flipLine = "Narrative flip risk is %d/100%s.".formatted(
                flipRiskScore,
                debateTriggered ? " and critic-triggered revision already happened" : ""
        );
        return List.of(campLine, heatLine, flipLine);
    }

    private ConfidenceBreakdown buildConfidenceBreakdown(
            int confidenceScore,
            RawPosts reddit,
            RawPosts twitter,
            List<ControversyTopic> topics,
            List<FlipSignal> flipSignals
    ) {
        int coverage = clampScore(Math.min(100, (reddit.posts().size() + twitter.posts().size()) * 4));
        int diversity = clampScore(60 + Math.min(20, topics.size() * 5));
        int agreement = clampScore(confidenceScore);
        int evidenceSupport = clampScore(70 - Math.min(30, flipSignals.size() * 8));
        int stability = clampScore(confidenceScore - Math.min(20, flipSignals.size() * 4));
        return new ConfidenceBreakdown(coverage, diversity, agreement, evidenceSupport, stability);
    }

    private StanceResult defaultStanceResult() {
        return new StanceResult(0.0, 0.0, 1.0, List.of(), List.of(), List.of());
    }

    private ConflictResult defaultConflictResult() {
        return new ConflictResult(50, List.of(), List.of());
    }

    private AspectResult defaultAspectResult() {
        return new AspectResult(List.of());
    }

    private FlipRiskResult defaultFlipRiskResult() {
        return new FlipRiskResult(35, List.of(), List.of());
    }

    private int clampScore(int value) {
        return Math.max(0, Math.min(100, value));
    }

    private double nz(Double value) {
        return value == null ? 0.0 : value;
    }

    private <T> T safeRun(ThrowingSupplier<T> supplier, T fallback, String taskName) {
        try {
            return supplier.get();
        } catch (Exception e) {
            log.warn("{} failed and fallback is used: {}", taskName, e.getMessage());
            return fallback;
        }
    }

    @FunctionalInterface
    private interface ThrowingSupplier<T> {
        T get() throws Exception;
    }
}
