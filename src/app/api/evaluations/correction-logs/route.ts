import { jsonResponse, apiHandler } from "@/lib/api-response";
import { listCorrectionLogs } from "@/db/queries/correction-logs";

export async function GET(request: Request) {
  return apiHandler("api.evaluations.correction-logs", "http.server", async () => {
    const url = new URL(request.url);
    const agentId = url.searchParams.get("agentId") ?? undefined;
    const limitParam = url.searchParams.get("limit");
    const limit = limitParam ? parseInt(limitParam, 10) : 50;

    const logs = await listCorrectionLogs({ ...(agentId ? { agentId } : {}), limit });
    return jsonResponse(logs);
  });
}
