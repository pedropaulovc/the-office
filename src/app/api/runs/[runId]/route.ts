import { NextResponse } from "next/server";
import { getRunWithSteps } from "@/db/queries";

interface RouteContext {
  params: Promise<{ runId: string }>;
}

export async function GET(_request: Request, context: RouteContext) {
  const { runId } = await context.params;
  const run = await getRunWithSteps(runId);

  if (!run) {
    return NextResponse.json({ error: "Run not found" }, { status: 404 });
  }

  return NextResponse.json(run);
}
