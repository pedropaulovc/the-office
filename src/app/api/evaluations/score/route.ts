/**
 * POST /api/evaluations/score
 *
 * Scores propositions against agent behavior trajectories using the
 * proposition engine (LLM judge). Supports three modes:
 *   - "score"  single proposition 0-9 scoring
 *   - "check"  single proposition boolean check
 *   - "batch"  multiple propositions scored in one call
 */
import { NextResponse } from "next/server";
import { z } from "zod/v4";
import {
  scoreProposition,
  checkProposition,
  scorePropositions,
} from "@/features/evaluation/proposition-engine";
import type {
  ScoringContext,
  ScoreOptions,
} from "@/features/evaluation/proposition-engine";
import type { Proposition } from "@/features/evaluation/types";
import { jsonResponse, parseRequestJson, apiHandler } from "@/lib/api-response";
import { logInfo, countMetric } from "@/lib/telemetry";

// ---------------------------------------------------------------------------
// Request schemas
// ---------------------------------------------------------------------------

const trajectoryEntrySchema = z.object({
  type: z.enum(["action", "stimulus"]),
  agentName: z.string().min(1),
  text: z.string().min(1),
});

const propositionSchema = z.object({
  id: z.string().min(1),
  claim: z.string().min(1),
  weight: z.number().positive().optional(),
  inverted: z.boolean().optional(),
});

const scoreRequestSchema = z.discriminatedUnion("mode", [
  z.object({
    mode: z.literal("score"),
    proposition: propositionSchema,
    trajectory: z.array(trajectoryEntrySchema).min(1),
    persona: z.string().optional(),
    doubleCheck: z.boolean().optional(),
  }),
  z.object({
    mode: z.literal("check"),
    proposition: propositionSchema,
    trajectory: z.array(trajectoryEntrySchema).min(1),
    persona: z.string().optional(),
  }),
  z.object({
    mode: z.literal("batch"),
    propositions: z.array(propositionSchema).min(1),
    trajectory: z.array(trajectoryEntrySchema).min(1),
    persona: z.string().optional(),
  }),
]);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function toProposition(input: z.infer<typeof propositionSchema>): Proposition {
  return {
    id: input.id,
    claim: input.claim,
    weight: input.weight ?? 1,
    inverted: input.inverted ?? false,
  };
}

// ---------------------------------------------------------------------------
// Route handler
// ---------------------------------------------------------------------------

export async function POST(request: Request) {
  return apiHandler("api.evaluations.score", "http.server", async () => {
    const body = await parseRequestJson(request);
    if (body instanceof NextResponse) return body;

    const parsed = scoreRequestSchema.safeParse(body);
    if (!parsed.success) {
      return jsonResponse(
        { error: "Validation failed", issues: parsed.error.issues },
        { status: 400 },
      );
    }

    const data = parsed.data;
    const context: ScoringContext = {
      trajectory: data.trajectory,
      ...(data.persona !== undefined && { persona: data.persona }),
    };

    if (data.mode === "score") {
      const proposition = toProposition(data.proposition);
      const options: ScoreOptions = data.doubleCheck !== undefined
        ? { doubleCheck: data.doubleCheck }
        : {};

      logInfo("api.evaluations.score", {
        mode: "score",
        propositionCount: 1,
        doubleCheck: data.doubleCheck ?? false,
      });
      countMetric("api.evaluations.score", 1, { mode: "score" });

      const result = await scoreProposition(proposition, context, options);
      return jsonResponse(result);
    }

    if (data.mode === "check") {
      const proposition = toProposition(data.proposition);

      logInfo("api.evaluations.score", {
        mode: "check",
        propositionCount: 1,
        doubleCheck: false,
      });
      countMetric("api.evaluations.score", 1, { mode: "check" });

      const result = await checkProposition(proposition, context);
      return jsonResponse(result);
    }

    // mode === "batch"
    const propositions = data.propositions.map(toProposition);

    logInfo("api.evaluations.score", {
      mode: "batch",
      propositionCount: propositions.length,
      doubleCheck: false,
    });
    countMetric("api.evaluations.score", 1, { mode: "batch" });

    const result = await scorePropositions(propositions, context);
    return jsonResponse(result);
  });
}
