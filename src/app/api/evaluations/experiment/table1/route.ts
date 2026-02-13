import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod/v4";
import { jsonResponse, parseRequestJson, apiHandler } from "@/lib/api-response";
import { logInfo, countMetric } from "@/lib/telemetry";
import {
  getAllReferences,
  getReference,
} from "@/features/evaluation/experiment/table1-reference";
import { reproduceTable1 } from "@/features/evaluation/experiment/reproduce-table1";

export function GET(request: NextRequest) {
  return apiHandler("api.evaluations.experiment.table1", "http.server", () => {
    const id = request.nextUrl.searchParams.get("id");

    if (id) {
      const ref = getReference(id);
      if (!ref) {
        return jsonResponse({ error: `Unknown scenario: ${id}` }, { status: 404 });
      }
      logInfo("Table 1 reference fetched", { scenarioId: id });
      countMetric("api.evaluations.experiment.table1.reference.get", 1);
      return jsonResponse(ref);
    }

    const references = getAllReferences();
    logInfo("Table 1 references listed", { count: references.length });
    countMetric("api.evaluations.experiment.table1.reference.list", 1);
    return jsonResponse({ references, count: references.length });
  });
}

const postSchema = z.object({
  experiments: z.array(z.string()).optional(),
  scale: z.number().min(0.01).max(1.0).optional().default(1.0),
  seed: z.number().int().optional().default(42),
});

export async function POST(request: NextRequest) {
  return apiHandler("api.evaluations.experiment.table1.reproduce", "http.server", async () => {
    const body = await parseRequestJson(request);
    if (body instanceof NextResponse) return body;

    const parsed = postSchema.safeParse(body);
    if (!parsed.success) {
      return jsonResponse(
        { error: "Validation failed", issues: parsed.error.issues },
        { status: 400 },
      );
    }

    const { experiments, scale, seed } = parsed.data;

    logInfo("Table 1 reproduction requested", {
      experiments: experiments?.join(",") ?? "all",
      scale,
      seed,
    });
    countMetric("api.evaluations.experiment.table1.reproduction.requested", 1);

    const options = experiments
      ? { experiments, scale, seed }
      : { scale, seed };
    const report = reproduceTable1(options);
    return jsonResponse(report);
  });
}
