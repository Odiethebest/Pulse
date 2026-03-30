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
import java.util.Locale;

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
            int filteredShellCount = 0;
            for (String query : queries) {
                List<RawPost> rawResults = tavilySearchService.search(query, TWITTER_DOMAINS);
                for (RawPost post : rawResults) {
                    if (isTwitterJavascriptShell(post)) {
                        filteredShellCount += 1;
                        continue;
                    }
                    allPosts.add(post);
                }
            }

            long duration = System.currentTimeMillis() - start;
            publisher.publish(AgentEvent.completed("TwitterAgent",
                    "Fetched %d posts from Twitter/X (filtered %d shell pages)"
                            .formatted(allPosts.size(), filteredShellCount),
                    duration));
            log.info("TwitterAgent fetched {} posts in {}ms (filtered {} shell pages)",
                    allPosts.size(), duration, filteredShellCount);
            return new RawPosts("twitter", allPosts);

        } catch (Exception e) {
            long duration = System.currentTimeMillis() - start;
            publisher.publish(AgentEvent.failed("TwitterAgent", e.getMessage(), duration));
            log.error("TwitterAgent failed", e);
            throw new RuntimeException("TwitterAgent failed", e);
        }
    }

    private boolean isTwitterJavascriptShell(RawPost post) {
        if (post == null) {
            return false;
        }
        String merged = (post.title() == null ? "" : post.title())
                + " "
                + (post.snippet() == null ? "" : post.snippet());
        String text = merged.toLowerCase(Locale.ROOT);

        boolean hasJsBlocked = text.contains("javascript is disabled in this browser")
                || text.contains("javascript is not available");
        boolean hasEnablePrompt = text.contains("please enable javascript")
                || text.contains("switch to a supported browser");
        boolean hasHelpOrTerms = (text.contains("supported browsers") && text.contains("help center"))
                || (text.contains("terms of service") && text.contains("privacy policy"));

        return hasJsBlocked || (hasEnablePrompt && hasHelpOrTerms);
    }
}
