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
import java.util.LinkedHashSet;
import java.util.List;
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
    private static final List<String> REPORTER_SECTIONS = List.of(
            "Lead",
            "Frontline Clash",
            "Top Controversies",
            "Flip Risk Watch",
            "Why It Matters",
            "Reporter Note"
    );

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
        return analyze(topic, null);
    }

    public PulseReport analyze(String topic, String requestedRunId) {
        String runId = resolveRunId(requestedRunId);
        log.info("Starting analysis for topic: {}, runId={}", topic, runId);

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

            RawPosts reddit = redditFuture.join();
            RawPosts twitter = twitterFuture.join();

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
            int dramaScore = computeDramaScore(heatScore, polarizationScore, controversyTopics);
            List<FlipSignal> flipSignals = chooseFlipSignals(flipRiskResult, critique);
            List<String> revisionDelta = chooseRevisionDelta(critique);
            List<String> evidenceUrls = collectEvidenceUrls(redditSentiment, twitterSentiment);
            List<ClaimEvidenceLink> claimEvidenceMap = buildClaimEvidenceMap(
                    coreEntity,
                    campDistribution,
                    controversyTopics,
                    heatScore,
                    flipRiskScore,
                    debateTriggered,
                    platformDiff,
                    evidenceUrls
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
                    revisionAnchors
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
            List<String> evidenceUrls
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
        return List.of(
                new ClaimEvidenceLink("C1", campLine, pickEvidenceUrlsForClaim(evidenceUrls, 0, 3)),
                new ClaimEvidenceLink("C2", heatLine, pickEvidenceUrlsForClaim(evidenceUrls, 1, 3)),
                new ClaimEvidenceLink("C3", flipLine, pickEvidenceUrlsForClaim(evidenceUrls, 2, 3))
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

    private List<String> pickEvidenceUrlsForClaim(List<String> urls, int claimIndex, int claimCount) {
        if (urls.isEmpty()) {
            return List.of();
        }
        int targetDistinct = Math.min(Math.max(5, claimCount), urls.size());
        List<Integer> anchors = pickEvenlySpacedIndexes(urls.size(), targetDistinct);
        List<String> selected = new ArrayList<>();
        for (int i = claimIndex; i < anchors.size(); i += claimCount) {
            selected.add(urls.get(anchors.get(i)));
        }
        if (selected.isEmpty()) {
            selected.add(urls.get(Math.min(claimIndex, urls.size() - 1)));
        }
        return selected.stream().distinct().toList();
    }

    private List<Integer> pickEvenlySpacedIndexes(int totalSize, int count) {
        if (totalSize <= 0 || count <= 0) {
            return List.of();
        }
        if (count == 1) {
            return List.of(0);
        }
        List<Integer> indexes = new ArrayList<>();
        for (int i = 0; i < count; i++) {
            double ratio = (double) i / (count - 1);
            int candidate = (int) Math.round(ratio * (totalSize - 1));
            if (indexes.isEmpty() || indexes.getLast() != candidate) {
                indexes.add(candidate);
            }
        }
        for (int i = 0; indexes.size() < count && i < totalSize; i++) {
            if (!indexes.contains(i)) {
                indexes.add(i);
            }
        }
        indexes.sort(Integer::compareTo);
        return indexes;
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
