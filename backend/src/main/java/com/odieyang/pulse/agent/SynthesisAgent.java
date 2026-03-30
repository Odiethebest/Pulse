package com.odieyang.pulse.agent;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.odieyang.pulse.model.AgentEvent;
import com.odieyang.pulse.model.CrawledPost;
import com.odieyang.pulse.model.Quote;
import com.odieyang.pulse.model.RawPosts;
import com.odieyang.pulse.model.SentimentResult;
import com.odieyang.pulse.service.AgentEventPublisher;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.ai.chat.client.ChatClient;
import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.HashSet;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.TreeMap;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

@Component
@RequiredArgsConstructor
public class SynthesisAgent {

    private static final Logger log = LoggerFactory.getLogger(SynthesisAgent.class);
    private static final Pattern RAW_SCORE_PATTERN = Pattern.compile("(?is).*\\b\\d{1,3}\\s*/\\s*100\\b.*");
    private static final Pattern TRAILING_TAG_PATTERN = Pattern.compile(
            "(?is).*\\(\\s*(?:fierce|explosive|simmering|volatile|fragile|stable|quiet|niche|intense|heated)(?:\\s+and\\s+[a-z]+)*\\s*\\).*");
    private static final Pattern FRANKENSTEIN_ENTITY_PATTERN = Pattern.compile(
            "(?is).*(?:public\\s+perception|discourse|debate)\\s+of\\s+(?:there\\s+(?:is|are|was|were)|that\\s+|whether\\s+|it\\s+is\\s+).*");
    private static final Pattern ROBOTIC_TRANSITION_PATTERN = Pattern.compile(
            "(?is).*(?:The consensus is\\s+[^.]+,\\s*so one strong catalyst|Because this debate\\s+[^.]+,\\s*it can quickly).*");
    private static final Pattern CITATION_PATTERN = Pattern.compile("\\[(?:Q)?(\\d{1,3})\\]");
    private static final Pattern LAZY_CITATION_LOOP_PATTERN = Pattern.compile("(?is).*(?:\\[(?:Q)?1\\]\\s*\\[(?:Q)?2\\]).*(?:\\[(?:Q)?1\\]\\s*\\[(?:Q)?2\\]).*");
    private static final List<String> RAW_DUMP_MARKERS = List.of(
            "=== evidence bank",
            "=== reddit posts",
            "=== twitter/x posts"
    );
    private static final String BOUNDARY_CLASSIFIER_SYSTEM_PROMPT = """
            You are a strict topic boundary classifier for social posts.
            Assign each post to zero, one, or multiple topic indexes.

            Return JSON only with this schema:
            {
              "assignments": [
                {"postIndex": 0, "topicIndexes": [1, 2]}
              ]
            }

            Rules:
            - postIndex is 0-based and must match provided inputs.
            - topicIndexes are 1-based indexes from the topic list.
            - Use empty array when no topic applies.
            - Prefer precision over recall: do not force weak matches.
            - Never invent topic indexes that are not in range.
            - Output JSON only, no markdown fences.
            """;

    private static final String SYSTEM_PROMPT = """
            # ROLE
            You are an elite data journalist analyzing public sentiment.
            Your task is to synthesize raw metrics, agent feedback, and stance distributions into a highly readable, human-sounding executive briefing.

            Output markdown using exactly these six sections and this order:
            ## Lead
            ## Frontline Clash
            ## Top Controversies
            ## Flip Risk Watch
            ## Why It Matters
            ## Reporter Note

            # CRITICAL CONSTRAINTS AND FORMATTING RULES (STRICTLY ENFORCED)
            1. PARAPHRASE, DO NOT PASTE:
               - You MUST NOT copy raw queries or malformed topic text.
               - You MUST distill them into concise noun phrases.
            2. WEAVE ADJECTIVES, NO TRAILING TAGS:
               - You are STRICTLY FORBIDDEN from appending parenthetical tags like "(fierce and explosive)".
               - You MUST embed intensity words naturally in sentence structure.
            3. DYNAMIC JOURNALISTIC SYNTAX:
               - Avoid robotic templates like "Because X, so Y."
               - For high flip risk, use warning transitions.
               - For low flip risk, use stabilizing transitions.
            4. EXPLICITLY ACTION CRITIC FEEDBACK:
               - If Critic feedback contains evidence gaps or bias concerns, your revised text MUST address them directly.
               - Embed representative quote evidence naturally.
            5. CITATION MANDATE:
               - Every factual claim, percentage, or sentiment described in your summary MUST include at least one inline citation using source ids, for example [3] or [12].
               - Citations MUST map exactly to the provided "Source [n]" evidence lines.
            6. PROHIBIT LAZINESS:
               - DO NOT lazily default to [1] and [2].
               - You must analyze the entire source list and cite the specific ids that actually support each claim.
            7. DIVERSIFY EVIDENCE:
               - CITATION QUOTA: use a minimum of 5 distinct source ids across the final response when at least 5 sources are provided.
               - Do not repeat the same two ids in every section.

            Translation rules:
            - No raw query strings in final text. Convert query-like topic text into natural entity phrasing such as "public perception of [entity]" or "discourse around [entity]".
            - Keep every section concise, concrete, and evidence-led.
            - Every core claim in Lead and Frontline Clash must include at least one evidence citation from Source [n], for example [4] [11].
            - Hide the math and show the meaning. Never print raw score patterns such as "45/100", "heat at 45", or "flip risk is 65".
            - Translate Heat and Flip Risk scores into natural language:
              Heat <= 30: quiet or niche discussion
              Heat 31-60: simmering or steadily intensifying debate
              Heat > 60: fierce or explosive clash
              Flip Risk > 60: fragile or volatile consensus
              Flip Risk 40-60: consensus can still shift with new evidence
              Flip Risk < 40: relatively stable narrative
            - Use contrastive syntax in Frontline Clash. Prefer forms like "While ... , ...", "Despite ... , ...", or "In contrast, ...".
            - Describe platform mismatch with action verbs, e.g., "Reddit dissects/scrutinizes ..." versus "Twitter amplifies/fixates on ...".
            - Do not use vague filler such as "overall", "many people believe", or "it sparked broad discussion" without specifics.
            - Use only supplied source ids and do not invent ids.
            - Never output raw data blocks or labels such as "EVIDENCE BANK", "REDDIT POSTS", or "TWITTER/X POSTS".
            - Do not include any section outside this template.

            --- EXAMPLE OF BAD OUTPUT (LAZY) ---
            "While 68% defend MJ, 22% push back. [1] [2] The dispute has moved to a quiet stage. [1] [2] The consensus is relatively stable. [1] [2]"
            REASON: This is lazy and unacceptable. It only cites sources 1 and 2, ignoring the rest of the dataset.

            --- EXAMPLE OF GOOD OUTPUT (DIVERSE CITATIONS) ---
            "While 68% defend MJ, 22% push back. [3] [7] The dispute has moved to a quiet stage with 'greatest artist' becoming the flashpoint. [12] [15] The current consensus looks stable, though Twitter amplifies the GOAT debate. [2] [18]"
            REASON: Excellent. It uses diverse, accurate source ids spread across the entire dataset.
            """;

    private static final String REVISION_SYSTEM_PROMPT = """
            You are an elite data journalist revising a report based on critic feedback.
            Keep the same six-section template and improve evidence quality and readability.

            # CRITICAL CONSTRAINTS AND FORMATTING RULES (STRICTLY ENFORCED)
            1. PARAPHRASE, DO NOT PASTE:
               - You MUST NOT copy raw queries or malformed topic text.
               - You MUST distill them into concise noun phrases.
            2. WEAVE ADJECTIVES, NO TRAILING TAGS:
               - You are STRICTLY FORBIDDEN from appending parenthetical tags like "(fierce and explosive)".
               - You MUST embed intensity words naturally in sentence structure.
            3. DYNAMIC JOURNALISTIC SYNTAX:
               - Avoid robotic templates like "Because X, so Y."
               - For high flip risk, use warning transitions.
               - For low flip risk, use stabilizing transitions.
            4. EXPLICITLY ACTION CRITIC FEEDBACK:
               - If Critic feedback contains evidence gaps or bias concerns, your revised text MUST address them directly.
               - Embed representative quote evidence naturally.

            Revision priorities:
            - remove unsupported claims or add explicit qualifiers
            - strengthen weak claims with concrete evidence tags
            - eliminate pasted raw query fragments
            - remove trailing adjective tags in parentheses
            - vary transitions and avoid repetitive template sentences
            - preserve readability and strict section structure
            - citation mandate: every factual claim must cite Source [n] ids
            - citation quota: use at least 5 distinct source ids when 5 or more are provided
            - prohibit laziness: do not repeatedly cite only [1] and [2]
            """;

    private final ChatClient chatClient;
    private final AgentEventPublisher publisher;
    private final ObjectMapper objectMapper = new ObjectMapper();

    public List<List<Integer>> classifyBoundaryTopicIndexes(
            List<String> topicNames,
            List<CrawledPost> posts
    ) {
        if (topicNames == null || topicNames.isEmpty() || posts == null || posts.isEmpty()) {
            return List.of();
        }

        List<List<Integer>> fallback = fallbackBoundaryAssignments(topicNames, posts);
        if (chatClient == null) {
            return fallback;
        }

        String label = "SynthesisAgent (boundary classifier)";
        long start = System.currentTimeMillis();
        publishSafely(AgentEvent.started(label, "Running LLM boundary classification for ambiguous posts"));

        try {
            String raw = chatClient.prompt()
                    .system(BOUNDARY_CLASSIFIER_SYSTEM_PROMPT)
                    .user(buildBoundaryClassificationPrompt(topicNames, posts))
                    .call()
                    .content();

            List<List<Integer>> parsed = parseBoundaryAssignments(raw, posts.size(), topicNames.size());
            List<List<Integer>> merged = mergeAssignments(fallback, parsed);
            long duration = System.currentTimeMillis() - start;
            long assigned = merged.stream().filter(ids -> ids != null && !ids.isEmpty()).count();
            publishSafely(AgentEvent.completed(
                    label,
                    "Boundary classified %d/%d posts".formatted(assigned, posts.size()),
                    duration
            ));
            return merged;
        } catch (Exception e) {
            long duration = System.currentTimeMillis() - start;
            publishSafely(AgentEvent.failed(label, e.getMessage(), duration));
            log.warn("Boundary classifier fallback triggered: {}", e.getMessage());
            return fallback;
        }
    }

    public String synthesize(RawPosts reddit, RawPosts twitter,
                             SentimentResult redditSentiment, SentimentResult twitterSentiment) {
        return synthesizeWithCoreEntity(reddit, twitter, redditSentiment, twitterSentiment, null);
    }

    public String synthesizeWithCoreEntity(
            RawPosts reddit,
            RawPosts twitter,
            SentimentResult redditSentiment,
            SentimentResult twitterSentiment,
            String coreEntity
    ) {
        return doSynthesize(reddit, twitter, redditSentiment, twitterSentiment, null, coreEntity, false);
    }

    public String synthesize(RawPosts reddit, RawPosts twitter,
                             SentimentResult redditSentiment, SentimentResult twitterSentiment,
                             String critique) {
        return synthesizeWithCoreEntity(reddit, twitter, redditSentiment, twitterSentiment, critique, null);
    }

    public String synthesizeWithCoreEntity(
            RawPosts reddit,
            RawPosts twitter,
            SentimentResult redditSentiment,
            SentimentResult twitterSentiment,
            String critique,
            String coreEntity
    ) {
        return doSynthesize(reddit, twitter, redditSentiment, twitterSentiment, critique, coreEntity, true);
    }

    private String doSynthesize(RawPosts reddit, RawPosts twitter,
                                SentimentResult redditSentiment, SentimentResult twitterSentiment,
                                String critique, String coreEntity, boolean isRevision) {
        String label = isRevision ? "SynthesisAgent (revision)" : "SynthesisAgent";
        publishSafely(AgentEvent.started(label, isRevision
                ? "Revising synthesis based on critic feedback"
                : "Synthesizing sentiment from Reddit and Twitter/X"));
        long start = System.currentTimeMillis();

        try {
            String userPrompt = buildUserPrompt(reddit, twitter, redditSentiment, twitterSentiment, critique, coreEntity);
            String systemPrompt = isRevision ? REVISION_SYSTEM_PROMPT : SYSTEM_PROMPT;
            String result = generate(systemPrompt, userPrompt);
            int availableSourceCount = countAvailableSources(redditSentiment, twitterSentiment);
            List<String> violations = collectCriticalViolations(result, availableSourceCount);
            if (!violations.isEmpty()) {
                String retryPrompt = buildRetryPrompt(userPrompt, result, violations);
                result = generate(systemPrompt, retryPrompt);
            }

            long duration = System.currentTimeMillis() - start;
            publishSafely(AgentEvent.completed(label,
                    "Synthesis report generated (%d chars)".formatted(result.length()), duration));
            log.info("{} completed in {}ms", label, duration);
            return result;

        } catch (Exception e) {
            long duration = System.currentTimeMillis() - start;
            publishSafely(AgentEvent.failed(label, e.getMessage(), duration));
            log.error("{} failed", label, e);
            throw new RuntimeException(label + " failed", e);
        }
    }

    private void publishSafely(AgentEvent event) {
        if (publisher == null) {
            return;
        }
        publisher.publish(event);
    }

    private String buildUserPrompt(RawPosts reddit, RawPosts twitter,
                                   SentimentResult redditSentiment, SentimentResult twitterSentiment,
                                   String critique, String coreEntity) {
        StringBuilder sb = new StringBuilder();
        sb.append("=== NORMALIZED CORE ENTITY ===\n");
        sb.append(coreEntity == null || coreEntity.isBlank() ? "not provided" : coreEntity);
        sb.append("\n");
        sb.append("Use this noun phrase as the anchor entity in your writing. Do not rewrite it into a clause.\n\n");

        sb.append("=== REDDIT SENTIMENT ===\n");
        sb.append("Positive: %.0f%%, Negative: %.0f%%, Neutral: %.0f%%\n".formatted(
                redditSentiment.positiveRatio() * 100,
                redditSentiment.negativeRatio() * 100,
                redditSentiment.neutralRatio() * 100));
        sb.append("Controversies: %s\n\n".formatted(redditSentiment.mainControversies()));
        if (redditSentiment.stanceDistribution() != null) {
            sb.append("Stance Distribution (support/oppose/neutral): %s / %s / %s\n".formatted(
                    pct(redditSentiment.stanceDistribution().support()),
                    pct(redditSentiment.stanceDistribution().oppose()),
                    pct(redditSentiment.stanceDistribution().neutral())));
        }
        if (redditSentiment.aspectSentiments() != null && !redditSentiment.aspectSentiments().isEmpty()) {
            sb.append("Aspect Heatmap: %s\n".formatted(redditSentiment.aspectSentiments()));
        }
        sb.append("\n");

        sb.append("=== TWITTER/X SENTIMENT ===\n");
        sb.append("Positive: %.0f%%, Negative: %.0f%%, Neutral: %.0f%%\n".formatted(
                twitterSentiment.positiveRatio() * 100,
                twitterSentiment.negativeRatio() * 100,
                twitterSentiment.neutralRatio() * 100));
        sb.append("Controversies: %s\n\n".formatted(twitterSentiment.mainControversies()));
        if (twitterSentiment.stanceDistribution() != null) {
            sb.append("Stance Distribution (support/oppose/neutral): %s / %s / %s\n".formatted(
                    pct(twitterSentiment.stanceDistribution().support()),
                    pct(twitterSentiment.stanceDistribution().oppose()),
                    pct(twitterSentiment.stanceDistribution().neutral())));
        }
        if (twitterSentiment.aspectSentiments() != null && !twitterSentiment.aspectSentiments().isEmpty()) {
            sb.append("Aspect Heatmap: %s\n".formatted(twitterSentiment.aspectSentiments()));
        }
        sb.append("\n");

        sb.append("=== PLATFORM DIFFERENCE CLUE ===\n");
        sb.append("Reddit main focus: %s\n".formatted(topControversy(redditSentiment)));
        sb.append("Twitter/X main focus: %s\n".formatted(topControversy(twitterSentiment)));
        sb.append("\n");

        sb.append("=== EVIDENCE SOURCES (cite with [n] exactly) ===\n");
        appendEvidenceBank(sb, redditSentiment, twitterSentiment);
        sb.append("\n");

        if (critique != null) {
            sb.append("=== CRITIC FEEDBACK ===\n");
            sb.append(critique).append("\n");
        }

        return sb.toString();
    }

    private String generate(String systemPrompt, String userPrompt) {
        return chatClient.prompt()
                .system(systemPrompt)
                .user(userPrompt)
                .call()
                .content();
    }

    private List<String> collectCriticalViolations(String content) {
        return collectCriticalViolations(content, 0);
    }

    private List<String> collectCriticalViolations(String content, int availableSourceCount) {
        List<String> violations = new ArrayList<>();
        if (content == null || content.isBlank()) {
            violations.add("Output is empty.");
            return violations;
        }
        if (RAW_SCORE_PATTERN.matcher(content).matches()) {
            violations.add("Raw score expression like xx/100 was found.");
        }
        if (TRAILING_TAG_PATTERN.matcher(content).matches()) {
            violations.add("Trailing parenthetical adjective tag was found.");
        }
        if (FRANKENSTEIN_ENTITY_PATTERN.matcher(content).matches()) {
            violations.add("Frankenstein entity phrasing was found.");
        }
        if (ROBOTIC_TRANSITION_PATTERN.matcher(content).matches()) {
            violations.add("Robotic transition template was found.");
        }
        if (LAZY_CITATION_LOOP_PATTERN.matcher(content).matches()) {
            violations.add("Lazy repeated [1] [2] citation loop was found.");
        }
        validateCitationDiversity(content, availableSourceCount, violations);
        String lower = content.toLowerCase();
        for (String marker : RAW_DUMP_MARKERS) {
            if (lower.contains(marker)) {
                violations.add("Raw dump marker was found: " + marker);
            }
        }
        return violations;
    }

    private String buildRetryPrompt(String originalUserPrompt, String previousOutput, List<String> violations) {
        String violationSummary = violations.isEmpty() ? "- formatting issue detected" : violations.stream()
                .map(v -> "- " + v)
                .reduce((a, b) -> a + "\n" + b)
                .orElse("- formatting issue detected");
        return """
                %s

                === OUTPUT VALIDATION FAILED ===
                Your previous output violated strict style constraints.
                Validation findings:
                %s

                Fix these issues in a fresh rewrite:
                1. No trailing parenthetical metric tags.
                2. No raw score expressions like 45/100.
                3. No Frankenstein entities such as "public perception of there are ...".
                4. Keep six required sections exactly.
                5. Avoid robotic templates like "The consensus is..., so..." and "Because this debate..., it can...".
                6. Integrate critic feedback directly into narrative with representative quote evidence tags.
                7. Use citations in [n] format that map to Source [n].
                8. Use at least 5 distinct citation ids when at least 5 sources are available.
                9. Do not repeat only [1] [2] across sections.

                === PREVIOUS INVALID OUTPUT (DO NOT COPY) ===
                %s
                """.formatted(originalUserPrompt, violationSummary, previousOutput);
    }

    private void appendEvidenceBank(StringBuilder sb, SentimentResult redditSentiment, SentimentResult twitterSentiment) {
        int[] index = {1};
        appendQuotes(sb, redditSentiment, "Reddit", index);
        appendQuotes(sb, twitterSentiment, "Twitter/X", index);
        if (index[0] == 1) {
            sb.append("No quote evidence available.\n");
            return;
        }
        sb.append("Total Sources: ").append(index[0] - 1).append("\n");
    }

    private void appendQuotes(StringBuilder sb, SentimentResult sentiment, String platform, int[] index) {
        if (sentiment == null || sentiment.representativeQuotes() == null) {
            return;
        }
        for (Quote quote : sentiment.representativeQuotes()) {
            if (quote == null || quote.text() == null || quote.text().isBlank()) {
                continue;
            }
            sb.append("Source [").append(index[0]++).append("]: ")
                    .append("(").append(platform).append(") ")
                    .append("camp=").append(quote.camp() == null ? "unknown" : quote.camp())
                    .append("; ")
                    .append("url=").append(quote.url() == null ? "" : quote.url())
                    .append("; ")
                    .append("text=\"").append(quote.text()).append("\"")
                    .append("\n");
        }
    }

    private int countAvailableSources(SentimentResult redditSentiment, SentimentResult twitterSentiment) {
        return countQuotes(redditSentiment) + countQuotes(twitterSentiment);
    }

    private int countQuotes(SentimentResult sentiment) {
        if (sentiment == null || sentiment.representativeQuotes() == null) {
            return 0;
        }
        int count = 0;
        for (Quote quote : sentiment.representativeQuotes()) {
            if (quote != null && quote.text() != null && !quote.text().isBlank()) {
                count += 1;
            }
        }
        return count;
    }

    private void validateCitationDiversity(String content, int availableSourceCount, List<String> violations) {
        Matcher matcher = CITATION_PATTERN.matcher(content);
        Set<Integer> citationIds = new HashSet<>();
        while (matcher.find()) {
            try {
                citationIds.add(Integer.parseInt(matcher.group(1)));
            } catch (NumberFormatException ignored) {
                // ignore malformed ids, regex already constrains numeric shape
            }
        }

        int requiredDistinct = Math.min(5, Math.max(availableSourceCount, 0));
        if (requiredDistinct > 0 && citationIds.size() < requiredDistinct) {
            violations.add("Citation diversity is too low: found %d distinct ids, expected at least %d."
                    .formatted(citationIds.size(), requiredDistinct));
        }
    }

    private String pct(Double value) {
        if (value == null) {
            return "0%";
        }
        return "%.0f%%".formatted(value * 100);
    }

    private String topControversy(SentimentResult sentimentResult) {
        if (sentimentResult == null
                || sentimentResult.mainControversies() == null
                || sentimentResult.mainControversies().isEmpty()) {
            return "general narrative";
        }
        String value = sentimentResult.mainControversies().getFirst();
        return value == null || value.isBlank() ? "general narrative" : value;
    }

    private String buildBoundaryClassificationPrompt(List<String> topicNames, List<CrawledPost> posts) {
        StringBuilder sb = new StringBuilder();
        sb.append("Classify these ambiguous posts against topic indexes.\n");
        sb.append("=== TOPICS (1-based index) ===\n");
        for (int i = 0; i < topicNames.size(); i++) {
            sb.append(i + 1).append(". ").append(topicNames.get(i)).append('\n');
        }
        sb.append('\n');
        sb.append("=== POSTS (0-based index) ===\n");
        for (int i = 0; i < posts.size(); i++) {
            CrawledPost post = posts.get(i);
            sb.append("- postIndex: ").append(i).append('\n');
            sb.append("  platform: ").append(nullSafe(post.platform())).append('\n');
            sb.append("  title: ").append(nullSafe(post.title())).append('\n');
            sb.append("  snippet: ").append(nullSafe(post.snippet())).append('\n');
            sb.append("  url: ").append(nullSafe(post.url())).append('\n');
        }
        return sb.toString();
    }

    private List<List<Integer>> parseBoundaryAssignments(String raw, int postCount, int topicCount) {
        List<List<Integer>> normalized = emptyAssignments(postCount);
        if (raw == null || raw.isBlank()) {
            return normalized;
        }

        try {
            String json = extractJsonPayload(raw);
            JsonNode root = objectMapper.readTree(json);
            JsonNode assignmentsNode = root;
            if (root != null && root.has("assignments")) {
                assignmentsNode = root.get("assignments");
            }
            if (assignmentsNode == null || !assignmentsNode.isArray()) {
                return normalized;
            }

            for (JsonNode node : assignmentsNode) {
                if (node == null || !node.isObject()) {
                    continue;
                }
                int postIndex = node.path("postIndex").asInt(-1);
                if (postIndex < 0 || postIndex >= postCount) {
                    continue;
                }

                JsonNode topics = node.path("topicIndexes");
                if (!topics.isArray()) {
                    continue;
                }

                LinkedHashSet<Integer> ids = new LinkedHashSet<>();
                for (JsonNode idNode : topics) {
                    int topicIndex = idNode.asInt(-1);
                    if (topicIndex <= 0 || topicIndex > topicCount) {
                        continue;
                    }
                    ids.add(topicIndex);
                }
                normalized.set(postIndex, new ArrayList<>(ids));
            }
            return normalized;
        } catch (Exception e) {
            log.debug("Failed to parse boundary classifier output: {}", e.getMessage());
            return normalized;
        }
    }

    private String extractJsonPayload(String raw) {
        String cleaned = raw.trim()
                .replaceFirst("(?is)^```(?:json)?\\s*", "")
                .replaceFirst("(?is)\\s*```$", "");
        int objectStart = cleaned.indexOf('{');
        int arrayStart = cleaned.indexOf('[');
        int start = -1;
        char endToken = '}';

        if (arrayStart >= 0 && (objectStart < 0 || arrayStart < objectStart)) {
            start = arrayStart;
            endToken = ']';
        } else if (objectStart >= 0) {
            start = objectStart;
            endToken = '}';
        }

        if (start < 0) {
            return cleaned;
        }

        int end = cleaned.lastIndexOf(endToken);
        if (end < start) {
            return cleaned.substring(start);
        }
        return cleaned.substring(start, end + 1);
    }

    private List<List<Integer>> mergeAssignments(List<List<Integer>> fallback, List<List<Integer>> parsed) {
        int size = Math.max(fallback.size(), parsed.size());
        List<List<Integer>> merged = new ArrayList<>();
        for (int i = 0; i < size; i++) {
            List<Integer> parsedRow = i < parsed.size() ? parsed.get(i) : List.of();
            List<Integer> fallbackRow = i < fallback.size() ? fallback.get(i) : List.of();
            if (parsedRow != null && !parsedRow.isEmpty()) {
                merged.add(parsedRow);
            } else {
                merged.add(fallbackRow == null ? List.of() : fallbackRow);
            }
        }
        return merged;
    }

    private List<List<Integer>> fallbackBoundaryAssignments(List<String> topicNames, List<CrawledPost> posts) {
        List<List<Integer>> assignments = emptyAssignments(posts.size());
        if (topicNames.isEmpty() || posts.isEmpty()) {
            return assignments;
        }

        List<List<String>> topicKeywords = topicNames.stream()
                .map(this::splitKeywords)
                .toList();

        for (int i = 0; i < posts.size(); i++) {
            CrawledPost post = posts.get(i);
            String source = normalizeForMatch(nullSafe(post.title()) + " " + nullSafe(post.snippet()));
            if (source.isBlank()) {
                continue;
            }

            Map<Integer, Integer> scored = new TreeMap<>();
            for (int j = 0; j < topicNames.size(); j++) {
                int score = keywordMatchScore(source, topicKeywords.get(j), topicNames.get(j));
                if (score > 0) {
                    scored.put(j + 1, score);
                }
            }

            if (scored.isEmpty()) {
                continue;
            }

            int top = scored.values().stream().mapToInt(Integer::intValue).max().orElse(0);
            List<Integer> picked = scored.entrySet().stream()
                    .filter(entry -> entry.getValue() == top)
                    .map(Map.Entry::getKey)
                    .limit(2)
                    .toList();
            assignments.set(i, picked);
        }
        return assignments;
    }

    private List<List<Integer>> emptyAssignments(int size) {
        List<List<Integer>> empty = new ArrayList<>();
        for (int i = 0; i < size; i++) {
            empty.add(List.of());
        }
        return empty;
    }

    private List<String> splitKeywords(String value) {
        String normalized = normalizeForMatch(value);
        if (normalized.isBlank()) {
            return List.of();
        }
        List<String> keywords = new ArrayList<>();
        for (String part : normalized.split("[^a-z0-9]+")) {
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

    private int keywordMatchScore(String source, List<String> keywords, String topicName) {
        String topic = normalizeForMatch(topicName);
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

    private String nullSafe(String value) {
        return value == null ? "" : value;
    }
}
