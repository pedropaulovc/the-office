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

  it("calls neon() with empty string when env var is missing", async () => {
    vi.stubEnv("DATABASE_URL_UNPOOLED", "");

    await import("../client");

    expect(mockNeon).toHaveBeenCalledWith("");
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
