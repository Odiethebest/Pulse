package com.odieyang.pulse.model;

import java.util.List;

public record CriticResult(
        List<String> unsupportedClaims,
        List<String> biasConcerns,
        boolean exceedsDataScope,
        int confidenceScore,
        String revisionSuggestions,
        List<String> evidenceGaps,
        List<String> deltaHighlights
) {
    public CriticResult(
            List<String> unsupportedClaims,
            List<String> biasConcerns,
            boolean exceedsDataScope,
            int confidenceScore,
            String revisionSuggestions
    ) {
        this(
                unsupportedClaims,
                biasConcerns,
                exceedsDataScope,
                confidenceScore,
                revisionSuggestions,
                null,
                null
        );
    }
}
