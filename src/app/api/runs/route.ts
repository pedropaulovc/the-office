import { NextResponse } from "next/server";
import { z } from "zod/v4";
import { listRuns } from "@/db/queries";
import { enqueueRun } from "@/agents/mailbox";

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
  const { searchParams } = new URL(request.url);
  const parsed = ListRunsSchema.safeParse({
    agentId: searchParams.get("agentId") ?? undefined,
    status: searchParams.get("status") ?? undefined,
  });

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  const runs = await listRuns(parsed.data);
  return NextResponse.json(runs);
}

const CreateRunSchema = z.object({
  agentId: z.string().min(1),
  triggerMessageId: z.uuid().optional(),
  channelId: z.string().min(1).optional(),
  chainDepth: z.number().int().nonnegative().optional(),
});

export async function POST(request: Request) {
  const body: unknown = await request.json();
  const parsed = CreateRunSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  const run = await enqueueRun(parsed.data);
  return NextResponse.json(run, { status: 201 });
}
