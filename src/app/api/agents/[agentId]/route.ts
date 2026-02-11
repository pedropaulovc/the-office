import { NextResponse } from "next/server";
import { z } from "zod/v4";
import { getAgent, updateAgent, deleteAgent } from "@/db/queries";

const UpdateAgentSchema = z.object({
  displayName: z.string().min(1).optional(),
  title: z.string().min(1).optional(),
  avatarColor: z.string().min(1).optional(),
  systemPrompt: z.string().min(1).optional(),
  modelId: z.string().optional(),
  maxTurns: z.number().int().positive().optional(),
  maxBudgetUsd: z.number().positive().optional(),
  isActive: z.boolean().optional(),
  sessionId: z.string().nullable().optional(),
});

interface RouteContext { params: Promise<{ agentId: string }> }

export async function GET(_request: Request, context: RouteContext) {
  const { agentId } = await context.params;
  const agent = await getAgent(agentId);

  if (!agent) {
    return NextResponse.json({ error: "Agent not found" }, { status: 404 });
  }

  return NextResponse.json(agent);
}

export async function PATCH(request: Request, context: RouteContext) {
  const { agentId } = await context.params;
  const body: unknown = await request.json();
  const parsed = UpdateAgentSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  // Strip undefined values to satisfy exactOptionalPropertyTypes
  const updates = Object.fromEntries(
    Object.entries(parsed.data).filter(([, v]) => v !== undefined),
  );
  const agent = await updateAgent(agentId, updates);

  if (!agent) {
    return NextResponse.json({ error: "Agent not found" }, { status: 404 });
  }

  return NextResponse.json(agent);
}

export async function DELETE(_request: Request, context: RouteContext) {
  const { agentId } = await context.params;
  const agent = await deleteAgent(agentId);

  if (!agent) {
    return NextResponse.json({ error: "Agent not found" }, { status: 404 });
  }

  return NextResponse.json(agent);
}
