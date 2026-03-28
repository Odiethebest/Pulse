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

@Component
@RequiredArgsConstructor
public class SynthesisAgent {

    private static final Logger log = LoggerFactory.getLogger(SynthesisAgent.class);

    private static final String SYSTEM_PROMPT = """
            You are a frontline social-news reporter.
            Write a high-signal report about what people are fighting over.

            Output markdown using exactly these six sections and this order:
            ## Lead
            ## Frontline Clash
            ## Top Controversies
            ## Flip Risk Watch
            ## Why It Matters
            ## Reporter Note

            Rules:
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
            """;

    private static final String REVISION_SYSTEM_PROMPT = """
            You are a frontline social-news reporter revising a report based on critic feedback.
            Keep the same six-section template and improve evidence quality.

            Revision priorities:
            - remove unsupported claims or add explicit qualifiers
            - strengthen weak claims with concrete evidence tags
            - smooth awkward entities and remove raw query fragments
            - convert score language into narrative descriptors rather than numbers
            - use contrastive syntax for camp distribution
            - reduce repetitive and generic phrasing
            - preserve readability and section structure
            """;

    private final ChatClient chatClient;
    private final AgentEventPublisher publisher;

    public String synthesize(RawPosts reddit, RawPosts twitter,
                             SentimentResult redditSentiment, SentimentResult twitterSentiment) {
        return doSynthesize(reddit, twitter, redditSentiment, twitterSentiment, null, false);
    }

    public String synthesize(RawPosts reddit, RawPosts twitter,
                             SentimentResult redditSentiment, SentimentResult twitterSentiment,
                             String critique) {
        return doSynthesize(reddit, twitter, redditSentiment, twitterSentiment, critique, true);
    }

    private String doSynthesize(RawPosts reddit, RawPosts twitter,
                                SentimentResult redditSentiment, SentimentResult twitterSentiment,
                                String critique, boolean isRevision) {
        String label = isRevision ? "SynthesisAgent (revision)" : "SynthesisAgent";
        publisher.publish(AgentEvent.started(label, isRevision
                ? "Revising synthesis based on critic feedback"
                : "Synthesizing sentiment from Reddit and Twitter/X"));
        long start = System.currentTimeMillis();

        try {
            String userPrompt = buildUserPrompt(reddit, twitter, redditSentiment, twitterSentiment, critique);
            String systemPrompt = isRevision ? REVISION_SYSTEM_PROMPT : SYSTEM_PROMPT;

            String result = chatClient.prompt()
                    .system(systemPrompt)
                    .user(userPrompt)
                    .call()
                    .content();

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
                                   String critique) {
        StringBuilder sb = new StringBuilder();
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
