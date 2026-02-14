import { jsonResponse, apiHandler } from "@/lib/api-response";
import { listGoldenBaselines } from "@/features/evaluation/harness/baseline-manager";
import { logInfo, countMetric } from "@/lib/telemetry";

export async function GET() {
  return apiHandler("api.golden-baselines.list", "http.server", () => {
    const baselines = listGoldenBaselines();

    logInfo("golden baselines listed", { count: baselines.length });
    countMetric("api.golden-baselines.list", 1);

    return jsonResponse(baselines);
  });
}
