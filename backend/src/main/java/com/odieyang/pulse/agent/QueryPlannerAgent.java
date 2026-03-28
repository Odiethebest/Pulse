package com.odieyang.pulse.agent;

import com.odieyang.pulse.model.AgentEvent;
import com.odieyang.pulse.model.QueryPlan;
import com.odieyang.pulse.service.AgentEventPublisher;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.ai.chat.client.ChatClient;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
public class QueryPlannerAgent {

    private static final Logger log = LoggerFactory.getLogger(QueryPlannerAgent.class);

    private static final String SYSTEM_PROMPT = """
            You are a search query planner for a public opinion analysis system.
            Given a topic or event, generate targeted search queries to retrieve
            relevant public discussions from Reddit and Twitter/X.

            Return a JSON object with this exact structure:
            {
              "redditQueries": ["query1", "query2", "query3"],
              "twitterQueries": ["query1", "query2", "query3"],
              "topicSummary": "one-sentence summary of the topic"
            }

            Rules:
            - Generate 3 queries per platform
            - Reddit queries should be conversational and community-focused
            - Twitter queries should use relevant hashtags and concise phrasing
            - topicSummary must be a single, neutral sentence
            - Output valid JSON only, no markdown fences
            """;

    private final ChatClient chatClient;
    private final AgentEventPublisher publisher;

    public QueryPlan plan(String topic) {
        publisher.publish(AgentEvent.started("QueryPlannerAgent", "Planning queries for: " + topic));
        long start = System.currentTimeMillis();

        try {
            QueryPlan plan = chatClient.prompt()
                    .system(SYSTEM_PROMPT)
                    .user("Topic: " + topic)
                    .call()
                    .entity(QueryPlan.class);

            long duration = System.currentTimeMillis() - start;
            publisher.publish(AgentEvent.completed(
                    "QueryPlannerAgent",
                    "Generated %d Reddit + %d Twitter queries".formatted(
                            plan.redditQueries().size(), plan.twitterQueries().size()),
                    duration));
            log.info("QueryPlannerAgent completed in {}ms: {}", duration, plan.topicSummary());
            return plan;

        } catch (Exception e) {
            long duration = System.currentTimeMillis() - start;
            publisher.publish(AgentEvent.failed("QueryPlannerAgent", e.getMessage(), duration));
            log.error("QueryPlannerAgent failed", e);
            throw new RuntimeException("QueryPlannerAgent failed", e);
        }
    }
}
