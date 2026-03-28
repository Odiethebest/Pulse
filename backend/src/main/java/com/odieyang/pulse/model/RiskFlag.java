package com.odieyang.pulse.model;

public record RiskFlag(
        String flagId,
        String section,
        String severity,
        String label,
        String message,
        String relatedClaimId
) {}
