package com.odieyang.pulse.agent;

import com.odieyang.pulse.model.AgentEvent;
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
            You are a social drama analyst.
            Write a tightly structured report for "what people are fighting about".

            Output in markdown using this exact section structure:

            ## Quick Take
            - bullet 1
            - bullet 2
            - bullet 3

            ## Camp Battle
            A short paragraph about support camp vs oppose camp vs neutral bystanders.

            ## Controversy Heatmap
            1. aspect and why it is controversial
            2. aspect and why it is controversial
            3. aspect and why it is controversial

            ## Flip Risk Watch
            A short paragraph about what can trigger narrative reversal.

            ## Evidence Notes
            A short paragraph about evidence limits and confidence caveats.

            Rules:
            - Keep it factual, vivid, and grounded in the provided data.
            - Do not include any section outside this template.
            - Do not invent claims without evidence from provided posts.
            """;

    private static final String REVISION_SYSTEM_PROMPT = """
            You are a social drama analyst revising a report based on critic feedback.

            Keep the same output template and improve evidence quality.

            Revision priorities:
            - remove or qualify unsupported claims
            - fix bias and one-sided framing
            - tighten scope to what posts actually support
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

        sb.append("=== REDDIT POSTS ===\n");
        appendPosts(sb, reddit);

        sb.append("=== TWITTER/X POSTS ===\n");
        appendPosts(sb, twitter);

        if (critique != null) {
            sb.append("=== CRITIC FEEDBACK ===\n");
            sb.append(critique).append("\n");
        }

        return sb.toString();
    }

    private void appendPosts(StringBuilder sb, RawPosts rawPosts) {
        int i = 1;
        for (var post : rawPosts.posts()) {
            sb.append("[%d] %s\n%s\n\n".formatted(i++, post.title(), post.snippet()));
        }
    }

    private String pct(Double value) {
        if (value == null) {
            return "0%";
        }
        return "%.0f%%".formatted(value * 100);
    }
}
