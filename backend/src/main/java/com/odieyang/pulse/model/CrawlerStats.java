package com.odieyang.pulse.model;

public record CrawlerStats(
        Integer targetTotal,
        Integer fetchedTotal,
        Integer redditCount,
        Integer twitterCount,
        Integer dedupedCount,
        Integer unassignedCount,
        Integer coveragePercent,
        String coverageLevel,
        java.util.List<String> coverageAlerts
) {}
