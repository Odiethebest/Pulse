package com.odieyang.pulse.model;

import java.util.List;

public record PulseReport(
        String topic,
        String topicSummary,
        SentimentResult redditSentiment,
        SentimentResult twitterSentiment,
        String platformDiff,
        String synthesis,
        CriticResult critique,
        int confidenceScore,
        boolean debateTriggered,
        List<AgentEvent> executionTrace,
        List<String> quickTake,
        Integer dramaScore,
        Integer polarizationScore,
        Integer heatScore,
        Integer flipRiskScore,
        ConfidenceBreakdown confidenceBreakdown,
        CampDistribution campDistribution,
        List<ControversyTopic> controversyTopics,
        List<FlipSignal> flipSignals,
        List<String> revisionDelta
) {
    public PulseReport(
            String topic,
            String topicSummary,
            SentimentResult redditSentiment,
            SentimentResult twitterSentiment,
            String platformDiff,
            String synthesis,
            CriticResult critique,
            int confidenceScore,
            boolean debateTriggered,
            List<AgentEvent> executionTrace
    ) {
        this(
                topic,
                topicSummary,
                redditSentiment,
                twitterSentiment,
                platformDiff,
                synthesis,
                critique,
                confidenceScore,
                debateTriggered,
                executionTrace,
                null,
                null,
                null,
                null,
                null,
                null,
                null,
                null,
                null,
                null
        );
    }
}
