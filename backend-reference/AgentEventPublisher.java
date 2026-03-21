package com.odieyang.pulse.service;

import com.odieyang.pulse.model.AgentEvent;
import org.springframework.stereotype.Component;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Sinks;

@Component
public class AgentEventPublisher {

    private final Sinks.Many<AgentEvent> sink =
            Sinks.many().multicast().onBackpressureBuffer();

    public void publish(AgentEvent event) {
        sink.tryEmitNext(event);
    }

    public Flux<AgentEvent> stream() {
        return sink.asFlux();
    }
}
