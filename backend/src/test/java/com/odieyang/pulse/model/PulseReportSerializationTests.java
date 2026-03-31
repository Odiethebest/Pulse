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
                List.of("removed weak claim"),
                List.of(new ClaimEvidenceLink("C1", "Claim text", List.of("https://reddit.com/test"))),
                List.of(new ClaimAnnotation(
                        "ann-1",
                        "Lead",
                        "C1",
                        "Clarified camp split language",
                        "Critic requested stronger source linkage.",
                        "rev-1"
                )),
                List.of(new RiskFlag(
                        "risk-gap-1",
                        "Top Controversies",
                        "warning",
                        "Evidence Gap",
                        "Need one more supporting source for C1",
                        "C1"
                )),
                List.of(new RevisionAnchor(
                        "rev-1",
                        "Lead",
                        "Revision 1",
                        "Clarified camp split language",
                        "C1"
                )),
                List.of(
                        new CrawledPost(
                                "reddit",
                                "Reddit thread",
                                "Taylor Swift and Ed Sheeran friendship debate evidence",
                                "https://reddit.com/test",
                                90,
                                86,
                                88,
                                "rule"
                        ),
                        new CrawledPost(
                                "twitter",
                                "X thread",
                                "Taylor Swift and Ed Sheeran friendship debate update",
                                "https://x.com/test",
                                85,
                                80,
                                83,
                                "rule+llm"
                        )
                ),
                new CrawlerStats(
                        16,
                        2,
                        1,
                        1,
                        2,
                        0,
                        13,
                        "warning",
                        List.of("Low crawl coverage: 13% (<70% target).")
                ),
                List.of(
                        new TopicBucket(
                                "t1",
                                "Pricing",
                                List.of(new CrawledPost(
                                        "reddit",
                                        "Reddit thread",
                                        "Taylor Swift and Ed Sheeran friendship debate evidence",
                                        "https://reddit.com/test",
                                        90,
                                        86,
                                        88,
                                        "rule"
                                ))
                        ),
                        new TopicBucket(
                                "unassigned",
                                "Unassigned",
                                List.of()
                        )
                )
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
        assertEquals("C1", root.get("claimEvidenceMap").get(0).get("claimId").asText());
        assertEquals("https://reddit.com/test", root.get("claimEvidenceMap").get(0).get("evidenceUrls").get(0).asText());
        assertEquals("ann-1", root.get("claimAnnotations").get(0).get("annotationId").asText());
        assertEquals("risk-gap-1", root.get("riskFlags").get(0).get("flagId").asText());
        assertEquals("rev-1", root.get("revisionAnchors").get(0).get("anchorId").asText());
        assertEquals("support", root.get("redditSentiment").get("representativeQuotes").get(0).get("camp").asText());
        assertEquals(0.8, root.get("redditSentiment").get("representativeQuotes").get(0).get("evidenceWeight").asDouble(), 0.0001);
        assertEquals("reddit", root.get("allPosts").get(0).get("platform").asText());
        assertEquals("rule", root.get("allPosts").get(0).get("classificationMethod").asText());
        assertEquals(16, root.get("crawlerStats").get("targetTotal").asInt());
        assertEquals("warning", root.get("crawlerStats").get("coverageLevel").asText());
        assertEquals("t1", root.get("topicBuckets").get(0).get("topicId").asText());
        assertEquals("unassigned", root.get("topicBuckets").get(1).get("topicId").asText());
    }

    @Test
    void shouldDeserializeCrawlerContractFields() throws Exception {
        String json = """
                {
                  "topic": "Topic",
                  "topicSummary": "Topic summary",
                  "redditSentiment": {
                    "platform": "reddit",
                    "positiveRatio": 0.55,
                    "negativeRatio": 0.30,
                    "neutralRatio": 0.15,
                    "mainControversies": ["pricing"],
                    "representativeQuotes": [{"text":"text","url":"url","sentiment":"positive","camp":"support","evidenceWeight":0.8}]
                  },
                  "twitterSentiment": {
                    "platform": "twitter",
                    "positiveRatio": 0.45,
                    "negativeRatio": 0.35,
                    "neutralRatio": 0.20,
                    "mainControversies": ["credibility"],
                    "representativeQuotes": [{"text":"text2","url":"url2","sentiment":"negative","camp":"oppose","evidenceWeight":0.7}]
                  },
                  "platformDiff": "diff",
                  "synthesis": "content",
                  "critique": {
                    "unsupportedClaims": [],
                    "biasConcerns": [],
                    "exceedsDataScope": false,
                    "confidenceScore": 70,
                    "revisionSuggestions": "tighten"
                  },
                  "confidenceScore": 70,
                  "debateTriggered": false,
                  "executionTrace": [],
                  "allPosts": [
                    {
                      "platform": "reddit",
                      "title": "Reddit thread",
                      "snippet": "topic evidence",
                      "url": "https://reddit.com/test",
                      "evidenceScore": 90,
                      "recencyScore": 86,
                      "sortScore": 88,
                      "classificationMethod": "rule"
                    }
                  ],
                  "crawlerStats": {
                    "targetTotal": 16,
                    "fetchedTotal": 1,
                    "redditCount": 1,
                    "twitterCount": 0,
                    "dedupedCount": 1,
                    "unassignedCount": 0,
                    "coveragePercent": 6,
                    "coverageLevel": "warning",
                    "coverageAlerts": ["low coverage"]
                  },
                  "topicBuckets": [
                    {
                      "topicId": "t1",
                      "topicName": "Pricing",
                      "posts": []
                    },
                    {
                      "topicId": "unassigned",
                      "topicName": "Unassigned",
                      "posts": []
                    }
                  ]
                }
                """;

        PulseReport report = objectMapper.readValue(json, PulseReport.class);

        assertNotNull(report.allPosts());
        assertEquals(1, report.allPosts().size());
        assertEquals("reddit", report.allPosts().getFirst().platform());
        assertNotNull(report.crawlerStats());
        assertEquals(16, report.crawlerStats().targetTotal());
        assertEquals("warning", report.crawlerStats().coverageLevel());
        assertNotNull(report.topicBuckets());
        assertEquals(2, report.topicBuckets().size());
        assertEquals("t1", report.topicBuckets().getFirst().topicId());
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
        assertNull(report.claimEvidenceMap());
        assertNull(report.claimAnnotations());
        assertNull(report.riskFlags());
        assertNull(report.revisionAnchors());
        assertNull(report.critique().evidenceGaps());
        assertNull(report.critique().deltaHighlights());
        assertNull(report.critique().fluffFindings());
        assertNull(report.critique().informationDensityScore());
        assertNull(report.critique().claimEvidenceCoverage());
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
