package com.odieyang.pulse.agent;

import com.odieyang.pulse.model.AgentEvent;
import com.odieyang.pulse.model.RawPosts;
import com.odieyang.pulse.model.StanceResult;
import com.odieyang.pulse.service.AgentEventPublisher;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.ai.chat.client.ChatClient;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
public class StanceAgent {

    private static final Logger log = LoggerFactory.getLogger(StanceAgent.class);

    private static final String SYSTEM_PROMPT = """
            You are a stance analyst for social media debates.
            Classify the combined discussion into three camps:
            support, oppose, and neutral bystander.

            Return strict JSON in this shape:
            {
              "supportRatio": 0.0,
              "opposeRatio": 0.0,
              "neutralRatio": 0.0,
              "supportArguments": ["..."],
              "opposeArguments": ["..."],
              "neutralArguments": ["..."]
            }

            Rules:
            - Ratios are between 0.0 and 1.0 and should sum close to 1.0.
            - Each arguments list should contain 2 to 4 concise points.
            - Keep arguments faithful to provided posts.
            - Output JSON only.
            """;

    private final ChatClient chatClient;
    private final AgentEventPublisher publisher;

    public StanceResult analyze(RawPosts reddit, RawPosts twitter) {
        publisher.publish(AgentEvent.started("StanceAgent", "Classifying support, oppose, and neutral camps"));
        long start = System.currentTimeMillis();

        try {
            String userPrompt = buildPrompt(reddit, twitter);
            StanceResult result = chatClient.prompt()
                    .system(SYSTEM_PROMPT)
                    .user(userPrompt)
                    .call()
                    .entity(StanceResult.class);

            long duration = System.currentTimeMillis() - start;
            publisher.publish(AgentEvent.completed(
                    "StanceAgent",
                    "Camp distribution S%.0f O%.0f N%.0f".formatted(
                            result.supportRatio() * 100,
                            result.opposeRatio() * 100,
                            result.neutralRatio() * 100),
                    duration));
            log.info("StanceAgent completed in {}ms", duration);
            return result;
        } catch (Exception e) {
            long duration = System.currentTimeMillis() - start;
            publisher.publish(AgentEvent.failed("StanceAgent", e.getMessage(), duration));
            log.error("StanceAgent failed", e);
            throw new RuntimeException("StanceAgent failed", e);
        }
    }

    private String buildPrompt(RawPosts reddit, RawPosts twitter) {
        StringBuilder sb = new StringBuilder();
        sb.append("Topic discussion from Reddit and Twitter/X follows.\n");
        sb.append("=== REDDIT POSTS ===\n");
        appendPosts(sb, reddit);
        sb.append("=== TWITTER/X POSTS ===\n");
        appendPosts(sb, twitter);
        return sb.toString();
    }

    private void appendPosts(StringBuilder sb, RawPosts rawPosts) {
        int i = 1;
        for (var post : rawPosts.posts()) {
            sb.append("[%d] %s\n%s\n\n".formatted(i++, post.title(), post.snippet()));
        }
    }
}
