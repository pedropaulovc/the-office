import { jsonResponse } from "@/lib/api-response";
import { withSpan } from "@/lib/telemetry";
import { listSkills } from "./skills-loader";

export type { SkillSummary } from "./skills-loader";

export async function GET() {
  return withSpan("api.skills.list", "http.server", async () => {
    const skills = await listSkills();
    return jsonResponse(skills);
  });
}
