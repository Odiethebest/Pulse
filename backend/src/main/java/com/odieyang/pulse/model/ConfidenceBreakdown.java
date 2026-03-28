package com.odieyang.pulse.model;

public record ConfidenceBreakdown(
        Integer coverage,
        Integer diversity,
        Integer agreement,
        Integer evidenceSupport,
        Integer stability
) {}
