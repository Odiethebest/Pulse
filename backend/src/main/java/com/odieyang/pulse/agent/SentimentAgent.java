package com.odieyang.pulse.agent;

import com.odieyang.pulse.model.AgentEvent;
import com.odieyang.pulse.model.CampDistribution;
import com.odieyang.pulse.model.ControversyTopic;
import com.odieyang.pulse.model.Quote;
import com.odieyang.pulse.model.RawPosts;
import com.odieyang.pulse.model.SentimentResult;
import com.odieyang.pulse.service.AgentEventPublisher;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.ai.chat.client.ChatClient;
import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.List;

@Component
@RequiredArgsConstructor
public class SentimentAgent {

    private static final Logger log = LoggerFactory.getLogger(SentimentAgent.class);

    private static final String SYSTEM_PROMPT = """
            You are a sentiment analysis expert specializing in social media discourse.
            Analyze a set of posts and return a structured sentiment breakdown.

            Return a JSON object with this exact structure:
            {
              "platform": "<platform name>",
              "positiveRatio": <0.0-1.0>,
              "negativeRatio": <0.0-1.0>,
              "neutralRatio": <0.0-1.0>,
              "mainControversies": ["controversy1", "controversy2", "controversy3"],
              "stanceDistribution": {
                "support": <0.0-1.0>,
                "oppose": <0.0-1.0>,
                "neutral": <0.0-1.0>
              },
              "aspectSentiments": [
                {"aspect": "pricing", "heat": 70, "summary": "short summary"}
              ],
              "representativeQuotes": [
                {
                  "text": "...",
                  "url": "...",
                  "sentiment": "positive|negative|neutral",
                  "camp": "support|oppose|neutral",
                  "evidenceWeight": <0.0-1.0>
                }
              ]
            }

            Rules:
            - positiveRatio + negativeRatio + neutralRatio must sum to 1.0
            - stanceDistribution ratios should also sum close to 1.0
            - mainControversies: up to 5 key points of debate or disagreement
            - aspectSentiments: 3 to 6 dimensions with heat score 0-100
            - representativeQuotes: 3 quotes that best illustrate the sentiment spread
            - quote text should be a verbatim excerpt or close paraphrase from the posts
            - evidenceWeight: confidence of quote representativeness between 0.0 and 1.0
            - Output valid JSON only, no markdown fences
            """;

    private final ChatClient chatClient;
    private final AgentEventPublisher publisher;

    public SentimentResult analyze(RawPosts rawPosts) {
        String platform = rawPosts.platform();
        publisher.publish(AgentEvent.started("SentimentAgent",
                "Analyzing sentiment for %d %s posts".formatted(rawPosts.posts().size(), platform)));
        long start = System.currentTimeMillis();

        try {
            String postsText = formatPosts(rawPosts);

            SentimentResult result = chatClient.prompt()
                    .system(SYSTEM_PROMPT)
                    .user("Platform: %s\n\nPosts:\n%s".formatted(platform, postsText))
                    .call()
                    .entity(SentimentResult.class);
            SentimentResult normalized = normalizeResult(platform, result);

            long duration = System.currentTimeMillis() - start;
            publisher.publish(AgentEvent.completed("SentimentAgent",
                    "%s sentiment: +%.0f%% -%.0f%% ~%.0f%%".formatted(
                            platform,
                            normalized.positiveRatio() * 100,
                            normalized.negativeRatio() * 100,
                            normalized.neutralRatio() * 100),
                    duration));
            log.info("SentimentAgent completed for {} in {}ms", platform, duration);
            return normalized;

        } catch (Exception e) {
            long duration = System.currentTimeMillis() - start;
            publisher.publish(AgentEvent.failed("SentimentAgent", e.getMessage(), duration));
            log.error("SentimentAgent failed for platform {}", platform, e);
            throw new RuntimeException("SentimentAgent failed for " + platform, e);
        }
    }

    private String formatPosts(RawPosts rawPosts) {
        StringBuilder sb = new StringBuilder();
        int i = 1;
        for (var post : rawPosts.posts()) {
            sb.append("[%d] %s\n%s\nURL: %s\n\n".formatted(i++, post.title(), post.snippet(), post.url()));
        }
        return sb.toString();
    }

    private SentimentResult normalizeResult(String platform, SentimentResult result) {
        double positive = sanitizeRatio(result.positiveRatio());
        double negative = sanitizeRatio(result.negativeRatio());
        double neutral = sanitizeRatio(result.neutralRatio());
        double total = positive + negative + neutral;
        if (total <= 0) {
            neutral = 1.0;
            total = 1.0;
        }

        List<String> controversies = result.mainControversies() == null
                ? List.of()
                : result.mainControversies();

        List<Quote> quotes = normalizeQuotes(result.representativeQuotes());

        CampDistribution stanceDistribution = result.stanceDistribution();
        if (stanceDistribution == null) {
            stanceDistribution = new CampDistribution(positive / total, negative / total, neutral / total);
        }

        List<ControversyTopic> aspects = result.aspectSentiments();
        if (aspects == null || aspects.isEmpty()) {
            aspects = controversies.stream()
                    .limit(3)
                    .map(c -> new ControversyTopic(c, 55, c))
                    .toList();
        }

        return new SentimentResult(
                result.platform() == null ? platform : result.platform(),
                positive / total,
                negative / total,
                neutral / total,
                controversies,
                quotes,
                stanceDistribution,
                aspects
        );
    }

    private List<Quote> normalizeQuotes(List<Quote> quotes) {
        if (quotes == null || quotes.isEmpty()) {
            return List.of();
        }

        List<Quote> normalized = new ArrayList<>(quotes.size());
        for (Quote quote : quotes) {
            String camp = quote.camp();
            if (camp == null) {
                camp = switch ((quote.sentiment() == null ? "neutral" : quote.sentiment().toLowerCase())) {
                    case "positive" -> "support";
                    case "negative" -> "oppose";
                    default -> "neutral";
                };
            }
            double evidenceWeight = quote.evidenceWeight() == null ? 0.5 : sanitizeRatio(quote.evidenceWeight());
            normalized.add(new Quote(
                    quote.text(),
                    quote.url(),
                    quote.sentiment(),
                    camp,
                    evidenceWeight
            ));
        }
        return normalized;
    }

    private double sanitizeRatio(double value) {
        if (Double.isNaN(value) || Double.isInfinite(value)) {
            return 0.0;
        }
        return Math.max(0.0, Math.min(1.0, value));
    }
}
