import { checkActionQuality, type CheckActionQualityOptions } from "./action-correction";
import { directCorrect } from "./direct-correction";
import { createCorrectionLog } from "@/db/queries/correction-logs";
import type {
  CorrectionPipelineConfig,
  CorrectionPipelineResult,
  CorrectionAttempt,
  CorrectionOutcome,
  CorrectionStage,
  RegenerationFeedback,
  GateResult,
  QualityDimension,
} from "./types";
import { DEFAULT_PIPELINE_CONFIG } from "./types";
import { withSpan, logInfo, countMetric, distributionMetric } from "@/lib/telemetry";

// ---------------------------------------------------------------------------
// In-memory pipeline state (tracks attempts across tool-call retries)
// ---------------------------------------------------------------------------

interface PipelineState {
  attempts: CorrectionAttempt[];
  regenerationCount: number;
  directCorrectionCount: number;
}

const pipelineStates = new Map<string, PipelineState>();

function stateKey(runId: string, agentId: string): string {
  return `${runId}:${agentId}`;
}

function getOrCreateState(key: string): PipelineState {
  let state = pipelineStates.get(key);
  if (!state) {
    state = { attempts: [], regenerationCount: 0, directCorrectionCount: 0 };
    pipelineStates.set(key, state);
  }
  return state;
}

/** Clear pipeline state for a run (used after completion and in tests). */
export function clearPipelineState(runId?: string, agentId?: string): void {
  if (runId && agentId) {
    pipelineStates.delete(stateKey(runId, agentId));
    return;
  }
  pipelineStates.clear();
}

// ---------------------------------------------------------------------------
// Build regeneration feedback (TinyTroupe-style)
// ---------------------------------------------------------------------------

export function buildRegenerationFeedback(
  messageText: string,
  gateResult: GateResult,
  attemptNumber: number,
  maxAttempts: number,
): RegenerationFeedback {
  const failedDimensions = gateResult.dimensionResults
    .filter((d) => !d.passed)
    .map((d) => ({
      dimension: d.dimension,
      score: d.score,
      threshold: d.threshold,
      reasoning: d.reasoning,
      recommendation: buildRecommendation(d.dimension, d.reasoning),
    }));

  return {
    tentativeAction: messageText,
    failedDimensions,
    attemptNumber,
    maxAttempts,
  };
}

function buildRecommendation(dimension: QualityDimension, reasoning: string): string {
  const templates: Record<QualityDimension, string> = {
    persona_adherence:
      "Rewrite to better match your character's personality traits, speech patterns, and behaviors.",
    self_consistency:
      "Ensure your message does not contradict your previous statements in this conversation.",
    fluency:
      "Use natural, varied language. Avoid repeating phrases or using formulaic patterns.",
    suitability:
      "Make your message a reasonable response to the conversation or a productive step toward a goal.",
  };
  return `${templates[dimension]} (Issue: ${reasoning})`;
}

// ---------------------------------------------------------------------------
// Format feedback as tool result string (for agent retry)
// ---------------------------------------------------------------------------

export function formatFeedbackForAgent(feedback: RegenerationFeedback): string {
  const dimLines = feedback.failedDimensions
    .map(
      (d) =>
        `  - ${d.dimension}: score ${d.score}/${d.threshold} — ${d.reasoning}\n    Recommendation: ${d.recommendation}`,
    )
    .join("\n");

  const escalation =
    feedback.attemptNumber > 1
      ? "\n\nIMPORTANT: Your previous attempts also failed quality checks. You MUST be MORE RADICAL in your changes and produce something VERY different from previous attempts. It is better to stop acting than to act poorly."
      : "";

  return JSON.stringify({
    type: "quality_check_failed",
    tentativeAction: feedback.tentativeAction,
    failedDimensions: feedback.failedDimensions,
    instruction: `Your message failed quality checks on ${feedback.failedDimensions.length} dimension(s):\n${dimLines}\n\nPlease rewrite your message to address these issues. Attempt ${feedback.attemptNumber} of ${feedback.maxAttempts}.${escalation}`,
  });
}

// ---------------------------------------------------------------------------
// Select best attempt (highest total score)
// ---------------------------------------------------------------------------

function selectBestAttempt(attempts: CorrectionAttempt[]): CorrectionAttempt {
  return attempts.reduce((best, current) =>
    current.gateResult.totalScore > best.gateResult.totalScore ? current : best,
  );
}

// ---------------------------------------------------------------------------
// Main pipeline
// ---------------------------------------------------------------------------

export interface RunCorrectionPipelineOptions extends CheckActionQualityOptions {
  runId?: string;
  channelId?: string;
  priorActionCount?: number;
}

export async function runCorrectionPipeline(
  agentId: string,
  messageText: string,
  conversationContext: string[],
  config: CorrectionPipelineConfig = DEFAULT_PIPELINE_CONFIG,
  options: RunCorrectionPipelineOptions = {},
): Promise<CorrectionPipelineResult> {
  return withSpan("gate.correctionPipeline", "evaluation.gate", async () => {
    const startTime = Date.now();
    const runId = options.runId ?? "standalone";
    const key = stateKey(runId, agentId);
    const state = getOrCreateState(key);

    // Skip if below minimum action threshold
    if (
      config.minimumRequiredQtyOfActions > 0 &&
      (options.priorActionCount ?? 0) < config.minimumRequiredQtyOfActions
    ) {
      logInfo("gate.pipeline.skipMinActions", { agentId, priorActions: options.priorActionCount ?? 0 });
      const skipResult: GateResult = {
        passed: true,
        dimensionResults: [],
        similarityResult: null,
        totalScore: 0,
      };
      return {
        finalText: messageText,
        outcome: "passed" as CorrectionOutcome,
        attempts: [],
        bestAttempt: { stage: "original", attemptNumber: 0, messageText, gateResult: skipResult },
        feedback: null,
        totalDurationMs: Date.now() - startTime,
      };
    }

    // --- Evaluate current message ---
    const gateResult = await checkActionQuality(
      agentId,
      messageText,
      conversationContext,
      config,
      options,
    );

    const currentStage: CorrectionStage =
      state.regenerationCount > 0
        ? "regeneration"
        : "original";
    const attemptNumber = state.attempts.length + 1;

    const attempt: CorrectionAttempt = {
      stage: currentStage,
      attemptNumber,
      messageText,
      gateResult,
    };
    state.attempts.push(attempt);

    countMetric("gate.pipeline.attempt", 1, { agentId, stage: currentStage });

    // --- Original/Regeneration passed ---
    if (gateResult.passed) {
      const outcome: CorrectionOutcome =
        currentStage === "regeneration" ? "regeneration_success" : "passed";

      logInfo("gate.pipeline.passed", { agentId, outcome, attemptNumber });

      await logCorrectionAttempt(agentId, messageText, messageText, attempt, outcome, options);
      clearPipelineState(runId, agentId);

      return {
        finalText: messageText,
        outcome,
        attempts: state.attempts,
        bestAttempt: attempt,
        feedback: null,
        totalDurationMs: Date.now() - startTime,
      };
    }

    // --- Stage 1: Regeneration ---
    if (config.enableRegeneration && state.regenerationCount < config.maxCorrectionAttempts) {
      state.regenerationCount++;
      const feedback = buildRegenerationFeedback(
        messageText,
        gateResult,
        state.regenerationCount,
        config.maxCorrectionAttempts,
      );

      logInfo("gate.pipeline.regeneration", {
        agentId,
        attemptNumber: state.regenerationCount,
        maxAttempts: config.maxCorrectionAttempts,
        failedDimensions: feedback.failedDimensions.length,
      });
      countMetric("gate.pipeline.regeneration", 1, { agentId });

      await logCorrectionAttempt(agentId, messageText, messageText, attempt, "regeneration_requested", options);

      return {
        finalText: messageText,
        outcome: "regeneration_requested",
        attempts: state.attempts,
        bestAttempt: selectBestAttempt(state.attempts),
        feedback,
        totalDurationMs: Date.now() - startTime,
      };
    }

    // --- Stage 2: Direct Correction ---
    if (config.enableDirectCorrection && state.directCorrectionCount < config.maxCorrectionAttempts) {
      logInfo("gate.pipeline.directCorrection.start", { agentId });

      for (
        let dcAttempt = state.directCorrectionCount;
        dcAttempt < config.maxCorrectionAttempts;
        dcAttempt++
      ) {
        state.directCorrectionCount++;
        const failedDims = gateResult.dimensionResults
          .filter((d) => !d.passed)
          .map((d) => ({
            dimension: d.dimension,
            score: d.score,
            threshold: d.threshold,
            reasoning: d.reasoning,
            recommendation: buildRecommendation(d.dimension, d.reasoning),
          }));

        const correction = await directCorrect(messageText, failedDims, {
          agentName: options.agentName ?? agentId,
          ...(options.persona ? { persona: options.persona } : {}),
          conversationContext,
        });

        // Re-evaluate corrected text
        const correctedResult = await checkActionQuality(
          agentId,
          correction.correctedText,
          conversationContext,
          config,
          options,
        );

        const dcAttemptEntry: CorrectionAttempt = {
          stage: "direct_correction",
          attemptNumber: state.attempts.length + 1,
          messageText: correction.correctedText,
          gateResult: correctedResult,
        };
        state.attempts.push(dcAttemptEntry);

        countMetric("gate.pipeline.directCorrection", 1, { agentId });

        if (correctedResult.passed) {
          logInfo("gate.pipeline.directCorrection.success", { agentId });

          await logCorrectionAttempt(
            agentId,
            messageText,
            correction.correctedText,
            dcAttemptEntry,
            "direct_correction_success",
            options,
          );
          clearPipelineState(runId, agentId);

          return {
            finalText: correction.correctedText,
            outcome: "direct_correction_success",
            attempts: state.attempts,
            bestAttempt: dcAttemptEntry,
            feedback: null,
            totalDurationMs: Date.now() - startTime,
          };
        }
      }
    }

    // --- All stages exhausted ---
    const best = selectBestAttempt(state.attempts);
    const outcome: CorrectionOutcome = config.continueOnFailure
      ? "forced_through"
      : "forced_through"; // Both use forced_through; caller checks config

    logInfo("gate.pipeline.exhausted", {
      agentId,
      outcome,
      bestScore: best.gateResult.totalScore,
      totalAttempts: state.attempts.length,
    });
    countMetric("gate.pipeline.forcedThrough", 1, { agentId });
    distributionMetric("gate.pipeline.totalAttempts", state.attempts.length, "none", { agentId });

    await logCorrectionAttempt(agentId, messageText, best.messageText, best, outcome, options);
    clearPipelineState(runId, agentId);

    if (!config.continueOnFailure) {
      return {
        finalText: messageText,
        outcome: "forced_through",
        attempts: state.attempts,
        bestAttempt: best,
        feedback: null,
        totalDurationMs: Date.now() - startTime,
      };
    }

    return {
      finalText: best.messageText,
      outcome: "forced_through",
      attempts: state.attempts,
      bestAttempt: best,
      feedback: null,
      totalDurationMs: Date.now() - startTime,
    };
  });
}

// ---------------------------------------------------------------------------
// Log correction attempt to DB
// ---------------------------------------------------------------------------

async function logCorrectionAttempt(
  agentId: string,
  originalText: string,
  finalText: string,
  attempt: CorrectionAttempt,
  outcome: CorrectionOutcome,
  options: RunCorrectionPipelineOptions,
): Promise<void> {
  try {
    await createCorrectionLog({
      agentId,
      runId: options.runId ?? null,
      channelId: options.channelId ?? null,
      originalText,
      finalText,
      stage: attempt.stage,
      attemptNumber: attempt.attemptNumber,
      outcome,
      dimensionScores: attempt.gateResult.dimensionResults,
      similarityScore: attempt.gateResult.similarityResult?.score ?? null,
      totalScore: attempt.gateResult.totalScore,
      tokenUsage: attempt.gateResult.tokenUsage ?? null,
      durationMs: null,
    });
  } catch {
    // Don't let logging failures break the pipeline
    logInfo("gate.pipeline.logFailed", { agentId });
  }
}
