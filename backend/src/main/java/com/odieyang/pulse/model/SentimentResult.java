package com.odieyang.pulse.model;

import java.util.List;

public record SentimentResult(
        String platform,
        double positiveRatio,
        double negativeRatio,
        double neutralRatio,
        List<String> mainControversies,
        List<Quote> representativeQuotes
) {}
