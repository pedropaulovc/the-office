import { jsonResponse, apiHandler } from "@/lib/api-response";
import { listAgentEvalConfigs } from "@/db/queries";
import { buildResolvedConfig } from "@/features/evaluation/config";
import { logInfo, countMetric } from "@/lib/telemetry";

export async function GET() {
  return apiHandler("api.evaluations.config.list", "http.server", async () => {
    const configs = await listAgentEvalConfigs();
    const resolved = configs.map((c) => ({
      agentId: c.agentId,
      config: buildResolvedConfig(c),
      updatedAt: c.updatedAt.toISOString(),
    }));

    logInfo("evaluations.config.list", { count: resolved.length });
    countMetric("api.evaluations.config.list", 1);

    return jsonResponse({ configs: resolved });
  });
}
