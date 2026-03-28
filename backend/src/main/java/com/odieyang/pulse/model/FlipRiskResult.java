package com.odieyang.pulse.model;

import java.util.List;

public record FlipRiskResult(
        int flipRiskScore,
        List<FlipSignal> signals,
        List<String> rationale
) {}
