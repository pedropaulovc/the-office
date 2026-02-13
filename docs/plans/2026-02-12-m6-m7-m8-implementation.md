# M6/M7/M8 Implementation Plan (S-6.2 through S-8.7)

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Implement the remaining evaluation, correction, and experiment infrastructure — 19 stories spanning persona drift measurement (M6), correction (M7), and evaluation harness (M8).

**Architecture:** Each story builds on the previous. Stories are implemented sequentially with dedicated feature branches chained off each other. Agent teams handle analysis, implementation, review, and testing in parallel within each story. All stories follow TDD: write E2E test + unit tests first, then implement.

**Tech Stack:** TypeScript, Drizzle ORM, Next.js API routes, Claude Haiku (LLM judge), Vitest (unit), Playwright (E2E), Sentry telemetry.

---

## Branching Strategy

Each story gets its own feature branch, chained sequentially:

```
main
 └── feature/s-6.2-consistency-scorer
      └── feature/s-6.3-fluency-scorer
           └── feature/s-6.4-convergence-scorer
                └── feature/s-6.6-ideas-quantity-scorer
                     └── feature/s-6.5-baseline-capture
                          └── feature/s-7.0a-action-quality-check
                               └── feature/s-7.0b-correction-pipeline
                                    └── feature/s-7.1a-intervention-framework
                                         └── feature/s-7.1b-built-in-interventions
                                              └── feature/s-7.2-repetition-suppression
                                                   └── feature/s-7.3-correction-config
                                                        └── feature/s-8.0-proposition-library
                                                             └── feature/s-8.1-eval-harness-cli
                                                                  └── feature/s-8.2-golden-baselines
                                                                       └── feature/s-8.3-ci-integration
                                                                            └── feature/s-8.4-agent-factory
                                                                                 └── feature/s-8.5-scenario-library
                                                                                      └── feature/s-8.6-experiment-runner
                                                                                           └── feature/s-8.7-table1-reproduction
```

Each story: branch → implement → E2E 10x local → PR → next branch off previous.

## Team Structure (per story)

Each story uses an agent team with these roles:
- **lead**: Coordinator — creates tasks, assigns work, reviews, runs final verification
- **implementer**: Writes production code (scorer, API routes, DB schema)
- **tester**: Writes E2E tests, unit tests, runs 10x stress test
- **reviewer**: Code review after implementation, checks patterns/telemetry/types

## E2E Testing Strategy

Every story must have an E2E test that:
1. Exercises the API endpoint(s) created/modified
2. Verifies database persistence
3. Cleans up after itself (DELETE endpoints)
4. Runs in < 5 seconds per test case
5. Passes 10x sequentially without retries locally
6. Passes 2x in CI/CD

For scorer stories (S-6.2 through S-6.6), E2E tests hit the scorer API endpoint with real data and verify score structure/ranges. For M7 stories, E2E tests verify the correction pipeline through the send_message flow. For M8 stories, E2E tests verify CLI output and harness behavior.

## Manual Demo Strategy

Every story must have a Playwright-based demo plan. Demos use the `playwright-cli` skill in headed mode to:
1. Navigate to relevant UI pages (if applicable)
2. Hit API endpoints and show responses
3. Verify database state
4. For scorer stories: show scoring results in a meaningful way

---

## Story Details

---

### Story 1: S-6.2 Self-Consistency Scorer

**Branch:** `feature/s-6.2-consistency-scorer` off `main`

**Goal:** Measure whether an agent's current behavior is consistent with its own past behavior by comparing current vs. historical message pairs.

**Files to create:**
- `src/features/evaluation/scorers/consistency.ts` — `scoreConsistency(agentId, currentWindow, historicalWindow)`
- `src/features/evaluation/propositions/consistency/_default.yaml` — Default consistency propositions
- `src/features/evaluation/scorers/__tests__/consistency.test.ts` — Unit tests
- `e2e/consistency-scorer.spec.ts` — E2E test
- `src/app/api/evaluations/consistency/route.ts` — POST endpoint

**Key implementation details:**
- Pulls messages from `run_messages` for both current and historical windows
- Groups by channel to find comparable contexts
- Samples up to 10 message pairs
- LLM judge scores paired messages with `include_personas: false`
- Returns null (not evaluable) when no historical messages exist
- Follow same pattern as `scorers/adherence.ts`

**Proposition YAML (`consistency/_default.yaml`):**
```yaml
dimension: consistency
include_personas: false
target_type: agent
first_n: 10
last_n: 100
propositions:
  - id: consistent-tone
    claim: "{{agent_name}}'s recent messages maintain a consistent tone with their earlier messages"
    weight: 1.0
  - id: consistent-vocabulary
    claim: "{{agent_name}} uses similar vocabulary and speech patterns across both time periods"
    weight: 0.9
  - id: consistent-behavior
    claim: "{{agent_name}} reacts to similar situations in a consistent manner across both time periods"
    weight: 0.8
```

**E2E test approach:**
- POST `/api/evaluations/consistency` with `{ agentId: "michael" }`
- Verify 201 response with evaluationRunId, overallScore (0-9), sampleSize > 0
- Verify persisted run via GET `/api/evaluations/{runId}`
- Cleanup via DELETE
- Test 400 for missing agentId
- Test cold-start: agent with no historical messages returns null score

**Demo plan (Playwright):**
1. Hit POST `/api/evaluations/consistency` for michael
2. Show score result with per-proposition breakdowns
3. Hit GET `/api/evaluations/{runId}` to show persisted data
4. Show that scores are in valid 0-9 range

---

### Story 2: S-6.3 Fluency Scorer

**Branch:** `feature/s-6.3-fluency-scorer` off `feature/s-6.2-consistency-scorer`

**Goal:** Detect repetitive language patterns and formulaic responses using n-gram analysis + LLM judge.

**Files to create:**
- `src/features/evaluation/scorers/fluency.ts` — `scoreFluency(agentId, timeWindow)`
- `src/features/evaluation/utils/ngram.ts` — `extractNgrams()`, `computeOverlap()`, `computeCorpusRepetition()`
- `src/features/evaluation/propositions/fluency/_default.yaml` — Fluency propositions
- `src/features/evaluation/scorers/__tests__/fluency.test.ts` — Unit tests
- `src/features/evaluation/utils/__tests__/ngram.test.ts` — N-gram unit tests
- `e2e/fluency-scorer.spec.ts` — E2E test
- `src/app/api/evaluations/fluency/route.ts` — POST endpoint

**Key implementation details:**
- N-gram utils are pure TypeScript, no LLM call
- `extractNgrams(text, n)`: tokenize → sliding window of size n → Set of n-gram strings
- `computeOverlap(a, b)`: Jaccard similarity of two n-gram sets
- `computeCorpusRepetition(messages, n)`: average pairwise overlap across all message pairs
- `scoreFluency()`: pull messages → compute 3-gram and 5-gram stats → feed messages + stats to LLM judge
- Judge prompt includes n-gram statistics as supplementary evidence
- `include_personas: false`

**E2E test approach:**
- POST `/api/evaluations/fluency` with `{ agentId: "michael" }`
- Verify 201 with valid score structure
- Verify n-gram statistics included in response metadata
- Cleanup via DELETE

**Demo plan:**
1. Hit fluency endpoint for michael
2. Show score and n-gram statistics
3. Compare with another agent

---

### Story 3: S-6.4 Convergence/Divergence Scorer

**Branch:** `feature/s-6.4-convergence-scorer` off `feature/s-6.3-fluency-scorer`

**Goal:** Measure whether agents in group conversations maintain distinct voices or converge to similar styles. Environment-level evaluation.

**Files to create:**
- `src/features/evaluation/scorers/convergence.ts` — `scoreConvergence(channelId, timeWindow)`
- `src/features/evaluation/utils/text-stats.ts` — `computeVocabularyStats()`
- `src/features/evaluation/propositions/convergence/_default.yaml` — Convergence propositions
- `src/features/evaluation/scorers/__tests__/convergence.test.ts` — Unit tests
- `src/features/evaluation/utils/__tests__/text-stats.test.ts` — Text stats unit tests
- `e2e/convergence-scorer.spec.ts` — E2E test
- `src/app/api/evaluations/convergence/route.ts` — POST endpoint

**Key implementation details:**
- Environment-level: `target_type: environment`, evaluates full channel conversation
- `computeVocabularyStats()`: unique word ratio, avg sentence length, punctuation density per agent
- Pairwise vocabulary similarity between all agent pairs (Jaccard on unique words)
- LLM judge receives full conversation trajectory (all agents' messages in order)
- `include_personas: false`
- Returns single divergence score (0-9) + per-agent-pair similarity metrics as metadata

**E2E test approach:**
- POST `/api/evaluations/convergence` with `{ channelId: "general" }`
- Verify 201 with divergence score (0-9)
- Verify vocabulary stats and pair metrics in response
- Cleanup via DELETE

---

### Story 4: S-6.6 Ideas Quantity Scorer

**Branch:** `feature/s-6.6-ideas-quantity-scorer` off `feature/s-6.4-convergence-scorer`

**Goal:** Count distinct ideas proposed by agents in a conversation. Returns integer count, not 0-9 score.

**Files to create:**
- `src/features/evaluation/scorers/ideas-quantity.ts` — `scoreIdeasQuantity(channelId, timeWindow)`
- `src/features/evaluation/propositions/ideas_quantity/_default.yaml` — Ideas quantity prompt
- `src/features/evaluation/scorers/__tests__/ideas-quantity.test.ts` — Unit tests
- `e2e/ideas-quantity-scorer.spec.ts` — E2E test
- `src/app/api/evaluations/ideas-quantity/route.ts` — POST endpoint

**Key implementation details:**
- Environment-level: `target_type: environment`, `include_personas: false`
- LLM judge enumerates distinct ideas from conversation
- Returns integer count + list of identified ideas with descriptions
- Duplicate/overlapping ideas collapsed by the judge
- Different from other scorers: count, not 0-9 score
- Uses a specific output schema for structured extraction

**E2E test approach:**
- POST `/api/evaluations/ideas-quantity` with `{ channelId: "general" }`
- Verify 201 with count (integer >= 0) and ideas list
- Verify each idea has description
- Cleanup via DELETE

---

### Story 5: S-6.5 Baseline Capture

**Branch:** `feature/s-6.5-baseline-capture` off `feature/s-6.6-ideas-quantity-scorer`

**Goal:** Run all 5 scorers against agents and store baseline scores for comparison.

**Files to create:**
- `src/features/evaluation/scripts/capture-baseline.ts` — CLI script
- `src/features/evaluation/scripts/sample-prompts.ts` — Canned prompts for synthetic conversations
- `src/features/evaluation/baseline.ts` — `captureBaseline()`, `getBaseline()`, `compareToBaseline()`
- `src/app/api/evaluations/baselines/route.ts` — GET list, POST trigger
- `src/app/api/evaluations/baselines/[agentId]/route.ts` — GET single agent baseline
- `src/features/evaluation/__tests__/baseline.test.ts` — Unit tests
- `e2e/baseline-capture.spec.ts` — E2E test

**Files to modify:**
- `package.json` — Add `eval:baseline` script

**Key implementation details:**
- `captureBaseline(agentId)` runs all 5 scorers, marks run with `is_baseline = true`
- For agents with < 10 messages, uses sample prompts (synthetic generation)
- `compareToBaseline()` returns delta per dimension
- Idempotent: re-running replaces previous baseline
- CLI supports `--agents michael,dwight` filtering

**E2E test approach:**
- POST `/api/evaluations/baselines` with `{ agentId: "michael" }`
- Verify baseline created with `is_baseline: true`
- GET `/api/evaluations/baselines/michael` returns scores
- GET `/api/evaluations/baselines` lists all baselines
- Cleanup

---

### Story 6: S-7.0a Action Quality Check & Similarity

**Branch:** `feature/s-7.0a-action-quality-check` off `feature/s-6.5-baseline-capture`

**Goal:** Build the multi-dimension quality check function and Jaccard action similarity for the correction gate.

**Files to create:**
- `src/features/evaluation/gates/action-correction.ts` — `checkActionQuality(agentId, messageText, context)`
- `src/features/evaluation/gates/action-similarity.ts` — `computeActionSimilarity(proposedText, recentMessages)`
- `src/features/evaluation/gates/types.ts` — Gate types
- `src/features/evaluation/gates/__tests__/action-correction.test.ts` — Unit tests
- `src/features/evaluation/gates/__tests__/action-similarity.test.ts` — Unit tests
- `e2e/action-quality-check.spec.ts` — E2E test
- `src/app/api/evaluations/quality-check/route.ts` — POST endpoint (for testing)

**Key implementation details:**
- Four quality dimensions: persona_adherence, self_consistency, fluency, suitability
- Each dimension independently scored 0-9 via action-level propositions
- Action-level trajectory windows: `first_n: 5, last_n: 10` (narrower than offline)
- `computeActionSimilarity()`: Jaccard similarity on tokenized words vs. last 5 messages
- Each dimension individually enable/disable via config (S-7.3)
- No-op when all checks disabled

**E2E test approach:**
- POST `/api/evaluations/quality-check` with agent message and context
- Verify per-dimension scores returned (0-9)
- Verify similarity score returned (0-1)
- Verify overall pass/fail based on thresholds

---

### Story 7: S-7.0b Two-Stage Correction Pipeline

**Branch:** `feature/s-7.0b-correction-pipeline` off `feature/s-7.0a-action-quality-check`

**Goal:** Implement the regeneration + direct correction pipeline, integrate into send_message tool.

**Files to create:**
- `src/features/evaluation/gates/direct-correction.ts` — `directCorrect(messageText, feedback, context)`
- `src/tests/factories/bad-action-injector.ts` — `BadActionInjector` test utility
- `src/features/evaluation/gates/__tests__/direct-correction.test.ts` — Unit tests
- `e2e/correction-pipeline.spec.ts` — E2E test

**Files to modify:**
- `src/tools/send-message.ts` — Add pre-commit gate before `createMessage()`
- `src/db/schema/evaluations.ts` — Add `correction_logs` table
- `src/db/schema/index.ts` — Export correction_logs
- `src/features/evaluation/gates/action-correction.ts` — Add two-stage pipeline orchestration + statistics

**Key implementation details:**
- Stage 1 (Regeneration): Discard tool call, return feedback to agent, agent retries
- Stage 2 (Direct Correction): LLM rewrites action text directly
- Best-scoring = highest SUM of all dimension scores across ALL attempts
- `continue_on_failure: true` (default) = commit best attempt even if failing
- `correction_logs` table records every gate invocation
- `getGateStatistics(agentId, timeWindow)` aggregates statistics
- `BadActionInjector`: generates deliberate persona violations for testing
- 5-second timeout per dimension, fail-open

**E2E test approach:**
- Send a message through the API that triggers the correction gate
- Verify `correction_logs` entries created
- Verify message eventually committed (fail-open)
- Test with quality checks disabled (no-op passthrough)

---

### Story 8: S-7.1a Intervention Framework Core

**Branch:** `feature/s-7.1a-intervention-framework` off `feature/s-7.0b-correction-pipeline`

**Goal:** Build the `Intervention` class with composable preconditions, effects, and chaining API.

**Files to create:**
- `src/features/evaluation/interventions/intervention.ts` — `Intervention` class + `InterventionBatch`
- `src/features/evaluation/interventions/preconditions.ts` — Three precondition types
- `src/features/evaluation/interventions/types.ts` — Intervention types
- `src/features/evaluation/interventions/__tests__/intervention.test.ts` — Unit tests
- `src/features/evaluation/interventions/__tests__/preconditions.test.ts` — Unit tests
- `e2e/intervention-framework.spec.ts` — E2E test
- `src/app/api/evaluations/interventions/route.ts` — GET logs, POST test intervention

**Files to modify:**
- `src/db/schema/evaluations.ts` — Add `intervention_logs` table

**Key implementation details:**
- Fluent chaining API: `.setTextualPrecondition()`, `.setFunctionalPrecondition()`, `.setPropositionalPrecondition()`, `.setEffect()`
- Three precondition types combined with AND logic
- Textual: creates one-off Proposition and calls `.check()` (boolean)
- Functional: `(targets) => boolean`
- Propositional: M6 Proposition with optional score threshold (inverted logic)
- `InterventionBatch.createForEach(agents)` creates per-agent interventions
- `intervention_logs` table records every evaluation

**E2E test approach:**
- POST `/api/evaluations/interventions` to test an intervention evaluation
- Verify intervention_logs entry created
- Verify precondition results logged correctly
- Verify effect fires only when all preconditions true

---

### Story 9: S-7.1b Built-in Interventions & Orchestrator Integration

**Branch:** `feature/s-7.1b-built-in-interventions` off `feature/s-7.1a-intervention-framework`

**Goal:** Anti-convergence and variety interventions, wired into orchestrator + prompt-builder.

**Files to create:**
- `src/features/evaluation/interventions/anti-convergence.ts`
- `src/features/evaluation/interventions/variety-intervention.ts`
- `src/features/evaluation/interventions/nudge-templates.ts`
- `src/features/evaluation/interventions/__tests__/anti-convergence.test.ts`
- `src/features/evaluation/interventions/__tests__/variety-intervention.test.ts`
- `e2e/interventions-integration.spec.ts` — E2E test

**Files to modify:**
- `src/agents/prompt-builder.ts` — Accept optional `interventions` parameter, append nudge section
- `src/agents/orchestrator.ts` — Evaluate interventions before agent acts

**Key implementation details:**
- Anti-convergence: LLM-based textual precondition detects agreement patterns
- Variety: functional (messageCount >= N) AND textual ("not proposing new ideas")
- Nudge templates are character-aware (Michael: "tell a story", Dwight: "assert authority")
- Nudges are transient — appended to system prompt, NOT stored in memory
- Interventions evaluated once per orchestrator step, BEFORE agents act
- Only fire for channel messages (not DMs) unless explicitly configured

**E2E test approach:**
- Configure intervention for an agent via API
- Send message to trigger agent response
- Verify intervention_logs show evaluation
- Verify nudge text appears in prompt (via system prompt inspection in run_messages)

---

### Story 10: S-7.2 Repetition Suppression

**Branch:** `feature/s-7.2-repetition-suppression` off `feature/s-7.1b-built-in-interventions`

**Goal:** Detect and prevent step repetition by injecting agent's recent messages as context.

**Files to create:**
- `src/features/evaluation/interventions/repetition-suppression.ts` — `checkRepetition()`, `buildRepetitionContext()`
- `src/features/evaluation/interventions/__tests__/repetition-suppression.test.ts`
- `e2e/repetition-suppression.spec.ts`

**Files to modify:**
- `src/agents/prompt-builder.ts` — Accept `repetitionContext` parameter
- `src/agents/orchestrator.ts` — Call `checkRepetition()` before agent invocation

**Key implementation details:**
- Fetches last 5 messages across all channels from `run_messages`
- Uses 3-gram overlap from S-6.3 utilities
- If overlap > threshold (0.3), injects suppression context into system prompt
- No LLM call — purely algorithmic
- Context is additive to system prompt, not replacing existing sections

**E2E test approach:**
- Verify repetition detection via API (POST with sample messages)
- Verify suppression context format
- Verify prompt injection visible in run_messages

---

### Story 11: S-7.3 Correction Configuration & Cost Tracking

**Branch:** `feature/s-7.3-correction-config` off `feature/s-7.2-repetition-suppression`

**Goal:** Per-agent config for all correction mechanisms + cost tracking.

**Files to create:**
- `src/db/schema/evaluation-config.ts` — `agent_evaluation_config` table
- `src/db/queries/evaluation-config.ts` — CRUD queries
- `src/features/evaluation/config.ts` — `resolveConfig(agentId)`
- `src/features/evaluation/cost-tracker.ts` — Cost aggregation
- `src/app/api/evaluations/config/route.ts` — GET list, PUT defaults
- `src/app/api/evaluations/config/[agentId]/route.ts` — GET, PATCH
- `src/app/api/evaluations/costs/route.ts` — GET cost summary
- `src/features/evaluation/__tests__/config.test.ts`
- `src/features/evaluation/__tests__/cost-tracker.test.ts`
- `e2e/correction-config.spec.ts`

**Files to modify:**
- `src/db/schema/index.ts` — Export new schema
- `src/db/seed.ts` — Seed default configs for all 16 agents

**Key implementation details:**
- Per-dimension toggles and thresholds for action gate
- Per-agent enable/disable for interventions and repetition suppression
- Default config: all mechanisms disabled (matching TinyTroupe defaults)
- `resolveConfig()` merges agent-specific overrides with defaults
- Cost tracker aggregates token usage from correction_logs, intervention_logs, LLM calls

**E2E test approach:**
- GET `/api/evaluations/config` — verify all 16 agents have default config
- PATCH `/api/evaluations/config/michael` — enable adherence check
- GET `/api/evaluations/config/michael` — verify updated config
- GET `/api/evaluations/costs` — verify cost aggregation

---

### Story 12: S-8.0 Proposition Library

**Branch:** `feature/s-8.0-proposition-library` off `feature/s-7.3-correction-config`

**Goal:** Create YAML proposition files for all 16 characters covering personality traits, relationships, speech patterns.

**Files to create:**
- `src/features/evaluation/propositions/adherence/{michael,dwight,jim,pam,ryan,stanley,kevin,angela,oscar,andy,toby,creed,kelly,phyllis,meredith,darryl}.yaml` — 16 character files
- `src/features/evaluation/propositions/__tests__/library-validation.test.ts` — Schema validation for all YAMLs
- `e2e/proposition-library.spec.ts`

**Key implementation details:**
- Each character: 6-10 weighted propositions covering speech, relationships, behavior
- Each has at least 1 anti-pattern proposition (inverted)
- All validate against Zod schema from S-6.0
- Proposition loader correctly merges agent-specific + _default.yaml

**E2E test approach:**
- GET `/api/evaluations/propositions?agentId=michael` — verify merged propositions loaded
- Verify all 16 agents have valid propositions
- Verify proposition counts per agent (6-10 each)

---

### Story 13: S-8.1 Evaluation Harness CLI

**Branch:** `feature/s-8.1-eval-harness-cli` off `feature/s-8.0-proposition-library`

**Goal:** CLI tool that runs propositions against conversations and produces structured evaluation reports.

**Files to create:**
- `src/features/evaluation/harness/cli.ts` — Entry point
- `src/features/evaluation/harness/runner.ts` — `runEvaluation(options)`
- `src/features/evaluation/harness/report.ts` — `generateReport(results)`
- `src/features/evaluation/harness/synthetic.ts` — Synthetic conversation generator
- `src/features/evaluation/harness/mock-judge.ts` — `MockJudge` for CI
- `src/features/evaluation/harness/prompts/` — Canned prompts per character
- `src/features/evaluation/harness/__tests__/runner.test.ts`
- `src/features/evaluation/harness/__tests__/report.test.ts`
- `src/features/evaluation/harness/__tests__/mock-judge.test.ts`
- `e2e/eval-harness.spec.ts`

**Files to modify:**
- `package.json` — Add `eval:run` script

**Key implementation details:**
- CLI flags: `--agents`, `--dimensions`, `--threshold`, `--mock-judge`, `--synthetic`, `--output`
- `--mock-judge` returns pre-recorded scores (no LLM calls)
- Report format: per-agent, per-dimension scores with pass/fail
- Exit code 0 (all pass) or 1 (any fail)
- Human-readable summary to stderr, JSON to stdout

**E2E test approach:**
- Run CLI with `--mock-judge --agents michael` via API or subprocess
- Verify JSON report structure
- Verify exit code 0 for passing scores
- Verify exit code 1 with high threshold

---

### Story 14: S-8.2 Golden Baseline Storage

**Branch:** `feature/s-8.2-golden-baselines` off `feature/s-8.1-eval-harness-cli`

**Goal:** Golden baseline JSON files committed to repo for regression detection.

**Files to create:**
- `src/features/evaluation/baselines/` — Directory for JSON files
- `src/features/evaluation/harness/baseline-manager.ts` — Load, save, detect regressions
- `src/features/evaluation/harness/__tests__/baseline-manager.test.ts`
- `e2e/golden-baselines.spec.ts`

**Files to modify:**
- `src/features/evaluation/harness/cli.ts` — Add `--update-baseline`, `--regression-delta` flags
- `src/features/evaluation/harness/report.ts` — Add regressions field

**Key implementation details:**
- One JSON file per agent in `src/features/evaluation/baselines/`
- `detectRegressions()`: current scores vs baseline, flag drops > delta (default 1.0)
- `--update-baseline` writes JSON files from current evaluation
- Exit code 1 if regressions detected
- Initial baselines for Michael, Dwight, Jim

**E2E test approach:**
- Run harness with `--mock-judge --update-baseline --agents michael`
- Verify baseline JSON file created
- Run again with modified scores
- Verify regression detected

---

### Story 15: S-8.3 CI Integration

**Branch:** `feature/s-8.3-ci-integration` off `feature/s-8.2-golden-baselines`

**Goal:** GitHub Actions workflow for persona regression testing on PRs.

**Files to create:**
- `.github/workflows/persona-evaluation.yml` — GHA workflow
- `src/features/evaluation/harness/ci-reporter.ts` — Markdown table for PR comments
- `src/features/evaluation/harness/__tests__/ci-reporter.test.ts`
- `e2e/ci-integration.spec.ts`

**Key implementation details:**
- Triggers on PRs modifying persona-related files
- Runs `npm run eval:run -- --mock-judge` (fast, deterministic)
- Posts PR comment with scores table
- Fails check if regressions exceed delta
- Completes in < 60 seconds

**E2E test approach:**
- Verify CI reporter generates valid markdown
- Verify workflow file is valid YAML
- Test markdown output format

---

### Story 16: S-8.4 Agent Factory

**Branch:** `feature/s-8.4-agent-factory` off `feature/s-8.3-ci-integration`

**Goal:** Programmatically generate large populations of diverse agent personas for experiments.

**Files to create:**
- `src/features/evaluation/experiment/agent-factory.ts` — `AgentFactory` class
- `src/features/evaluation/experiment/population-profiles.ts` — Profile definitions
- `src/features/evaluation/experiment/persona-templates.ts` — System prompt templates
- `src/features/evaluation/experiment/types.ts` — Experiment types
- `src/features/evaluation/experiment/__tests__/agent-factory.test.ts`
- `e2e/agent-factory.spec.ts`

**Key implementation details:**
- Three profiles: averageCustomer, difficultCustomer, politicalCompass
- Three-stage LLM pipeline: dimensions → sampling plan → generate
- Deterministic sampling with `options.seed`
- Template-based mode (`templateOnly: true`) for fast validation
- Generated personas: name, age, gender, nationality, occupation, personality (Big Five), style, goals
- Parallel generation supported

**E2E test approach:**
- POST `/api/evaluations/experiment/generate` with template-only mode
- Verify generated personas have all required fields
- Verify deterministic seed produces same population
- Verify 3 profiles produce different distributions

---

### Story 17: S-8.5 Scenario Library

**Branch:** `feature/s-8.5-scenario-library` off `feature/s-8.4-agent-factory`

**Goal:** Pre-defined experiment scenarios matching TinyTroupe's four experiments.

**Files to create:**
- `src/features/evaluation/experiment/scenario-library.ts` — Registry
- `src/features/evaluation/experiment/scenarios/brainstorming-average.ts`
- `src/features/evaluation/experiment/scenarios/brainstorming-difficult-full.ts`
- `src/features/evaluation/experiment/scenarios/brainstorming-difficult-variety.ts`
- `src/features/evaluation/experiment/scenarios/debate-controversial.ts`
- `src/features/evaluation/experiment/facilitator.ts` — Facilitator class
- `src/features/evaluation/experiment/environment.ts` — ExperimentEnvironment class
- `src/features/evaluation/experiment/__tests__/scenario-library.test.ts`
- `src/features/evaluation/experiment/__tests__/environment.test.ts`
- `e2e/scenario-library.spec.ts`

**Key implementation details:**
- Four scenario configs matching TinyTroupe Experiments 1, 2.1, 2.2, 3
- Step-based execution: interventions → facilitator → agents
- Sequential_random agent order with seeded shuffle
- Facilitator broadcasts prompts at step-indexed points

**E2E test approach:**
- GET `/api/evaluations/experiment/scenarios` — list all
- GET `/api/evaluations/experiment/scenarios/brainstorming-average` — verify full config
- Verify all scenario configs validate
- Verify facilitator prompt sequencing

---

### Story 18: S-8.6 Experiment Runner & Statistical Testing

**Branch:** `feature/s-8.6-experiment-runner` off `feature/s-8.5-scenario-library`

**Goal:** Run treatment vs. control experiments with Welch's t-test for statistical significance.

**Files to create:**
- `src/features/evaluation/experiment/cli.ts` — Experiment CLI
- `src/features/evaluation/experiment/runner.ts` — `ExperimentRunner` class
- `src/features/evaluation/experiment/environment-manager.ts` — T/C environment pairs
- `src/features/evaluation/experiment/statistical-testing.ts` — Welch's t-test, Cohen's d
- `src/features/evaluation/experiment/experiment-report.ts` — Table 1 format report
- `src/features/evaluation/experiment/__tests__/statistical-testing.test.ts`
- `src/features/evaluation/experiment/__tests__/runner.test.ts`
- `e2e/experiment-runner.spec.ts`

**Files to modify:**
- `package.json` — Add `experiment:run` script

**Key implementation details:**
- Welch's t-test with Welch-Satterthwaite degrees of freedom
- Cohen's d effect size
- T-distribution CDF via approximation (no external library)
- `--seed` for deterministic reproducibility
- `--dry-run` shows config without executing
- Report format matches Table 1: T mean(sd), C mean(sd), delta, p-value

**E2E test approach:**
- Verify statistical testing against known values
- POST `/api/evaluations/experiment/run` with dry-run
- Verify report structure matches Table 1 format
- Verify deterministic seed produces same results

---

### Story 19: S-8.7 Table 1 Reproduction

**Branch:** `feature/s-8.7-table1-reproduction` off `feature/s-8.6-experiment-runner`

**Goal:** Run all four TinyTroupe experiments and generate comparison report against published values.

**Files to create:**
- `src/features/evaluation/experiment/reproduce-table1.ts` — CLI entry point
- `src/features/evaluation/experiment/table1-reference.ts` — Hard-coded reference values
- `src/features/evaluation/experiment/comparison-report.ts` — Side-by-side comparison
- `src/features/evaluation/experiment/__tests__/table1-reference.test.ts`
- `src/features/evaluation/experiment/__tests__/comparison-report.test.ts`
- `e2e/table1-reproduction.spec.ts`

**Files to modify:**
- `package.json` — Add `experiment:table1` script

**Key implementation details:**
- Reference values from TinyTroupe Table 1 as structured constant
- `--scale` factor for quick validation (0.1 = 10% agents/environments)
- Trend validation: directional match on delta signs for significant results
- Summary: trends matched / total significant results
- Display labels mapping: adherence→persona_adherence, consistency→self_consistency, convergence→divergence

**E2E test approach:**
- Verify reference values load correctly
- Verify comparison logic with mock experiment results
- Verify trend matching algorithm
- POST `/api/evaluations/experiment/reproduce-table1` with `--dry-run`

---

## Execution Order Summary

| # | Story | Branch | Depends On |
|---|-------|--------|------------|
| 1 | S-6.2 | feature/s-6.2-consistency-scorer | main |
| 2 | S-6.3 | feature/s-6.3-fluency-scorer | S-6.2 |
| 3 | S-6.4 | feature/s-6.4-convergence-scorer | S-6.3 |
| 4 | S-6.6 | feature/s-6.6-ideas-quantity-scorer | S-6.4 |
| 5 | S-6.5 | feature/s-6.5-baseline-capture | S-6.6 |
| 6 | S-7.0a | feature/s-7.0a-action-quality-check | S-6.5 |
| 7 | S-7.0b | feature/s-7.0b-correction-pipeline | S-7.0a |
| 8 | S-7.1a | feature/s-7.1a-intervention-framework | S-7.0b |
| 9 | S-7.1b | feature/s-7.1b-built-in-interventions | S-7.1a |
| 10 | S-7.2 | feature/s-7.2-repetition-suppression | S-7.1b |
| 11 | S-7.3 | feature/s-7.3-correction-config | S-7.2 |
| 12 | S-8.0 | feature/s-8.0-proposition-library | S-7.3 |
| 13 | S-8.1 | feature/s-8.1-eval-harness-cli | S-8.0 |
| 14 | S-8.2 | feature/s-8.2-golden-baselines | S-8.1 |
| 15 | S-8.3 | feature/s-8.3-ci-integration | S-8.2 |
| 16 | S-8.4 | feature/s-8.4-agent-factory | S-8.3 |
| 17 | S-8.5 | feature/s-8.5-scenario-library | S-8.4 |
| 18 | S-8.6 | feature/s-8.6-experiment-runner | S-8.5 |
| 19 | S-8.7 | feature/s-8.7-table1-reproduction | S-8.6 |

## Quality Gates (per story)

1. `npm run lint` passes
2. `npm run typecheck` passes
3. `npm run test` passes (unit tests)
4. `npm run test:e2e` passes
5. E2E runs 10x sequentially without failures locally
6. E2E passes 2x in CI/CD
7. Manual demo via Playwright completed
8. PR created targeting `main`
