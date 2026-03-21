package com.odieyang.pulse.model;

import java.util.List;

public record CriticResult(
        List<String> unsupportedClaims,
        List<String> biasConcerns,
        boolean exceedsDataScope,
        int confidenceScore,
        String revisionSuggestions
) {}
