package com.odieyang.pulse.model;

import java.util.List;

public record CriticResult(
        List<String> unsupportedClaims,
        List<String> biasConcerns,
        boolean exceedsDataScope,
        int confidenceScore,
        String revisionSuggestions,
        List<String> evidenceGaps,
        List<String> deltaHighlights,
        List<String> fluffFindings,
        Integer informationDensityScore,
        Integer claimEvidenceCoverage
) {
    public CriticResult(
            List<String> unsupportedClaims,
            List<String> biasConcerns,
            boolean exceedsDataScope,
            int confidenceScore,
            String revisionSuggestions,
            List<String> evidenceGaps,
            List<String> deltaHighlights
    ) {
        this(
                unsupportedClaims,
                biasConcerns,
                exceedsDataScope,
                confidenceScore,
                revisionSuggestions,
                evidenceGaps,
                deltaHighlights,
                null,
                null,
                null
        );
    }

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
                null,
                null,
                null,
                null
        );
    }
}
