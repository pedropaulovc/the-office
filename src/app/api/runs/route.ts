import { z } from "zod/v4";
import { NextResponse } from "next/server";
import { listRuns } from "@/db/queries";
import { enqueueRun } from "@/agents/mailbox";
import { jsonResponse, parseRequestJson, apiHandler } from "@/lib/api-response";

const VALID_STATUSES = [
  "created",
  "running",
  "completed",
  "failed",
  "cancelled",
] as const;

const ListRunsSchema = z.object({
  agentId: z.string().min(1).optional(),
  status: z.enum(VALID_STATUSES).optional(),
});

export async function GET(request: Request) {
  return apiHandler("api.runs.list", "http.server", async () => {
    const { searchParams } = new URL(request.url);
    const parsed = ListRunsSchema.safeParse({
      agentId: searchParams.get("agentId") ?? undefined,
      status: searchParams.get("status") ?? undefined,
    });

    if (!parsed.success) {
      return jsonResponse(
        { error: "Validation failed", issues: parsed.error.issues },
        { status: 400 },
      );
    }

    const runs = await listRuns(parsed.data);
    return jsonResponse(runs);
  });
}

const CreateRunSchema = z.object({
  agentId: z.string().min(1),
  triggerMessageId: z.uuid().optional(),
  channelId: z.string().min(1).optional(),
  chainDepth: z.number().int().nonnegative().optional(),
});

export async function POST(request: Request) {
  return apiHandler("api.runs.create", "http.server", async () => {
    const body = await parseRequestJson(request);
    if (body instanceof NextResponse) return body;

    const parsed = CreateRunSchema.safeParse(body);

    if (!parsed.success) {
      return jsonResponse(
        { error: "Validation failed", issues: parsed.error.issues },
        { status: 400 },
      );
    }

    const run = await enqueueRun(parsed.data);
    return jsonResponse(run, { status: 201 });
  });
}
