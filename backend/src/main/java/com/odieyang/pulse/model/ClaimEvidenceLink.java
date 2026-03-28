package com.odieyang.pulse.model;

import java.util.List;

public record ClaimEvidenceLink(
        String claimId,
        String claim,
        List<String> evidenceUrls
) {}
