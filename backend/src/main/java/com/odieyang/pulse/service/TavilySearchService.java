package com.odieyang.pulse.service;

import com.odieyang.pulse.model.RawPost;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;

import java.util.List;
import java.util.Map;

@Service
public class TavilySearchService {

    private static final Logger log = LoggerFactory.getLogger(TavilySearchService.class);
    private static final String TAVILY_URL = "https://api.tavily.com/search";

    private final RestClient restClient;
    private final String apiKey;
    private final int maxResults;

    public TavilySearchService(
            RestClient.Builder restClientBuilder,
            @Value("${tavily.api-key}") String apiKey,
            @Value("${tavily.max-results:10}") int maxResults
    ) {
        this.restClient = restClientBuilder.build();
        this.apiKey = apiKey;
        this.maxResults = Math.max(1, Math.min(20, maxResults));
    }

    public List<RawPost> search(String query, List<String> includeDomains) {
        log.debug("Tavily search: query='{}', domains={}", query, includeDomains);

        Map<String, Object> requestBody = Map.of(
                "api_key", apiKey,
                "query", query,
                "include_domains", includeDomains,
                "max_results", maxResults
        );

        TavilyResponse response = restClient.post()
                .uri(TAVILY_URL)
                .header("Content-Type", "application/json")
                .body(requestBody)
                .retrieve()
                .body(TavilyResponse.class);

        if (response == null || response.results() == null) {
            log.warn("Tavily returned empty response for query: {}", query);
            return List.of();
        }

        return response.results().stream()
                .map(r -> new RawPost(r.title(), r.content(), r.url()))
                .toList();
    }

    // Internal response mapping records
    record TavilyResponse(List<TavilyResult> results) {}

    record TavilyResult(String title, String content, String url) {}
}
