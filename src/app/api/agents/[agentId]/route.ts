import { z } from "zod/v4";
import { NextResponse } from "next/server";
import { getAgent, updateAgent, deleteAgent } from "@/db/queries";
import { jsonResponse, parseRequestJson, apiHandler } from "@/lib/api-response";

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
  return apiHandler("api.agents.get", "http.server", async () => {
    const { agentId } = await context.params;
    const agent = await getAgent(agentId);

    if (!agent) {
      return jsonResponse({ error: "Agent not found" }, { status: 404 });
    }

    return jsonResponse(agent);
  });
}

export async function PATCH(request: Request, context: RouteContext) {
  return apiHandler("api.agents.update", "http.server", async () => {
    const { agentId } = await context.params;

    const body = await parseRequestJson(request);
    if (body instanceof NextResponse) return body;

    const parsed = UpdateAgentSchema.safeParse(body);

    if (!parsed.success) {
      return jsonResponse(
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
      return jsonResponse({ error: "Agent not found" }, { status: 404 });
    }

    return jsonResponse(agent);
  });
}

export async function DELETE(_request: Request, context: RouteContext) {
  return apiHandler("api.agents.delete", "http.server", async () => {
    const { agentId } = await context.params;
    const agent = await deleteAgent(agentId);

    if (!agent) {
      return jsonResponse({ error: "Agent not found" }, { status: 404 });
    }

    return jsonResponse(agent);
  });
}
