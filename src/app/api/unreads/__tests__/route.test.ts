import { describe, it, expect, vi, beforeEach } from "vitest";

const mockGetUnreadsByUser = vi.fn<(userId: string) => Promise<Record<string, number>>>();
const mockMarkChannelRead = vi.fn<(userId: string, channelId: string) => Promise<void>>();

vi.mock("@/db/queries", () => ({
  getUnreadsByUser: (...args: unknown[]) => mockGetUnreadsByUser(...args as [string]),
  markChannelRead: (...args: unknown[]) => mockMarkChannelRead(...args as [string, string]),
}));

describe("GET /api/unreads", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 200 with unread counts for a user", async () => {
    const unreads = { sales: 3, "party-planning": 5 };
    mockGetUnreadsByUser.mockResolvedValue(unreads);

    const { GET } = await import("../route");
    const response = await GET(
      new Request("http://localhost/api/unreads?userId=michael"),
    );
    const body = await response.json() as Record<string, number>;

    expect(response.status).toBe(200);
    expect(body).toEqual(unreads);
    expect(mockGetUnreadsByUser).toHaveBeenCalledWith("michael");
  });

  it("returns 400 when userId is missing", async () => {
    const { GET } = await import("../route");
    const response = await GET(
      new Request("http://localhost/api/unreads"),
    );

    expect(response.status).toBe(400);
  });

  it("returns empty object when user has no unreads", async () => {
    mockGetUnreadsByUser.mockResolvedValue({});

    const { GET } = await import("../route");
    const response = await GET(
      new Request("http://localhost/api/unreads?userId=oscar"),
    );
    const body = await response.json() as Record<string, number>;

    expect(response.status).toBe(200);
    expect(body).toEqual({});
  });
});

describe("POST /api/unreads/mark-read", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 204 on successful mark-read", async () => {
    mockMarkChannelRead.mockResolvedValue(undefined);

    const routeModule = await import("../mark-read/route");
    const response = await routeModule.POST(
      new Request("http://localhost/api/unreads/mark-read", {
        method: "POST",
        body: JSON.stringify({ userId: "michael", channelId: "general" }),
      }),
    );

    expect(response.status).toBe(204);
    expect(mockMarkChannelRead).toHaveBeenCalledWith("michael", "general");
  });

  it("returns 400 when userId is missing", async () => {
    const routeModule = await import("../mark-read/route");
    const response = await routeModule.POST(
      new Request("http://localhost/api/unreads/mark-read", {
        method: "POST",
        body: JSON.stringify({ channelId: "general" }),
      }),
    );

    expect(response.status).toBe(400);
  });

  it("returns 400 when channelId is missing", async () => {
    const routeModule = await import("../mark-read/route");
    const response = await routeModule.POST(
      new Request("http://localhost/api/unreads/mark-read", {
        method: "POST",
        body: JSON.stringify({ userId: "michael" }),
      }),
    );

    expect(response.status).toBe(400);
  });
});
