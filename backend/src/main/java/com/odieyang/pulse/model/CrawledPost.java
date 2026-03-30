package com.odieyang.pulse.model;

public record CrawledPost(
        String platform,
        String title,
        String snippet,
        String url,
        Integer evidenceScore,
        Integer recencyScore,
        Integer sortScore,
        String classificationMethod
) {
    public CrawledPost(
            String platform,
            String title,
            String snippet,
            String url
    ) {
        this(platform, title, snippet, url, null, null, null, null);
    }
}
