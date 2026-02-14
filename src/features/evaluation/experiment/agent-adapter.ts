import type { Agent, NewAgent } from "@/db/schema";
import type { GeneratedPersona } from "./types";
import { db } from "@/db/client";
import { agents } from "@/db/schema";
import { withSpan, logInfo } from "@/lib/telemetry";

/**
 * Converts a DB Agent row (with persona JSONB) to a GeneratedPersona.
 * Requires the agent to have a non-null `persona` column populated.
 */
export function toGeneratedPersona(agent: Agent): GeneratedPersona {
  if (!agent.persona) {
    throw new Error(`Agent '${agent.id}' has no persona data`);
  }
  return agent.persona as GeneratedPersona;
}

/**
 * Persists a GeneratedPersona as an agent row in the database.
 * The persona's demographic/personality data is stored in the `persona` JSONB column.
 * The system prompt and display name are derived from the persona.
 */
export function persistGeneratedPersona(
  persona: GeneratedPersona,
  experimentId: string,
): Promise<Agent> {
  return withSpan("persistGeneratedPersona", "db.query", async () => {
    const agentId = `exp-${experimentId.slice(0, 8)}-${persona.name.toLowerCase().replace(/\s+/g, "-")}`;

    const newAgent: NewAgent = {
      id: agentId,
      displayName: persona.name,
      title: persona.occupation.title,
      avatarColor: generateAvatarColor(persona.name),
      systemPrompt: persona.system_prompt,
      modelId: "claude-haiku-4-5-20251001",
      experimentId,
      persona: persona as unknown as Record<string, unknown>,
      isActive: false,
    };

    const rows = await db.insert(agents).values(newAgent).returning();
    const created = rows[0];
    if (!created) throw new Error("Insert returned no rows");

    logInfo("persisted generated persona as agent", {
      agentId: created.id,
      experimentId,
      personaName: persona.name,
    });

    return created;
  });
}

/** Generates a deterministic hex color from a name string. */
function generateAvatarColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  const hue = Math.abs(hash) % 360;
  return `hsl(${hue}, 65%, 45%)`;
}
