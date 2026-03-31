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
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.CompletableFuture;
import java.util.function.Supplier;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

@Component
@RequiredArgsConstructor
public class PulseOrchestrator {

    private static final Logger log = LoggerFactory.getLogger(PulseOrchestrator.class);
    private static final Pattern SHELL_PREFIX_PATTERN = Pattern.compile(
            "(?i)^(?:there\\s+(?:is|are|was|were)\\s+)?(?:growing\\s+|rising\\s+|increasing\\s+|serious\\s+|widespread\\s+|public\\s+)*(?:concern|concerns|debate|debates|discussion|discussions|arguments?|questions?)\\s+(?:about|around|over|on|regarding|concerning|toward|towards)\\s+");
    private static final Pattern VIEW_PREFIX_PATTERN = Pattern.compile(
            "(?i)^(?:people'?s\\s+)?(?:atti?tude|opinion|perception|sentiment|view|views|public\\s+opinion|public\\s+perception)\\s+(?:of|about|around|over|on|regarding|concerning|toward|towards)\\s+");
    private static final Pattern INTENT_PREPOSITION_PATTERN = Pattern.compile(
            "(?i)\\b(about|around|over|on|regarding|concerning|toward|towards)\\b");
    private static final Pattern PROPOSITION_VERB_PATTERN = Pattern.compile(
            "(?i)\\b(is|are|was|were|be|being|been|has|have|had|can|could|should|would|will|may|might|must|do|does|did)\\b");
    private static final Pattern CLAUSE_BREAK_PATTERN = Pattern.compile(
            "(?i)(,|;|\\.|\\b(?:because|while|although|though|but|which|that|if|when)\\b)");
    private static final Pattern WORD_TOKEN_PATTERN = Pattern.compile("[\\p{L}\\p{N}]+");
    private static final Pattern HASHTAG_PATTERN = Pattern.compile("(?<!\\w)#[\\p{L}\\p{N}_]+");
    private static final List<String> REPORTER_SECTIONS = List.of(
            "Lead",
            "Frontline Clash",
            "Top Controversies",
            "Flip Risk Watch",
            "Why It Matters",
            "Reporter Note"
    );
    private static final Set<String> RELEVANCE_STOPWORDS = Set.of(
            "the", "a", "an", "and", "or", "for", "with", "from", "about", "around", "over", "under", "into",
            "reddit", "twitter", "tweet", "tweets", "post", "posts", "discussion", "discussions", "public",
            "opinion", "sentiment", "debate", "topic", "people", "what", "how", "why", "this", "that", "these",
            "those", "there", "their", "they", "them", "our", "your", "you", "is", "are", "was", "were", "be",
            "been", "being", "on", "in", "of", "to", "by", "as", "at", "it", "its", "x", "site"
    );
    private static final List<String> LOW_SIGNAL_MARKERS = List.of(
            "image on x",
            "image 1 on x",
            "image 2 on x",
            "listen now",
            "stream now",
            "buy tickets",
            "link in bio",
            "giveaway",
            "follow for",
            "subscribe for"
    );
    private static final int QUICK_TAKE_MAX_CITATIONS_PER_CLAIM = 2;

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

    @Value("${crawler.target-total:50}")
    private int crawlerTargetTotal;

    @Value("${crawler.boundary.max-posts:24}")
    private int crawlerBoundaryMaxPosts = 24;

    @Value("${crawler.coverage.warn-percent:70}")
    private int crawlerCoverageWarnPercent = 70;

    @Value("${crawler.coverage.critical-percent:45}")
    private int crawlerCoverageCriticalPercent = 45;

    @Value("${crawler.unassigned.warn-percent:40}")
    private int crawlerUnassignedWarnPercent = 40;

    @Value("${crawler.platform-imbalance.warn-gap:70}")
    private int crawlerPlatformImbalanceWarnGap = 70;

    @Value("${crawler.relevance.min-sample:12}")
    private int crawlerRelevanceMinSample = 12;

    @Value("${crawler.relevance.min-score:2}")
    private int crawlerRelevanceMinScore = 2;

    @Value("${crawler.relevance.min-retain-count:6}")
    private int crawlerRelevanceMinRetainCount = 6;

    @Value("${crawler.relevance.min-retain-ratio:0.35}")
    private double crawlerRelevanceMinRetainRatio = 0.35;

    @Value("${crawler.relevance.max-hashtags:4}")
    private int crawlerRelevanceMaxHashtags = 4;

    public PulseReport analyze(String topic) {
        return analyze(topic, null, "en-US");
    }

    public PulseReport analyze(String topic, String requestedRunId) {
        return analyze(topic, requestedRunId, "en-US");
    }

    public PulseReport analyze(String topic, String requestedRunId, String locale) {
        String normalizedLocale = resolveLocale(locale);
        String runId = resolveRunId(requestedRunId);
        log.info("Starting analysis for topic: {}, runId={}, locale={}", topic, runId, normalizedLocale);

        publisher.registerRun(runId);
        List<AgentEvent> trace = new ArrayList<>();
        Disposable traceSubscription = publisher.stream(runId).subscribe(trace::add);

        try {
            // Step 1: Plan queries
            QueryPlan plan = scoped(runId, () -> queryPlannerAgent.plan(topic));
            String coreEntity = extractCoreEntity(topic, plan.topicSummary());

            // Step 2: Fetch posts in parallel
            CompletableFuture<RawPosts> redditFuture =
                    CompletableFuture.supplyAsync(() -> scoped(runId, () -> redditAgent.fetch(plan.redditQueries())));
            CompletableFuture<RawPosts> twitterFuture =
                    CompletableFuture.supplyAsync(() -> scoped(runId, () -> twitterAgent.fetch(plan.twitterQueries())));

            RawPosts fetchedReddit = redditFuture.join();
            RawPosts fetchedTwitter = twitterFuture.join();
            RawPosts reddit = tightenCrawledPosts(fetchedReddit, topic, plan.topicSummary(), plan.redditQueries());
            RawPosts twitter = tightenCrawledPosts(fetchedTwitter, topic, plan.topicSummary(), plan.twitterQueries());

            // Step 3: Analyze in parallel
            CompletableFuture<SentimentResult> redditSentimentFuture =
                    CompletableFuture.supplyAsync(() -> scoped(runId, () -> sentimentAgent.analyze(reddit)));
            CompletableFuture<SentimentResult> twitterSentimentFuture =
                    CompletableFuture.supplyAsync(() -> scoped(runId, () -> sentimentAgent.analyze(twitter)));
            CompletableFuture<StanceResult> stanceFuture =
                    CompletableFuture.supplyAsync(() -> scoped(runId, () -> safeRun(
                            () -> stanceAgent.analyze(reddit, twitter),
                            defaultStanceResult(),
                            "StanceAgent")));
            CompletableFuture<ConflictResult> conflictFuture =
                    CompletableFuture.supplyAsync(() -> scoped(runId, () -> safeRun(
                            () -> conflictAgent.analyze(reddit, twitter),
                            defaultConflictResult(),
                            "ConflictAgent")));
            CompletableFuture<AspectResult> aspectFuture =
                    CompletableFuture.supplyAsync(() -> scoped(runId, () -> safeRun(
                            () -> aspectAgent.analyze(reddit, twitter),
                            defaultAspectResult(),
                            "AspectAgent")));
            CompletableFuture<FlipRiskResult> flipRiskFuture =
                    CompletableFuture.supplyAsync(() -> scoped(runId, () -> safeRun(
                            () -> flipRiskAgent.analyze(reddit, twitter),
                            defaultFlipRiskResult(),
                            "FlipRiskAgent")));

            SentimentResult redditSentiment = redditSentimentFuture.join();
            SentimentResult twitterSentiment = twitterSentimentFuture.join();
            StanceResult stanceResult = stanceFuture.join();
            ConflictResult conflictResult = conflictFuture.join();
            AspectResult aspectResult = aspectFuture.join();
            FlipRiskResult flipRiskResult = flipRiskFuture.join();

            // Step 4: Initial synthesis
            String synthesis = scoped(runId, () -> synthesisAgent.synthesizeWithCoreEntity(
                    reddit,
                    twitter,
                    redditSentiment,
                    twitterSentiment,
                    coreEntity
            ));

            // Step 5: Critic evaluation
            String synthesisForCritique = synthesis;
            CriticResult critique = scoped(runId, () -> criticAgent.critique(synthesisForCritique, reddit, twitter));

            // Step 6: Critic-triggered rewrite — low confidence or low writing quality
            boolean debateTriggered = false;
            String rewriteGuidance = buildRewriteGuidance(critique);
            if (rewriteGuidance != null) {
                try {
                    synthesis = scoped(runId, () -> synthesisAgent.synthesizeWithCoreEntity(
                            reddit,
                            twitter,
                            redditSentiment,
                            twitterSentiment,
                            rewriteGuidance,
                            coreEntity
                    ));
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
            int targetTotal = Math.max(1, crawlerTargetTotal);
            CrawlProjection crawlProjection = projectCrawledPosts(reddit, twitter, targetTotal);
            List<TopicBucket> topicBuckets = buildTopicBuckets(controversyTopics, crawlProjection.allPosts());
            int redditCount = sizeOfPosts(reddit);
            int twitterCount = sizeOfPosts(twitter);
            int unassignedCount = countUnassignedPosts(topicBuckets);
            CrawlerStats crawlerStats = buildCrawlerStats(
                    targetTotal,
                    crawlProjection.allPosts().size(),
                    redditCount,
                    twitterCount,
                    crawlProjection.dedupedCount(),
                    unassignedCount
            );
            int dramaScore = computeDramaScore(heatScore, polarizationScore, controversyTopics);
            List<FlipSignal> flipSignals = chooseFlipSignals(flipRiskResult, critique);
            List<String> revisionDelta = chooseRevisionDelta(critique);
            List<EvidenceQuote> evidenceQuotes = collectEvidenceQuotes(redditSentiment, twitterSentiment);
            List<String> evidenceUrls = evidenceQuotes.stream()
                    .map(EvidenceQuote::url)
                    .toList();
            List<ClaimEvidenceLink> claimEvidenceMap = buildClaimEvidenceMap(
                    coreEntity,
                    campDistribution,
                    controversyTopics,
                    heatScore,
                    flipRiskScore,
                    debateTriggered,
                    platformDiff,
                    evidenceQuotes
            );
            List<RevisionAnchor> revisionAnchors = buildRevisionAnchors(revisionDelta, claimEvidenceMap);
            List<ClaimAnnotation> claimAnnotations = buildClaimAnnotations(critique, revisionAnchors);
            List<RiskFlag> riskFlags = buildRiskFlags(critique, flipSignals, claimEvidenceMap);
            List<String> quickTake = buildQuickTake(claimEvidenceMap, evidenceUrls);
            ConfidenceBreakdown confidenceBreakdown = buildConfidenceBreakdown(
                    critique.confidenceScore(),
                    reddit,
                    twitter,
                    controversyTopics,
                    flipSignals
            );
            synthesis = finalizeSynthesis(
                    synthesis,
                    coreEntity,
                    quickTake,
                    controversyTopics,
                    flipSignals,
                    campDistribution,
                    heatScore,
                    flipRiskScore,
                    platformDiff
            );

            log.info("Analysis complete for '{}', runId={}, confidence={}, debateTriggered={}",
                    topic, runId, critique.confidenceScore(), debateTriggered);

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
                    claimEvidenceMap,
                    claimAnnotations,
                    riskFlags,
                    revisionAnchors,
                    crawlProjection.allPosts(),
                    crawlerStats,
                    topicBuckets
            );
        } finally {
            traceSubscription.dispose();
            publisher.unregisterRun(runId);
        }
    }

    private String resolveRunId(String requestedRunId) {
        if (requestedRunId == null || requestedRunId.isBlank()) {
            return UUID.randomUUID().toString();
        }
        return requestedRunId.trim();
    }

    private String resolveLocale(String locale) {
        if (locale == null || locale.isBlank()) {
            return "en-US";
        }
        return locale.trim();
    }

    private <T> T scoped(String runId, Supplier<T> supplier) {
        return publisher.withRunContext(runId, supplier);
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
        if (!redditTop.equalsIgnoreCase(twitterTop)) {
            return "Cross-platform mismatch is clear: Reddit users dissect \"%s\", while Twitter/X amplifies \"%s\"."
                    .formatted(redditTop, twitterTop);
        }
        return "Both platforms are converging on \"%s\", but they frame it with different emotional tones."
                .formatted(redditTop);
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

    private List<RevisionAnchor> buildRevisionAnchors(
            List<String> revisionDelta,
            List<ClaimEvidenceLink> claimEvidenceMap
    ) {
        if (revisionDelta == null || revisionDelta.isEmpty()) {
            return List.of();
        }
        List<RevisionAnchor> anchors = new ArrayList<>();
        for (int i = 0; i < revisionDelta.size(); i++) {
            String detail = revisionDelta.get(i);
            ClaimEvidenceLink relatedClaim = claimEvidenceMap.isEmpty()
                    ? null
                    : claimEvidenceMap.get(Math.min(i, claimEvidenceMap.size() - 1));
            String claimId = relatedClaim == null ? null : relatedClaim.claimId();
            String section = resolveSectionForClaim(claimId, i);
            anchors.add(new RevisionAnchor(
                    "rev-" + (i + 1),
                    section,
                    "Revision " + (i + 1),
                    detail,
                    claimId
            ));
        }
        return anchors;
    }

    private String resolveSectionForClaim(String claimId, int index) {
        if ("C1".equalsIgnoreCase(claimId)) return "Lead";
        if ("C2".equalsIgnoreCase(claimId)) return "Top Controversies";
        if ("C3".equalsIgnoreCase(claimId)) return "Flip Risk Watch";
        return REPORTER_SECTIONS.get(index % REPORTER_SECTIONS.size());
    }

    private List<ClaimAnnotation> buildClaimAnnotations(
            CriticResult critique,
            List<RevisionAnchor> revisionAnchors
    ) {
        if (revisionAnchors == null || revisionAnchors.isEmpty()) {
            return List.of();
        }
        String criticMessage = critique == null || critique.revisionSuggestions() == null || critique.revisionSuggestions().isBlank()
                ? "Critic requested stronger claim to evidence alignment."
                : critique.revisionSuggestions();
        List<ClaimAnnotation> annotations = new ArrayList<>();
        for (int i = 0; i < revisionAnchors.size(); i++) {
            RevisionAnchor anchor = revisionAnchors.get(i);
            annotations.add(new ClaimAnnotation(
                    "ann-" + (i + 1),
                    anchor.section(),
                    anchor.relatedClaimId(),
                    anchor.detail(),
                    criticMessage,
                    anchor.anchorId()
            ));
        }
        return annotations;
    }

    private List<RiskFlag> buildRiskFlags(
            CriticResult critique,
            List<FlipSignal> flipSignals,
            List<ClaimEvidenceLink> claimEvidenceMap
    ) {
        List<RiskFlag> flags = new ArrayList<>();
        String defaultClaimId = claimEvidenceMap == null || claimEvidenceMap.isEmpty()
                ? null
                : claimEvidenceMap.getFirst().claimId();

        if (critique != null && critique.evidenceGaps() != null) {
            List<String> evidenceGaps = critique.evidenceGaps();
            for (int i = 0; i < evidenceGaps.size(); i++) {
                String message = evidenceGaps.get(i);
                String section = i == 0 ? "Top Controversies" : "Flip Risk Watch";
                String claimId = claimEvidenceMap == null || claimEvidenceMap.isEmpty()
                        ? defaultClaimId
                        : claimEvidenceMap.get(Math.min(i, claimEvidenceMap.size() - 1)).claimId();
                flags.add(new RiskFlag(
                        "risk-gap-" + (i + 1),
                        section,
                        "warning",
                        "Evidence Gap",
                        message,
                        claimId
                ));
            }
        }

        if (flipSignals != null && !flipSignals.isEmpty()) {
            for (int i = 0; i < Math.min(2, flipSignals.size()); i++) {
                FlipSignal signal = flipSignals.get(i);
                flags.add(new RiskFlag(
                        "risk-flip-" + (i + 1),
                        "Flip Risk Watch",
                        (signal.severity() != null && signal.severity() >= 70) ? "high" : "warning",
                        signal.signal() == null || signal.signal().isBlank() ? "Narrative Volatility" : signal.signal(),
                        signal.summary() == null || signal.summary().isBlank()
                                ? "Narrative may shift quickly under new catalysts."
                                : signal.summary(),
                        claimEvidenceMap == null || claimEvidenceMap.size() < 3
                                ? defaultClaimId
                                : claimEvidenceMap.get(2).claimId()
                ));
            }
        }

        return flags;
    }

    private List<ClaimEvidenceLink> buildClaimEvidenceMap(
            String coreEntity,
            CampDistribution campDistribution,
            List<ControversyTopic> topics,
            int heatScore,
            int flipRiskScore,
            boolean debateTriggered,
            String platformDiff,
            List<EvidenceQuote> evidenceQuotes
    ) {
        String smoothTopic = coreEntity == null || coreEntity.isBlank() ? "the subject" : coreEntity;
        int supportPct = (int) Math.round(nz(campDistribution.support()) * 100);
        int opposePct = (int) Math.round(nz(campDistribution.oppose()) * 100);
        int neutralPct = (int) Math.round(nz(campDistribution.neutral()) * 100);
        String mainAspect = topics.isEmpty() || topics.getFirst().aspect() == null || topics.getFirst().aspect().isBlank()
                ? "the core narrative conflict"
                : topics.getFirst().aspect();
        String campLine = "While about %d%% still defend %s, a vocal %d%% actively push back, and %d%% remain cautious observers."
                .formatted(supportPct, smoothTopic, opposePct, neutralPct);
        String heatLine = "The dispute around \"%s\" has moved into a %s stage, with \"%s\" becoming the central flashpoint."
                .formatted(
                smoothTopic,
                describeHeat(heatScore),
                mainAspect
        );
        String flipLine = "The current consensus looks %s. %s%s"
                .formatted(
                describeFlipRisk(flipRiskScore),
                platformDiff,
                debateTriggered ? " Critic revision has already been applied." : ""
        );
        Set<String> globallyUsedUrls = new LinkedHashSet<>();
        return List.of(
                new ClaimEvidenceLink("C1", campLine, pickEvidenceUrlsForClaim(campLine, evidenceQuotes, globallyUsedUrls)),
                new ClaimEvidenceLink("C2", heatLine, pickEvidenceUrlsForClaim(heatLine, evidenceQuotes, globallyUsedUrls)),
                new ClaimEvidenceLink("C3", flipLine, pickEvidenceUrlsForClaim(flipLine, evidenceQuotes, globallyUsedUrls))
        );
    }

    private String describeHeat(int heatScore) {
        if (heatScore >= 70) {
            return "fierce and explosive";
        }
        if (heatScore >= 40) {
            return "simmering but steadily intensifying";
        }
        return "quiet but not resolved";
    }

    private String describeFlipRisk(int flipRiskScore) {
        if (flipRiskScore >= 70) {
            return "fragile and highly volatile to new triggers";
        }
        if (flipRiskScore >= 40) {
            return "susceptible to meaningful shifts if new evidence lands";
        }
        return "relatively stable for now";
    }

    private String extractCoreEntity(String rawTopic, String topicSummary) {
        String fromSummary = normalizeEntity(topicSummary);
        if (!fromSummary.equals("the subject")) {
            return fromSummary;
        }
        return normalizeEntity(rawTopic);
    }

    private String normalizeEntity(String topic) {
        if (topic == null || topic.isBlank()) {
            return "the subject";
        }

        String cleaned = topic.trim()
                .replaceAll("(?i)people'?s\\s+atti?tude\\s+of\\s+", "")
                .replaceAll("(?i)public\\s+opinion\\s+on\\s+", "")
                .replaceAll("(?i)discussion\\s+about\\s+", "")
                .replaceAll("(?i)debate\\s+over\\s+", "")
                .replaceAll("(?i)topic\\s*[:：]\\s*", "")
                .replaceAll("(?i)summary\\s*[:：]\\s*", "")
                .replaceAll("(?i)site:[^\\s]+", "")
                .replaceAll("(?i)\\b(and|or|not)\\b", " ")
                .replaceAll("[\"'`]+", "")
                .replaceAll("[#*_]+", " ")
                .replaceAll("[\\[\\]{}()]+", " ")
                .replaceAll("\\s+", " ")
                .trim();

        if (cleaned.isBlank()) {
            return "the subject";
        }

        cleaned = SHELL_PREFIX_PATTERN.matcher(cleaned).replaceFirst("");
        cleaned = VIEW_PREFIX_PATTERN.matcher(cleaned).replaceFirst("");
        cleaned = cleaned.replaceAll("(?i)^(?:what|how|why)\\s+do\\s+people\\s+(?:think|feel)\\s+(?:about|regarding|toward|towards)\\s+", "");
        cleaned = cleaned.replaceAll("(?i)^(?:topic|summary|question)\\s*[:：]\\s*", "");
        cleaned = cleaned.trim();

        if (looksLikeProposition(cleaned)) {
            cleaned = extractEntityTail(cleaned);
            cleaned = trimAtClauseBoundary(cleaned);
            cleaned = VIEW_PREFIX_PATTERN.matcher(cleaned).replaceFirst("").trim();
        }

        cleaned = cleaned.replaceAll("(?i)^(?:the\\s+)?(?:issue|question|debate|discussion)\\s+of\\s+", "");
        cleaned = cleaned.replaceAll("(?i)^(?:the\\s+)?(?:topic|subject)\\s+of\\s+", "");
        cleaned = cleaned.replaceAll("\\s+", " ").trim();

        if (cleaned.isBlank()) {
            return "the subject";
        }

        if (cleaned.split("\\s+").length > 12) {
            cleaned = limitWords(cleaned, 12);
        }
        return cleaned;
    }

    private boolean looksLikeProposition(String text) {
        if (text == null || text.isBlank()) {
            return false;
        }
        int wordCount = text.trim().split("\\s+").length;
        return wordCount >= 7 && PROPOSITION_VERB_PATTERN.matcher(text).find();
    }

    private String extractEntityTail(String text) {
        Matcher marker = INTENT_PREPOSITION_PATTERN.matcher(text);
        if (!marker.find()) {
            return text;
        }
        String prefix = text.substring(0, marker.start()).toLowerCase();
        boolean hasShellSignal = prefix.matches(".*\\b(concern|concerns|debate|discussion|argument|issue|question|opinion|perception|attitude|sentiment|think|feel|view|views)\\b.*");
        if (!hasShellSignal) {
            return text;
        }
        String candidate = text.substring(marker.end()).trim();
        return candidate.isBlank() ? text : candidate;
    }

    private String trimAtClauseBoundary(String text) {
        Matcher matcher = CLAUSE_BREAK_PATTERN.matcher(text);
        if (!matcher.find()) {
            return text;
        }
        String trimmed = text.substring(0, matcher.start()).trim();
        return trimmed.isBlank() ? text : trimmed;
    }

    private String limitWords(String text, int maxWords) {
        String[] words = text.split("\\s+");
        if (words.length <= maxWords) {
            return text;
        }
        StringBuilder sb = new StringBuilder();
        for (int i = 0; i < maxWords; i++) {
            if (i > 0) {
                sb.append(' ');
            }
            sb.append(words[i]);
        }
        return sb.toString();
    }

    private List<String> buildQuickTake(List<ClaimEvidenceLink> claimEvidenceMap, List<String> allEvidenceUrls) {
        return claimEvidenceMap.stream()
                .limit(3)
                .map(link -> {
                    String refs = renderEvidenceRefs(link.evidenceUrls(), allEvidenceUrls);
                    return refs.isBlank() ? link.claim() : link.claim() + " " + refs;
                })
                .toList();
    }

    private String finalizeSynthesis(
            String synthesis,
            String coreEntity,
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
                coreEntity,
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
                || lower.contains("=== source:")
                || lower.matches("(?s).*\\b\\d{1,3}\\s*/\\s*100\\b.*")
                || lower.matches("(?s).*\\(\\s*(fierce|explosive|simmering|volatile|fragile)[^)]+\\).*")
                || lower.contains("public perception of there ")
                || lower.contains("the consensus is ")
                || lower.contains("because this debate "));
    }

    private String buildReporterFallback(
            String coreEntity,
            List<String> quickTake,
            List<ControversyTopic> controversyTopics,
            List<FlipSignal> flipSignals,
            CampDistribution campDistribution,
            int heatScore,
            int flipRiskScore,
            String platformDiff
    ) {
        String lead = quickTake.isEmpty()
                ? "The discourse around %s is splitting into clear camps, and pressure is rising.".formatted(coreEntity)
                : quickTake.getFirst();

        String frontline = "While %.0f%% lean supportive, %.0f%% remain firmly opposed, and %.0f%% are still watching before committing."
                .formatted(
                        nz(campDistribution.support()) * 100,
                        nz(campDistribution.oppose()) * 100,
                        nz(campDistribution.neutral()) * 100
                );
        String controversies = controversyTopics.isEmpty()
                ? "General narrative clash remains the main fight."
                : controversyTopics.stream()
                .limit(3)
                .map(t -> "%s: %s (%s).".formatted(
                        t.aspect() == null ? "General" : t.aspect(),
                        t.summary() == null ? "No extra context." : t.summary(),
                        describeHeat(clampScore(t.heat() == null ? 50 : t.heat()))))
                .reduce((a, b) -> a + "\n" + b)
                .orElse("General narrative clash remains the main fight.");
        String flipWatch = flipRiskScore >= 70
                ? "The consensus remains highly fragile, and one strong catalyst could quickly rewrite the dominant narrative."
                : flipRiskScore >= 40
                ? "The narrative can still swing if credible new evidence or a fresh controversy lands."
                : "The discourse has settled into a relatively stable holding pattern, with limited room for sharp reversals.";
        String whyItMatters = "This debate now runs at a %s level, shaping mainstream framing and what neutral observers are likely to believe next."
                .formatted(describeHeat(heatScore));
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

    private List<EvidenceQuote> collectEvidenceQuotes(SentimentResult redditSentiment, SentimentResult twitterSentiment) {
        LinkedHashMap<String, EvidenceQuote> deduped = new LinkedHashMap<>();
        addEvidenceQuotes(deduped, redditSentiment, "Reddit");
        addEvidenceQuotes(deduped, twitterSentiment, "Twitter");
        return new ArrayList<>(deduped.values());
    }

    private void addEvidenceQuotes(
            LinkedHashMap<String, EvidenceQuote> deduped,
            SentimentResult sentimentResult,
            String platform
    ) {
        if (sentimentResult == null || sentimentResult.representativeQuotes() == null) {
            return;
        }
        for (Quote quote : sentimentResult.representativeQuotes()) {
            if (quote == null || quote.url() == null || quote.url().isBlank()) {
                continue;
            }
            String normalizedUrl = normalizeForMatch(quote.url());
            String dedupKey = "url::" + normalizedUrl;
            deduped.putIfAbsent(dedupKey, new EvidenceQuote(
                    quote.url(),
                    quote.text(),
                    sanitizeEvidenceWeight(quote.evidenceWeight()),
                    platform
            ));
        }
    }

    private List<String> pickEvidenceUrlsForClaim(
            String claim,
            List<EvidenceQuote> evidenceQuotes,
            Set<String> globallyUsedUrls
    ) {
        if (evidenceQuotes == null || evidenceQuotes.isEmpty()) {
            return List.of();
        }

        List<String> claimKeywords = claimKeywords(claim);
        List<ScoredEvidenceQuote> scored = new ArrayList<>();
        for (int i = 0; i < evidenceQuotes.size(); i++) {
            EvidenceQuote quote = evidenceQuotes.get(i);
            int relevanceScore = claimRelevanceScore(claimKeywords, quote);
            int evidenceScore = clampScore((int) Math.round(quote.evidenceWeight() * 100.0));
            int orderScore = recencyScore(i, evidenceQuotes.size());
            int noveltyScore = globallyUsedUrls.contains(quote.url()) ? 0 : 10;
            double priorityScore = relevanceScore * 0.55
                    + evidenceScore * 0.25
                    + orderScore * 0.15
                    + noveltyScore * 0.05;
            scored.add(new ScoredEvidenceQuote(
                    quote,
                    relevanceScore,
                    evidenceScore,
                    orderScore,
                    priorityScore
            ));
        }

        scored.sort((left, right) -> {
            int byPriority = Double.compare(right.priorityScore(), left.priorityScore());
            if (byPriority != 0) {
                return byPriority;
            }
            int byRelevance = Integer.compare(right.relevanceScore(), left.relevanceScore());
            if (byRelevance != 0) {
                return byRelevance;
            }
            int byEvidence = Integer.compare(right.evidenceScore(), left.evidenceScore());
            if (byEvidence != 0) {
                return byEvidence;
            }
            return Integer.compare(right.orderScore(), left.orderScore());
        });

        int targetCount = evidenceQuotes.size() >= 5 ? QUICK_TAKE_MAX_CITATIONS_PER_CLAIM : 1;
        List<ScoredEvidenceQuote> unused = scored.stream()
                .filter(candidate -> globallyUsedUrls == null || !globallyUsedUrls.contains(candidate.quote().url()))
                .toList();
        List<ScoredEvidenceQuote> primaryPool = unused.isEmpty() ? scored : unused;
        LinkedHashSet<String> selected = new LinkedHashSet<>();
        ScoredEvidenceQuote primary = primaryPool.getFirst();
        selected.add(primary.quote().url());

        if (targetCount > 1) {
            addDifferentPlatformCandidate(selected, unused, primary.quote().platform());
            if (selected.size() < targetCount) {
                addDifferentPlatformCandidate(selected, scored, primary.quote().platform());
            }
        }

        fillSelectedFromPool(selected, unused, targetCount);
        fillSelectedFromPool(selected, scored, targetCount);

        if (selected.isEmpty()) {
            selected.add(evidenceQuotes.getFirst().url());
        }
        if (globallyUsedUrls != null) {
            globallyUsedUrls.addAll(selected);
        }
        return new ArrayList<>(selected);
    }

    private void addDifferentPlatformCandidate(
            LinkedHashSet<String> selected,
            List<ScoredEvidenceQuote> candidates,
            String primaryPlatform
    ) {
        if (candidates == null || candidates.isEmpty()) {
            return;
        }
        for (ScoredEvidenceQuote candidate : candidates) {
            String url = candidate.quote().url();
            if (selected.contains(url)) {
                continue;
            }
            if (candidate.quote().platform().equalsIgnoreCase(primaryPlatform)) {
                continue;
            }
            selected.add(url);
            return;
        }
    }

    private void fillSelectedFromPool(
            LinkedHashSet<String> selected,
            List<ScoredEvidenceQuote> candidates,
            int targetCount
    ) {
        if (candidates == null || candidates.isEmpty() || selected.size() >= targetCount) {
            return;
        }
        for (ScoredEvidenceQuote candidate : candidates) {
            if (selected.size() >= targetCount) {
                return;
            }
            selected.add(candidate.quote().url());
        }
    }

    private List<String> claimKeywords(String claim) {
        String normalized = normalizeForMatch(claim);
        if (normalized.isBlank()) {
            return List.of();
        }
        LinkedHashSet<String> keywords = new LinkedHashSet<>();
        Matcher tokenMatcher = WORD_TOKEN_PATTERN.matcher(normalized);
        while (tokenMatcher.find()) {
            String token = tokenMatcher.group();
            if (token == null || token.isBlank()) {
                continue;
            }
            if (RELEVANCE_STOPWORDS.contains(token)) {
                continue;
            }
            if (!containsCjk(token) && token.length() < 3) {
                continue;
            }
            if (containsCjk(token) && token.length() < 2) {
                continue;
            }
            keywords.add(token);
        }
        if (keywords.isEmpty() && normalized.length() >= 4 && normalized.length() <= 90) {
            keywords.add(normalized);
        }
        return new ArrayList<>(keywords);
    }

    private int claimRelevanceScore(List<String> claimKeywords, EvidenceQuote quote) {
        if (quote == null) {
            return 0;
        }
        String source = normalizeForMatch(
                (quote.text() == null ? "" : quote.text())
                        + " "
                        + (quote.url() == null ? "" : quote.url())
        );
        if (source.isBlank()) {
            return 0;
        }
        if (claimKeywords == null || claimKeywords.isEmpty()) {
            return 0;
        }
        int score = 0;
        int hits = 0;
        for (String keyword : claimKeywords) {
            if (keyword == null || keyword.isBlank()) {
                continue;
            }
            if (!source.contains(keyword)) {
                continue;
            }
            hits += 1;
            if (containsCjk(keyword)) {
                score += 8;
            } else if (keyword.length() >= 8) {
                score += 13;
            } else {
                score += 9;
            }
        }
        if (hits >= 2) {
            score += 8;
        }
        return clampScore(score);
    }

    private double sanitizeEvidenceWeight(Double value) {
        if (value == null || Double.isNaN(value) || Double.isInfinite(value)) {
            return 0.5;
        }
        return Math.max(0.0, Math.min(1.0, value));
    }

    private String renderEvidenceRefs(List<String> evidenceUrls, List<String> allEvidenceUrls) {
        if (evidenceUrls == null || evidenceUrls.isEmpty()) {
            return "";
        }

        LinkedHashSet<String> uniqueUrls = new LinkedHashSet<>();
        for (String url : evidenceUrls) {
            if (url != null && !url.isBlank()) {
                uniqueUrls.add(url);
            }
        }
        if (uniqueUrls.isEmpty()) {
            return "";
        }

        StringBuilder sb = new StringBuilder();
        for (String url : uniqueUrls) {
            int sourceIndex = allEvidenceUrls == null ? -1 : allEvidenceUrls.indexOf(url);
            if (sourceIndex < 0) {
                continue;
            }
            if (sb.length() > 0) {
                sb.append(' ');
            }
            sb.append("[Q").append(sourceIndex + 1).append(']');
        }

        if (sb.length() > 0) {
            return sb.toString();
        }

        int localIndex = 1;
        for (String ignored : uniqueUrls) {
            if (localIndex > 1) {
                sb.append(' ');
            }
            sb.append("[Q").append(localIndex++).append(']');
        }
        return sb.toString();
    }

    private CrawlProjection projectCrawledPosts(RawPosts reddit, RawPosts twitter, int targetTotal) {
        List<CrawledPost> redditPosts = toCrawledPosts(reddit);
        List<CrawledPost> twitterPosts = toCrawledPosts(twitter);
        List<CrawledPost> merged = interleavePosts(redditPosts, twitterPosts);

        LinkedHashMap<String, CrawledPost> deduped = new LinkedHashMap<>();
        for (CrawledPost post : merged) {
            String key = crawledPostDedupKey(post);
            deduped.putIfAbsent(key, post);
        }

        int dedupedCount = deduped.size();
        List<CrawledPost> capped = deduped.values().stream()
                .limit(targetTotal)
                .toList();
        return new CrawlProjection(capped, dedupedCount);
    }

    private List<CrawledPost> toCrawledPosts(RawPosts rawPosts) {
        List<CrawledPost> output = new ArrayList<>();
        if (rawPosts == null || rawPosts.posts() == null) {
            return output;
        }
        String platform = rawPosts.platform() == null || rawPosts.platform().isBlank()
                ? "unknown"
                : rawPosts.platform().trim().toLowerCase(Locale.ROOT);
        for (RawPost post : rawPosts.posts()) {
            if (post == null) {
                continue;
            }
            output.add(new CrawledPost(
                    platform,
                    post.title(),
                    post.snippet(),
                    post.url()
            ));
        }
        return output;
    }

    private List<CrawledPost> interleavePosts(List<CrawledPost> first, List<CrawledPost> second) {
        List<CrawledPost> merged = new ArrayList<>(first.size() + second.size());
        int max = Math.max(first.size(), second.size());
        for (int i = 0; i < max; i++) {
            if (i < first.size()) {
                merged.add(first.get(i));
            }
            if (i < second.size()) {
                merged.add(second.get(i));
            }
        }
        return merged;
    }

    private String crawledPostDedupKey(CrawledPost post) {
        String url = normalizeForMatch(post.url());
        if (!url.isBlank()) {
            return "url::" + url;
        }
        return "text::" + normalizeForMatch(post.platform())
                + "::" + normalizeForMatch(post.title())
                + "::" + normalizeForMatch(post.snippet());
    }

    private RawPosts tightenCrawledPosts(
            RawPosts rawPosts,
            String topic,
            String topicSummary,
            List<String> plannedQueries
    ) {
        if (rawPosts == null || rawPosts.posts() == null || rawPosts.posts().isEmpty()) {
            return rawPosts;
        }

        List<RawPost> originalPosts = rawPosts.posts();
        int sampleThreshold = Math.max(1, crawlerRelevanceMinSample);
        if (originalPosts.size() < sampleThreshold) {
            return rawPosts;
        }

        List<String> anchors = buildRelevanceAnchors(topic, topicSummary, plannedQueries);
        if (anchors.isEmpty()) {
            return rawPosts;
        }

        String normalizedTopic = normalizeForMatch(topic);
        List<ScoredRawPost> scoredPosts = new ArrayList<>();
        int hardRejected = 0;
        for (RawPost post : originalPosts) {
            if (post == null) {
                continue;
            }
            if (isHardIrrelevantPost(post, normalizedTopic, anchors)) {
                hardRejected += 1;
                continue;
            }
            int score = postRelevanceScore(post, normalizedTopic, anchors);
            scoredPosts.add(new ScoredRawPost(post, score));
        }

        if (scoredPosts.isEmpty()) {
            return rawPosts;
        }

        int minScore = Math.max(0, crawlerRelevanceMinScore);
        List<RawPost> thresholdKept = scoredPosts.stream()
                .filter(item -> item.score() >= minScore)
                .map(ScoredRawPost::post)
                .toList();

        int minRetainCount = Math.max(1, crawlerRelevanceMinRetainCount);
        int ratioRetainCount = (int) Math.ceil(originalPosts.size() * clampRatio(crawlerRelevanceMinRetainRatio));
        int requiredRetainCount = Math.min(
                originalPosts.size(),
                Math.max(minRetainCount, ratioRetainCount)
        );
        requiredRetainCount = Math.min(requiredRetainCount, scoredPosts.size());

        List<RawPost> finalPosts;
        if (thresholdKept.size() >= requiredRetainCount) {
            finalPosts = thresholdKept;
        } else {
            finalPosts = scoredPosts.stream()
                    .sorted(Comparator.comparingInt(ScoredRawPost::score).reversed())
                    .limit(requiredRetainCount)
                    .map(ScoredRawPost::post)
                    .toList();
        }

        if (finalPosts.size() >= originalPosts.size()) {
            return rawPosts;
        }

        int filteredCount = originalPosts.size() - finalPosts.size();
        String platform = rawPosts.platform() == null ? "unknown" : rawPosts.platform();
        log.info("Relevance filter tightened {} posts: kept {}/{} (hardRejected={}, anchors={})",
                platform,
                finalPosts.size(),
                originalPosts.size(),
                hardRejected,
                anchors.size());
        return new RawPosts(rawPosts.platform(), finalPosts);
    }

    private List<String> buildRelevanceAnchors(String topic, String topicSummary, List<String> plannedQueries) {
        LinkedHashSet<String> anchors = new LinkedHashSet<>();
        collectAnchorTokens(anchors, topic);
        collectAnchorTokens(anchors, topicSummary);
        if (plannedQueries != null) {
            for (String query : plannedQueries) {
                collectAnchorTokens(anchors, query);
            }
        }
        return anchors.stream().limit(40).toList();
    }

    private void collectAnchorTokens(Set<String> anchors, String text) {
        String normalized = normalizeForMatch(text);
        if (normalized.isBlank()) {
            return;
        }

        if (normalized.length() >= 8 && normalized.length() <= 80) {
            anchors.add(normalized);
        }

        Matcher tokenMatcher = WORD_TOKEN_PATTERN.matcher(normalized);
        while (tokenMatcher.find()) {
            String token = tokenMatcher.group();
            if (token == null || token.isBlank()) {
                continue;
            }
            if (RELEVANCE_STOPWORDS.contains(token)) {
                continue;
            }
            if (!containsCjk(token) && token.length() < 3) {
                continue;
            }
            if (containsCjk(token) && token.length() < 2) {
                continue;
            }
            anchors.add(token);
        }
    }

    private int postRelevanceScore(RawPost post, String normalizedTopic, List<String> anchors) {
        String title = normalizeForMatch(post.title());
        String snippet = normalizeForMatch(post.snippet());
        String combined = normalizeForMatch(title + " " + snippet);
        if (combined.isBlank()) {
            return 0;
        }

        int score = 0;
        int uniqueAnchorHits = 0;
        for (String anchor : anchors) {
            if (anchor == null || anchor.isBlank()) {
                continue;
            }
            if (!combined.contains(anchor)) {
                continue;
            }
            uniqueAnchorHits += 1;
            if (containsCjk(anchor)) {
                score += 2;
            } else if (anchor.length() >= 8) {
                score += 2;
            } else {
                score += 1;
            }
        }

        if (!normalizedTopic.isBlank() && combined.contains(normalizedTopic)) {
            score += 4;
        }
        if (uniqueAnchorHits >= 2) {
            score += 2;
        }
        if (uniqueAnchorHits == 1 && anchors.size() >= 6) {
            score -= 1;
        }
        if (looksLikeLowSignalNoise(combined)) {
            score -= 2;
        }

        int hashtagCount = hashtagCount(post);
        if (hashtagCount > crawlerRelevanceMaxHashtags) {
            score -= 2;
        }
        return score;
    }

    private boolean isHardIrrelevantPost(RawPost post, String normalizedTopic, List<String> anchors) {
        String combined = normalizeForMatch((post.title() == null ? "" : post.title())
                + " "
                + (post.snippet() == null ? "" : post.snippet()));
        if (combined.isBlank()) {
            return true;
        }
        if (combined.contains("javascript is disabled in this browser")
                || combined.contains("javascript is not available")) {
            return true;
        }

        int anchorHits = 0;
        for (String anchor : anchors) {
            if (anchor == null || anchor.isBlank()) {
                continue;
            }
            if (combined.contains(anchor)) {
                anchorHits += 1;
                if (anchorHits >= 1) {
                    break;
                }
            }
        }

        int hashtags = hashtagCount(post);
        boolean hashtagSpam = hashtags > crawlerRelevanceMaxHashtags && anchorHits == 0;
        boolean lowSignal = looksLikeLowSignalNoise(combined) && anchorHits == 0;
        boolean topicMiss = !normalizedTopic.isBlank() && !combined.contains(normalizedTopic) && anchorHits == 0;
        return hashtagSpam || lowSignal || topicMiss;
    }

    private boolean looksLikeLowSignalNoise(String text) {
        if (text == null || text.isBlank()) {
            return false;
        }
        for (String marker : LOW_SIGNAL_MARKERS) {
            if (text.contains(marker)) {
                return true;
            }
        }
        return false;
    }

    private int hashtagCount(RawPost post) {
        String text = (post == null ? "" : (post.title() == null ? "" : post.title()) + " " + (post.snippet() == null ? "" : post.snippet()));
        Matcher matcher = HASHTAG_PATTERN.matcher(text);
        int count = 0;
        while (matcher.find()) {
            count += 1;
        }
        return count;
    }

    private boolean containsCjk(String value) {
        if (value == null || value.isBlank()) {
            return false;
        }
        for (int i = 0; i < value.length(); i++) {
            Character.UnicodeScript script = Character.UnicodeScript.of(value.charAt(i));
            if (script == Character.UnicodeScript.HAN
                    || script == Character.UnicodeScript.HIRAGANA
                    || script == Character.UnicodeScript.KATAKANA
                    || script == Character.UnicodeScript.HANGUL) {
                return true;
            }
        }
        return false;
    }

    private double clampRatio(double value) {
        if (Double.isNaN(value) || Double.isInfinite(value)) {
            return 0.35;
        }
        return Math.max(0.10, Math.min(0.95, value));
    }

    private List<TopicBucket> buildTopicBuckets(List<ControversyTopic> topics, List<CrawledPost> posts) {
        List<CrawledPost> safePosts = posts == null ? List.of() : posts;
        if (topics == null || topics.isEmpty()) {
            List<CrawledPost> rankedUnassigned = new ArrayList<>();
            for (int i = 0; i < safePosts.size(); i++) {
                CrawledPost post = safePosts.get(i);
                rankedUnassigned.add(new CrawledPost(
                        post.platform(),
                        post.title(),
                        post.snippet(),
                        post.url(),
                        null,
                        recencyScore(i, safePosts.size()),
                        null,
                        "unassigned"
                ));
            }
            return List.of(new TopicBucket("unassigned", "Unassigned", rankedUnassigned));
        }

        List<TopicDescriptor> descriptors = new ArrayList<>();
        for (int i = 0; i < topics.size(); i++) {
            ControversyTopic topic = topics.get(i);
            String topicId = "t" + (i + 1);
            String topicName = topic == null || topic.aspect() == null || topic.aspect().isBlank()
                    ? "Topic " + (i + 1)
                    : topic.aspect().trim();
            int topicHeat = clampScore(topic == null || topic.heat() == null ? 50 : topic.heat());
            descriptors.add(new TopicDescriptor(topicId, topicName, topicHeat, topicKeywords(topicName)));
        }

        LinkedHashMap<String, CrawledPost> postByKey = new LinkedHashMap<>();
        LinkedHashMap<String, Integer> postOrder = new LinkedHashMap<>();
        for (int i = 0; i < safePosts.size(); i++) {
            CrawledPost post = safePosts.get(i);
            String key = crawledPostDedupKey(post);
            postByKey.putIfAbsent(key, post);
            postOrder.putIfAbsent(key, i);
        }

        Map<String, Map<Integer, Integer>> ruleScoreLookup = new LinkedHashMap<>();
        Map<String, Map<Integer, TopicAssignment>> assignedByPost = new LinkedHashMap<>();
        List<CrawledPost> boundaryPosts = new ArrayList<>();
        List<String> boundaryKeys = new ArrayList<>();

        for (Map.Entry<String, CrawledPost> entry : postByKey.entrySet()) {
            String key = entry.getKey();
            CrawledPost post = entry.getValue();
            Map<Integer, Integer> scoreByTopic = scorePostAcrossTopics(descriptors, post);
            ruleScoreLookup.put(key, scoreByTopic);

            int bestScore = scoreByTopic.values().stream().mapToInt(Integer::intValue).max().orElse(0);
            int tieCount = (int) scoreByTopic.values().stream().filter(score -> score == bestScore).count();
            List<Integer> directIndexes = scoreByTopic.entrySet().stream()
                    .filter(e -> e.getValue() >= 2 && e.getValue() >= Math.max(2, bestScore - 1))
                    .map(Map.Entry::getKey)
                    .toList();

            if (!directIndexes.isEmpty()) {
                for (Integer topicIndex : directIndexes) {
                    int ruleScore = scoreByTopic.getOrDefault(topicIndex, 0);
                    addTopicAssignment(assignedByPost, key, topicIndex, ruleScore, false);
                }
            }

            boolean boundaryCandidate = scoreByTopic.isEmpty() || bestScore <= 1 || tieCount > 1;
            if (boundaryCandidate) {
                boundaryKeys.add(key);
                boundaryPosts.add(post);
            }
        }

        if (!boundaryPosts.isEmpty()) {
            int maxBoundary = Math.max(1, crawlerBoundaryMaxPosts);
            int boundaryCount = Math.min(maxBoundary, boundaryPosts.size());
            List<CrawledPost> llmCandidates = boundaryPosts.subList(0, boundaryCount);
            List<String> llmCandidateKeys = boundaryKeys.subList(0, boundaryCount);
            List<String> topicNames = descriptors.stream().map(TopicDescriptor::topicName).toList();
            List<List<Integer>> llmAssignments = safeRun(
                    () -> synthesisAgent.classifyBoundaryTopicIndexes(topicNames, llmCandidates),
                    List.<List<Integer>>of(),
                    "BoundaryClassifier"
            );

            for (int i = 0; i < llmCandidateKeys.size(); i++) {
                List<Integer> topicIndexes = i < llmAssignments.size() ? llmAssignments.get(i) : List.of();
                if (topicIndexes == null || topicIndexes.isEmpty()) {
                    continue;
                }
                String key = llmCandidateKeys.get(i);
                Map<Integer, Integer> scoreByTopic = ruleScoreLookup.getOrDefault(key, Map.of());
                for (Integer oneBased : topicIndexes) {
                    if (oneBased == null) {
                        continue;
                    }
                    int topicIndex = oneBased - 1;
                    if (topicIndex < 0 || topicIndex >= descriptors.size()) {
                        continue;
                    }
                    int ruleScore = scoreByTopic.getOrDefault(topicIndex, 0);
                    addTopicAssignment(assignedByPost, key, topicIndex, ruleScore, true);
                }
            }
        }

        List<TopicBucket> buckets = new ArrayList<>();
        Set<String> assignedKeys = assignedByPost.keySet();

        for (int i = 0; i < descriptors.size(); i++) {
            TopicDescriptor descriptor = descriptors.get(i);
            List<CrawledPost> ranked = new ArrayList<>();

            for (Map.Entry<String, Map<Integer, TopicAssignment>> entry : assignedByPost.entrySet()) {
                String key = entry.getKey();
                TopicAssignment assignment = entry.getValue().get(i);
                if (assignment == null) {
                    continue;
                }

                CrawledPost source = postByKey.get(key);
                if (source == null) {
                    continue;
                }

                int order = postOrder.getOrDefault(key, safePosts.size());
                int recencyScore = recencyScore(order, safePosts.size());
                int evidenceScore = evidenceScore(assignment, source);
                int sortScore = sortScore(descriptor.heat(), recencyScore, evidenceScore);
                ranked.add(new CrawledPost(
                        source.platform(),
                        source.title(),
                        source.snippet(),
                        source.url(),
                        evidenceScore,
                        recencyScore,
                        sortScore,
                        assignment.llmAssigned()
                                ? (assignment.ruleScore() > 0 ? "rule+llm" : "llm")
                                : "rule"
                ));
            }

            ranked.sort(Comparator
                    .comparing((CrawledPost post) -> post.sortScore() == null ? 0 : post.sortScore())
                    .reversed()
                    .thenComparing(post -> post.evidenceScore() == null ? 0 : post.evidenceScore(), Comparator.reverseOrder())
                    .thenComparing(post -> post.recencyScore() == null ? 0 : post.recencyScore(), Comparator.reverseOrder()));
            buckets.add(new TopicBucket(descriptor.topicId(), descriptor.topicName(), ranked));
        }

        List<CrawledPost> unassigned = new ArrayList<>();
        for (Map.Entry<String, CrawledPost> entry : postByKey.entrySet()) {
            String key = entry.getKey();
            if (!assignedKeys.contains(key)) {
                CrawledPost post = entry.getValue();
                int order = postOrder.getOrDefault(key, safePosts.size());
                unassigned.add(new CrawledPost(
                        post.platform(),
                        post.title(),
                        post.snippet(),
                        post.url(),
                        null,
                        recencyScore(order, safePosts.size()),
                        null,
                        "unassigned"
                ));
            }
        }

        buckets.add(new TopicBucket("unassigned", "Unassigned", unassigned));
        return buckets;
    }

    private Map<Integer, Integer> scorePostAcrossTopics(List<TopicDescriptor> descriptors, CrawledPost post) {
        Map<Integer, Integer> scoreByTopic = new LinkedHashMap<>();
        for (int i = 0; i < descriptors.size(); i++) {
            TopicDescriptor descriptor = descriptors.get(i);
            int score = topicMatchScore(descriptor.topicName(), descriptor.keywords(), post);
            if (score > 0) {
                scoreByTopic.put(i, score);
            }
        }
        return scoreByTopic;
    }

    private void addTopicAssignment(
            Map<String, Map<Integer, TopicAssignment>> assignedByPost,
            String postKey,
            int topicIndex,
            int ruleScore,
            boolean llmAssigned
    ) {
        Map<Integer, TopicAssignment> assignments = assignedByPost.computeIfAbsent(postKey, ignored -> new LinkedHashMap<>());
        TopicAssignment previous = assignments.get(topicIndex);
        if (previous == null) {
            assignments.put(topicIndex, new TopicAssignment(ruleScore, llmAssigned));
            return;
        }
        assignments.put(topicIndex, new TopicAssignment(
                Math.max(previous.ruleScore(), ruleScore),
                previous.llmAssigned() || llmAssigned
        ));
    }

    private int recencyScore(int order, int totalPosts) {
        if (totalPosts <= 1) {
            return 100;
        }
        double ratio = 1.0 - ((double) Math.max(0, order) / (double) (totalPosts - 1));
        return clampScore((int) Math.round(ratio * 100));
    }

    private int evidenceScore(TopicAssignment assignment, CrawledPost post) {
        int scoreFromRule = assignment.ruleScore() >= 10
                ? 92
                : clampScore(48 + assignment.ruleScore() * 12);
        if (assignment.ruleScore() <= 0) {
            scoreFromRule = 56;
        }
        if (assignment.llmAssigned()) {
            scoreFromRule += 4;
        }
        if (post.url() != null && !post.url().isBlank()) {
            scoreFromRule += 4;
        }
        return clampScore(scoreFromRule);
    }

    private int sortScore(int topicHeat, int recencyScore, int evidenceScore) {
        double weighted = topicHeat * 0.30 + recencyScore * 0.25 + evidenceScore * 0.45;
        return clampScore((int) Math.round(weighted));
    }

    private int countUnassignedPosts(List<TopicBucket> topicBuckets) {
        if (topicBuckets == null || topicBuckets.isEmpty()) {
            return 0;
        }
        for (TopicBucket bucket : topicBuckets) {
            if (bucket == null || bucket.topicId() == null) {
                continue;
            }
            if ("unassigned".equalsIgnoreCase(bucket.topicId())) {
                return bucket.posts() == null ? 0 : bucket.posts().size();
            }
        }
        return 0;
    }

    private CrawlerStats buildCrawlerStats(
            int targetTotal,
            int fetchedTotal,
            int redditCount,
            int twitterCount,
            int dedupedCount,
            int unassignedCount
    ) {
        int safeTarget = Math.max(1, targetTotal);
        int coveragePercent = clampScore((int) Math.round((fetchedTotal * 100.0) / safeTarget));
        int unassignedPercent = fetchedTotal <= 0
                ? 0
                : clampScore((int) Math.round((unassignedCount * 100.0) / fetchedTotal));
        int platformGapPercent = fetchedTotal <= 0
                ? 0
                : clampScore((int) Math.round((Math.abs(redditCount - twitterCount) * 100.0) / fetchedTotal));

        List<String> coverageAlerts = new ArrayList<>();
        if (coveragePercent < crawlerCoverageCriticalPercent) {
            coverageAlerts.add("Critical crawl coverage: %d%% (<%d%% target).".formatted(
                    coveragePercent,
                    crawlerCoverageCriticalPercent
            ));
        } else if (coveragePercent < crawlerCoverageWarnPercent) {
            coverageAlerts.add("Low crawl coverage: %d%% (<%d%% target).".formatted(
                    coveragePercent,
                    crawlerCoverageWarnPercent
            ));
        }
        if (unassignedPercent >= crawlerUnassignedWarnPercent && fetchedTotal > 0) {
            coverageAlerts.add("High unassigned ratio: %d%% posts could not be confidently mapped.".formatted(
                    unassignedPercent
            ));
        }
        if (platformGapPercent >= crawlerPlatformImbalanceWarnGap && fetchedTotal >= 10) {
            coverageAlerts.add("Platform imbalance detected: Reddit %d vs Twitter %d.".formatted(
                    redditCount,
                    twitterCount
            ));
        }

        String coverageLevel = "ok";
        if (!coverageAlerts.isEmpty()) {
            coverageLevel = coveragePercent < crawlerCoverageCriticalPercent ? "critical" : "warning";
        }

        return new CrawlerStats(
                safeTarget,
                fetchedTotal,
                redditCount,
                twitterCount,
                dedupedCount,
                unassignedCount,
                coveragePercent,
                coverageLevel,
                coverageAlerts
        );
    }

    private int sizeOfPosts(RawPosts rawPosts) {
        if (rawPosts == null || rawPosts.posts() == null) {
            return 0;
        }
        return rawPosts.posts().size();
    }

    private List<String> topicKeywords(String topicName) {
        String normalized = normalizeForMatch(topicName);
        if (normalized.isBlank()) {
            return List.of();
        }

        String[] parts = normalized.split("[^a-z0-9]+");
        List<String> keywords = new ArrayList<>();
        for (String part : parts) {
            if (part == null || part.isBlank()) {
                continue;
            }
            if (part.length() < 3) {
                continue;
            }
            keywords.add(part);
        }
        return keywords;
    }

    private int topicMatchScore(String topicName, List<String> keywords, CrawledPost post) {
        String topic = normalizeForMatch(topicName);
        String source = normalizeForMatch((post.title() == null ? "" : post.title())
                + " "
                + (post.snippet() == null ? "" : post.snippet()));
        if (source.isBlank()) {
            return 0;
        }
        if (!topic.isBlank() && source.contains(topic)) {
            return 10;
        }

        int score = 0;
        for (String keyword : keywords) {
            if (source.contains(keyword)) {
                score += 1;
            }
        }
        return score;
    }

    private String normalizeForMatch(String value) {
        if (value == null || value.isBlank()) {
            return "";
        }
        return value.toLowerCase(Locale.ROOT)
                .replaceAll("\\s+", " ")
                .trim();
    }

    private ConfidenceBreakdown buildConfidenceBreakdown(
            int confidenceScore,
            RawPosts reddit,
            RawPosts twitter,
            List<ControversyTopic> topics,
            List<FlipSignal> flipSignals
    ) {
        int coverage = clampScore(Math.min(100, (sizeOfPosts(reddit) + sizeOfPosts(twitter)) * 4));
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

    private record TopicDescriptor(
            String topicId,
            String topicName,
            int heat,
            List<String> keywords
    ) {}

    private record TopicAssignment(
            int ruleScore,
            boolean llmAssigned
    ) {}

    private record ScoredRawPost(
            RawPost post,
            int score
    ) {}

    private record EvidenceQuote(
            String url,
            String text,
            double evidenceWeight,
            String platform
    ) {}

    private record ScoredEvidenceQuote(
            EvidenceQuote quote,
            int relevanceScore,
            int evidenceScore,
            int orderScore,
            double priorityScore
    ) {}

    private record CrawlProjection(
            List<CrawledPost> allPosts,
            int dedupedCount
    ) {}
}
