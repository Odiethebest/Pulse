package com.odieyang.pulse.orchestrator;

import com.odieyang.pulse.agent.*;
import com.odieyang.pulse.model.*;
import com.odieyang.pulse.service.AgentEventPublisher;
import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;

import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.HashSet;
import java.util.LinkedHashSet;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

import static org.junit.jupiter.api.Assertions.*;

class PulseOrchestratorV2Tests {

    @Test
    void analyzeShouldFetchPlatformsInParallelAndAssembleV2Report() throws Exception {
        CountDownLatch bothFetchStarted = new CountDownLatch(2);
        CountDownLatch releaseFetch = new CountDownLatch(1);

        var orchestrator = buildOrchestrator(
                new FixedQueryPlannerAgent(),
                new BlockingRedditAgent(bothFetchStarted, releaseFetch),
                new BlockingTwitterAgent(bothFetchStarted, releaseFetch),
                new FixedSentimentAgent(),
                new FixedStanceAgent(),
                new FixedConflictAgent(),
                new FixedAspectAgent(),
                new FixedFlipRiskAgent(),
                new TrackingSynthesisAgent(),
                new FixedCriticAgent(55),
                new AgentEventPublisher()
        );
        ReflectionTestUtils.setField(orchestrator, "confidenceThreshold", 60);

        CompletableFuture<PulseReport> future = CompletableFuture.supplyAsync(() -> orchestrator.analyze("Parallel Topic"));

        assertTrue(bothFetchStarted.await(2, TimeUnit.SECONDS),
                "Expected Reddit and Twitter fetch to start before release");
        assertFalse(future.isDone(), "Analyze should still be waiting for fetch release");
        releaseFetch.countDown();

        PulseReport report = future.get(3, TimeUnit.SECONDS);

        assertEquals("Parallel Topic", report.topic());
        assertTrue(report.debateTriggered());
        assertTrue(report.synthesis().contains("## Lead"));
        assertTrue(report.synthesis().contains("## Reporter Note"));
        assertEquals(72, report.heatScore());
        assertEquals(58, report.flipRiskScore());
        assertEquals(66, report.dramaScore());
        assertEquals(55, report.confidenceScore());
        assertNotNull(report.confidenceBreakdown());
        assertEquals(3, report.quickTake().size());
        assertEquals(1, report.controversyTopics().size());
        assertEquals("Pricing", report.controversyTopics().getFirst().aspect());
        assertNotNull(report.claimAnnotations());
        assertFalse(report.claimAnnotations().isEmpty());
        assertNotNull(report.riskFlags());
        assertFalse(report.riskFlags().isEmpty());
        assertNotNull(report.revisionAnchors());
        assertFalse(report.revisionAnchors().isEmpty());
    }

    @Test
    void analyzeShouldFallbackWhenOptionalAgentsFail() {
        var orchestrator = buildOrchestrator(
                new FixedQueryPlannerAgent(),
                new FixedRedditAgent(),
                new FixedTwitterAgent(),
                new FixedSentimentAgent(),
                new FailingStanceAgent(),
                new FailingConflictAgent(),
                new FailingAspectAgent(),
                new FailingFlipRiskAgent(),
                new TrackingSynthesisAgent(),
                new CriticWithEvidenceGapAgent(),
                new AgentEventPublisher()
        );
        ReflectionTestUtils.setField(orchestrator, "confidenceThreshold", 60);

        PulseReport report = orchestrator.analyze("Fallback Topic");

        assertFalse(report.debateTriggered());
        assertEquals(50, report.heatScore(), "Conflict fallback heat should be used");
        assertEquals(35, report.flipRiskScore(), "Flip risk fallback should be used");
        assertNotNull(report.campDistribution());
        assertEquals(1.0, report.campDistribution().neutral(), 0.0001);
        assertFalse(report.controversyTopics().isEmpty(), "Should fallback to sentiment controversies");
        assertEquals("Evidence gap", report.flipSignals().getFirst().signal());
        assertTrue(report.revisionDelta().getFirst().startsWith("Need stronger evidence: "));
    }

    @Test
    void analyzeShouldDegradeWhenRedditFetchFailsButTwitterStillWorks() {
        var orchestrator = buildOrchestrator(
                new FixedQueryPlannerAgent(),
                new FailingRedditAgent(),
                new FixedTwitterAgent(),
                new FixedSentimentAgent(),
                new FixedStanceAgent(),
                new FixedConflictAgent(),
                new FixedAspectAgent(),
                new FixedFlipRiskAgent(),
                new TrackingSynthesisAgent(),
                new FixedCriticAgent(72),
                new AgentEventPublisher()
        );
        ReflectionTestUtils.setField(orchestrator, "confidenceThreshold", 60);

        PulseReport report = assertDoesNotThrow(() -> orchestrator.analyze("Reddit failure degrade topic"));

        assertNotNull(report);
        assertNotNull(report.crawlerStats());
        assertEquals(0, report.crawlerStats().redditCount(), "Failed Reddit fetch should degrade to empty posts");
        assertTrue(report.crawlerStats().twitterCount() > 0, "Twitter data should still be preserved");
        assertNotNull(report.allPosts());
        assertFalse(report.allPosts().isEmpty(), "At least one platform should still contribute posts");
        assertTrue(report.allPosts().stream().anyMatch(post -> "twitter".equalsIgnoreCase(post.platform())));
    }

    @Test
    void analyzeShouldFallbackToInitialSynthesisWhenRevisionFails() {
        var orchestrator = buildOrchestrator(
                new FixedQueryPlannerAgent(),
                new FixedRedditAgent(),
                new FixedTwitterAgent(),
                new FixedSentimentAgent(),
                new FixedStanceAgent(),
                new FixedConflictAgent(),
                new FixedAspectAgent(),
                new FixedFlipRiskAgent(),
                new FailingRevisionSynthesisAgent(),
                new FixedCriticAgent(45),
                new AgentEventPublisher()
        );
        ReflectionTestUtils.setField(orchestrator, "confidenceThreshold", 60);

        PulseReport report = orchestrator.analyze("Revision fallback topic");

        assertTrue(report.synthesis().contains("## Lead"));
        assertTrue(report.synthesis().contains("## Flip Risk Watch"));
        assertFalse(report.debateTriggered(),
                "Should not claim revision happened when revision synthesis failed");
        assertEquals(45, report.confidenceScore());
        assertNotNull(report.quickTake());
        assertFalse(report.quickTake().isEmpty());
    }

    @Test
    void analyzeShouldTriggerRewriteWhenQualityGateFails() {
        var orchestrator = buildOrchestrator(
                new FixedQueryPlannerAgent(),
                new FixedRedditAgent(),
                new FixedTwitterAgent(),
                new FixedSentimentAgent(),
                new FixedStanceAgent(),
                new FixedConflictAgent(),
                new FixedAspectAgent(),
                new FixedFlipRiskAgent(),
                new TrackingSynthesisAgent(),
                new QualityGateCriticAgent(),
                new AgentEventPublisher()
        );
        ReflectionTestUtils.setField(orchestrator, "confidenceThreshold", 60);
        ReflectionTestUtils.setField(orchestrator, "minInformationDensity", 55);
        ReflectionTestUtils.setField(orchestrator, "minClaimEvidenceCoverage", 60);

        PulseReport report = orchestrator.analyze("Quality gate topic");

        assertTrue(report.debateTriggered(), "Quality gate rewrite should mark debateTriggered");
        assertTrue(report.synthesis().contains("## Lead"));
        assertTrue(report.synthesis().contains("## Why It Matters"));
    }

    @Test
    void analyzeShouldDistillPropositionSummaryIntoEntityPhrase() {
        var orchestrator = buildOrchestrator(
                new PropositionSummaryQueryPlannerAgent(),
                new FixedRedditAgent(),
                new FixedTwitterAgent(),
                new FixedSentimentAgent(),
                new FixedStanceAgent(),
                new FixedConflictAgent(),
                new FixedAspectAgent(),
                new FixedFlipRiskAgent(),
                new TrackingSynthesisAgent(),
                new FixedCriticAgent(82),
                new AgentEventPublisher()
        );

        PulseReport report = orchestrator.analyze("Taiwan topic");

        String firstClaim = report.claimEvidenceMap().getFirst().claim().toLowerCase();
        assertFalse(firstClaim.contains("there are growing public concerns"));
        assertFalse(firstClaim.contains("public perception of there"));
        assertTrue(firstClaim.contains("taiwan"), "Expected normalized entity to retain target subject");
    }

    @Test
    void analyzeShouldUseNonRoboticFallbackWhenSynthesisContainsBadTemplates() {
        var orchestrator = buildOrchestrator(
                new FixedQueryPlannerAgent(),
                new FixedRedditAgent(),
                new FixedTwitterAgent(),
                new FixedSentimentAgent(),
                new FixedStanceAgent(),
                new FixedConflictAgent(),
                new FixedAspectAgent(),
                new FixedFlipRiskAgent(),
                new InvalidTemplateSynthesisAgent(),
                new FixedCriticAgent(82),
                new AgentEventPublisher()
        );

        PulseReport report = orchestrator.analyze("Fallback style topic");
        String synthesis = report.synthesis();

        assertFalse(synthesis.contains("The consensus is "), "Fallback should avoid robotic consensus template");
        assertFalse(synthesis.contains("Because this debate"), "Fallback should avoid robotic because-template");
        assertTrue(synthesis.contains("## Flip Risk Watch"));
    }

    @Test
    void quickTakeShouldSpreadCitationsBeyondFirstTwoSources() {
        var orchestrator = buildOrchestrator(
                new FixedQueryPlannerAgent(),
                new FixedRedditAgent(),
                new FixedTwitterAgent(),
                new MultiQuoteSentimentAgent(),
                new FixedStanceAgent(),
                new FixedConflictAgent(),
                new FixedAspectAgent(),
                new FixedFlipRiskAgent(),
                new TrackingSynthesisAgent(),
                new FixedCriticAgent(82),
                new AgentEventPublisher()
        );

        PulseReport report = orchestrator.analyze("Citation diversity topic");
        String joinedQuickTake = String.join(" ", report.quickTake());
        Matcher matcher = Pattern.compile("\\[Q(\\d+)]").matcher(joinedQuickTake);
        Set<Integer> citationIds = new HashSet<>();
        while (matcher.find()) {
            citationIds.add(Integer.parseInt(matcher.group(1)));
        }

        assertTrue(citationIds.size() >= 5,
                "Expected at least 5 distinct citations when 5+ sources are available");
        assertTrue(citationIds.stream().anyMatch(id -> id > 2),
                "Expected citations beyond [Q1] and [Q2]");
    }

    @Test
    void quickTakeShouldAvoidLegacyFixedOffsetCitationPairing() {
        var orchestrator = buildOrchestrator(
                new FixedQueryPlannerAgent(),
                new FixedRedditAgent(),
                new FixedTwitterAgent(),
                new ClaimMatchedQuoteSentimentAgent(),
                new FixedStanceAgent(),
                new FixedConflictAgent(),
                new FixedAspectAgent(),
                new FixedFlipRiskAgent(),
                new TrackingSynthesisAgent(),
                new FixedCriticAgent(82),
                new AgentEventPublisher()
        );

        PulseReport report = orchestrator.analyze("Taylor Swift and Ed Sheeran friendship debate");

        assertTrue(report.quickTake().size() >= 2);
        String first = report.quickTake().get(0);
        String second = report.quickTake().get(1);

        assertFalse(containsCitationPair(first, 1, 5),
                "First quickTake line should not fall back to legacy [Q1][Q5] pairing");
        assertFalse(containsCitationPair(second, 2, 6),
                "Second quickTake line should not fall back to legacy [Q2][Q6] pairing");
    }

    @Test
    void quickTakeShouldRepairMechanicalPairingWhenFirstTwoClaimsAlignByOffset() {
        var orchestrator = buildOrchestrator(
                new FixedQueryPlannerAgent(),
                new FixedRedditAgent(),
                new FixedTwitterAgent(),
                new LegacyPatternSentimentAgent(),
                new FixedStanceAgent(),
                new FixedConflictAgent(),
                new FixedAspectAgent(),
                new FixedFlipRiskAgent(),
                new TrackingSynthesisAgent(),
                new FixedCriticAgent(82),
                new AgentEventPublisher()
        );

        PulseReport report = orchestrator.analyze("Taylor Swift and Ed Sheeran friendship debate");
        assertTrue(report.quickTake().size() >= 2);

        String first = report.quickTake().get(0);
        String second = report.quickTake().get(1);
        List<Integer> firstPair = extractCitationPair(first);
        List<Integer> secondPair = extractCitationPair(second);

        assertEquals(2, firstPair.size(), "Expected first quickTake claim to carry two citations");
        assertEquals(2, secondPair.size(), "Expected second quickTake claim to carry two citations");
        assertFalse(isMechanicalOffsetPairing(firstPair, secondPair),
                "Expected Phase2 guard to break fixed-offset pairing in first two quickTake claims");
        assertFalse(containsCitationPair(second, 2, 6),
                "Expected guard to replace legacy [Q2][Q6] in second quickTake line");
    }

    @Test
    @SuppressWarnings("unchecked")
    void mechanicalPairingGuardShouldRewriteSecondClaimWhenOffsetPatternDetected() {
        var orchestrator = buildOrchestrator(
                new FixedQueryPlannerAgent(),
                new FixedRedditAgent(),
                new FixedTwitterAgent(),
                new LegacyPatternSentimentAgent(),
                new FixedStanceAgent(),
                new FixedConflictAgent(),
                new FixedAspectAgent(),
                new FixedFlipRiskAgent(),
                new TrackingSynthesisAgent(),
                new FixedCriticAgent(82),
                new AgentEventPublisher()
        );

        SentimentResult redditSentiment = new LegacyPatternSentimentAgent().analyze(new RawPosts("reddit", List.of()));
        SentimentResult twitterSentiment = new LegacyPatternSentimentAgent().analyze(new RawPosts("twitter", List.of()));
        List<Object> evidenceQuotes = (List<Object>) ReflectionTestUtils.invokeMethod(
                orchestrator,
                "collectEvidenceQuotes",
                redditSentiment,
                twitterSentiment
        );

        List<ClaimEvidenceLink> initialClaimMap = (List<ClaimEvidenceLink>) ReflectionTestUtils.invokeMethod(
                orchestrator,
                "buildClaimEvidenceMap",
                "Taylor Swift and Ed Sheeran friendship",
                new CampDistribution(0.52, 0.36, 0.12),
                List.of(new ControversyTopic("pricing flashpoint", 72, "Price fairness fight")),
                72,
                58,
                false,
                "Reddit dissects details while X amplifies headline loops.",
                evidenceQuotes
        );

        List<String> evidenceUrls = List.of(
                "https://reddit.com/r/1",
                "https://reddit.com/r/2",
                "https://reddit.com/r/3",
                "https://x.com/1",
                "https://x.com/2",
                "https://x.com/3"
        );

        List<Integer> firstPairBefore = citationPairFromUrls(initialClaimMap.get(0).evidenceUrls(), evidenceUrls);
        List<Integer> secondPairBefore = citationPairFromUrls(initialClaimMap.get(1).evidenceUrls(), evidenceUrls);
        assertTrue(isMechanicalOffsetPairing(firstPairBefore, secondPairBefore),
                "Fixture should produce a mechanical offset pair before guard");

        List<ClaimEvidenceLink> guardedClaimMap = (List<ClaimEvidenceLink>) ReflectionTestUtils.invokeMethod(
                orchestrator,
                "applyQuickTakeMechanicalPairingGuard",
                initialClaimMap,
                evidenceQuotes,
                evidenceUrls
        );

        List<Integer> firstPairAfter = citationPairFromUrls(guardedClaimMap.get(0).evidenceUrls(), evidenceUrls);
        List<Integer> secondPairAfter = citationPairFromUrls(guardedClaimMap.get(1).evidenceUrls(), evidenceUrls);

        assertFalse(isMechanicalOffsetPairing(firstPairAfter, secondPairAfter),
                "Expected guard to rewrite second claim away from fixed-offset pairing");
        assertNotEquals(
                new LinkedHashSet<>(initialClaimMap.get(1).evidenceUrls()),
                new LinkedHashSet<>(guardedClaimMap.get(1).evidenceUrls()),
                "Expected second claim evidence urls to change when guard triggers"
        );
    }

    @Test
    void analyzeShouldEmitPhase3CrawlerSignalsAndRankedBucketPosts() {
        var orchestrator = buildOrchestrator(
                new FixedQueryPlannerAgent(),
                new FixedRedditAgent(),
                new FixedTwitterAgent(),
                new FixedSentimentAgent(),
                new FixedStanceAgent(),
                new FixedConflictAgent(),
                new FixedAspectAgent(),
                new FixedFlipRiskAgent(),
                new BoundaryClassifyingSynthesisAgent(),
                new FixedCriticAgent(82),
                new AgentEventPublisher()
        );
        ReflectionTestUtils.setField(orchestrator, "crawlerTargetTotal", 10);
        ReflectionTestUtils.setField(orchestrator, "crawlerBoundaryMaxPosts", 20);

        PulseReport report = orchestrator.analyze("Phase3 coverage topic");

        assertNotNull(report.crawlerStats());
        assertEquals(40, report.crawlerStats().coveragePercent());
        assertEquals("critical", report.crawlerStats().coverageLevel());
        assertNotNull(report.crawlerStats().coverageAlerts());
        assertFalse(report.crawlerStats().coverageAlerts().isEmpty());

        TopicBucket pricingBucket = report.topicBuckets().stream()
                .filter(bucket -> "t1".equals(bucket.topicId()))
                .findFirst()
                .orElseThrow();
        assertNotNull(pricingBucket.posts());
        assertFalse(pricingBucket.posts().isEmpty());
        assertEquals(0, report.crawlerStats().unassignedCount());

        CrawledPost top = pricingBucket.posts().getFirst();
        assertNotNull(top.evidenceScore());
        assertNotNull(top.recencyScore());
        assertNotNull(top.sortScore());
        assertEquals("llm", top.classificationMethod());
        assertEquals("https://reddit.com/r/1", top.url());
    }

    @Test
    void analyzeShouldTightenNoisyCrawlerPostsByRelevance() {
        var orchestrator = buildOrchestrator(
                new FixedQueryPlannerAgent(),
                new NoisyRedditAgent(),
                new NoisyTwitterAgent(),
                new FixedSentimentAgent(),
                new FixedStanceAgent(),
                new FixedConflictAgent(),
                new FixedAspectAgent(),
                new FixedFlipRiskAgent(),
                new TrackingSynthesisAgent(),
                new FixedCriticAgent(82),
                new AgentEventPublisher()
        );
        ReflectionTestUtils.setField(orchestrator, "crawlerRelevanceMinSample", 1);
        ReflectionTestUtils.setField(orchestrator, "crawlerRelevanceMinScore", 2);
        ReflectionTestUtils.setField(orchestrator, "crawlerRelevanceMinRetainCount", 2);
        ReflectionTestUtils.setField(orchestrator, "crawlerRelevanceMinRetainRatio", 0.2);
        ReflectionTestUtils.setField(orchestrator, "crawlerRelevanceMaxHashtags", 3);

        PulseReport report = orchestrator.analyze("Taylor Swift and Ed Sheeran friendship debate");

        assertNotNull(report.allPosts());
        assertTrue(report.allPosts().size() < 12, "Expected noisy posts to be filtered");
        assertTrue(report.allPosts().stream().noneMatch(post ->
                        String.valueOf(post.snippet()).toLowerCase().contains("giveaway")),
                "Expected giveaway noise to be removed");
        assertTrue(report.allPosts().stream().noneMatch(post ->
                        String.valueOf(post.snippet()).toLowerCase().contains("image 1 on x")),
                "Expected social image shell noise to be removed");
        assertTrue(report.allPosts().stream().anyMatch(post ->
                        String.valueOf(post.snippet()).toLowerCase().contains("friendship")),
                "Expected topic-relevant friendship posts to remain");
    }

    @Test
    void analyzeShouldApplyStrictGateAndPlatformCapForHighRelevanceOnly() {
        var orchestrator = buildOrchestrator(
                new FixedQueryPlannerAgent(),
                new RelevanceStressRedditAgent(),
                new RelevanceStressTwitterAgent(),
                new FixedSentimentAgent(),
                new FixedStanceAgent(),
                new FixedConflictAgent(),
                new FixedAspectAgent(),
                new FixedFlipRiskAgent(),
                new TrackingSynthesisAgent(),
                new FixedCriticAgent(82),
                new AgentEventPublisher()
        );
        ReflectionTestUtils.setField(orchestrator, "crawlerTargetTotal", 32);
        ReflectionTestUtils.setField(orchestrator, "crawlerRelevanceMinSample", 1);
        ReflectionTestUtils.setField(orchestrator, "crawlerRelevanceMinScore", 2);
        ReflectionTestUtils.setField(orchestrator, "crawlerRelevanceMinRetainCount", 1);
        ReflectionTestUtils.setField(orchestrator, "crawlerRelevanceMinRetainRatio", 0.10);
        ReflectionTestUtils.setField(orchestrator, "crawlerRelevancePlatformCap", 8);

        PulseReport report = orchestrator.analyze("Taylor Swift and Ed Sheeran friendship debate");

        assertNotNull(report.allPosts());
        assertTrue(report.allPosts().size() <= 16, "Platform cap should constrain merged posts to 16 or fewer");
        assertNotNull(report.crawlerStats());
        assertTrue(report.crawlerStats().redditCount() <= 8, "Reddit posts should be capped per platform");
        assertTrue(report.crawlerStats().twitterCount() <= 8, "Twitter posts should be capped per platform");
        assertTrue(report.allPosts().stream().noneMatch(post ->
                        String.valueOf(post.url()).contains("/weak-")),
                "Strict gate should remove weak single-anchor posts");
        assertTrue(report.allPosts().stream().anyMatch(post ->
                        String.valueOf(post.url()).contains("/strong-")),
                "Strongly relevant posts should remain after tightening");
    }

    private boolean containsCitationPair(String line, int left, int right) {
        if (line == null || line.isBlank()) {
            return false;
        }
        String a = "[Q" + left + "]";
        String b = "[Q" + right + "]";
        return line.contains(a + " " + b) || line.contains(b + " " + a);
    }

    private List<Integer> extractCitationPair(String line) {
        if (line == null || line.isBlank()) {
            return List.of();
        }
        LinkedHashSet<Integer> uniqueIds = new LinkedHashSet<>();
        Matcher matcher = Pattern.compile("\\[Q(\\d+)]").matcher(line);
        while (matcher.find() && uniqueIds.size() < 2) {
            uniqueIds.add(Integer.parseInt(matcher.group(1)));
        }
        if (uniqueIds.size() < 2) {
            return List.of();
        }
        List<Integer> pair = new ArrayList<>(uniqueIds);
        pair.sort(Integer::compareTo);
        return pair;
    }

    private boolean isMechanicalOffsetPairing(List<Integer> firstPair, List<Integer> secondPair) {
        if (firstPair == null || secondPair == null || firstPair.size() < 2 || secondPair.size() < 2) {
            return false;
        }
        int firstOffset = firstPair.get(1) - firstPair.get(0);
        int secondOffset = secondPair.get(1) - secondPair.get(0);
        if (firstOffset < 2 || firstOffset != secondOffset) {
            return false;
        }
        int lowerDelta = secondPair.get(0) - firstPair.get(0);
        int upperDelta = secondPair.get(1) - firstPair.get(1);
        return Math.abs(lowerDelta) <= 2 && Math.abs(upperDelta) <= 2 && (lowerDelta != 0 || upperDelta != 0);
    }

    private List<Integer> citationPairFromUrls(List<String> selectedUrls, List<String> allEvidenceUrls) {
        if (selectedUrls == null || allEvidenceUrls == null) {
            return List.of();
        }
        LinkedHashSet<Integer> ids = new LinkedHashSet<>();
        for (String url : selectedUrls) {
            int index = allEvidenceUrls.indexOf(url);
            if (index >= 0) {
                ids.add(index + 1);
            }
            if (ids.size() >= 2) {
                break;
            }
        }
        if (ids.size() < 2) {
            return List.of();
        }
        List<Integer> pair = new ArrayList<>(ids);
        pair.sort(Integer::compareTo);
        return pair;
    }

    private PulseOrchestrator buildOrchestrator(
            QueryPlannerAgent queryPlannerAgent,
            RedditAgent redditAgent,
            TwitterAgent twitterAgent,
            SentimentAgent sentimentAgent,
            StanceAgent stanceAgent,
            ConflictAgent conflictAgent,
            AspectAgent aspectAgent,
            FlipRiskAgent flipRiskAgent,
            SynthesisAgent synthesisAgent,
            CriticAgent criticAgent,
            AgentEventPublisher publisher
    ) {
        return new PulseOrchestrator(
                queryPlannerAgent,
                redditAgent,
                twitterAgent,
                sentimentAgent,
                stanceAgent,
                conflictAgent,
                aspectAgent,
                flipRiskAgent,
                synthesisAgent,
                criticAgent,
                publisher
        );
    }

    private static class FixedQueryPlannerAgent extends QueryPlannerAgent {
        FixedQueryPlannerAgent() {
            super(null, null);
        }

        @Override
        public QueryPlan plan(String topic) {
            return new QueryPlan(
                    List.of(topic + " reddit 1", topic + " reddit 2"),
                    List.of(topic + " twitter 1", topic + " twitter 2"),
                    "Summary for " + topic
            );
        }
    }

    private static class PropositionSummaryQueryPlannerAgent extends QueryPlannerAgent {
        PropositionSummaryQueryPlannerAgent() {
            super(null, null);
        }

        @Override
        public QueryPlan plan(String topic) {
            return new QueryPlan(
                    List.of(topic + " reddit"),
                    List.of(topic + " twitter"),
                    "There are growing public concerns regarding Taiwan's reunification with China"
            );
        }
    }

    private static class FixedRedditAgent extends RedditAgent {
        FixedRedditAgent() {
            super(null, null);
        }

        @Override
        public RawPosts fetch(List<String> queries) {
            return new RawPosts("reddit", List.of(
                    new RawPost("r1", "Reddit snippet 1", "https://reddit.com/r/1"),
                    new RawPost("r2", "Reddit snippet 2", "https://reddit.com/r/2")
            ));
        }
    }

    private static class FixedTwitterAgent extends TwitterAgent {
        FixedTwitterAgent() {
            super(null, null);
        }

        @Override
        public RawPosts fetch(List<String> queries) {
            return new RawPosts("twitter", List.of(
                    new RawPost("t1", "Twitter snippet 1", "https://x.com/1"),
                    new RawPost("t2", "Twitter snippet 2", "https://x.com/2")
            ));
        }
    }

    private static class FailingRedditAgent extends RedditAgent {
        FailingRedditAgent() {
            super(null, null);
        }

        @Override
        public RawPosts fetch(List<String> queries) {
            throw new RuntimeException("simulated tavily limit");
        }
    }

    private static class NoisyRedditAgent extends RedditAgent {
        NoisyRedditAgent() {
            super(null, null);
        }

        @Override
        public RawPosts fetch(List<String> queries) {
            return new RawPosts("reddit", List.of(
                    new RawPost("Thread 1", "Fans debate Taylor Swift friendship with Ed Sheeran.", "https://reddit.com/r/noisy/1"),
                    new RawPost("Thread 2", "Ed Sheeran says their friendship stayed stable over years.", "https://reddit.com/r/noisy/2"),
                    new RawPost("Thread 3", "Their friendship timeline sparks another debate this week.", "https://reddit.com/r/noisy/3"),
                    new RawPost("Promo", "Crypto giveaway now. Follow for rewards.", "https://reddit.com/r/noisy/4"),
                    new RawPost("Promo", "Stream now and subscribe for updates.", "https://reddit.com/r/noisy/5"),
                    new RawPost("Noise", "Completely unrelated movie trailer reactions.", "https://reddit.com/r/noisy/6")
            ));
        }
    }

    private static class NoisyTwitterAgent extends TwitterAgent {
        NoisyTwitterAgent() {
            super(null, null);
        }

        @Override
        public RawPosts fetch(List<String> queries) {
            return new RawPosts("twitter", List.of(
                    new RawPost("Tweet 1", "Taylor Swift and Ed Sheeran friendship still looks strong.", "https://x.com/noisy/1"),
                    new RawPost("Tweet 2", "People argue whether their friendship changed after tours.", "https://x.com/noisy/2"),
                    new RawPost("Tweet 3", "Friendship debate keeps trending among fans.", "https://x.com/noisy/3"),
                    new RawPost("Spam", "#TaylorSwift #EdSheeran #Music #Pop #Viral #FanCam image 1 on X", "https://x.com/noisy/4"),
                    new RawPost("Spam", "Buy tickets now. Link in bio for exclusive drops.", "https://x.com/noisy/5"),
                    new RawPost("Noise", "General weekend mood post unrelated to the topic.", "https://x.com/noisy/6")
            ));
        }
    }

    private static class RelevanceStressRedditAgent extends RedditAgent {
        RelevanceStressRedditAgent() {
            super(null, null);
        }

        @Override
        public RawPosts fetch(List<String> queries) {
            List<RawPost> posts = new ArrayList<>();
            for (int i = 1; i <= 10; i++) {
                posts.add(new RawPost(
                        "Taylor Swift and Ed Sheeran friendship debate thread " + i,
                        "Fans debate Taylor Swift and Ed Sheeran friendship intensity " + i,
                        "https://reddit.com/r/strong-" + i
                ));
            }
            posts.add(new RawPost(
                    "Friendship update",
                    "General fandom chatter without concrete context.",
                    "https://reddit.com/r/weak-1"
            ));
            posts.add(new RawPost(
                    "Taylor headline",
                    "General pop roundup without specific debate context.",
                    "https://reddit.com/r/weak-2"
            ));
            return new RawPosts("reddit", posts);
        }
    }

    private static class RelevanceStressTwitterAgent extends TwitterAgent {
        RelevanceStressTwitterAgent() {
            super(null, null);
        }

        @Override
        public RawPosts fetch(List<String> queries) {
            List<RawPost> posts = new ArrayList<>();
            for (int i = 1; i <= 10; i++) {
                posts.add(new RawPost(
                        "Taylor Swift and Ed Sheeran friendship debate pulse " + i,
                        "X users discuss Taylor Swift and Ed Sheeran friendship debate signals " + i,
                        "https://x.com/strong-" + i
                ));
            }
            posts.add(new RawPost(
                    "Friendship mood",
                    "General mood post with no concrete debate detail.",
                    "https://x.com/weak-1"
            ));
            posts.add(new RawPost(
                    "Sheeran mention",
                    "Short mention without broader topic context.",
                    "https://x.com/weak-2"
            ));
            return new RawPosts("twitter", posts);
        }
    }

    private static class BlockingRedditAgent extends FixedRedditAgent {
        private final CountDownLatch startedLatch;
        private final CountDownLatch releaseLatch;

        BlockingRedditAgent(CountDownLatch startedLatch, CountDownLatch releaseLatch) {
            this.startedLatch = startedLatch;
            this.releaseLatch = releaseLatch;
        }

        @Override
        public RawPosts fetch(List<String> queries) {
            startedLatch.countDown();
            awaitRelease();
            return super.fetch(queries);
        }

        private void awaitRelease() {
            try {
                releaseLatch.await(2, TimeUnit.SECONDS);
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
                throw new RuntimeException(e);
            }
        }
    }

    private static class BlockingTwitterAgent extends FixedTwitterAgent {
        private final CountDownLatch startedLatch;
        private final CountDownLatch releaseLatch;

        BlockingTwitterAgent(CountDownLatch startedLatch, CountDownLatch releaseLatch) {
            this.startedLatch = startedLatch;
            this.releaseLatch = releaseLatch;
        }

        @Override
        public RawPosts fetch(List<String> queries) {
            startedLatch.countDown();
            awaitRelease();
            return super.fetch(queries);
        }

        private void awaitRelease() {
            try {
                releaseLatch.await(2, TimeUnit.SECONDS);
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
                throw new RuntimeException(e);
            }
        }
    }

    private static class FixedSentimentAgent extends SentimentAgent {
        FixedSentimentAgent() {
            super(null, null);
        }

        @Override
        public SentimentResult analyze(RawPosts rawPosts) {
            if ("reddit".equals(rawPosts.platform())) {
                return new SentimentResult(
                        "reddit",
                        0.55,
                        0.35,
                        0.10,
                        List.of("Pricing"),
                        List.of(new Quote("Reddit quote", "https://reddit.com/r/1", "positive", "support", 0.8)),
                        new CampDistribution(0.58, 0.30, 0.12),
                        List.of(new ControversyTopic("Pricing", 70, "Price fairness fight"))
                );
            }

            return new SentimentResult(
                    "twitter",
                    0.33,
                    0.50,
                    0.17,
                    List.of("Credibility"),
                    List.of(new Quote("Twitter quote", "https://x.com/1", "negative", "oppose", 0.7)),
                    new CampDistribution(0.32, 0.52, 0.16),
                    List.of(new ControversyTopic("Credibility", 66, "Trust concerns"))
            );
        }
    }

    private static class MultiQuoteSentimentAgent extends SentimentAgent {
        MultiQuoteSentimentAgent() {
            super(null, null);
        }

        @Override
        public SentimentResult analyze(RawPosts rawPosts) {
            if ("reddit".equals(rawPosts.platform())) {
                return new SentimentResult(
                        "reddit",
                        0.55,
                        0.35,
                        0.10,
                        List.of("Pricing"),
                        List.of(
                                new Quote("Reddit quote 1", "https://reddit.com/r/1", "positive", "support", 0.8),
                                new Quote("Reddit quote 2", "https://reddit.com/r/2", "neutral", "neutral", 0.7),
                                new Quote("Reddit quote 3", "https://reddit.com/r/3", "negative", "oppose", 0.75)
                        ),
                        new CampDistribution(0.58, 0.30, 0.12),
                        List.of(new ControversyTopic("Pricing", 70, "Price fairness fight"))
                );
            }

            return new SentimentResult(
                    "twitter",
                    0.33,
                    0.50,
                    0.17,
                    List.of("Credibility"),
                    List.of(
                            new Quote("Twitter quote 1", "https://x.com/1", "negative", "oppose", 0.7),
                            new Quote("Twitter quote 2", "https://x.com/2", "neutral", "neutral", 0.6),
                            new Quote("Twitter quote 3", "https://x.com/3", "positive", "support", 0.65)
                    ),
                    new CampDistribution(0.32, 0.52, 0.16),
                    List.of(new ControversyTopic("Credibility", 66, "Trust concerns"))
            );
        }
    }

    private static class ClaimMatchedQuoteSentimentAgent extends SentimentAgent {
        ClaimMatchedQuoteSentimentAgent() {
            super(null, null);
        }

        @Override
        public SentimentResult analyze(RawPosts rawPosts) {
            if ("reddit".equals(rawPosts.platform())) {
                return new SentimentResult(
                        "reddit",
                        0.55,
                        0.35,
                        0.10,
                        List.of("pricing flashpoint"),
                        List.of(
                                new Quote(
                                        "Supporters still defend Taylor Swift and Ed Sheeran friendship.",
                                        "https://reddit.com/r/1",
                                        "positive",
                                        "support",
                                        0.92
                                ),
                                new Quote(
                                        "Pricing flashpoint and tour costs dominate this dispute.",
                                        "https://reddit.com/r/2",
                                        "neutral",
                                        "neutral",
                                        0.84
                                ),
                                new Quote(
                                        "Consensus remains fragile and could flip with fresh evidence.",
                                        "https://reddit.com/r/3",
                                        "negative",
                                        "oppose",
                                        0.88
                                )
                        ),
                        new CampDistribution(0.58, 0.30, 0.12),
                        List.of(new ControversyTopic("pricing flashpoint", 70, "Price fairness fight"))
                );
            }

            return new SentimentResult(
                    "twitter",
                    0.33,
                    0.50,
                    0.17,
                    List.of("consensus volatility"),
                    List.of(
                            new Quote(
                                    "Fans defend Taylor and Ed friendship against backlash on X.",
                                    "https://x.com/1",
                                    "positive",
                                    "support",
                                    0.90
                            ),
                            new Quote(
                                    "Flashpoint on X focuses on pricing fairness and dispute intensity.",
                                    "https://x.com/2",
                                    "neutral",
                                    "neutral",
                                    0.82
                            ),
                            new Quote(
                                    "Narrative consensus on X looks volatile when new evidence lands.",
                                    "https://x.com/3",
                                    "negative",
                                    "oppose",
                                    0.86
                            )
                    ),
                    new CampDistribution(0.32, 0.52, 0.16),
                    List.of(new ControversyTopic("consensus volatility", 66, "Trust concerns"))
            );
        }
    }

    private static class LegacyPatternSentimentAgent extends SentimentAgent {
        LegacyPatternSentimentAgent() {
            super(null, null);
        }

        @Override
        public SentimentResult analyze(RawPosts rawPosts) {
            if ("reddit".equals(rawPosts.platform())) {
                return new SentimentResult(
                        "reddit",
                        0.55,
                        0.35,
                        0.10,
                        List.of("pricing flashpoint"),
                        List.of(
                                new Quote(
                                        "Supporters defend Taylor Swift and Ed Sheeran friendship while critics push back and cautious observers wait.",
                                        "https://reddit.com/r/1",
                                        "positive",
                                        "support",
                                        0.96
                                ),
                                new Quote(
                                        "The pricing flashpoint moved into a fierce dispute stage around ticket costs.",
                                        "https://reddit.com/r/2",
                                        "neutral",
                                        "neutral",
                                        0.94
                                ),
                                new Quote(
                                        "Consensus may flip quickly if new evidence appears.",
                                        "https://reddit.com/r/3",
                                        "negative",
                                        "oppose",
                                        0.78
                                )
                        ),
                        new CampDistribution(0.58, 0.30, 0.12),
                        List.of(new ControversyTopic("pricing flashpoint", 70, "Price fairness fight"))
                );
            }

            return new SentimentResult(
                    "twitter",
                    0.33,
                    0.50,
                    0.17,
                    List.of("pricing flashpoint"),
                    List.of(
                            new Quote(
                                    "General reaction post with little detail.",
                                    "https://x.com/1",
                                    "neutral",
                                    "neutral",
                                    0.22
                            ),
                            new Quote(
                                    "X users defend Taylor and Ed friendship as vocal pushback grows among critics.",
                                    "https://x.com/2",
                                    "positive",
                                    "support",
                                    0.92
                            ),
                            new Quote(
                                    "X calls pricing the central flashpoint in this fierce dispute stage.",
                                    "https://x.com/3",
                                    "negative",
                                    "oppose",
                                    0.91
                            )
                    ),
                    new CampDistribution(0.32, 0.52, 0.16),
                    List.of(new ControversyTopic("pricing flashpoint", 66, "Trust concerns"))
            );
        }
    }

    private static class FixedStanceAgent extends StanceAgent {
        FixedStanceAgent() {
            super(null, null);
        }

        @Override
        public StanceResult analyze(RawPosts reddit, RawPosts twitter) {
            return new StanceResult(
                    0.52,
                    0.36,
                    0.12,
                    List.of("Support point"),
                    List.of("Oppose point"),
                    List.of("Neutral point")
            );
        }
    }

    private static class FailingStanceAgent extends StanceAgent {
        FailingStanceAgent() {
            super(null, null);
        }

        @Override
        public StanceResult analyze(RawPosts reddit, RawPosts twitter) {
            throw new RuntimeException("stance failure");
        }
    }

    private static class FixedConflictAgent extends ConflictAgent {
        FixedConflictAgent() {
            super(null, null);
        }

        @Override
        public ConflictResult analyze(RawPosts reddit, RawPosts twitter) {
            return new ConflictResult(72, List.of("Identity clash"), List.of("Ad hominem"));
        }
    }

    private static class FailingConflictAgent extends ConflictAgent {
        FailingConflictAgent() {
            super(null, null);
        }

        @Override
        public ConflictResult analyze(RawPosts reddit, RawPosts twitter) {
            throw new RuntimeException("conflict failure");
        }
    }

    private static class FixedAspectAgent extends AspectAgent {
        FixedAspectAgent() {
            super(null, null);
        }

        @Override
        public AspectResult analyze(RawPosts reddit, RawPosts twitter) {
            return new AspectResult(List.of(
                    new ControversyTopic("Pricing", 75, "Price fairness argument")
            ));
        }
    }

    private static class FailingAspectAgent extends AspectAgent {
        FailingAspectAgent() {
            super(null, null);
        }

        @Override
        public AspectResult analyze(RawPosts reddit, RawPosts twitter) {
            throw new RuntimeException("aspect failure");
        }
    }

    private static class FixedFlipRiskAgent extends FlipRiskAgent {
        FixedFlipRiskAgent() {
            super(null, null);
        }

        @Override
        public FlipRiskResult analyze(RawPosts reddit, RawPosts twitter) {
            return new FlipRiskResult(
                    58,
                    List.of(new FlipSignal("Rumor spread", 63, "Unverified repost chain")),
                    List.of("Evidence relies on second-hand claims")
            );
        }
    }

    private static class FailingFlipRiskAgent extends FlipRiskAgent {
        FailingFlipRiskAgent() {
            super(null, null);
        }

        @Override
        public FlipRiskResult analyze(RawPosts reddit, RawPosts twitter) {
            throw new RuntimeException("flip failure");
        }
    }

    private static class TrackingSynthesisAgent extends SynthesisAgent {
        private final AtomicInteger baseCalls = new AtomicInteger();
        private final AtomicInteger revisionCalls = new AtomicInteger();

        TrackingSynthesisAgent() {
            super(null, null);
        }

        @Override
        public String synthesize(
                RawPosts reddit,
                RawPosts twitter,
                SentimentResult redditSentiment,
                SentimentResult twitterSentiment
        ) {
            baseCalls.incrementAndGet();
            return "initial synthesis";
        }

        @Override
        public String synthesizeWithCoreEntity(
                RawPosts reddit,
                RawPosts twitter,
                SentimentResult redditSentiment,
                SentimentResult twitterSentiment,
                String coreEntity
        ) {
            return synthesize(reddit, twitter, redditSentiment, twitterSentiment);
        }

        @Override
        public String synthesize(
                RawPosts reddit,
                RawPosts twitter,
                SentimentResult redditSentiment,
                SentimentResult twitterSentiment,
                String critique
        ) {
            revisionCalls.incrementAndGet();
            return "revised synthesis";
        }

        @Override
        public String synthesizeWithCoreEntity(
                RawPosts reddit,
                RawPosts twitter,
                SentimentResult redditSentiment,
                SentimentResult twitterSentiment,
                String critique,
                String coreEntity
        ) {
            return synthesize(reddit, twitter, redditSentiment, twitterSentiment, critique);
        }
    }

    private static class BoundaryClassifyingSynthesisAgent extends TrackingSynthesisAgent {
        @Override
        public List<List<Integer>> classifyBoundaryTopicIndexes(List<String> topicNames, List<CrawledPost> posts) {
            return posts.stream()
                    .map(ignored -> List.of(1))
                    .toList();
        }
    }

    private static class FailingRevisionSynthesisAgent extends SynthesisAgent {
        FailingRevisionSynthesisAgent() {
            super(null, null);
        }

        @Override
        public String synthesize(
                RawPosts reddit,
                RawPosts twitter,
                SentimentResult redditSentiment,
                SentimentResult twitterSentiment
        ) {
            return "initial synthesis";
        }

        @Override
        public String synthesizeWithCoreEntity(
                RawPosts reddit,
                RawPosts twitter,
                SentimentResult redditSentiment,
                SentimentResult twitterSentiment,
                String coreEntity
        ) {
            return synthesize(reddit, twitter, redditSentiment, twitterSentiment);
        }

        @Override
        public String synthesize(
                RawPosts reddit,
                RawPosts twitter,
                SentimentResult redditSentiment,
                SentimentResult twitterSentiment,
                String critique
        ) {
            throw new RuntimeException("revision synthesis failed");
        }

        @Override
        public String synthesizeWithCoreEntity(
                RawPosts reddit,
                RawPosts twitter,
                SentimentResult redditSentiment,
                SentimentResult twitterSentiment,
                String critique,
                String coreEntity
        ) {
            return synthesize(reddit, twitter, redditSentiment, twitterSentiment, critique);
        }
    }

    private static class InvalidTemplateSynthesisAgent extends SynthesisAgent {
        InvalidTemplateSynthesisAgent() {
            super(null, null);
        }

        @Override
        public String synthesize(
                RawPosts reddit,
                RawPosts twitter,
                SentimentResult redditSentiment,
                SentimentResult twitterSentiment
        ) {
            return """
                    ## Lead
                    Public perception of there are growing concerns around this issue.

                    ## Frontline Clash
                    Support and oppose voices remain active.

                    ## Top Controversies
                    One core controversy drives the discussion.

                    ## Flip Risk Watch
                    The consensus is fragile, so one strong catalyst could reshape the narrative.

                    ## Why It Matters
                    Because this debate is intense, it can shift perception.

                    ## Reporter Note
                    Evidence sampled from public posts. (fierce and explosive)
                    """;
        }

        @Override
        public String synthesizeWithCoreEntity(
                RawPosts reddit,
                RawPosts twitter,
                SentimentResult redditSentiment,
                SentimentResult twitterSentiment,
                String coreEntity
        ) {
            return synthesize(reddit, twitter, redditSentiment, twitterSentiment);
        }
    }

    private static class FixedCriticAgent extends CriticAgent {
        private final int confidence;

        FixedCriticAgent(int confidence) {
            super(null, null);
            this.confidence = confidence;
        }

        @Override
        public CriticResult critique(String synthesis, RawPosts reddit, RawPosts twitter) {
            return new CriticResult(
                    List.of(),
                    List.of(),
                    false,
                    confidence,
                    "Tighten weak points",
                    List.of("Need direct source for strongest claim"),
                    List.of("Removed unsupported claim")
            );
        }
    }

    private static class CriticWithEvidenceGapAgent extends CriticAgent {
        CriticWithEvidenceGapAgent() {
            super(null, null);
        }

        @Override
        public CriticResult critique(String synthesis, RawPosts reddit, RawPosts twitter) {
            return new CriticResult(
                    List.of("Overstated certainty"),
                    List.of(),
                    false,
                    78,
                    "Stay within evidence",
                    List.of("Missing cross-platform quote"),
                    List.of()
            );
        }
    }

    private static class QualityGateCriticAgent extends CriticAgent {
        QualityGateCriticAgent() {
            super(null, null);
        }

        @Override
        public CriticResult critique(String synthesis, RawPosts reddit, RawPosts twitter) {
            return new CriticResult(
                    List.of(),
                    List.of(),
                    false,
                    82,
                    "Keep claims tightly evidence-backed.",
                    List.of("Missing direct source for one key claim"),
                    List.of(),
                    List.of("Generic wording in lead section"),
                    42,
                    45
            );
        }
    }
}
