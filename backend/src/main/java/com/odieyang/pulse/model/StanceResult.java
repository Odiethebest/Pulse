package com.odieyang.pulse.model;

import java.util.List;

public record StanceResult(
        double supportRatio,
        double opposeRatio,
        double neutralRatio,
        List<String> supportArguments,
        List<String> opposeArguments,
        List<String> neutralArguments
) {
    public CampDistribution toCampDistribution() {
        double support = sanitizeRatio(supportRatio);
        double oppose = sanitizeRatio(opposeRatio);
        double neutral = sanitizeRatio(neutralRatio);
        double total = support + oppose + neutral;
        if (total <= 0) {
            return new CampDistribution(0.0, 0.0, 1.0);
        }
        return new CampDistribution(support / total, oppose / total, neutral / total);
    }

    private double sanitizeRatio(double value) {
        if (Double.isNaN(value) || Double.isInfinite(value)) {
            return 0.0;
        }
        return Math.max(0.0, Math.min(1.0, value));
    }
}
