import { test, expect } from "@playwright/test";

test.describe("prompt builder API", () => {
  test("GET /api/agents/[agentId]/prompt returns assembled prompt", async ({
    request,
  }) => {
    const response = await request.get(
      "/api/agents/michael/prompt?channelId=general",
    );

    expect(response.status()).toBe(200);
    const body = (await response.json()) as {
      agentId: string;
      channelId: string;
      sections: { persona: string };
      prompt: string;
    };
    expect(body.agentId).toBe("michael");
    expect(body.channelId).toBe("general");
    expect(body.sections.persona).toBeTruthy();
    expect(body.prompt).toContain("send_message");
    expect(body.prompt).toContain("do_nothing");
  });

  test("GET /api/agents/[agentId]/prompt returns 404 for unknown agent", async ({
    request,
  }) => {
    const response = await request.get("/api/agents/nonexistent/prompt");
    expect(response.status()).toBe(404);
  });
});
