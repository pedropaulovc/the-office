import { db } from "@/db/client";
import { correctionLogs, interventionLogs } from "@/db/schema";
import { eq, and, gte, lte } from "drizzle-orm";
import { withSpan, logInfo } from "@/lib/telemetry";

// Claude Haiku rates
const INPUT_COST_PER_TOKEN = 0.25 / 1_000_000;
const OUTPUT_COST_PER_TOKEN = 1.25 / 1_000_000;

export interface CostSummary {
  agentId: string | null;
  correctionTokens: { input: number; output: number };
  interventionTokens: { input: number; output: number };
  totalTokens: { input: number; output: number };
  estimatedCostUsd: number;
}

interface TokenUsageJson {
  input_tokens?: number;
  output_tokens?: number;
}

function sumTokenUsage(
  rows: (TokenUsageJson | null)[],
): { input: number; output: number } {
  let input = 0;
  let output = 0;
  for (const row of rows) {
    if (!row) continue;
    input += row.input_tokens ?? 0;
    output += row.output_tokens ?? 0;
  }
  return { input, output };
}

export function getCostSummary(
  agentId?: string,
  startDate?: Date,
  endDate?: Date,
): Promise<CostSummary> {
  return withSpan("getCostSummary", "evaluation.cost", async () => {
    // Build correction log conditions
    const correctionConditions = [];
    if (agentId)
      correctionConditions.push(eq(correctionLogs.agentId, agentId));
    if (startDate)
      correctionConditions.push(gte(correctionLogs.createdAt, startDate));
    if (endDate)
      correctionConditions.push(lte(correctionLogs.createdAt, endDate));

    const correctionRows = await db
      .select({ tokenUsage: correctionLogs.tokenUsage })
      .from(correctionLogs)
      .where(
        correctionConditions.length > 0
          ? and(...correctionConditions)
          : undefined,
      );

    // Build intervention log conditions
    const interventionConditions = [];
    if (agentId)
      interventionConditions.push(eq(interventionLogs.agentId, agentId));
    if (startDate)
      interventionConditions.push(gte(interventionLogs.createdAt, startDate));
    if (endDate)
      interventionConditions.push(lte(interventionLogs.createdAt, endDate));

    const interventionRows = await db
      .select({ tokenUsage: interventionLogs.tokenUsage })
      .from(interventionLogs)
      .where(
        interventionConditions.length > 0
          ? and(...interventionConditions)
          : undefined,
      );

    // Aggregate
    const correctionTokens = sumTokenUsage(
      correctionRows.map((r) => r.tokenUsage as TokenUsageJson | null),
    );
    const interventionTokens = sumTokenUsage(
      interventionRows.map((r) => r.tokenUsage as TokenUsageJson | null),
    );

    const totalTokens = {
      input: correctionTokens.input + interventionTokens.input,
      output: correctionTokens.output + interventionTokens.output,
    };

    const estimatedCostUsd =
      totalTokens.input * INPUT_COST_PER_TOKEN +
      totalTokens.output * OUTPUT_COST_PER_TOKEN;

    logInfo("getCostSummary.complete", {
      agentId: agentId ?? "all",
      totalInput: totalTokens.input,
      totalOutput: totalTokens.output,
      estimatedCostUsd,
    });

    return {
      agentId: agentId ?? null,
      correctionTokens,
      interventionTokens,
      totalTokens,
      estimatedCostUsd,
    };
  });
}
