import { describe, it, expect, vi, beforeEach } from "vitest";
import type { SkillSummary, SkillDetail } from "../skills-loader";

const mockListSkills = vi.fn<() => Promise<SkillSummary[]>>();
const mockGetSkill = vi.fn<(name: string) => Promise<SkillDetail | null>>();

vi.mock("../skills-loader", () => ({
  listSkills: (...args: unknown[]) => mockListSkills(...(args as [])),
  getSkill: (...args: unknown[]) => mockGetSkill(...(args as [string])),
}));

vi.mock("@/lib/telemetry", () => ({
  withSpan: (_n: string, _o: string, fn: () => unknown) => fn(),
  logInfo: vi.fn(),
  countMetric: vi.fn(),
}));

const MOCK_SKILLS: SkillSummary[] = [
  {
    name: "character-voice",
    description: "Speech patterns and mannerisms guide for Office characters",
  },
  {
    name: "chat-etiquette",
    description: "Guidelines for when to DM vs channel post, reactions, and threading",
  },
  {
    name: "conflict-resolution",
    description: "How Office characters handle disagreements and tensions",
  },
  {
    name: "meeting-dynamics",
    description: "Conference room interaction patterns for group conversations",
  },
  {
    name: "personality-drift-check",
    description: "Self-assessment checklist for persona consistency",
  },
  {
    name: "scenario-playbook",
    description: "Classic Office scenarios and situations to reference",
  },
];

const MOCK_SKILL_DETAIL: SkillDetail = {
  name: "character-voice",
  description: "Speech patterns and mannerisms guide for Office characters",
  content:
    "# Character Voice Guide\n\nEach character has distinct speech patterns.",
};

describe("GET /api/skills", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns list of skills with name and description", async () => {
    mockListSkills.mockResolvedValue(MOCK_SKILLS);

    const { GET } = await import("../route");
    const response = await GET();
    const body = (await response.json()) as SkillSummary[];

    expect(response.status).toBe(200);
    expect(body).toHaveLength(6);
    expect(body[0]).toEqual({
      name: "character-voice",
      description:
        "Speech patterns and mannerisms guide for Office characters",
    });
  });

  it("returns empty array when no skills exist", async () => {
    mockListSkills.mockResolvedValue([]);

    const { GET } = await import("../route");
    const response = await GET();
    const body = (await response.json()) as SkillSummary[];

    expect(response.status).toBe(200);
    expect(body).toEqual([]);
  });

  it("returns skills sorted alphabetically", async () => {
    mockListSkills.mockResolvedValue(MOCK_SKILLS);

    const { GET } = await import("../route");
    const response = await GET();
    const body = (await response.json()) as SkillSummary[];

    const names = body.map((s) => s.name);
    const sorted = [...names].sort();
    expect(names).toEqual(sorted);
  });
});

describe("GET /api/skills/[name]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns full skill content for existing skill", async () => {
    mockGetSkill.mockResolvedValue(MOCK_SKILL_DETAIL);

    const routeModule = await import("../[name]/route");
    const response = await routeModule.GET(
      new Request("http://localhost/api/skills/character-voice"),
      { params: Promise.resolve({ name: "character-voice" }) },
    );
    const body = (await response.json()) as SkillDetail;

    expect(response.status).toBe(200);
    expect(body.name).toBe("character-voice");
    expect(body.description).toBe(
      "Speech patterns and mannerisms guide for Office characters",
    );
    expect(body.content).toContain("# Character Voice Guide");
    expect(body.content).toContain(
      "Each character has distinct speech patterns.",
    );
  });

  it("returns 404 for non-existent skill", async () => {
    mockGetSkill.mockResolvedValue(null);

    const routeModule = await import("../[name]/route");
    const response = await routeModule.GET(
      new Request("http://localhost/api/skills/nonexistent"),
      { params: Promise.resolve({ name: "nonexistent" }) },
    );

    expect(response.status).toBe(404);
    const body = (await response.json()) as { error: string };
    expect(body.error).toBe("Skill not found");
  });

  it("returns 400 for invalid skill name", async () => {
    const routeModule = await import("../[name]/route");
    const response = await routeModule.GET(
      new Request("http://localhost/api/skills/../secret"),
      { params: Promise.resolve({ name: "../secret" }) },
    );

    expect(response.status).toBe(400);
    const body = (await response.json()) as { error: string };
    expect(body.error).toBe("Invalid skill name");
    expect(mockGetSkill).not.toHaveBeenCalled();
  });

  it("content does not include YAML frontmatter", async () => {
    mockGetSkill.mockResolvedValue(MOCK_SKILL_DETAIL);

    const routeModule = await import("../[name]/route");
    const response = await routeModule.GET(
      new Request("http://localhost/api/skills/character-voice"),
      { params: Promise.resolve({ name: "character-voice" }) },
    );
    const body = (await response.json()) as SkillDetail;

    expect(body.content).not.toContain("---");
    expect(body.content).not.toContain("name: character-voice");
  });
});
