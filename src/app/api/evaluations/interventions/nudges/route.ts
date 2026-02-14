import { jsonResponse, apiHandler } from "@/lib/api-response";
import { getNudgeText } from "@/features/evaluation/interventions/nudge-templates";
import type { NudgeType } from "@/features/evaluation/interventions/types";

const NUDGE_TYPES: NudgeType[] = [
  "devils_advocate",
  "change_subject",
  "personal_story",
  "challenging_question",
  "new_ideas",
];

export async function GET(request: Request) {
  return apiHandler("api.evaluations.interventions.nudges", "http.server", async () => {
    const url = new URL(request.url);
    const agentId = url.searchParams.get("agentId");
    const nudgeType = url.searchParams.get("nudgeType") as NudgeType | null;

    if (agentId && nudgeType) {
      if (!NUDGE_TYPES.includes(nudgeType)) {
        return jsonResponse(
          { error: `Invalid nudgeType. Must be one of: ${NUDGE_TYPES.join(", ")}` },
          { status: 400 },
        );
      }
      return jsonResponse({
        agentId,
        nudgeType,
        text: getNudgeText(agentId, nudgeType),
      });
    }

    if (agentId) {
      const nudges = Object.fromEntries(
        NUDGE_TYPES.map((type) => [type, getNudgeText(agentId, type)]),
      );
      return jsonResponse({ agentId, nudges });
    }

    return jsonResponse({
      nudgeTypes: NUDGE_TYPES,
      usage: "Pass ?agentId=michael to get all nudges for a character, or ?agentId=michael&nudgeType=devils_advocate for a specific one.",
    });
  });
}
