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
public class SentimentAgent {

    private static final Logger log = LoggerFactory.getLogger(SentimentAgent.class);

    private static final String SYSTEM_PROMPT = """
            You are a sentiment analysis expert specializing in social media discourse.
            Analyze a set of posts and return a structured sentiment breakdown.

            Return a JSON object with this exact structure:
            {
              "platform": "<platform name>",
              "positiveRatio": <0.0-1.0>,
              "negativeRatio": <0.0-1.0>,
              "neutralRatio": <0.0-1.0>,
              "mainControversies": ["controversy1", "controversy2", "controversy3"],
              "representativeQuotes": [
                {"text": "...", "url": "...", "sentiment": "positive|negative|neutral"},
                {"text": "...", "url": "...", "sentiment": "positive|negative|neutral"},
                {"text": "...", "url": "...", "sentiment": "positive|negative|neutral"}
              ]
            }

            Rules:
            - positiveRatio + negativeRatio + neutralRatio must sum to 1.0
            - mainControversies: up to 5 key points of debate or disagreement
            - representativeQuotes: 3 quotes that best illustrate the sentiment spread
            - quote text should be a verbatim excerpt or close paraphrase from the posts
            - Output valid JSON only, no markdown fences
            """;

    private final ChatClient chatClient;
    private final AgentEventPublisher publisher;

    public SentimentResult analyze(RawPosts rawPosts) {
        String platform = rawPosts.platform();
        publisher.publish(AgentEvent.started("SentimentAgent",
                "Analyzing sentiment for %d %s posts".formatted(rawPosts.posts().size(), platform)));
        long start = System.currentTimeMillis();

        try {
            String postsText = formatPosts(rawPosts);

            SentimentResult result = chatClient.prompt()
                    .system(SYSTEM_PROMPT)
                    .user("Platform: %s\n\nPosts:\n%s".formatted(platform, postsText))
                    .call()
                    .entity(SentimentResult.class);

            long duration = System.currentTimeMillis() - start;
            publisher.publish(AgentEvent.completed("SentimentAgent",
                    "%s sentiment: +%.0f%% -%.0f%% ~%.0f%%".formatted(
                            platform,
                            result.positiveRatio() * 100,
                            result.negativeRatio() * 100,
                            result.neutralRatio() * 100),
                    duration));
            log.info("SentimentAgent completed for {} in {}ms", platform, duration);
            return result;

        } catch (Exception e) {
            long duration = System.currentTimeMillis() - start;
            publisher.publish(AgentEvent.failed("SentimentAgent", e.getMessage(), duration));
            log.error("SentimentAgent failed for platform {}", platform, e);
            throw new RuntimeException("SentimentAgent failed for " + platform, e);
        }
    }

    private String formatPosts(RawPosts rawPosts) {
        StringBuilder sb = new StringBuilder();
        int i = 1;
        for (var post : rawPosts.posts()) {
            sb.append("[%d] %s\n%s\nURL: %s\n\n".formatted(i++, post.title(), post.snippet(), post.url()));
        }
        return sb.toString();
    }
}
