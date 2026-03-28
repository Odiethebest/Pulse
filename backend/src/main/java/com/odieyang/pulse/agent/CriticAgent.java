package com.odieyang.pulse.agent;

import com.odieyang.pulse.model.AgentEvent;
import com.odieyang.pulse.model.CriticResult;
import com.odieyang.pulse.model.RawPosts;
import com.odieyang.pulse.service.AgentEventPublisher;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.ai.chat.client.ChatClient;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
public class CriticAgent {

    private static final Logger log = LoggerFactory.getLogger(CriticAgent.class);

    private static final String SYSTEM_PROMPT = """
            You are a critical reviewer of public opinion analysis reports.
            Your role is to evaluate a synthesis report for accuracy, bias, and scope.

            Return a JSON object with this exact structure:
            {
              "unsupportedClaims": ["claim1", "claim2"],
              "biasConcerns": ["concern1", "concern2"],
              "exceedsDataScope": <true|false>,
              "confidenceScore": <0-100>,
              "revisionSuggestions": "specific actionable guidance for improving the report"
            }

            Scoring guide for confidenceScore:
            - 80-100: Report is well-supported, balanced, and within data scope
            - 60-79: Minor issues but generally reliable
            - 40-59: Significant unsupported claims or notable bias — revision needed
            - 0-39: Major problems; report should be substantially rewritten

            Rules:
            - unsupportedClaims: list specific claims in the synthesis not backed by the posts
            - biasConcerns: list any framing, omissions, or language that skews the analysis
            - exceedsDataScope: true if the report draws conclusions beyond what the data supports
            - revisionSuggestions: concrete, actionable guidance (not just "be more balanced")
            - Output valid JSON only, no markdown fences
            """;

    private final ChatClient chatClient;
    private final AgentEventPublisher publisher;

    public CriticResult critique(String synthesis, RawPosts reddit, RawPosts twitter) {
        publisher.publish(AgentEvent.started("CriticAgent", "Evaluating synthesis report for bias and confidence"));
        long start = System.currentTimeMillis();

        try {
            String userPrompt = buildUserPrompt(synthesis, reddit, twitter);

            CriticResult result = chatClient.prompt()
                    .system(SYSTEM_PROMPT)
                    .user(userPrompt)
                    .call()
                    .entity(CriticResult.class);

            long duration = System.currentTimeMillis() - start;
            publisher.publish(AgentEvent.completed("CriticAgent",
                    "Confidence score: %d/100".formatted(result.confidenceScore()), duration));
            log.info("CriticAgent completed in {}ms, confidence={}", duration, result.confidenceScore());
            return result;

        } catch (Exception e) {
            long duration = System.currentTimeMillis() - start;
            publisher.publish(AgentEvent.failed("CriticAgent", e.getMessage(), duration));
            log.error("CriticAgent failed", e);
            throw new RuntimeException("CriticAgent failed", e);
        }
    }

    private String buildUserPrompt(String synthesis, RawPosts reddit, RawPosts twitter) {
        StringBuilder sb = new StringBuilder();
        sb.append("=== SYNTHESIS REPORT TO EVALUATE ===\n");
        sb.append(synthesis).append("\n\n");

        sb.append("=== SOURCE: REDDIT POSTS ===\n");
        appendPosts(sb, reddit);

        sb.append("=== SOURCE: TWITTER/X POSTS ===\n");
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
