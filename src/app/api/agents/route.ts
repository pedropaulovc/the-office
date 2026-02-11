import { z } from "zod/v4";
import { listAgents, createAgent, getAgent } from "@/db/queries";
import { jsonResponse } from "@/lib/api-response";

const CreateAgentSchema = z.object({
  id: z.string().min(1),
  displayName: z.string().min(1),
  title: z.string().min(1),
  avatarColor: z.string().min(1),
  systemPrompt: z.string().min(1),
  modelId: z.string().optional(),
  maxTurns: z.number().int().positive().optional(),
  maxBudgetUsd: z.number().positive().optional(),
  isActive: z.boolean().optional(),
});

export async function GET() {
  const agents = await listAgents();
  return jsonResponse(agents);
}

export async function POST(request: Request) {
  const body: unknown = await request.json();
  const parsed = CreateAgentSchema.safeParse(body);

  if (!parsed.success) {
    return jsonResponse(
      { error: "Validation failed", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  const existing = await getAgent(parsed.data.id);
  if (existing) {
    return jsonResponse(
      { error: `Agent with id '${parsed.data.id}' already exists` },
      { status: 409 },
    );
  }

  const agent = await createAgent(parsed.data);
  return jsonResponse(agent, { status: 201 });
}
