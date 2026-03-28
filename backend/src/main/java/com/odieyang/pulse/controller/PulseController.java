package com.odieyang.pulse.controller;

import com.odieyang.pulse.model.AgentEvent;
import com.odieyang.pulse.model.PulseReport;
import com.odieyang.pulse.orchestrator.PulseOrchestrator;
import com.odieyang.pulse.service.AgentEventPublisher;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.*;
import reactor.core.publisher.Flux;

@RestController
@RequestMapping({"/pulse", "/api/pulse"})
@RequiredArgsConstructor
public class PulseController {

    private static final Logger log = LoggerFactory.getLogger(PulseController.class);

    private final PulseOrchestrator orchestrator;
    private final AgentEventPublisher publisher;

    @PostMapping("/analyze")
    public PulseReport analyze(@RequestBody AnalyzeRequest request) {
        log.info("POST /pulse/analyze (or /api/pulse/analyze) topic='{}'", request.topic());
        return orchestrator.analyze(request.topic());
    }

    @GetMapping(value = "/stream", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    public Flux<AgentEvent> stream() {
        return publisher.stream();
    }

    record AnalyzeRequest(String topic) {}
}
