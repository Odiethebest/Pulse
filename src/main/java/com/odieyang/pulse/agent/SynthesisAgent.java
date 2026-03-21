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
            You are a public opinion analyst who synthesizes social media sentiment
            into clear, balanced reports.

            Write a structured synthesis report covering:
            1. Overall public sentiment and dominant mood
            2. Key themes and narratives across both platforms
            3. Notable differences between Reddit and Twitter/X audiences
            4. Most significant controversies or points of division
            5. Confidence caveats based on the data available

            Be factual, balanced, and grounded in the provided data.
            Do not introduce claims that aren't supported by the posts.
            Write in clear prose, 300-500 words.
            """;

    private static final String REVISION_SYSTEM_PROMPT = """
            You are a public opinion analyst revising a synthesis report based on
            critic feedback.

            Incorporate the revision suggestions to address:
            - Unsupported claims that should be removed or qualified
            - Bias concerns that should be balanced
            - Scope issues where the report overreaches the data

            Produce an improved synthesis report (300-500 words) that addresses
            all identified issues while remaining grounded in the source data.
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

        sb.append("=== TWITTER/X SENTIMENT ===\n");
        sb.append("Positive: %.0f%%, Negative: %.0f%%, Neutral: %.0f%%\n".formatted(
                twitterSentiment.positiveRatio() * 100,
                twitterSentiment.negativeRatio() * 100,
                twitterSentiment.neutralRatio() * 100));
        sb.append("Controversies: %s\n\n".formatted(twitterSentiment.mainControversies()));

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
}
