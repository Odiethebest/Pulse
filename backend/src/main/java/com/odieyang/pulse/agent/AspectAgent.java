package com.odieyang.pulse.agent;

import com.odieyang.pulse.model.AgentEvent;
import com.odieyang.pulse.model.AspectResult;
import com.odieyang.pulse.model.RawPosts;
import com.odieyang.pulse.service.AgentEventPublisher;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.ai.chat.client.ChatClient;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
public class AspectAgent {

    private static final Logger log = LoggerFactory.getLogger(AspectAgent.class);

    private static final String SYSTEM_PROMPT = """
            You are an aspect controversy extractor for social media debates.
            Cluster arguments into clear controversy dimensions.

            Return strict JSON:
            {
              "topics": [
                {"aspect": "string", "heat": 0, "summary": "string"}
              ]
            }

            Rules:
            - Return 3 to 6 topics.
            - heat is integer 0 to 100.
            - aspect is a short label, for example pricing, ethics, product quality.
            - summary is one concise sentence.
            - Output JSON only.
            """;

    private final ChatClient chatClient;
    private final AgentEventPublisher publisher;

    public AspectResult analyze(RawPosts reddit, RawPosts twitter) {
        publisher.publish(AgentEvent.started("AspectAgent", "Extracting controversy dimensions and heat"));
        long start = System.currentTimeMillis();

        try {
            String userPrompt = buildPrompt(reddit, twitter);
            AspectResult result = chatClient.prompt()
                    .system(SYSTEM_PROMPT)
                    .user(userPrompt)
                    .call()
                    .entity(AspectResult.class);

            int count = result.topics() == null ? 0 : result.topics().size();
            long duration = System.currentTimeMillis() - start;
            publisher.publish(AgentEvent.completed(
                    "AspectAgent",
                    "Extracted %d controversy topics".formatted(count),
                    duration));
            log.info("AspectAgent completed in {}ms with {} topics", duration, count);
            return result;
        } catch (Exception e) {
            long duration = System.currentTimeMillis() - start;
            publisher.publish(AgentEvent.failed("AspectAgent", e.getMessage(), duration));
            log.error("AspectAgent failed", e);
            throw new RuntimeException("AspectAgent failed", e);
        }
    }

    private String buildPrompt(RawPosts reddit, RawPosts twitter) {
        StringBuilder sb = new StringBuilder();
        sb.append("Identify the main controversy dimensions from these posts.\n");
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
