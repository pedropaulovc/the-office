import { describe, it, expect, vi, beforeEach } from "vitest";

const mockGetActiveSpan = vi.fn();
const mockCaptureException = vi.fn();
const mockStartSpan = vi.fn();

vi.mock("@sentry/nextjs", () => ({
  getActiveSpan: (): unknown => mockGetActiveSpan(),
  captureException: (...args: unknown[]): unknown => mockCaptureException(...args),
  startSpan: (...args: unknown[]): unknown => mockStartSpan(...args),
}));

vi.mock("@/lib/telemetry", () => ({
  logError: vi.fn(),
}));

describe("api-response helpers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it("jsonResponse attaches trace header when span active", async () => {
    mockGetActiveSpan.mockReturnValue({ spanContext: () => ({ traceId: "abc123" }) });

    const { jsonResponse } = await import("../api-response");
    const res = jsonResponse({ ok: true });

    expect(res.headers.get("x-sentry-trace-id")).toBe("abc123");
  });

  it("jsonResponse omits trace header when no active span", async () => {
    mockGetActiveSpan.mockReturnValue(undefined);

    const { jsonResponse } = await import("../api-response");
    const res = jsonResponse({ ok: true });

    expect(res.headers.get("x-sentry-trace-id")).toBeNull();
  });

  it("emptyResponse attaches trace header when span active", async () => {
    mockGetActiveSpan.mockReturnValue({ spanContext: () => ({ traceId: "trace-456" }) });

    const { emptyResponse } = await import("../api-response");
    const res = emptyResponse({ status: 204 });

    expect(res.headers.get("x-sentry-trace-id")).toBe("trace-456");
    expect(res.status).toBe(204);
  });

  it("emptyResponse omits trace header when no active span", async () => {
    mockGetActiveSpan.mockReturnValue(undefined);

    const { emptyResponse } = await import("../api-response");
    const res = emptyResponse({ status: 204 });

    expect(res.headers.get("x-sentry-trace-id")).toBeNull();
  });

  it("parseRequestJson returns parsed body on valid JSON", async () => {
    mockGetActiveSpan.mockReturnValue(undefined);

    const { parseRequestJson } = await import("../api-response");
    const request = new Request("http://localhost", {
      method: "POST",
      body: JSON.stringify({ name: "test" }),
      headers: { "Content-Type": "application/json" },
    });

    const result = await parseRequestJson(request);
    expect(result).toEqual({ name: "test" });
  });

  it("parseRequestJson returns 400 response on invalid JSON", async () => {
    mockGetActiveSpan.mockReturnValue(undefined);

    const { parseRequestJson } = await import("../api-response");
    const request = new Request("http://localhost", {
      method: "POST",
      body: "not json",
      headers: { "Content-Type": "application/json" },
    });

    const result = await parseRequestJson(request);
    expect(result).toBeInstanceOf(Response);
    const res = result as Response;
    expect(res.status).toBe(400);
    expect(mockCaptureException).toHaveBeenCalled();
  });

  it("parseRequestJson handles non-Error thrown values", async () => {
    mockGetActiveSpan.mockReturnValue(undefined);

    const { parseRequestJson } = await import("../api-response");
    // A request whose .json() rejects with a non-Error value
    const request = {
      json: () => Promise.reject(new Error("not json")),
    } as unknown as Request;

    const result = await parseRequestJson(request);
    expect(result).toBeInstanceOf(Response);
    const res = result as Response;
    expect(res.status).toBe(400);
  });

  it("apiHandler returns handler result on success", async () => {
    mockGetActiveSpan.mockReturnValue(undefined);
    mockStartSpan.mockImplementation((_opts: unknown, cb: () => unknown) => cb());

    const { apiHandler, jsonResponse } = await import("../api-response");
    const expected = jsonResponse({ data: "ok" });
    const result = await apiHandler("test", "test.op", () => Promise.resolve(expected));

    expect(result).toBe(expected);
  });

  it("apiHandler returns 500 on handler Error", async () => {
    mockGetActiveSpan.mockReturnValue(undefined);
    mockStartSpan.mockImplementation((_opts: unknown, cb: () => unknown) => cb());

    const { apiHandler } = await import("../api-response");
    const result = await apiHandler("test", "test.op", () => Promise.reject(new Error("handler boom")));

    expect(result.status).toBe(500);
    const body = await result.json() as { detail: string };
    expect(body.detail).toBe("handler boom");
    expect(mockCaptureException).toHaveBeenCalled();
  });

  it("apiHandler handles non-Error thrown values", async () => {
    mockGetActiveSpan.mockReturnValue(undefined);
    mockStartSpan.mockImplementation((_opts: unknown, cb: () => unknown) => cb());

    const { apiHandler } = await import("../api-response");
    // eslint-disable-next-line @typescript-eslint/prefer-promise-reject-errors
    const result = await apiHandler("test", "test.op", () => Promise.reject(42));

    expect(result.status).toBe(500);
    const body = await result.json() as { detail: string };
    expect(body.detail).toBe("42");
  });
});
