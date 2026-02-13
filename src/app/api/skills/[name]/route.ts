import { jsonResponse } from "@/lib/api-response";
import { withSpan } from "@/lib/telemetry";
import { getSkill } from "../skills-loader";

export type { SkillDetail } from "../skills-loader";

const VALID_SKILL_NAME = /^[a-z0-9-]+$/;

interface RouteContext {
  params: Promise<{ name: string }>;
}

export async function GET(_request: Request, context: RouteContext) {
  const { name } = await context.params;

  if (!VALID_SKILL_NAME.test(name)) {
    return jsonResponse({ error: "Invalid skill name" }, { status: 400 });
  }

  return withSpan("api.skills.get", "http.server", async () => {
    const skill = await getSkill(name);

    if (!skill) {
      return jsonResponse({ error: "Skill not found" }, { status: 404 });
    }

    return jsonResponse(skill);
  });
}
