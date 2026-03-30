package com.odieyang.pulse.agent;

import com.odieyang.pulse.model.CampDistribution;
import com.odieyang.pulse.model.ControversyTopic;
import com.odieyang.pulse.model.Quote;
import com.odieyang.pulse.model.RawPost;
import com.odieyang.pulse.model.RawPosts;
import com.odieyang.pulse.model.SentimentResult;
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

    @Test
    void buildUserPromptShouldRankEvidenceSourcesByValueAcrossPlatforms() {
        SynthesisAgent agent = new SynthesisAgent(null, null);
        RawPosts reddit = new RawPosts("reddit", List.of(
                new RawPost("Reddit title", "General comments about awards.", "https://reddit.com/r/1")
        ));
        RawPosts twitter = new RawPosts("twitter", List.of(
                new RawPost("Twitter title", "Fans debate Taylor Swift and Ed Sheeran friendship.", "https://x.com/1")
        ));

        SentimentResult redditSentiment = new SentimentResult(
                "reddit",
                0.4,
                0.4,
                0.2,
                List.of("awards"),
                List.of(new Quote(
                        "People discuss music awards in broad terms.",
                        "https://reddit.com/r/1",
                        "neutral",
                        "neutral",
                        0.95
                )),
                new CampDistribution(0.4, 0.4, 0.2),
                List.of(new ControversyTopic("awards", 55, "award-related opinions"))
        );
        SentimentResult twitterSentiment = new SentimentResult(
                "twitter",
                0.5,
                0.3,
                0.2,
                List.of("friendship dynamics"),
                List.of(new Quote(
                        "Taylor Swift and Ed Sheeran friendship still sparks debate.",
                        "https://x.com/1",
                        "neutral",
                        "neutral",
                        0.70
                )),
                new CampDistribution(0.5, 0.3, 0.2),
                List.of(new ControversyTopic("friendship dynamics", 70, "friendship discourse"))
        );

        String prompt = (String) ReflectionTestUtils.invokeMethod(
                agent,
                "buildUserPrompt",
                reddit,
                twitter,
                redditSentiment,
                twitterSentiment,
                null,
                "Taylor Swift and Ed Sheeran friendship"
        );

        assertTrue(prompt.contains("Source [1]: (Twitter/X)"),
                "Expected top-ranked source to be selected by value, not platform block order");
    }
}
