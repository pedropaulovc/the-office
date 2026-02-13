import { test, expect } from "@playwright/test";

interface PropositionResponse {
  dimension: string;
  agentId: string | null;
  propositions: {
    id: string;
    claim: string;
    weight: number;
    inverted: boolean;
    recommendations_for_improvement?: string;
  }[];
  totalCount: number;
  includePersonas: boolean;
  hard: boolean;
  targetType: string;
}

const ALL_CHARACTERS = [
  "michael", "dwight", "jim", "pam", "ryan", "stanley",
  "kevin", "angela", "oscar", "andy", "toby", "creed",
  "kelly", "phyllis", "meredith", "darryl",
];

test.describe("proposition library API", () => {
  test("GET /api/evaluations/propositions loads default propositions without agentId", async ({ request }) => {
    const response = await request.get("/api/evaluations/propositions");
    expect(response.status()).toBe(200);

    const result = (await response.json()) as PropositionResponse;
    expect(result.dimension).toBe("adherence");
    expect(result.agentId).toBeNull();
    expect(result.totalCount).toBe(4); // _default.yaml has 4 propositions
    expect(result.propositions.length).toBe(4);
  });

  test("GET /api/evaluations/propositions?agentId=michael returns merged propositions", async ({ request }) => {
    const response = await request.get("/api/evaluations/propositions?agentId=michael&dimension=adherence");
    expect(response.status()).toBe(200);

    const result = (await response.json()) as PropositionResponse;
    expect(result.dimension).toBe("adherence");
    expect(result.agentId).toBe("michael");
    // 4 default + 10 michael-specific = 14
    expect(result.totalCount).toBe(14);

    // Verify default propositions present
    const ids = result.propositions.map(p => p.id);
    expect(ids).toContain("adheres-to-persona");

    // Verify michael-specific propositions present
    expect(ids).toContain("michael-self-centered-humor");
    expect(ids).toContain("michael-dry-corporate-antipattern");

    // Verify anti-pattern is inverted
    const antiPattern = result.propositions.find(p => p.id === "michael-dry-corporate-antipattern");
    expect(antiPattern?.inverted).toBe(true);
  });

  test("all 16 characters load propositions successfully", async ({ request }) => {
    const responses = await Promise.all(
      ALL_CHARACTERS.map(agentId =>
        request.get(`/api/evaluations/propositions?agentId=${agentId}&dimension=adherence`)
      ),
    );

    let totalPropositions = 0;

    for (let i = 0; i < ALL_CHARACTERS.length; i++) {
      const response = responses[i]!;
      expect(response.status()).toBe(200);

      const result = (await response.json()) as PropositionResponse;
      const agentId = ALL_CHARACTERS[i]!;

      expect(result.agentId).toBe(agentId);
      // Each agent: 4 default + 6-10 agent-specific = 10-14 total
      expect(result.totalCount).toBeGreaterThanOrEqual(10);
      expect(result.totalCount).toBeLessThanOrEqual(14);

      // Each agent must have at least 1 inverted proposition
      const invertedCount = result.propositions.filter(p => p.inverted).length;
      expect(invertedCount).toBeGreaterThanOrEqual(1);

      totalPropositions += result.totalCount;
    }

    // Total: 16 chars * (10-14) = 160-224
    expect(totalPropositions).toBeGreaterThanOrEqual(160);
    expect(totalPropositions).toBeLessThanOrEqual(240);
  });

  test("returns 200 with empty dimension query param defaulting to adherence", async ({ request }) => {
    const response = await request.get("/api/evaluations/propositions?agentId=dwight");
    expect(response.status()).toBe(200);

    const result = (await response.json()) as PropositionResponse;
    expect(result.dimension).toBe("adherence");
  });
});
