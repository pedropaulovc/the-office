import { jsonResponse } from "@/lib/api-response";
import { withSpan } from "@/lib/telemetry";
import { getSkill } from "../skills-loader";

export type { SkillDetail } from "../skills-loader";

interface RouteContext {
  params: Promise<{ name: string }>;
}

export async function GET(_request: Request, context: RouteContext) {
  const { name } = await context.params;

  return withSpan("GET /api/skills/[name]", "http.handler", async () => {
    const skill = await getSkill(name);

    if (!skill) {
      return jsonResponse({ error: "Skill not found" }, { status: 404 });
    }

    return jsonResponse(skill);
  });
}
