package com.odieyang.pulse.model;

import java.util.List;

public record QueryPlan(
        List<String> redditQueries,
        List<String> twitterQueries,
        String topicSummary
) {}
