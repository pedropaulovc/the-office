import { describe, it, expect, vi, beforeEach } from "vitest";

const mockNeon = vi.fn();
const mockDrizzle = vi.fn(() => ({
  execute: vi.fn(),
  select: vi.fn(),
  query: {},
}));

vi.mock("@neondatabase/serverless", () => ({
  neon: mockNeon,
}));

vi.mock("drizzle-orm/neon-http", () => ({
  drizzle: mockDrizzle,
}));

interface DbClient {
  execute: unknown;
  select: unknown;
  query: unknown;
}

describe("db/client", () => {
  beforeEach(() => {
    vi.resetModules();
    mockNeon.mockClear();
    mockDrizzle.mockClear();
  });

  it("calls neon() with DATABASE_URL_UNPOOLED env var", async () => {
    const testUrl = "postgresql://test:test@test.neon.tech/testdb";
    vi.stubEnv("DATABASE_URL_UNPOOLED", testUrl);

    await import("../client");

    expect(mockNeon).toHaveBeenCalledWith(testUrl);
  });

  it("uses placeholder client when neon() throws on empty URL", async () => {
    mockNeon.mockImplementation(() => {
      throw new Error("No database connection string");
    });
    vi.stubEnv("DATABASE_URL_UNPOOLED", "");

    await import("../client");

    // drizzle() still called with a placeholder function
    expect(mockDrizzle).toHaveBeenCalledTimes(1);
    const calls = mockDrizzle.mock.calls as unknown as [{ client: unknown }][];
    expect(typeof calls[0]?.[0]?.client).toBe("function");
  });

  it("calls drizzle() with the neon client and schema", async () => {
    const mockSqlClient = vi.fn();
    mockNeon.mockReturnValue(mockSqlClient);
    vi.stubEnv("DATABASE_URL_UNPOOLED", "postgresql://test");

    await import("../client");

    expect(mockDrizzle).toHaveBeenCalledWith(
      expect.objectContaining({ client: mockSqlClient }),
    );
  });

  it("exports db with expected Drizzle methods", async () => {
    vi.stubEnv("DATABASE_URL_UNPOOLED", "postgresql://test");

    const { db } = (await import("../client")) as { db: DbClient };

    expect(db).toBeDefined();
    expect(db).toHaveProperty("execute");
    expect(db).toHaveProperty("select");
    expect(db).toHaveProperty("query");
  });
});
