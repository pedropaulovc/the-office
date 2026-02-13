import { z } from "zod/v4";

const evaluationDimension = z.enum([
  "adherence",
  "consistency",
  "fluency",
  "convergence",
  "ideas_quantity",
]);

const targetType = z.enum(["agent", "environment"]);

// --- Proposition YAML schema ---

export const propositionYamlSchema = z.object({
  dimension: evaluationDimension,
  agent_id: z.string().optional(),
  include_personas: z.boolean().default(true),
  hard: z.boolean().default(false),
  target_type: targetType.default("agent"),
  first_n: z.number().int().nonnegative().optional(),
  last_n: z.number().int().nonnegative().optional(),
  propositions: z.array(
    z.object({
      id: z.string().min(1),
      claim: z.string().min(1),
      weight: z.number().positive().default(1),
      inverted: z.boolean().default(false),
      recommendations_for_improvement: z.string().optional(),
    }),
  ),
});

// --- Evaluation run request schema (POST /api/evaluations) ---

export const evaluationRunRequestSchema = z.object({
  agentId: z.string().min(1),
  dimensions: z.array(evaluationDimension).min(1),
  windowStart: z.iso.datetime().optional(),
  windowEnd: z.iso.datetime().optional(),
  sampleSize: z.number().int().positive(),
  isBaseline: z.boolean().optional(),
});

// --- Evaluation run response schema ---

export const evaluationRunResponseSchema = z.object({
  id: z.uuid(),
  agentId: z.string(),
  status: z.enum(["pending", "running", "completed", "failed"]),
  dimensions: z.array(evaluationDimension),
  windowStart: z.iso.datetime().nullable(),
  windowEnd: z.iso.datetime().nullable(),
  sampleSize: z.number().int(),
  overallScore: z.number().nullable(),
  isBaseline: z.boolean(),
  tokenUsage: z.unknown().nullable(),
  createdAt: z.iso.datetime(),
  completedAt: z.iso.datetime().nullable(),
});

// --- Record score request schema (POST /api/evaluations/:runId/scores) ---

export const recordScoreRequestSchema = z.object({
  dimension: evaluationDimension,
  propositionId: z.string().min(1),
  score: z.number().min(0).max(9),
  reasoning: z.string().min(1),
  contextSnippet: z.string().optional(),
});
