package com.odieyang.pulse.agent;

import com.odieyang.pulse.model.AgentEvent;
import com.odieyang.pulse.model.ConflictResult;
import com.odieyang.pulse.model.RawPosts;
import com.odieyang.pulse.service.AgentEventPublisher;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.ai.chat.client.ChatClient;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
public class ConflictAgent {

    private static final Logger log = LoggerFactory.getLogger(ConflictAgent.class);

    private static final String SYSTEM_PROMPT = """
            You are a conflict intensity analyst for online arguments.
            Score how heated the discussion is.

            Return strict JSON:
            {
              "heatScore": 0,
              "conflictDrivers": ["..."],
              "toxicSignals": ["..."]
            }

            Rules:
            - heatScore is integer 0 to 100.
            - conflictDrivers should list 3 to 5 major causes of fighting.
            - toxicSignals should list up to 5 observable aggressive patterns.
            - Keep all items grounded in given posts.
            - Output JSON only.
            """;

    private final ChatClient chatClient;
    private final AgentEventPublisher publisher;

    public ConflictResult analyze(RawPosts reddit, RawPosts twitter) {
        publisher.publish(AgentEvent.started("ConflictAgent", "Scoring discussion heat and conflict drivers"));
        long start = System.currentTimeMillis();

        try {
            String userPrompt = buildPrompt(reddit, twitter);
            ConflictResult result = chatClient.prompt()
                    .system(SYSTEM_PROMPT)
                    .user(userPrompt)
                    .call()
                    .entity(ConflictResult.class);

            long duration = System.currentTimeMillis() - start;
            publisher.publish(AgentEvent.completed(
                    "ConflictAgent",
                    "Heat score: %d/100".formatted(result.heatScore()),
                    duration));
            log.info("ConflictAgent completed in {}ms, heat={}", duration, result.heatScore());
            return result;
        } catch (Exception e) {
            long duration = System.currentTimeMillis() - start;
            publisher.publish(AgentEvent.failed("ConflictAgent", e.getMessage(), duration));
            log.error("ConflictAgent failed", e);
            throw new RuntimeException("ConflictAgent failed", e);
        }
    }

    private String buildPrompt(RawPosts reddit, RawPosts twitter) {
        StringBuilder sb = new StringBuilder();
        sb.append("Evaluate the conflict intensity based on these posts.\n");
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
