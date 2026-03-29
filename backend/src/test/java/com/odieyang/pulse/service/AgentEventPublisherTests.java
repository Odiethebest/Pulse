package com.odieyang.pulse.service;

import com.odieyang.pulse.model.AgentEvent;
import org.junit.jupiter.api.Test;
import reactor.core.Disposable;

import java.util.List;
import java.util.concurrent.CopyOnWriteArrayList;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

class AgentEventPublisherTests {

    @Test
    void runScopedStreamsShouldIsolateEventsAcrossRuns() throws Exception {
        AgentEventPublisher publisher = new AgentEventPublisher();
        String runA = "run-a";
        String runB = "run-b";
        publisher.registerRun(runA);
        publisher.registerRun(runB);

        List<AgentEvent> runAEvents = new CopyOnWriteArrayList<>();
        List<AgentEvent> runBEvents = new CopyOnWriteArrayList<>();
        List<AgentEvent> globalEvents = new CopyOnWriteArrayList<>();
        CountDownLatch latch = new CountDownLatch(4);

        Disposable runASub = publisher.stream(runA).subscribe(event -> {
            runAEvents.add(event);
            latch.countDown();
        });
        Disposable runBSub = publisher.stream(runB).subscribe(event -> {
            runBEvents.add(event);
            latch.countDown();
        });
        Disposable globalSub = publisher.stream().subscribe(event -> {
            globalEvents.add(event);
            latch.countDown();
        });

        publisher.withRunContext(runA, () -> {
            publisher.publish(AgentEvent.started("RunAAgent", "run a event"));
            return null;
        });
        publisher.withRunContext(runB, () -> {
            publisher.publish(AgentEvent.completed("RunBAgent", "run b event", 8));
            return null;
        });

        assertTrue(latch.await(1, TimeUnit.SECONDS), "Expected scoped and global streams to receive events");
        assertEquals(1, runAEvents.size());
        assertEquals("RunAAgent", runAEvents.getFirst().agentName());
        assertEquals(1, runBEvents.size());
        assertEquals("RunBAgent", runBEvents.getFirst().agentName());
        assertEquals(2, globalEvents.size());

        runASub.dispose();
        runBSub.dispose();
        globalSub.dispose();
        publisher.unregisterRun(runA);
        publisher.unregisterRun(runB);
    }
}
