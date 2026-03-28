package com.odieyang.pulse.model;

public record FlipSignal(
        String signal,
        Integer severity,
        String summary
) {}
