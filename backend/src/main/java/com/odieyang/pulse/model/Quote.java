package com.odieyang.pulse.model;

public record Quote(
        String text,
        String url,
        String sentiment,
        String camp,
        Double evidenceWeight
) {
    public Quote(String text, String url, String sentiment) {
        this(text, url, sentiment, null, null);
    }
}
