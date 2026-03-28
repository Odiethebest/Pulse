package com.odieyang.pulse.agent;

import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

class SynthesisAgentFormattingTests {

    @Test
    @SuppressWarnings("unchecked")
    void collectCriticalViolationsShouldFlagKnownMachinePatterns() {
        SynthesisAgent agent = new SynthesisAgent(null, null);
        String invalidOutput = """
                ## Lead
                Public perception of there are growing concerns over this issue.

                ## Frontline Clash
                The conflict remains active.

                ## Top Controversies
                One topic dominates.

                ## Flip Risk Watch
                Heat sits at 45/100.

                ## Why It Matters
                Because this debate keeps escalating, it can shape wider narratives.

                ## Reporter Note
                Evidence sampled from posts. (fierce and explosive)
                """;

        List<String> violations = (List<String>) ReflectionTestUtils.invokeMethod(
                agent,
                "collectCriticalViolations",
                invalidOutput
        );

        assertFalse(violations.isEmpty());
        assertTrue(violations.stream().anyMatch(v -> v.toLowerCase().contains("raw score")));
        assertTrue(violations.stream().anyMatch(v -> v.toLowerCase().contains("trailing")));
        assertTrue(violations.stream().anyMatch(v -> v.toLowerCase().contains("frankenstein")));
    }

    @Test
    @SuppressWarnings("unchecked")
    void collectCriticalViolationsShouldPassCleanReporterOutput() {
        SynthesisAgent agent = new SynthesisAgent(null, null);
        String validOutput = """
                ## Lead
                The discourse around Steve Jobs remains split, and both camps cite concrete moments [Q1].

                ## Frontline Clash
                While supporters defend his long term product vision [Q2], critics focus on leadership costs [Q3].

                ## Top Controversies
                Leadership style and legacy framing remain the two main friction points.

                ## Flip Risk Watch
                The consensus is still fragile, and a new primary source could move neutral observers.

                ## Why It Matters
                This conflict shapes how future founders are judged in both business and culture coverage.

                ## Reporter Note
                Reddit discussions dissect management details while Twitter amplifies identity narratives.
                """;

        List<String> violations = (List<String>) ReflectionTestUtils.invokeMethod(
                agent,
                "collectCriticalViolations",
                validOutput
        );

        assertTrue(violations.isEmpty());
    }
}
