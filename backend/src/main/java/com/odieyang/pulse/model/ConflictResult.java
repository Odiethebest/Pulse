package com.odieyang.pulse.model;

import java.util.List;

public record ConflictResult(
        int heatScore,
        List<String> conflictDrivers,
        List<String> toxicSignals
) {}
