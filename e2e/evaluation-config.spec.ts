import { test, expect } from "@playwright/test";

interface ResolvedConfigResponse {
  agentId: string;
  config: {
    pipeline: {
      dimensions: {
        persona_adherence: { enabled: boolean; threshold: number };
        self_consistency: { enabled: boolean; threshold: number };
        fluency: { enabled: boolean; threshold: number };
        suitability: { enabled: boolean; threshold: number };
      };
      similarity: { enabled: boolean; threshold: number };
      enableRegeneration: boolean;
      enableDirectCorrection: boolean;
      maxCorrectionAttempts: number;
      continueOnFailure: boolean;
      minimumRequiredQtyOfActions: number;
    };
    interventions: {
      antiConvergenceEnabled: boolean;
      convergenceThreshold: number;
      varietyInterventionEnabled: boolean;
      varietyMessageThreshold: number;
    };
    repetition: {
      enabled: boolean;
      threshold: number;
    };
  };
}

interface ConfigListResponse {
  configs: (ResolvedConfigResponse & { updatedAt: string })[];
}

interface CostSummaryResponse {
  agentId: string | null;
  correctionTokens: { input: number; output: number };
  interventionTokens: { input: number; output: number };
  totalTokens: { input: number; output: number };
  estimatedCostUsd: number;
}

test.describe("Evaluation Config & Costs (S-7.3)", () => {
  test("GET /api/evaluations/config returns list of configs", async ({
    request,
  }) => {
    const res = await request.get("/api/evaluations/config");
    expect(res.status()).toBe(200);
    const body = (await res.json()) as ConfigListResponse;
    expect(body.configs).toBeDefined();
    expect(Array.isArray(body.configs)).toBe(true);
  });

  test("GET /api/evaluations/config/[agentId] returns resolved config", async ({
    request,
  }) => {
    const res = await request.get("/api/evaluations/config/michael");
    expect(res.status()).toBe(200);
    const body = (await res.json()) as ResolvedConfigResponse;
    expect(body.agentId).toBe("michael");
    expect(body.config).toBeDefined();
    expect(body.config.pipeline).toBeDefined();
    expect(body.config.interventions).toBeDefined();
    expect(body.config.repetition).toBeDefined();
  });

  test("PATCH /api/evaluations/config/[agentId] updates config", async ({
    request,
  }) => {
    const res = await request.patch("/api/evaluations/config/michael", {
      data: {
        gateAdherenceEnabled: true,
        gateAdherenceThreshold: 8.0,
      },
    });
    expect(res.status()).toBe(200);
    const body = (await res.json()) as ResolvedConfigResponse;
    expect(body.config.pipeline.dimensions.persona_adherence.enabled).toBe(
      true,
    );
    expect(body.config.pipeline.dimensions.persona_adherence.threshold).toBe(
      8.0,
    );

    // Reset back to defaults
    await request.patch("/api/evaluations/config/michael", {
      data: {
        gateAdherenceEnabled: false,
        gateAdherenceThreshold: 7.0,
      },
    });
  });

  test("GET /api/evaluations/config/[agentId] returns defaults for unknown agent", async ({
    request,
  }) => {
    const res = await request.get(
      "/api/evaluations/config/unknown-agent-xyz",
    );
    expect(res.status()).toBe(200);
    const body = (await res.json()) as ResolvedConfigResponse;
    // Should return defaults since no config exists
    expect(body.config.pipeline.dimensions.persona_adherence.enabled).toBe(
      false,
    );
    expect(body.config.interventions.antiConvergenceEnabled).toBe(false);
    expect(body.config.repetition.enabled).toBe(false);
  });

  test("GET /api/evaluations/costs returns cost summary", async ({
    request,
  }) => {
    const res = await request.get("/api/evaluations/costs");
    expect(res.status()).toBe(200);
    const body = (await res.json()) as CostSummaryResponse;
    expect(body.correctionTokens).toBeDefined();
    expect(body.interventionTokens).toBeDefined();
    expect(body.totalTokens).toBeDefined();
    expect(typeof body.estimatedCostUsd).toBe("number");
  });

  test("GET /api/evaluations/costs with agentId filter", async ({
    request,
  }) => {
    const res = await request.get(
      "/api/evaluations/costs?agentId=michael",
    );
    expect(res.status()).toBe(200);
    const body = (await res.json()) as CostSummaryResponse;
    expect(body.agentId).toBe("michael");
  });

  test("PATCH updates are persisted", async ({ request }) => {
    // Update
    await request.patch("/api/evaluations/config/jim", {
      data: {
        repetitionSuppressionEnabled: true,
        repetitionThreshold: 0.5,
      },
    });

    // Verify persisted
    const res = await request.get("/api/evaluations/config/jim");
    const body = (await res.json()) as ResolvedConfigResponse;
    expect(body.config.repetition.enabled).toBe(true);
    expect(body.config.repetition.threshold).toBeCloseTo(0.5);

    // Reset
    await request.patch("/api/evaluations/config/jim", {
      data: {
        repetitionSuppressionEnabled: false,
        repetitionThreshold: 0.3,
      },
    });
  });
});
