import { resolve } from "path";
import { describe, it, expect, vi } from "vitest";

interface DrizzleConfig {
  dialect: string;
  schema: string;
  out: string;
  dbCredentials: { url: string };
}

const configPath = resolve(__dirname, "../../../drizzle.config");

describe("drizzle.config", () => {
  it("uses postgresql dialect", async () => {
    vi.stubEnv("DATABASE_URL_UNPOOLED", "postgresql://test");
    vi.resetModules();

    const { default: config } = (await import(configPath)) as {
      default: DrizzleConfig;
    };

    expect(config.dialect).toBe("postgresql");
  });

  it("points schema to src/db/schema/index.ts", async () => {
    vi.stubEnv("DATABASE_URL_UNPOOLED", "postgresql://test");
    vi.resetModules();

    const { default: config } = (await import(configPath)) as {
      default: DrizzleConfig;
    };

    expect(config.schema).toBe("./src/db/schema/index.ts");
  });

  it("reads database URL from DATABASE_URL_UNPOOLED env var", async () => {
    const testUrl = "postgresql://test:test@test.neon.tech/testdb";
    vi.stubEnv("DATABASE_URL_UNPOOLED", testUrl);
    vi.resetModules();

    const { default: config } = (await import(configPath)) as {
      default: DrizzleConfig;
    };

    expect(config.dbCredentials).toEqual({ url: testUrl });
  });

  it("outputs migrations to ./drizzle directory", async () => {
    vi.stubEnv("DATABASE_URL_UNPOOLED", "postgresql://test");
    vi.resetModules();

    const { default: config } = (await import(configPath)) as {
      default: DrizzleConfig;
    };

    expect(config.out).toBe("./drizzle");
  });
});
