package com.odieyang.pulse.model;

public record Quote(
        String text,
        String url,
        String sentiment
) {}
