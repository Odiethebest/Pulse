package com.odieyang.pulse.model;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

class PulseReportSerializationTests {

    private final ObjectMapper objectMapper = new ObjectMapper().findAndRegisterModules();

    @Test
    void shouldSerializeV2FieldsWithoutLosingData() throws Exception {
        PulseReport report = new PulseReport(
                "Topic",
                "Topic summary",
                sentiment("reddit"),
                sentiment("twitter"),
                "platform diff",
                "synthesis content",
                new CriticResult(
                        List.of("unsupported"),
                        List.of("bias"),
                        false,
                        73,
                        "revise suggestions",
                        List.of("need source"),
                        List.of("remove weak claim")
                ),
                73,
                true,
                List.of(new AgentEvent("Planner", "COMPLETED", "ok", 10, Instant.parse("2026-03-28T08:00:00Z"))),
                List.of("line 1", "line 2", "line 3"),
                66,
                58,
                72,
                41,
                new ConfidenceBreakdown(84, 72, 73, 65, 62),
                new CampDistribution(0.48, 0.37, 0.15),
                List.of(new ControversyTopic("Pricing", 71, "price fight")),
                List.of(new FlipSignal("Evidence gap", 64, "weak citation chain")),
                List.of("removed weak claim")
        );

        JsonNode root = objectMapper.readTree(objectMapper.writeValueAsString(report));

        assertEquals("Topic", root.get("topic").asText());
        assertEquals(66, root.get("dramaScore").asInt());
        assertEquals(58, root.get("polarizationScore").asInt());
        assertEquals(72, root.get("heatScore").asInt());
        assertEquals(41, root.get("flipRiskScore").asInt());
        assertEquals(84, root.get("confidenceBreakdown").get("coverage").asInt());
        assertEquals(0.48, root.get("campDistribution").get("support").asDouble(), 0.0001);
        assertEquals("Pricing", root.get("controversyTopics").get(0).get("aspect").asText());
        assertEquals("Evidence gap", root.get("flipSignals").get(0).get("signal").asText());
        assertEquals("removed weak claim", root.get("revisionDelta").get(0).asText());
        assertEquals("support", root.get("redditSentiment").get("representativeQuotes").get(0).get("camp").asText());
        assertEquals(0.8, root.get("redditSentiment").get("representativeQuotes").get(0).get("evidenceWeight").asDouble(), 0.0001);
    }

    @Test
    void shouldDeserializeV1PayloadWithV2FieldsAsNull() throws Exception {
        String legacyJson = """
                {
                  "topic": "Legacy Topic",
                  "topicSummary": "legacy summary",
                  "redditSentiment": {
                    "platform": "reddit",
                    "positiveRatio": 0.5,
                    "negativeRatio": 0.3,
                    "neutralRatio": 0.2,
                    "mainControversies": ["pricing"],
                    "representativeQuotes": [{"text":"q","url":"u","sentiment":"positive"}]
                  },
                  "twitterSentiment": {
                    "platform": "twitter",
                    "positiveRatio": 0.4,
                    "negativeRatio": 0.4,
                    "neutralRatio": 0.2,
                    "mainControversies": ["quality"],
                    "representativeQuotes": [{"text":"q2","url":"u2","sentiment":"negative"}]
                  },
                  "platformDiff": "legacy diff",
                  "synthesis": "legacy synthesis",
                  "critique": {
                    "unsupportedClaims": [],
                    "biasConcerns": [],
                    "exceedsDataScope": false,
                    "confidenceScore": 67,
                    "revisionSuggestions": "none"
                  },
                  "confidenceScore": 67,
                  "debateTriggered": false,
                  "executionTrace": []
                }
                """;

        PulseReport report = objectMapper.readValue(legacyJson, PulseReport.class);

        assertEquals("Legacy Topic", report.topic());
        assertEquals(67, report.confidenceScore());
        assertNotNull(report.critique());
        assertNull(report.quickTake());
        assertNull(report.dramaScore());
        assertNull(report.confidenceBreakdown());
        assertNull(report.campDistribution());
        assertNull(report.controversyTopics());
        assertNull(report.flipSignals());
        assertNull(report.revisionDelta());
        assertNull(report.critique().evidenceGaps());
        assertNull(report.critique().deltaHighlights());
    }

    private SentimentResult sentiment(String platform) {
        return new SentimentResult(
                platform,
                0.55,
                0.30,
                0.15,
                List.of("pricing"),
                List.of(new Quote("text", "url", "positive", "support", 0.8)),
                new CampDistribution(0.50, 0.35, 0.15),
                List.of(new ControversyTopic("Pricing", 70, "price fight"))
        );
    }
}
