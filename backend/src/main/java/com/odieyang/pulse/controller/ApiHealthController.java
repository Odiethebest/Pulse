package com.odieyang.pulse.controller;

import lombok.RequiredArgsConstructor;
import org.springframework.boot.actuate.health.HealthComponent;
import org.springframework.boot.actuate.health.HealthEndpoint;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequiredArgsConstructor
public class ApiHealthController {

    private final HealthEndpoint healthEndpoint;

    @GetMapping("/api/actuator/health")
    public HealthComponent health() {
        return healthEndpoint.health();
    }
}
