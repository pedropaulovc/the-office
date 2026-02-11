import { test, expect } from "@playwright/test";

interface ChannelResponse {
  id: string;
  name: string;
  kind: "public" | "private" | "dm";
  topic: string;
  memberIds: string[];
}

interface MessageResponse {
  id: string;
  channelId: string;
  userId: string;
  text: string;
  timestamp: string;
  reactions: { emoji: string; userIds: string[] }[];
  threadReplyCount: number;
  threadParticipantIds?: string[];
}

interface ThreadReplyResponse {
  id: string;
  parentMessageId: string;
  userId: string;
  text: string;
  timestamp: string;
  reactions: { emoji: string; userIds: string[] }[];
}

interface ErrorResponse {
  error: string;
}

test.describe("messages API", () => {
  test("GET /api/channels returns 200 with channel list", async ({
    request,
  }) => {
    const response = await request.get("/api/channels");

    expect(response.status()).toBe(200);
    const channels = (await response.json()) as ChannelResponse[];
    expect(channels.length).toBeGreaterThanOrEqual(7);

    const general = channels.find((c) => c.id === "general");
    expect(general).toBeDefined();
    expect(general?.name).toBe("general");
    expect(general?.kind).toBe("public");
    expect(general?.memberIds.length).toBeGreaterThanOrEqual(10);
  });

  test("GET /api/channels?kind=dm&userId=michael returns DMs", async ({
    request,
  }) => {
    const response = await request.get(
      "/api/channels?kind=dm&userId=michael",
    );

    expect(response.status()).toBe(200);
    const dms = (await response.json()) as ChannelResponse[];
    expect(dms.length).toBeGreaterThanOrEqual(1);
    for (const dm of dms) {
      expect(dm.kind).toBe("dm");
      expect(dm.memberIds).toContain("michael");
    }
  });

  test("GET /api/channels/general returns channel with members", async ({
    request,
  }) => {
    const response = await request.get("/api/channels/general");

    expect(response.status()).toBe(200);
    const channel = (await response.json()) as ChannelResponse;
    expect(channel.id).toBe("general");
    expect(channel.memberIds).toContain("michael");
  });

  test("GET /api/channels/nonexistent returns 404", async ({ request }) => {
    const response = await request.get("/api/channels/nonexistent-channel");

    expect(response.status()).toBe(404);
  });

  test("POST creates channel, DELETE cascades", async ({ request }) => {
    const testId = `e2e-ch-${Date.now()}`;

    // POST — create
    const createRes = await request.post("/api/channels", {
      data: {
        id: testId,
        name: testId,
        kind: "public",
        topic: "E2E test channel",
        memberIds: ["michael", "jim"],
      },
    });
    expect(createRes.status()).toBe(201);
    const created = (await createRes.json()) as ChannelResponse;
    expect(created.id).toBe(testId);
    expect(created.memberIds).toEqual(["michael", "jim"]);

    // POST duplicate — 409
    const dupRes = await request.post("/api/channels", {
      data: {
        id: testId,
        name: "Duplicate",
        kind: "public",
      },
    });
    expect(dupRes.status()).toBe(409);

    // DELETE — cascade
    const deleteRes = await request.delete(`/api/channels/${testId}`);
    expect(deleteRes.status()).toBe(200);

    // Verify deleted
    const getRes = await request.get(`/api/channels/${testId}`);
    expect(getRes.status()).toBe(404);
  });

  test("POST dm enforces 2 memberIds", async ({ request }) => {
    const response = await request.post("/api/channels", {
      data: {
        id: "dm-test-bad",
        name: "dm-test-bad",
        kind: "dm",
        memberIds: ["michael"],
      },
    });
    expect(response.status()).toBe(400);
    const body = (await response.json()) as ErrorResponse;
    expect(body.error).toContain("2 memberIds");
  });

  test("GET /api/channels/general/messages returns messages", async ({
    request,
  }) => {
    const response = await request.get("/api/channels/general/messages");

    expect(response.status()).toBe(200);
    const messages = (await response.json()) as MessageResponse[];
    expect(messages.length).toBeGreaterThanOrEqual(10);

    // Check first message has expected shape
    const first = messages[0];
    expect(first).toBeDefined();
    expect(first?.channelId).toBe("general");
    expect(first?.userId).toBeTruthy();
    expect(first?.text).toBeTruthy();
    expect(first?.timestamp).toBeTruthy();
    expect(Array.isArray(first?.reactions)).toBe(true);
    expect(typeof first?.threadReplyCount).toBe("number");
  });

  test("messages include thread reply counts and reactions", async ({
    request,
  }) => {
    const response = await request.get("/api/channels/general/messages");
    const messages = (await response.json()) as MessageResponse[];

    // At least one message should have thread replies
    const withThreads = messages.filter((m) => m.threadReplyCount > 0);
    expect(withThreads.length).toBeGreaterThanOrEqual(1);

    // At least one message should have reactions
    const withReactions = messages.filter((m) => m.reactions.length > 0);
    expect(withReactions.length).toBeGreaterThanOrEqual(1);
  });

  test("GET /api/messages/{id}/replies returns thread replies", async ({
    request,
  }) => {
    // First get a message with threads
    const msgsRes = await request.get("/api/channels/general/messages");
    const messages = (await msgsRes.json()) as MessageResponse[];
    const withThread = messages.find((m) => m.threadReplyCount > 0);
    expect(withThread).toBeDefined();

    const repliesRes = await request.get(
      `/api/messages/${withThread?.id}/replies`,
    );
    expect(repliesRes.status()).toBe(200);
    const replies = (await repliesRes.json()) as ThreadReplyResponse[];
    expect(replies.length).toBe(withThread?.threadReplyCount);

    const first = replies[0];
    expect(first).toBeDefined();
    expect(first?.parentMessageId).toBe(withThread?.id);
    expect(first?.userId).toBeTruthy();
    expect(first?.text).toBeTruthy();
  });

  test("GET /api/channels/general/members returns member IDs", async ({
    request,
  }) => {
    const response = await request.get("/api/channels/general/members");

    expect(response.status()).toBe(200);
    const members = (await response.json()) as string[];
    expect(members.length).toBeGreaterThanOrEqual(10);
    expect(members).toContain("michael");
  });

  test("POST/DELETE channel members", async ({ request }) => {
    const testId = `e2e-memb-${Date.now()}`;

    // Create a test channel
    await request.post("/api/channels", {
      data: {
        id: testId,
        name: testId,
        kind: "public",
        memberIds: ["michael"],
      },
    });

    // Add member
    const addRes = await request.post(`/api/channels/${testId}/members`, {
      data: { userId: "jim" },
    });
    expect(addRes.status()).toBe(201);

    // Verify
    const listRes = await request.get(`/api/channels/${testId}/members`);
    const members = (await listRes.json()) as string[];
    expect(members).toContain("jim");

    // Remove
    const removeRes = await request.delete(
      `/api/channels/${testId}/members/jim`,
    );
    expect(removeRes.status()).toBe(200);

    // Verify removed
    const listRes2 = await request.get(`/api/channels/${testId}/members`);
    const members2 = (await listRes2.json()) as string[];
    expect(members2).not.toContain("jim");

    // Cleanup
    await request.delete(`/api/channels/${testId}`);
  });

  test("POST returns 400 for invalid body", async ({ request }) => {
    const response = await request.post("/api/channels", {
      data: { id: "" },
    });
    expect(response.status()).toBe(400);
    const body = (await response.json()) as ErrorResponse;
    expect(body.error).toBe("Validation failed");
  });
});
