# Pulse Testing and Quality

## Quality target

Keep query to report behavior stable while preserving evidence quality, crawler precision, citation correctness, and mobile desktop isolation.

## Test topology

### Backend tests

Location:
`backend/src/test/java/com/odieyang/pulse`

Core suites:

1. `orchestrator/PulseOrchestratorV2Tests.java`
2. `controller/PulseControllerV2Tests.java`
3. `model/PulseReportSerializationTests.java`
4. `agent/TwitterAgentTests.java`
5. `agent/SynthesisAgentFormattingTests.java`
6. `service/AgentEventPublisherTests.java`
7. `PublicOpinionAnalysisSystemApplicationTests.java`

### Frontend tests

Locations:

1. `frontend/src/components/__tests__`
2. `frontend/src/hooks/__tests__/usePulseV2.test.js`
3. `frontend/src/lib/__tests__`

## Risk to test mapping

### Orchestrator flow and degradation

1. Parallel fetch and assembly
   `analyzeShouldFetchPlatformsInParallelAndAssembleV2Report`
2. Optional agent fallback
   `analyzeShouldFallbackWhenOptionalAgentsFail`
3. Single platform failure degradation
   `analyzeShouldDegradeWhenRedditFetchFailsButTwitterStillWorks`
4. Revision failure fallback
   `analyzeShouldFallbackToInitialSynthesisWhenRevisionFails`
5. Rewrite gate
   `analyzeShouldTriggerRewriteWhenQualityGateFails`

File:
`PulseOrchestratorV2Tests.java`

### Crawler precision and merge quality

1. Noise tightening
   `analyzeShouldTightenNoisyCrawlerPostsByRelevance`
2. Strict gate and platform cap
   `analyzeShouldApplyStrictGateAndPlatformCapForHighRelevanceOnly`
3. Global top relevance ordering
   `analyzeShouldPreferGlobalTopRelevanceInsteadOfArrivalOrder`
4. Top16 target and coverage
   `analyzeShouldMeetPhase4CoverageTargetsAtTop16`
5. Noise reduction and topic consistency
   `analyzeShouldQuantifyLowerNoiseAndHigherTopicConsistency`

File:
`PulseOrchestratorV2Tests.java`

### Citation anti pattern and stability

1. Citation diversity in quick take
   `quickTakeShouldSpreadCitationsBeyondFirstTwoSources`
2. Fixed offset legacy pattern guard
   `quickTakeShouldAvoidLegacyFixedOffsetCitationPairing`
3. Mechanical pairing repair
   `quickTakeShouldRepairMechanicalPairingWhenFirstTwoClaimsAlignByOffset`
4. Mechanical pairing rewrite verification
   `mechanicalPairingGuardShouldRewriteSecondClaimWhenOffsetPatternDetected`
5. Cross run citation stability
   `analyzeShouldKeepTopCitationsStableAndSemanticallyAlignedAcrossRuns`

File:
`PulseOrchestratorV2Tests.java`

### Synthesis format and prompt validation

1. Machine pattern detection
   `collectCriticalViolationsShouldFlagKnownMachinePatterns`
2. Clean output pass
   `collectCriticalViolationsShouldPassCleanReporterOutput`
3. Frontline pool exposure in prompt
   `buildUserPromptShouldExposeLeadAndFrontlineCandidatePools`
4. Frontline fixed offset detection
   `collectCriticalViolationsShouldFlagFrontlineFixedOffsetPairing`

File:
`backend/src/test/java/com/odieyang/pulse/agent/SynthesisAgentFormattingTests.java`

### API contract and serialization compatibility

1. Controller V2 contract fields
   `analyzeShouldReturnV2ContractFields`
2. Locale field compatibility
   `analyzeShouldAcceptLocaleField`
3. V2 field serialization
   `shouldSerializeV2FieldsWithoutLosingData`
4. Crawler field deserialization
   `shouldDeserializeCrawlerContractFields`
5. V1 payload backward compatibility
   `shouldDeserializeV1PayloadWithV2FieldsAsNull`

Files:

1. `PulseControllerV2Tests.java`
2. `PulseReportSerializationTests.java`

### Event stream isolation

1. Per run scoped event isolation
   `runScopedStreamsShouldIsolateEventsAcrossRuns`

File:
`backend/src/test/java/com/odieyang/pulse/service/AgentEventPublisherTests.java`

### Frontend state and transport

1. Full run state convergence
   `completes V2 state flow and converges after SSE events`
2. Analyze failure transition
   `falls back to error state when analyze request fails`
3. Cancel behavior with late response ignore
   `cancels active run and ignores late analyze result`

File:
`frontend/src/hooks/__tests__/usePulseV2.test.js`

### Frontend component and mapper behavior

1. Theater mobile desktop isolation
   `AgentTheaterLoading.test.jsx`
2. Controversy filters and progressive disclosure
   `ControversyAccordion.test.jsx`
3. Citation chip interaction
   `SemanticSourceChip.test.jsx`
4. Source order normalization
   `apiCitationSources.test.js`
5. Report citation alignment
   `apiNormalizeReport.test.js`
6. Mapper real quote enforcement and shell filtering
   `controversyMapper.test.js`

## Mandatory gate before merge

1. `cd backend && ./mvnw test`
2. `cd frontend && npm test`
3. `cd frontend && npm run build`

For any change in crawler, citation, or mobile theater behavior, add or update targeted regression tests in the same PR.

## Manual regression checklist

Use at least three real query topics:

1. High volume mainstream topic
2. Long tail niche topic
3. Topic likely to attract noise or shell pages

For each run verify:

1. `allPosts` count does not exceed current target.
2. `crawlerStats` alerts and coverage are reasonable for the topic.
3. Frontline citations map to valid source chips.
4. Controversy cards are source grounded and semantically relevant.
5. Mobile bottom of report remains visible and scrollable.

## Test authoring rules

1. Reproduce bug with a failing test first when practical.
2. Extend existing suite before creating a new test file.
3. Keep test names behavior focused and scenario specific.
4. For contract changes, update both backend serialization tests and frontend normalization tests.
