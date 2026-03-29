package com.odieyang.pulse.service;

import com.odieyang.pulse.model.AgentEvent;
import org.springframework.stereotype.Component;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Sinks;

import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ConcurrentMap;
import java.util.function.Supplier;

@Component
public class AgentEventPublisher {

    private final Sinks.Many<AgentEvent> globalSink =
            Sinks.many().multicast().onBackpressureBuffer();
    private final ConcurrentMap<String, Sinks.Many<AgentEvent>> runSinks = new ConcurrentHashMap<>();
    private final ThreadLocal<String> activeRunId = new ThreadLocal<>();

    public void publish(AgentEvent event) {
        globalSink.tryEmitNext(event);

        String runId = activeRunId.get();
        if (runId == null) {
            return;
        }
        Sinks.Many<AgentEvent> runSink = runSinks.get(runId);
        if (runSink != null) {
            runSink.tryEmitNext(event);
        }
    }

    public Flux<AgentEvent> stream() {
        return globalSink.asFlux();
    }

    public Flux<AgentEvent> stream(String runId) {
        if (runId == null || runId.isBlank()) {
            return stream();
        }
        return runSinks
                .computeIfAbsent(runId, ignored -> Sinks.many().multicast().onBackpressureBuffer())
                .asFlux();
    }

    public void registerRun(String runId) {
        if (runId == null || runId.isBlank()) {
            return;
        }
        runSinks.computeIfAbsent(runId, ignored -> Sinks.many().multicast().onBackpressureBuffer());
    }

    public void unregisterRun(String runId) {
        if (runId == null || runId.isBlank()) {
            return;
        }
        Sinks.Many<AgentEvent> removed = runSinks.remove(runId);
        if (removed != null) {
            removed.tryEmitComplete();
        }
    }

    public <T> T withRunContext(String runId, Supplier<T> action) {
        if (runId == null || runId.isBlank()) {
            return action.get();
        }

        String previousRunId = activeRunId.get();
        activeRunId.set(runId);
        try {
            return action.get();
        } finally {
            if (previousRunId == null) {
                activeRunId.remove();
            } else {
                activeRunId.set(previousRunId);
            }
        }
    }
}
