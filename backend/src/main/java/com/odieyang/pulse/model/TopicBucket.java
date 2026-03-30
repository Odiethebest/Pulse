package com.odieyang.pulse.model;

import java.util.List;

public record TopicBucket(
        String topicId,
        String topicName,
        List<CrawledPost> posts
) {}
