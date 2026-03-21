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
public class TwitterAgent {

    private static final Logger log = LoggerFactory.getLogger(TwitterAgent.class);
    private static final List<String> TWITTER_DOMAINS = List.of("twitter.com", "x.com");

    private final TavilySearchService tavilySearchService;
    private final AgentEventPublisher publisher;

    public RawPosts fetch(List<String> queries) {
        publisher.publish(AgentEvent.started("TwitterAgent",
                "Fetching Twitter/X posts for %d queries".formatted(queries.size())));
        long start = System.currentTimeMillis();

        try {
            List<RawPost> allPosts = new ArrayList<>();
            for (String query : queries) {
                allPosts.addAll(tavilySearchService.search(query, TWITTER_DOMAINS));
            }

            long duration = System.currentTimeMillis() - start;
            publisher.publish(AgentEvent.completed("TwitterAgent",
                    "Fetched %d posts from Twitter/X".formatted(allPosts.size()), duration));
            log.info("TwitterAgent fetched {} posts in {}ms", allPosts.size(), duration);
            return new RawPosts("twitter", allPosts);

        } catch (Exception e) {
            long duration = System.currentTimeMillis() - start;
            publisher.publish(AgentEvent.failed("TwitterAgent", e.getMessage(), duration));
            log.error("TwitterAgent failed", e);
            throw new RuntimeException("TwitterAgent failed", e);
        }
    }
}
