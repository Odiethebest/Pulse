package com.odieyang.pulse.orchestrator;

import com.odieyang.pulse.agent.*;
import com.odieyang.pulse.model.*;
import com.odieyang.pulse.service.AgentEventPublisher;
import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;

import java.util.List;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicInteger;

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
