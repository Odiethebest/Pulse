package com.odieyang.pulse.model;

public record ClaimAnnotation(
        String annotationId,
        String section,
        String claimId,
        String note,
        String criticMessage,
        String anchorId
) {}
