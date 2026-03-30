package com.odieyang.pulse.agent;

import com.odieyang.pulse.model.RawPost;
import com.odieyang.pulse.model.RawPosts;
import com.odieyang.pulse.service.AgentEventPublisher;
import com.odieyang.pulse.service.TavilySearchService;
import org.junit.jupiter.api.Test;
import org.springframework.web.client.RestClient;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

class TwitterAgentTests {

    @Test
    void fetchShouldFilterJavascriptShellPages() {
        TavilySearchService tavily = new StubTavilySearchService(List.of(
                new RawPost(
                        "X",
                        "We've detected that JavaScript is disabled in this browser. Please enable JavaScript or switch to a supported browser.",
                        "https://x.com/shell"
                ),
                new RawPost(
                        "Real discussion",
                        "Fans are debating the production quality and lyrics.",
                        "https://x.com/real-post"
                )
        ));
        AgentEventPublisher publisher = new AgentEventPublisher();

        TwitterAgent agent = new TwitterAgent(tavily, publisher);
        RawPosts result = agent.fetch(List.of("topic query"));

        assertEquals("twitter", result.platform());
        assertEquals(1, result.posts().size());
        assertEquals("https://x.com/real-post", result.posts().getFirst().url());
    }

    @Test
    void fetchShouldKeepNormalTwitterPosts() {
        TavilySearchService tavily = new StubTavilySearchService(List.of(
                new RawPost("Tweet A", "Normal content A", "https://x.com/a"),
                new RawPost("Tweet B", "Normal content B", "https://x.com/b")
        ));
        AgentEventPublisher publisher = new AgentEventPublisher();

        TwitterAgent agent = new TwitterAgent(tavily, publisher);
        RawPosts result = agent.fetch(List.of("topic query"));

        assertEquals(2, result.posts().size());
        assertTrue(result.posts().stream().anyMatch(p -> "https://x.com/a".equals(p.url())));
        assertTrue(result.posts().stream().anyMatch(p -> "https://x.com/b".equals(p.url())));
    }

    private static class StubTavilySearchService extends TavilySearchService {
        private final List<RawPost> results;

        StubTavilySearchService(List<RawPost> results) {
            super(RestClient.builder(), "test-key", 10);
            this.results = results;
        }

        @Override
        public List<RawPost> search(String query, List<String> includeDomains) {
            return results;
        }
    }
}
