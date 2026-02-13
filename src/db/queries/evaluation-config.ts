import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import {
  agentEvaluationConfig,
  type AgentEvaluationConfig,
  type NewAgentEvaluationConfig,
} from "@/db/schema";
import { withSpan } from "@/lib/telemetry";

export function getAgentEvalConfig(
  agentId: string,
): Promise<AgentEvaluationConfig | undefined> {
  return withSpan("getAgentEvalConfig", "db.query", async () => {
    const rows = await db
      .select()
      .from(agentEvaluationConfig)
      .where(eq(agentEvaluationConfig.agentId, agentId));
    return rows[0];
  });
}

export function listAgentEvalConfigs(): Promise<AgentEvaluationConfig[]> {
  return withSpan("listAgentEvalConfigs", "db.query", () =>
    db
      .select()
      .from(agentEvaluationConfig)
      .orderBy(agentEvaluationConfig.agentId),
  );
}

export function upsertAgentEvalConfig(
  agentId: string,
  updates: Partial<Omit<NewAgentEvaluationConfig, "agentId">>,
): Promise<AgentEvaluationConfig> {
  return withSpan("upsertAgentEvalConfig", "db.query", async () => {
    const [row] = await db
      .insert(agentEvaluationConfig)
      .values({ agentId, ...updates, updatedAt: new Date() })
      .onConflictDoUpdate({
        target: agentEvaluationConfig.agentId,
        set: { ...updates, updatedAt: new Date() },
      })
      .returning();
    if (!row) throw new Error("Upsert returned no rows");
    return row;
  });
}
