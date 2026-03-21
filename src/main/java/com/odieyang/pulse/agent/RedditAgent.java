package com.odieyang.pulse.agent;

import com.odieyang.pulse.model.AgentEvent;
import com.odieyang.pulse.model.RawPost;
import com.odieyang.pulse.model.RawPosts;
import com.odieyang.pulse.service.AgentEventPublisher;
import com.odieyang.pulse.service.TavilySearchService;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.List;

@Component
@RequiredArgsConstructor
public class RedditAgent {

    private static final Logger log = LoggerFactory.getLogger(RedditAgent.class);
    private static final List<String> REDDIT_DOMAINS = List.of("reddit.com");

    private final TavilySearchService tavilySearchService;
    private final AgentEventPublisher publisher;

    public RawPosts fetch(List<String> queries) {
        publisher.publish(AgentEvent.started("RedditAgent",
                "Fetching Reddit posts for %d queries".formatted(queries.size())));
        long start = System.currentTimeMillis();

        try {
            List<RawPost> allPosts = new ArrayList<>();
            for (String query : queries) {
                allPosts.addAll(tavilySearchService.search(query, REDDIT_DOMAINS));
            }

            long duration = System.currentTimeMillis() - start;
            publisher.publish(AgentEvent.completed("RedditAgent",
                    "Fetched %d posts from Reddit".formatted(allPosts.size()), duration));
            log.info("RedditAgent fetched {} posts in {}ms", allPosts.size(), duration);
            return new RawPosts("reddit", allPosts);

        } catch (Exception e) {
            long duration = System.currentTimeMillis() - start;
            publisher.publish(AgentEvent.failed("RedditAgent", e.getMessage(), duration));
            log.error("RedditAgent failed", e);
            throw new RuntimeException("RedditAgent failed", e);
        }
    }
}
