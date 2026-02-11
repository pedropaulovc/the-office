import { getRunWithSteps } from "@/db/queries";
import { jsonResponse } from "@/lib/api-response";

interface RouteContext {
  params: Promise<{ runId: string }>;
}

export async function GET(_request: Request, context: RouteContext) {
  const { runId } = await context.params;
  const run = await getRunWithSteps(runId);

  if (!run) {
    return jsonResponse({ error: "Run not found" }, { status: 404 });
  }

  return jsonResponse(run);
}
