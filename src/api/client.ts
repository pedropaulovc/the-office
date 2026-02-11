import type { Agent } from "@/db/schema";

export async function fetchAgents(): Promise<Agent[]> {
  const response = await fetch("/api/agents");

  if (!response.ok) {
    throw new Error(`Failed to fetch agents: ${response.status}`);
  }

  return response.json() as Promise<Agent[]>;
}
