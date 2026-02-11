import { cancelRun } from "@/db/queries";
import { jsonResponse } from "@/lib/api-response";

interface RouteContext {
  params: Promise<{ runId: string }>;
}

export async function POST(_request: Request, context: RouteContext) {
  const { runId } = await context.params;
  const { run, error } = await cancelRun(runId);

  if (!run) {
    return jsonResponse({ error: "Run not found" }, { status: 404 });
  }

  if (error) {
    return jsonResponse({ error }, { status: 409 });
  }

  return jsonResponse(run);
}
