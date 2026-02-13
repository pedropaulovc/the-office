import { NextResponse } from "next/server";
import { z } from "zod/v4";
import { jsonResponse, parseRequestJson, apiHandler } from "@/lib/api-response";
import { logInfo, countMetric } from "@/lib/telemetry";
import {
  listInterventionLogs,
  createInterventionLog,
} from "@/db/queries/intervention-logs";

const createInterventionSchema = z.object({
  agentId: z.string().min(1),
  channelId: z.string().optional(),
  interventionType: z.enum(["anti_convergence", "variety", "custom"]),
  textualPrecondition: z.string().optional(),
  functionalPreconditionResult: z.boolean().optional(),
  fired: z.boolean(),
  nudgeText: z.string().optional(),
});

export async function GET(request: Request) {
  return apiHandler("api.evaluations.interventions", "http.server", async () => {
    const url = new URL(request.url);
    const agentId = url.searchParams.get("agentId") ?? undefined;
    const channelId = url.searchParams.get("channelId") ?? undefined;
    const rawInterventionType = url.searchParams.get("interventionType");
    const validTypes = ["anti_convergence", "variety", "custom"] as const;
    const interventionType =
      rawInterventionType && validTypes.includes(rawInterventionType as (typeof validTypes)[number])
        ? (rawInterventionType as (typeof validTypes)[number])
        : undefined;
    const firedParam = url.searchParams.get("fired");
    const fired = firedParam === "true" ? true : firedParam === "false" ? false : undefined;
    const limitParam = url.searchParams.get("limit");
    const limit = limitParam ? parseInt(limitParam, 10) : 50;

    const logs = await listInterventionLogs({
      ...(agentId ? { agentId } : {}),
      ...(channelId ? { channelId } : {}),
      ...(interventionType ? { interventionType } : {}),
      ...(fired !== undefined ? { fired } : {}),
      limit,
    });

    logInfo("interventions.list", { count: logs.length, ...(agentId ? { agentId } : {}) });
    countMetric("api.evaluations.interventions.list", 1);

    return jsonResponse({ logs });
  });
}

export async function POST(request: Request) {
  return apiHandler("api.evaluations.interventions.create", "http.server", async () => {
    const body = await parseRequestJson(request);
    if (body instanceof NextResponse) return body;

    const parsed = createInterventionSchema.safeParse(body);
    if (!parsed.success) {
      return jsonResponse(
        { error: "Validation failed", issues: parsed.error.issues },
        { status: 400 },
      );
    }

    const data = parsed.data;
    const log = await createInterventionLog({
      agentId: data.agentId,
      channelId: data.channelId ?? null,
      interventionType: data.interventionType,
      textualPrecondition: data.textualPrecondition ?? null,
      functionalPreconditionResult: data.functionalPreconditionResult ?? null,
      fired: data.fired,
      nudgeText: data.nudgeText ?? null,
    });

    logInfo("interventions.created", {
      id: log.id,
      agentId: data.agentId,
      interventionType: data.interventionType,
      fired: data.fired,
    });
    countMetric("api.evaluations.interventions.create", 1);

    return jsonResponse({ log });
  });
}
