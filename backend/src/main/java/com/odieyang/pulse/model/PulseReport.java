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
        List<AgentEvent> executionTrace
) {}
