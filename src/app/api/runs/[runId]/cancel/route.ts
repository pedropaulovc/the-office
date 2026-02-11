import { NextResponse } from "next/server";
import { cancelRun } from "@/db/queries";

interface RouteContext {
  params: Promise<{ runId: string }>;
}

export async function POST(_request: Request, context: RouteContext) {
  const { runId } = await context.params;
  const { run, error } = await cancelRun(runId);

  if (!run) {
    return NextResponse.json({ error: "Run not found" }, { status: 404 });
  }

  if (error) {
    return NextResponse.json({ error }, { status: 409 });
  }

  return NextResponse.json(run);
}
