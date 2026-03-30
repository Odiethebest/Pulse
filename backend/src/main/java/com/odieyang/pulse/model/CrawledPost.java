package com.odieyang.pulse.model;

public record CrawledPost(
        String platform,
        String title,
        String snippet,
        String url
) {}
