package com.odieyang.pulse.model;

public record RevisionAnchor(
        String anchorId,
        String section,
        String title,
        String detail,
        String relatedClaimId
) {}
