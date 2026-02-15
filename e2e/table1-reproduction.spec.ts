import { test, expect } from "@playwright/test";

interface MetricStat {
  mean: number;
  sd: number;
}

interface ReferenceMetric {
  treatment: MetricStat;
  control: MetricStat;
  delta: number;
  pValue: number;
  significant: boolean;
}

interface ReferenceEntry {
  scenarioId: string;
  experimentLabel: string;
  agentsCount: number;
  metrics: Record<string, ReferenceMetric>;
}

interface ReferencesListResponse {
  count: number;
  references: ReferenceEntry[];
}

interface TrendEntry {
  dimension: string;
  sameDirection: boolean;
}

interface ComparisonEntry {
  scenarioId: string;
  matchedCount: number;
  totalSignificant: number;
  reproductionScore: number;
  trends: TrendEntry[];
}

interface FullComparisonResponse {
  experiments: ComparisonEntry[];
  overallMatchedCount: number;
  overallTotalSignificant: number;
  overallReproductionScore: number;
  timestamp: string;
}

test.describe("table 1 reproduction API", () => {
  test("GET returns all reference values", async ({ request }) => {
    const response = await request.get("/api/evaluations/experiment/table1");
    expect(response.status()).toBe(200);

    const body = (await response.json()) as ReferencesListResponse;
    expect(body.count).toBe(4);
    expect(body.references).toHaveLength(4);

    for (const ref of body.references) {
      expect(ref).toHaveProperty("scenarioId");
      expect(ref).toHaveProperty("experimentLabel");
      expect(ref).toHaveProperty("metrics");
    }
  });

  test("GET with id returns single reference", async ({ request }) => {
    const response = await request.get(
      "/api/evaluations/experiment/table1?id=brainstorming-average",
    );
    expect(response.status()).toBe(200);

    const body = (await response.json()) as ReferenceEntry;
    expect(body.scenarioId).toBe("brainstorming-average");
    expect(body.experimentLabel).toBe("Exp. 1");
    expect(body.agentsCount).toBe(200);

    const dims = Object.keys(body.metrics);
    expect(dims).toHaveLength(5);
    expect(dims).toEqual(
      expect.arrayContaining([
        "adherence",
        "consistency",
        "fluency",
        "convergence",
        "ideas_quantity",
      ]),
    );
  });

  test("GET with unknown id returns 404", async ({ request }) => {
    const response = await request.get(
      "/api/evaluations/experiment/table1?id=nonexistent",
    );
    expect(response.status()).toBe(404);
  });

  test("POST runs reproduction for single experiment", async ({ request }) => {
    const response = await request.post("/api/evaluations/experiment/table1", {
      data: { experiments: ["debate-controversial"], seed: 42 },
    });
    expect(response.status()).toBe(200);

    const body = (await response.json()) as FullComparisonResponse;
    expect(body.experiments).toHaveLength(1);

    const [entry] = body.experiments;
    expect(entry).toBeDefined();
    expect(entry?.scenarioId).toBe("debate-controversial");
    expect(typeof entry?.matchedCount).toBe("number");
    expect(typeof entry?.totalSignificant).toBe("number");
    expect(typeof entry?.reproductionScore).toBe("number");
    expect(Array.isArray(entry?.trends)).toBe(true);
    expect(entry?.trends.length).toBeGreaterThan(0);
  });

  test("POST with all experiments returns full report", async ({ request }) => {
    const response = await request.post("/api/evaluations/experiment/table1", {
      data: { seed: 42 },
    });
    expect(response.status()).toBe(200);

    const body = (await response.json()) as FullComparisonResponse;
    expect(body.experiments).toHaveLength(4);
    expect(typeof body.overallMatchedCount).toBe("number");
    expect(typeof body.overallTotalSignificant).toBe("number");
    expect(typeof body.overallReproductionScore).toBe("number");
    expect(body.timestamp).toBeDefined();
  });

  test("reference values have correct metric structure", async ({
    request,
  }) => {
    const response = await request.get("/api/evaluations/experiment/table1");
    expect(response.status()).toBe(200);

    const body = (await response.json()) as ReferencesListResponse;

    for (const ref of body.references) {
      for (const metric of Object.values(ref.metrics)) {
        expect(typeof metric.treatment.mean).toBe("number");
        expect(typeof metric.treatment.sd).toBe("number");
        expect(typeof metric.control.mean).toBe("number");
        expect(typeof metric.control.sd).toBe("number");
        expect(typeof metric.delta).toBe("number");
        expect(typeof metric.pValue).toBe("number");
        expect(typeof metric.significant).toBe("boolean");
      }
    }
  });
});
