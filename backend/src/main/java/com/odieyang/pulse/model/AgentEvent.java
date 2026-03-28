package com.odieyang.pulse.model;

import java.time.Instant;

public record AgentEvent(
        String agentName,
        String status,
        String summary,
        long durationMs,
        Instant timestamp
) {
    public static AgentEvent started(String agentName, String summary) {
        return new AgentEvent(agentName, "STARTED", summary, 0, Instant.now());
    }

    public static AgentEvent completed(String agentName, String summary, long durationMs) {
        return new AgentEvent(agentName, "COMPLETED", summary, durationMs, Instant.now());
    }

    public static AgentEvent failed(String agentName, String summary, long durationMs) {
        return new AgentEvent(agentName, "FAILED", summary, durationMs, Instant.now());
    }
}
