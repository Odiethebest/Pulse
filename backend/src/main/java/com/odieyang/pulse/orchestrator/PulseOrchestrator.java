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

    @Value("${debate.quality.min-density:55}")
    private int minInformationDensity;

    @Value("${debate.quality.min-claim-coverage:60}")
    private int minClaimEvidenceCoverage;

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

        // Step 6: Critic-triggered rewrite — low confidence or low writing quality
        boolean debateTriggered = false;
        String rewriteGuidance = buildRewriteGuidance(critique);
        if (rewriteGuidance != null) {
            try {
                synthesis = synthesisAgent.synthesize(
                        reddit, twitter, redditSentiment, twitterSentiment,
                        rewriteGuidance);
                debateTriggered = true;
            } catch (Exception revisionError) {
                log.warn("Revision synthesis failed, fallback to initial synthesis: {}",
                        revisionError.getMessage());
            }
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
        List<ClaimEvidenceLink> claimEvidenceMap = buildClaimEvidenceMap(
                topic,
                campDistribution,
                controversyTopics,
                heatScore,
                flipRiskScore,
                debateTriggered,
                redditSentiment,
                twitterSentiment
        );
        List<String> quickTake = buildQuickTake(claimEvidenceMap);
        ConfidenceBreakdown confidenceBreakdown = buildConfidenceBreakdown(
                critique.confidenceScore(),
                reddit,
                twitter,
                controversyTopics,
                flipSignals
        );
        synthesis = finalizeSynthesis(
                synthesis,
                topic,
                quickTake,
                controversyTopics,
                flipSignals,
                campDistribution,
                heatScore,
                flipRiskScore,
                platformDiff
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
                revisionDelta,
                claimEvidenceMap
        );
        } finally {
            traceSubscription.dispose();
        }
    }

    private String buildRewriteGuidance(CriticResult critique) {
        String revisionSuggestions = critique.revisionSuggestions();
        boolean lowConfidence = critique.confidenceScore() < confidenceThreshold;
        boolean lowDensity = critique.informationDensityScore() != null
                && critique.informationDensityScore() < minInformationDensity;
        boolean lowCoverage = critique.claimEvidenceCoverage() != null
                && critique.claimEvidenceCoverage() < minClaimEvidenceCoverage;
        boolean hasFluff = critique.fluffFindings() != null && !critique.fluffFindings().isEmpty();

        if (!(lowConfidence || lowDensity || lowCoverage || hasFluff)) {
            return null;
        }

        StringBuilder guidance = new StringBuilder();
        if (revisionSuggestions != null && !revisionSuggestions.isBlank()) {
            guidance.append(revisionSuggestions.trim());
        } else {
            guidance.append("Tighten claims to evidence and remove vague language.");
        }

        if (lowConfidence) {
            guidance.append("\n- Confidence is below threshold, qualify uncertain claims.");
        }
        if (lowDensity) {
            guidance.append("\n- Increase information density with concrete entities, actions, and numbers.");
        }
        if (lowCoverage) {
            guidance.append("\n- Improve claim-to-evidence coverage and cite evidence tags for key claims.");
        }
        if (hasFluff) {
            guidance.append("\n- Remove repetitive and generic lines flagged as fluff.");
        }

        log.info("Critic-triggered rewrite enabled: confidence={}, density={}, claimCoverage={}, fluffCount={}",
                critique.confidenceScore(),
                critique.informationDensityScore(),
                critique.claimEvidenceCoverage(),
                critique.fluffFindings() == null ? 0 : critique.fluffFindings().size());
        return guidance.toString();
    }

    private String buildPlatformDiff(SentimentResult reddit, SentimentResult twitter) {
        String redditTop = topControversy(reddit);
        String twitterTop = topControversy(twitter);
        double posDiff = reddit.positiveRatio() - twitter.positiveRatio();
        double negDiff = reddit.negativeRatio() - twitter.negativeRatio();
        String sentimentDiff = "positive %+.0f%%, negative %+.0f%%".formatted(posDiff * 100, negDiff * 100);

        if (!redditTop.equalsIgnoreCase(twitterTop)) {
            return "Platform mismatch: Reddit debates \"%s\", while Twitter/X fixates on \"%s\" (%s)."
                    .formatted(redditTop, twitterTop, sentimentDiff);
        }
        return "Both platforms center on \"%s\" (%s).".formatted(redditTop, sentimentDiff);
    }

    private String topControversy(SentimentResult sentiment) {
        if (sentiment == null || sentiment.mainControversies() == null || sentiment.mainControversies().isEmpty()) {
            return "general narrative";
        }
        String top = sentiment.mainControversies().getFirst();
        return top == null || top.isBlank() ? "general narrative" : top;
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

    private List<ClaimEvidenceLink> buildClaimEvidenceMap(
            String topic,
            CampDistribution campDistribution,
            List<ControversyTopic> topics,
            int heatScore,
            int flipRiskScore,
            boolean debateTriggered,
            SentimentResult redditSentiment,
            SentimentResult twitterSentiment
    ) {
        List<String> evidenceUrls = collectEvidenceUrls(redditSentiment, twitterSentiment);
        int supportPct = (int) Math.round(nz(campDistribution.support()) * 100);
        int opposePct = (int) Math.round(nz(campDistribution.oppose()) * 100);
        int neutralPct = (int) Math.round(nz(campDistribution.neutral()) * 100);
        String mainAspect = topics.isEmpty() ? "overall narrative clash" : topics.getFirst().aspect();
        String campLine = "The fight around \"%s\" is split: support %d%%, oppose %d%%, and %d%% remain on-the-fence watchers."
                .formatted(topic, supportPct, opposePct, neutralPct);
        String heatLine = "The main battlefield is %s, with heat at %d/100, which signals %s."
                .formatted(
                mainAspect,
                heatScore,
                describeHeat(heatScore)
        );
        String flipLine = "Flip risk is %d/100 (%s). %s%s"
                .formatted(
                flipRiskScore,
                describeFlipRisk(flipRiskScore),
                buildPlatformDiff(redditSentiment, twitterSentiment),
                debateTriggered ? " Critic revision has already been applied." : ""
        );
        return List.of(
                new ClaimEvidenceLink("C1", campLine, pickEvidenceUrls(evidenceUrls, 0, 2)),
                new ClaimEvidenceLink("C2", heatLine, pickEvidenceUrls(evidenceUrls, 1, 2)),
                new ClaimEvidenceLink("C3", flipLine, pickEvidenceUrls(evidenceUrls, 2, 2))
        );
    }

    private String describeHeat(int heatScore) {
        if (heatScore >= 70) {
            return "an actively escalating conflict";
        }
        if (heatScore >= 40) {
            return "a sustained but controllable confrontation";
        }
        return "a low-temperature disagreement that could still flare up";
    }

    private String describeFlipRisk(int flipRiskScore) {
        if (flipRiskScore >= 70) {
            return "the narrative is near a turning point";
        }
        if (flipRiskScore >= 40) {
            return "new evidence could still move sentiment";
        }
        return "the current storyline is relatively stable";
    }

    private List<String> buildQuickTake(List<ClaimEvidenceLink> claimEvidenceMap) {
        return claimEvidenceMap.stream()
                .limit(3)
                .map(link -> {
                    String refs = renderEvidenceRefs(link.evidenceUrls());
                    return refs.isBlank() ? link.claim() : link.claim() + " " + refs;
                })
                .toList();
    }

    private String finalizeSynthesis(
            String synthesis,
            String topic,
            List<String> quickTake,
            List<ControversyTopic> controversyTopics,
            List<FlipSignal> flipSignals,
            CampDistribution campDistribution,
            int heatScore,
            int flipRiskScore,
            String platformDiff
    ) {
        if (isValidReporterSynthesis(synthesis)) {
            return synthesis;
        }
        log.warn("Synthesis format is weak or contains raw dump markers, using deterministic reporter fallback.");
        return buildReporterFallback(
                topic,
                quickTake,
                controversyTopics,
                flipSignals,
                campDistribution,
                heatScore,
                flipRiskScore,
                platformDiff
        );
    }

    private boolean isValidReporterSynthesis(String synthesis) {
        if (synthesis == null || synthesis.isBlank()) {
            return false;
        }
        List<String> required = List.of(
                "## Lead",
                "## Frontline Clash",
                "## Top Controversies",
                "## Flip Risk Watch",
                "## Why It Matters",
                "## Reporter Note"
        );
        boolean hasAllSections = required.stream().allMatch(synthesis::contains);
        if (!hasAllSections) {
            return false;
        }

        String lower = synthesis.toLowerCase();
        return !(lower.contains("=== evidence bank")
                || lower.contains("=== reddit posts")
                || lower.contains("=== twitter/x posts")
                || lower.contains("=== source:"));
    }

    private String buildReporterFallback(
            String topic,
            List<String> quickTake,
            List<ControversyTopic> controversyTopics,
            List<FlipSignal> flipSignals,
            CampDistribution campDistribution,
            int heatScore,
            int flipRiskScore,
            String platformDiff
    ) {
        String lead = quickTake.isEmpty()
                ? "The conversation around \"%s\" is splitting into clear camps with rising pressure.".formatted(topic)
                : quickTake.getFirst();

        String frontline = "Support stands at %.0f%% versus %.0f%% opposition, while %.0f%% are still undecided observers."
                .formatted(
                        nz(campDistribution.support()) * 100,
                        nz(campDistribution.oppose()) * 100,
                        nz(campDistribution.neutral()) * 100
                );
        String controversies = controversyTopics.isEmpty()
                ? "1. General narrative clash remains the main fight."
                : controversyTopics.stream()
                .limit(3)
                .map(t -> "%s (%d/100): %s".formatted(
                        t.aspect() == null ? "General" : t.aspect(),
                        clampScore(t.heat() == null ? 50 : t.heat()),
                        t.summary() == null ? "No extra context." : t.summary()))
                .reduce((a, b) -> a + "\n" + b)
                .orElse("1. General narrative clash remains the main fight.");
        String flipWatch = "Flip risk is %d/100, meaning %s.".formatted(flipRiskScore, describeFlipRisk(flipRiskScore));
        String whyItMatters = "With heat at %d/100, this discussion can quickly shape public perception and spill into mainstream narratives."
                .formatted(heatScore);
        String reporterNote = platformDiff + " Evidence is sampled from cross-platform public posts and should be read as directional, not universal.";

        return """
                ## Lead
                %s

                ## Frontline Clash
                %s

                ## Top Controversies
                %s

                ## Flip Risk Watch
                %s

                ## Why It Matters
                %s

                ## Reporter Note
                %s
                """.formatted(lead, frontline, controversies, flipWatch, whyItMatters, reporterNote);
    }

    private List<String> collectEvidenceUrls(SentimentResult redditSentiment, SentimentResult twitterSentiment) {
        List<String> urls = new ArrayList<>();
        addQuoteUrls(urls, redditSentiment);
        addQuoteUrls(urls, twitterSentiment);
        return urls.stream().distinct().toList();
    }

    private void addQuoteUrls(List<String> urls, SentimentResult sentimentResult) {
        if (sentimentResult == null || sentimentResult.representativeQuotes() == null) {
            return;
        }
        sentimentResult.representativeQuotes().stream()
                .map(Quote::url)
                .filter(url -> url != null && !url.isBlank())
                .forEach(urls::add);
    }

    private List<String> pickEvidenceUrls(List<String> urls, int start, int limit) {
        if (urls.isEmpty()) {
            return List.of();
        }
        int from = Math.min(start, urls.size() - 1);
        int to = Math.min(urls.size(), from + limit);
        return urls.subList(from, to);
    }

    private String renderEvidenceRefs(List<String> evidenceUrls) {
        if (evidenceUrls == null || evidenceUrls.isEmpty()) {
            return "";
        }
        StringBuilder sb = new StringBuilder();
        for (int i = 0; i < evidenceUrls.size(); i++) {
            if (i > 0) {
                sb.append(' ');
            }
            sb.append("[Q").append(i + 1).append(']');
        }
        return sb.toString();
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
