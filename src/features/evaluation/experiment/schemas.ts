import { z } from "zod/v4";

export const createExperimentRequestSchema = z.object({
  scenarioId: z.string().min(1),
  seed: z.number().int().optional().default(42),
  scale: z.number().positive().optional().default(1.0),
  mode: z.enum(["template", "llm"]).optional().default("template"),
  populationSource: z.enum(["generated", "existing"]),
  sourceAgentIds: z.array(z.string()).optional(),
  config: z.record(z.string(), z.unknown()).optional(),
});

export type CreateExperimentRequest = z.infer<typeof createExperimentRequestSchema>;
