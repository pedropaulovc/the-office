import { withSpan, logInfo } from "@/lib/telemetry";
import { getAgent } from "@/db/queries/agents";
import { toGeneratedPersona } from "./agent-adapter";
import { shuffleWithSeed } from "./environment-manager";
import type { GeneratedPersona } from "./types";

/**
 * Loads existing agents from the DB and converts them to GeneratedPersona format.
 */
export async function loadExistingAgents(
  agentIds: string[],
): Promise<GeneratedPersona[]> {
  return withSpan("loadExistingAgents", "experiment.existing", async () => {
    const personas: GeneratedPersona[] = [];
    for (const id of agentIds) {
      const agent = await getAgent(id);
      if (!agent) {
        throw new Error(`Agent not found: ${id}`);
      }
      personas.push(toGeneratedPersona(agent));
    }
    logInfo("Loaded existing agents", { count: personas.length });
    return personas;
  });
}

/**
 * Distributes existing agents across environments using seeded shuffle.
 * Unlike generated agents, existing agents may be reused across environments
 * if there aren't enough for unique assignment.
 */
export function assignExistingAgents(
  agents: GeneratedPersona[],
  envCount: number,
  agentsPerEnv: number,
  seed: number,
): GeneratedPersona[][] {
  // If we have enough agents for unique assignment, use normal assignment
  if (agents.length >= envCount * agentsPerEnv) {
    const shuffled = shuffleWithSeed(agents, seed);
    const environments: GeneratedPersona[][] = [];
    for (let i = 0; i < envCount; i++) {
      const start = i * agentsPerEnv;
      environments.push(shuffled.slice(start, start + agentsPerEnv));
    }
    return environments;
  }

  // Not enough agents - reuse them across environments via rotation
  const shuffled = shuffleWithSeed(agents, seed);
  const environments: GeneratedPersona[][] = [];
  for (let i = 0; i < envCount; i++) {
    const group: GeneratedPersona[] = [];
    for (let j = 0; j < agentsPerEnv; j++) {
      const idx = (i * agentsPerEnv + j) % shuffled.length;
      const agent = shuffled[idx];
      if (agent) group.push(agent);
    }
    environments.push(group);
  }
  return environments;
}
