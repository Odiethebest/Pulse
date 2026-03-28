package com.odieyang.pulse.agent;

import com.odieyang.pulse.model.AgentEvent;
import com.odieyang.pulse.model.FlipRiskResult;
import com.odieyang.pulse.model.RawPosts;
import com.odieyang.pulse.service.AgentEventPublisher;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.ai.chat.client.ChatClient;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
public class FlipRiskAgent {

    private static final Logger log = LoggerFactory.getLogger(FlipRiskAgent.class);

    private static final String SYSTEM_PROMPT = """
            You are a narrative reversal risk analyst.
            Estimate how likely this discussion can flip due to weak evidence,
            contradictory claims, or rumor-driven spread.

            Return strict JSON:
            {
              "flipRiskScore": 0,
              "signals": [
                {"signal": "string", "severity": 0, "summary": "string"}
              ],
              "rationale": ["..."]
            }

            Rules:
            - flipRiskScore is integer 0 to 100.
            - Return up to 5 signals.
            - severity is integer 0 to 100.
            - rationale should list 2 to 5 concise points.
            - Output JSON only.
            """;

    private final ChatClient chatClient;
    private final AgentEventPublisher publisher;

    public FlipRiskResult analyze(RawPosts reddit, RawPosts twitter) {
        publisher.publish(AgentEvent.started("FlipRiskAgent", "Estimating narrative flip risk"));
        long start = System.currentTimeMillis();

        try {
            String userPrompt = buildPrompt(reddit, twitter);
            FlipRiskResult result = chatClient.prompt()
                    .system(SYSTEM_PROMPT)
                    .user(userPrompt)
                    .call()
                    .entity(FlipRiskResult.class);

            int signalCount = result.signals() == null ? 0 : result.signals().size();
            long duration = System.currentTimeMillis() - start;
            publisher.publish(AgentEvent.completed(
                    "FlipRiskAgent",
                    "Flip risk %d/100 with %d signals".formatted(result.flipRiskScore(), signalCount),
                    duration));
            log.info("FlipRiskAgent completed in {}ms, flipRisk={}", duration, result.flipRiskScore());
            return result;
        } catch (Exception e) {
            long duration = System.currentTimeMillis() - start;
            publisher.publish(AgentEvent.failed("FlipRiskAgent", e.getMessage(), duration));
            log.error("FlipRiskAgent failed", e);
            throw new RuntimeException("FlipRiskAgent failed", e);
        }
    }

    private String buildPrompt(RawPosts reddit, RawPosts twitter) {
        StringBuilder sb = new StringBuilder();
        sb.append("Assess reversal risk from these social posts.\n");
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
