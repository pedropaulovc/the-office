# Milestone 8: Evaluation Harness — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task.

**Goal:** CI-integrated evaluation harness with proposition library, golden baselines, experiment runner, and Table 1 reproduction.

**Architecture:** Builds on M6 scorers + M7 correction pipeline. Adds CLI tools, experiment infrastructure, and CI workflow. All evaluation code lives in `src/features/evaluation/`. CLI entry points use `npx tsx`. E2E tests hit API routes.

**Tech Stack:** TypeScript, Zod, YAML (js-yaml), Playwright E2E, Vitest unit tests, GitHub Actions

**Branch Strategy:** Linear chain — each story branches off the previous:
```
main → feature/s-8.0-proposition-library
     → feature/s-8.1-evaluation-harness-cli
     → feature/s-8.2-golden-baselines
     → feature/s-8.3-ci-integration
     → feature/s-8.4-agent-factory
     → feature/s-8.5-scenario-library
     → feature/s-8.6-experiment-runner
     → feature/s-8.7-table1-reproduction
```

**Quality Gates per story:**
1. `npm run lint && npm run typecheck` pass
2. `npm run test` (unit) pass with 70% coverage
3. E2E test passes 10x sequential locally: `npm run test:e2e -- --workers=1 --repeat-each=10`
4. E2E test passes 2x in CI (push branch, verify workflow)
5. Manual demo via Playwright (headed mode)
6. PR created targeting `main`

---

## Story S-8.0: Proposition Library

**Branch:** `feature/s-8.0-proposition-library` (already exists, off `main`)

### Task 1: Create 16 character adherence YAML files

**Files to create** (all in `src/features/evaluation/propositions/adherence/`):

Each file follows this structure:
```yaml
dimension: adherence
agent_id: <character-id>
include_personas: true
hard: false
target_type: agent
first_n: 10
last_n: 100
propositions:
  - id: <character>-<trait>
    claim: "{{agent_name}} ..."
    weight: 1.0
    inverted: false  # true for anti-patterns
    recommendations_for_improvement: "..."
```

**Characters and key propositions:**

1. **michael.yaml** (10 propositions): self-centered humor, "that's what she said", needs to be liked, avoids conflict, pop culture references, friendship obsession, inappropriate jokes, self-declared best boss, *anti-pattern: gives dry factual responses without humor*
2. **dwight.yaml** (10): authority/hierarchy obsession, loyalty to Michael, beet farm/farming references, survival skills, bears/battlestar galactica, weapons/martial arts, Assistant Regional Manager title, rule enforcement, *anti-pattern: casual/laid-back attitude*
3. **jim.yaml** (8): sarcasm/dry wit, pranks on Dwight, Pam references, camera looks, laid-back demeanor, sports references, deflects with humor, *anti-pattern: takes work too seriously*
4. **pam.yaml** (8): supportive/encouraging, artistic references, quiet strength, Jim connection, observational humor, polite but firm, avoids confrontation initially, *anti-pattern: aggressive/domineering*
5. **ryan.yaml** (8): tech-bro/startup language, WUPHF references, condescension, MBA/business jargon, trend-chasing, inflated self-importance, social media obsession, *anti-pattern: humble/self-deprecating*
6. **stanley.yaml** (8): disinterest in work, crossword puzzles, pretzel day, minimal engagement, eye-rolling, "did I stutter", retirement countdown, *anti-pattern: enthusiastic about office activities*
7. **kevin.yaml** (8): food references/obsession, simple language, accounting struggles, chili recipe, band (Scrantonicity), math errors, slow speech, *anti-pattern: uses sophisticated vocabulary*
8. **angela.yaml** (8): cat obsession, moral judgments, disapproval, Dwight connection, Senator references, party planning perfectionism, religious references, *anti-pattern: openly warm and approving*
9. **oscar.yaml** (8): intellectual/corrects others, "actually" corrections, patience with Kevin, financial knowledge, cultural references, diplomatic, dry humor, *anti-pattern: uses simple/incorrect language*
10. **andy.yaml** (8): Cornell references, a cappella, anger management, tries too hard to fit in, Nard Dog, musical theatre, family wealth references, *anti-pattern: quiet/reserved*
11. **toby.yaml** (8): meek/apologetic, HR references, sad resignation, Michael's punching bag, tries to fit in, quiet desperation, divorce references, *anti-pattern: assertive/confrontational*
12. **creed.yaml** (8): bizarre non-sequiturs, questionable past, detachment from reality, doesn't know coworkers' names, mysterious statements, steals things, quality assurance ignorance, *anti-pattern: follows rules/procedures carefully*
13. **kelly.yaml** (8): pop culture obsession, relationship drama, rapid speech, dramatic reactions, fashion/shopping, Ryan obsession, gossip, *anti-pattern: speaks slowly and thoughtfully*
14. **phyllis.yaml** (8): passive-aggressive sweetness, Bob Vance references, maternal but territorial, knitting/crafts, quiet power plays, uses relationship status, *anti-pattern: directly confrontational/aggressive*
15. **meredith.yaml** (8): inappropriate comments, party/drinking references, casual attitude, oversharing, supplier relations "methods", doesn't care about norms, *anti-pattern: prim and proper behavior*
16. **darryl.yaml** (8): cool demeanor, warehouse wisdom, music/drumming, exasperation with Michael, street-smart, professional ambition, code-switching, *anti-pattern: mimics Michael's behavior*

### Task 2: Add propositions API route

**File:** `src/app/api/evaluations/propositions/route.ts`

```typescript
// GET /api/evaluations/propositions?agentId=michael&dimension=adherence
// Returns: { dimension, agentId, propositions: Proposition[], totalCount }
```

This route enables E2E testing and demo of proposition loading without LLM calls.

### Task 3: Unit tests

**File:** `src/features/evaluation/propositions/__tests__/proposition-library.test.ts`

Tests:
- All 16 character YAML files load without errors
- Each file has 6-10 propositions
- Each proposition has id, claim, weight
- Each character has at least 1 anti-pattern (inverted: true)
- All YAML files validate against Zod schema
- Merged propositions (default + agent) have correct count
- Template variables are filled correctly

### Task 4: E2E test

**File:** `e2e/proposition-library.spec.ts`

Tests:
- `GET /api/evaluations/propositions?agentId=michael&dimension=adherence` returns merged propositions (default 4 + agent-specific ~10)
- All 16 agents load propositions successfully (parallel requests)
- Total proposition count across all characters is reasonable (>100)
- Each response has at least 1 inverted proposition

### Task 5: Demo plan

Manual Playwright demo (headed mode):
1. Navigate to app, verify it loads
2. Call proposition API for michael — show merged set
3. Call proposition API for all 16 — show counts
4. (Optional) Call adherence scorer for one agent to show propositions in action

### Task 6: Stress test & PR

- Run `npm run test:e2e -- --workers=1 --repeat-each=10` (must pass all 10)
- Create PR targeting `main`

---

## Story S-8.1: Evaluation Harness CLI

**Branch:** `feature/s-8.1-evaluation-harness-cli` (off `feature/s-8.0-proposition-library`)

### Task 1: Mock judge

**File:** `src/features/evaluation/harness/mock-judge.ts`

```typescript
export interface MockJudgeScores {
  [propositionId: string]: { score: number; reasoning: string };
}

// Pre-recorded scores for deterministic CI testing
// Returns fixed scores without LLM calls
export function createMockJudge(prerecordedScores: MockJudgeScores): MockJudge
```

The mock judge replaces the `scorePropositions` function from `proposition-engine.ts` when `--mock-judge` is active. Provide a set of pre-recorded scores for each of the 16 characters covering all adherence propositions.

**File:** `src/features/evaluation/harness/mock-scores.ts` — Pre-recorded score data for all 16 characters.

### Task 2: Runner

**File:** `src/features/evaluation/harness/runner.ts`

```typescript
export interface HarnessOptions {
  agents: string[];           // agent IDs or ['all']
  dimensions: EvaluationDimension[];
  window: string;             // e.g. '7d'
  threshold: number;          // min score to pass (default 5.0)
  mockJudge: boolean;
  synthetic: boolean;
  output: string | null;      // file path or null for stdout
}

export interface HarnessResult {
  timestamp: string;
  agents: Record<string, AgentResult>;
  summary: { total: number; passed: number; failed: number; failedAgents: string[] };
}

export async function runEvaluation(options: HarnessOptions): Promise<HarnessResult>
```

### Task 3: Report generator

**File:** `src/features/evaluation/harness/report.ts`

```typescript
export function generateJsonReport(result: HarnessResult): string
export function generateHumanReport(result: HarnessResult): string
```

### Task 4: CLI entry point

**File:** `src/features/evaluation/harness/cli.ts`

Parses CLI args, calls `runEvaluation`, writes JSON to stdout/file, human summary to stderr. Exit code 0/1.

**Modify:** `package.json` — add `"eval:run": "npx tsx src/features/evaluation/harness/cli.ts"`

### Task 5: API route for harness

**File:** `src/app/api/evaluations/harness/route.ts`

```typescript
// POST /api/evaluations/harness
// Body: { agents?, dimensions?, threshold?, mockJudge? }
// Returns: HarnessResult JSON
```

This enables E2E testing via HTTP.

### Task 6: Unit tests

**File:** `src/features/evaluation/harness/__tests__/`
- `mock-judge.test.ts` — returns pre-recorded scores, handles missing propositions
- `runner.test.ts` — mock judge mode produces correct report structure
- `report.test.ts` — JSON and human-readable output format
- `cli.test.ts` — argument parsing

### Task 7: E2E test

**File:** `e2e/evaluation-harness.spec.ts`

Tests:
- `POST /api/evaluations/harness` with `mockJudge: true` returns valid report
- Report has correct structure (agents, dimensions, scores, pass/fail)
- Threshold enforcement: `threshold: 9.0` causes failures
- Report summary counts match

### Task 8: Demo & stress test & PR

---

## Story S-8.2: Golden Baseline Storage & Comparison

**Branch:** `feature/s-8.2-golden-baselines` (off S-8.1)

### Task 1: Baseline manager

**File:** `src/features/evaluation/harness/baseline-manager.ts`

```typescript
export interface GoldenBaseline {
  agentId: string;
  capturedAt: string;
  dimensions: Record<string, number>;
  propositionScores: Record<string, number>;
}

export function loadGoldenBaseline(agentId: string): GoldenBaseline | null
export function saveGoldenBaseline(agentId: string, baseline: GoldenBaseline): void
export function detectRegressions(current: Record<string, number>, baseline: Record<string, number>, delta: number): Regression[]
```

Reads/writes JSON files in `src/features/evaluation/baselines/`.

### Task 2: Initial baselines

Create golden baseline JSON files for Michael, Dwight, Jim (minimum per AC-8.2.10) using mock judge scores.

### Task 3: Integrate with harness CLI

**Modify:** `src/features/evaluation/harness/cli.ts` — add `--update-baseline` and `--regression-delta` flags
**Modify:** `src/features/evaluation/harness/report.ts` — add `regressions` field to report

### Task 4: API route

**Modify:** `src/app/api/evaluations/harness/route.ts` — add `updateBaseline` and `regressionDelta` options, return regressions in response

### Task 5: Unit tests + E2E + demo + PR

---

## Story S-8.3: CI Integration

**Branch:** `feature/s-8.3-ci-integration` (off S-8.2)

### Task 1: CI reporter

**File:** `src/features/evaluation/harness/ci-reporter.ts`

```typescript
export function formatPrComment(result: HarnessResult): string
```

Generates markdown table matching spec format.

### Task 2: GitHub Actions workflow

**File:** `.github/workflows/persona-evaluation.yml`

Triggers on PRs modifying persona files. Runs `npm run eval:run -- --mock-judge`. Posts PR comment.

### Task 3: Unit tests + E2E + demo + PR

E2E: Validate the CI reporter markdown format via API. Demo: Show the workflow YAML and reporter output.

---

## Story S-8.4: Agent Factory

**Branch:** `feature/s-8.4-agent-factory` (off S-8.3)

### Task 1: Types

**File:** `src/features/evaluation/experiment/types.ts`

Define `GeneratedPersona`, `PopulationProfile`, `FactoryOptions`, `DemographicDistribution`.

### Task 2: Population profiles

**File:** `src/features/evaluation/experiment/population-profiles.ts`

Three profiles: `averageCustomer`, `difficultCustomer`, `politicalCompass`.

### Task 3: Persona templates

**File:** `src/features/evaluation/experiment/persona-templates.ts`

System prompt template for generating personas from demographic fields.

### Task 4: Agent factory

**File:** `src/features/evaluation/experiment/agent-factory.ts`

`AgentFactory` class with `generate(count, profile, options)`. Supports template-only mode (no LLM calls) for testing.

### Task 5: API route + unit tests + E2E + demo + PR

**File:** `src/app/api/evaluations/experiment/factory/route.ts`

E2E: Generate 5 template-only personas, verify diversity and structure.

---

## Story S-8.5: Scenario Library

**Branch:** `feature/s-8.5-scenario-library` (off S-8.4)

### Task 1: Scenario configs

**Files:** `src/features/evaluation/experiment/scenarios/*.ts` (4 scenario files)

### Task 2: Facilitator & Environment

**Files:**
- `src/features/evaluation/experiment/facilitator.ts`
- `src/features/evaluation/experiment/environment.ts`

### Task 3: Scenario registry

**File:** `src/features/evaluation/experiment/scenario-library.ts`

### Task 4: API route + unit tests + E2E + demo + PR

---

## Story S-8.6: Experiment Runner & Statistical Testing

**Branch:** `feature/s-8.6-experiment-runner` (off S-8.5)

### Task 1: Statistical testing

**File:** `src/features/evaluation/experiment/statistical-testing.ts`

Pure math: Welch's t-test, Cohen's d, t-distribution CDF approximation.

### Task 2: Experiment runner

**File:** `src/features/evaluation/experiment/runner.ts`

### Task 3: Environment manager

**File:** `src/features/evaluation/experiment/environment-manager.ts`

### Task 4: Experiment report

**File:** `src/features/evaluation/experiment/experiment-report.ts`

### Task 5: CLI + API route + unit tests + E2E + demo + PR

---

## Story S-8.7: Table 1 Reproduction

**Branch:** `feature/s-8.7-table1-reproduction` (off S-8.6)

### Task 1: Reference values

**File:** `src/features/evaluation/experiment/table1-reference.ts`

Hard-coded TinyTroupe Table 1 values.

### Task 2: Comparison report

**File:** `src/features/evaluation/experiment/comparison-report.ts`

### Task 3: CLI entry point

**File:** `src/features/evaluation/experiment/reproduce-table1.ts`

### Task 4: Unit tests + E2E + demo + PR

---

## E2E Test Patterns for M8

All M8 E2E tests follow the same pattern — API-level testing via Playwright's `request` fixture:

```typescript
test.describe("feature name", () => {
  test("POST /api/evaluations/... returns expected result", async ({ request }) => {
    const response = await request.post("/api/evaluations/...", {
      data: { /* request body */ },
    });
    expect(response.status()).toBe(200);
    const result = await response.json();
    // Validate structure and values
  });
});
```

Key patterns:
- No LLM calls in E2E (use mock judge / template-only mode)
- Each test completes in <5s
- Cleanup created resources after test
- Parallel requests where possible

## Demo Plans (Playwright Headed Mode)

Each story's demo uses Playwright CLI in headed mode to:
1. Open the app URL
2. Execute API requests via `page.evaluate(fetch(...))` or direct `request` fixture
3. Capture screenshots of results
4. Verify visual output where applicable

For CLI-based features (S-8.1, S-8.6, S-8.7), the demo runs the CLI command via Bash and shows the output.
