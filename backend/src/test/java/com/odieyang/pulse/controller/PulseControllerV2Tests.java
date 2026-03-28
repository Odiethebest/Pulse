package com.odieyang.pulse.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.odieyang.pulse.agent.*;
import com.odieyang.pulse.model.*;
import com.odieyang.pulse.orchestrator.PulseOrchestrator;
import com.odieyang.pulse.service.AgentEventPublisher;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

import java.util.List;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

class PulseControllerV2Tests {

    private MockMvc mockMvc;

    private final ObjectMapper objectMapper = new ObjectMapper();

    @BeforeEach
    void setUp() {
        PulseController controller = new PulseController(
                new StubPulseOrchestrator(sampleReport()),
                new AgentEventPublisher()
        );
        mockMvc = MockMvcBuilders.standaloneSetup(controller).build();
    }

    @Test
    void analyzeShouldReturnV2ContractFields() throws Exception {
        mockMvc.perform(post("/api/pulse/analyze")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(new AnalyzeBody("topic"))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.topic").value("topic"))
                .andExpect(jsonPath("$.quickTake[0]").value("Line one"))
                .andExpect(jsonPath("$.dramaScore").value(68))
                .andExpect(jsonPath("$.polarizationScore").value(57))
                .andExpect(jsonPath("$.heatScore").value(74))
                .andExpect(jsonPath("$.flipRiskScore").value(39))
                .andExpect(jsonPath("$.confidenceBreakdown.coverage").value(82))
                .andExpect(jsonPath("$.campDistribution.support").value(0.46))
                .andExpect(jsonPath("$.controversyTopics[0].aspect").value("Pricing"))
                .andExpect(jsonPath("$.flipSignals[0].signal").value("Evidence gap"))
                .andExpect(jsonPath("$.revisionDelta[0]").value("Removed unsupported claim"));
    }

    private PulseReport sampleReport() {
        SentimentResult redditSentiment = new SentimentResult(
                "reddit",
                0.52,
                0.30,
                0.18,
                List.of("Pricing"),
                List.of(new Quote("Reddit quote", "https://reddit.com/r/test", "positive", "support", 0.8)),
                new CampDistribution(0.50, 0.35, 0.15),
                List.of(new ControversyTopic("Pricing", 72, "Main fight around price fairness"))
        );

        SentimentResult twitterSentiment = new SentimentResult(
                "twitter",
                0.40,
                0.45,
                0.15,
                List.of("Credibility"),
                List.of(new Quote("Twitter quote", "https://x.com/test", "negative", "oppose", 0.76)),
                new CampDistribution(0.42, 0.43, 0.15),
                List.of(new ControversyTopic("Credibility", 69, "Large distrust cluster"))
        );

        CriticResult critic = new CriticResult(
                List.of("Unsupported claim"),
                List.of("Bias concern"),
                false,
                66,
                "Tighten evidence language",
                List.of("Need direct quote for claim A"),
                List.of("Removed unsupported claim")
        );

        return new PulseReport(
                "topic",
                "Topic summary",
                redditSentiment,
                twitterSentiment,
                "Platform diff",
                "Synthesis content",
                critic,
                66,
                true,
                List.of(),
                List.of("Line one", "Line two", "Line three"),
                68,
                57,
                74,
                39,
                new ConfidenceBreakdown(82, 70, 66, 61, 60),
                new CampDistribution(0.46, 0.39, 0.15),
                List.of(new ControversyTopic("Pricing", 72, "Main fight around price fairness")),
                List.of(new FlipSignal("Evidence gap", 64, "Claim depends on weak sources")),
                List.of("Removed unsupported claim")
        );
    }

    private record AnalyzeBody(String topic) {}

    private static class StubPulseOrchestrator extends PulseOrchestrator {
        private final PulseReport report;

        StubPulseOrchestrator(PulseReport report) {
            super(
                    (QueryPlannerAgent) null,
                    (RedditAgent) null,
                    (TwitterAgent) null,
                    (SentimentAgent) null,
                    (StanceAgent) null,
                    (ConflictAgent) null,
                    (AspectAgent) null,
                    (FlipRiskAgent) null,
                    (SynthesisAgent) null,
                    (CriticAgent) null,
                    (AgentEventPublisher) null
            );
            this.report = report;
        }

        @Override
        public PulseReport analyze(String topic) {
            return report;
        }
    }
}
