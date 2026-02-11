import { z } from "zod/v4";
import { getAgent, listArchivalPassages, createArchivalPassage } from "@/db/queries";
import { jsonResponse } from "@/lib/api-response";

const CreatePassageSchema = z.object({
  content: z.string().min(1),
  tags: z.array(z.string()).optional(),
});

interface RouteContext { params: Promise<{ agentId: string }> }

export async function GET(request: Request, context: RouteContext) {
  const { agentId } = await context.params;
  const agent = await getAgent(agentId);

  if (!agent) {
    return jsonResponse({ error: "Agent not found" }, { status: 404 });
  }

  const url = new URL(request.url);
  const query = url.searchParams.get("q") ?? undefined;
  const passages = await listArchivalPassages(agentId, query);
  return jsonResponse(passages);
}

export async function POST(request: Request, context: RouteContext) {
  const { agentId } = await context.params;
  const agent = await getAgent(agentId);

  if (!agent) {
    return jsonResponse({ error: "Agent not found" }, { status: 404 });
  }

  const body: unknown = await request.json();
  const parsed = CreatePassageSchema.safeParse(body);

  if (!parsed.success) {
    return jsonResponse(
      { error: "Validation failed", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  const passage = await createArchivalPassage({
    agentId,
    content: parsed.data.content,
    tags: parsed.data.tags,
  });
  return jsonResponse(passage, { status: 201 });
}
