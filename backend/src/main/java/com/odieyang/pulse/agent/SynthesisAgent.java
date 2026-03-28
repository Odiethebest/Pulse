package com.odieyang.pulse.agent;

import com.odieyang.pulse.model.AgentEvent;
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
import java.util.List;
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
    private static final List<String> RAW_DUMP_MARKERS = List.of(
            "=== evidence bank",
            "=== reddit posts",
            "=== twitter/x posts"
    );

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

            Translation rules:
            - No raw query strings in final text. Convert query-like topic text into natural entity phrasing such as "public perception of [entity]" or "discourse around [entity]".
            - Keep every section concise, concrete, and evidence-led.
            - Every core claim in Lead and Frontline Clash must include at least one evidence tag from the Evidence Bank, for example [Q1] [Q2].
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
            - Use only supplied evidence tags and do not invent new tags.
            - Never output raw data blocks or labels such as "EVIDENCE BANK", "REDDIT POSTS", or "TWITTER/X POSTS".
            - Do not include any section outside this template.

            <Examples>
            [BAD EXAMPLE - DO NOT DO THIS]
            Input:
            - Query: "Peoples Attuide of Steve Jobs"
            - Topic: "leadership style" (Heat: 85)
            - Support: 65%, Oppose: 25%
            Output:
            While about 65% still defend public perception of Peoples Attuide of Steve Jobs, a vocal 25% actively push back. The main debate is leadership style. (fierce and explosive).

            [GOOD EXAMPLE - COPY THIS STYLE]
            Input:
            - Query: "Peoples Attuide of Steve Jobs"
            - Topic: "leadership style" (Heat: 85)
            - Support: 65%, Oppose: 25%
            Output:
            While a 65% majority continues to fiercely defend Steve Jobs' legacy, a highly vocal 25% opposition actively pushes back against his hero-worship. At the heart of this divide is a fierce and explosive debate over his leadership style, with critics pointing to his uncompromising methods.
            </Examples>
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
            """;

    private final ChatClient chatClient;
    private final AgentEventPublisher publisher;

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
        publisher.publish(AgentEvent.started(label, isRevision
                ? "Revising synthesis based on critic feedback"
                : "Synthesizing sentiment from Reddit and Twitter/X"));
        long start = System.currentTimeMillis();

        try {
            String userPrompt = buildUserPrompt(reddit, twitter, redditSentiment, twitterSentiment, critique, coreEntity);
            String systemPrompt = isRevision ? REVISION_SYSTEM_PROMPT : SYSTEM_PROMPT;
            String result = generate(systemPrompt, userPrompt);
            List<String> violations = collectCriticalViolations(result);
            if (!violations.isEmpty()) {
                String retryPrompt = buildRetryPrompt(userPrompt, result, violations);
                result = generate(systemPrompt, retryPrompt);
            }

            long duration = System.currentTimeMillis() - start;
            publisher.publish(AgentEvent.completed(label,
                    "Synthesis report generated (%d chars)".formatted(result.length()), duration));
            log.info("{} completed in {}ms", label, duration);
            return result;

        } catch (Exception e) {
            long duration = System.currentTimeMillis() - start;
            publisher.publish(AgentEvent.failed(label, e.getMessage(), duration));
            log.error("{} failed", label, e);
            throw new RuntimeException(label + " failed", e);
        }
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

        sb.append("=== EVIDENCE BANK (use [Qn] tags in claims) ===\n");
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
        }
    }

    private void appendQuotes(StringBuilder sb, SentimentResult sentiment, String platform, int[] index) {
        if (sentiment == null || sentiment.representativeQuotes() == null) {
            return;
        }
        for (Quote quote : sentiment.representativeQuotes()) {
            if (quote == null || quote.text() == null || quote.text().isBlank()) {
                continue;
            }
            sb.append("[Q").append(index[0]++).append("] ")
                    .append(platform)
                    .append(" | ")
                    .append("camp=").append(quote.camp() == null ? "unknown" : quote.camp())
                    .append(" | ")
                    .append("url=").append(quote.url() == null ? "" : quote.url())
                    .append(" | ")
                    .append("quote=").append(quote.text())
                    .append("\n");
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
}
