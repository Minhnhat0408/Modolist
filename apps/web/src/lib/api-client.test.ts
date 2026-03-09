import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  api,
  clearTokenCache,
  getCachedToken,
  getClientToken,
} from "./api-client";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeResponse(body: unknown, ok = true, status = 200): Response {
  return {
    ok,
    status,
    statusText: "OK",
    json: () => Promise.resolve(body),
  } as unknown as Response;
}

// ─── Setup ────────────────────────────────────────────────────────────────────

beforeEach(() => {
  clearTokenCache();
  vi.restoreAllMocks();
});

afterEach(() => {
  clearTokenCache();
});

// ─── Token cache ──────────────────────────────────────────────────────────────

describe("clearTokenCache / getCachedToken", () => {
  it("getCachedToken returns null initially", () => {
    expect(getCachedToken()).toBeNull();
  });

  it("clearTokenCache resets to null after token is cached", async () => {
    const mockToken = "tok_abc123";
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(makeResponse({ token: mockToken })) // /api/auth/token
        .mockResolvedValueOnce(makeResponse({ id: 1 })), // actual request
    );

    await api.get("/tasks");
    expect(getCachedToken()).toBe(mockToken);

    clearTokenCache();
    expect(getCachedToken()).toBeNull();
  });

  it("getCachedToken reflects the cached value after a successful request", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(makeResponse({ token: "tok_xyz" }))
        .mockResolvedValueOnce(makeResponse([])),
    );

    await api.get("/tasks");
    expect(getCachedToken()).toBe("tok_xyz");
  });
});

// ─── Token fetching & caching strategy ───────────────────────────────────────

describe("token caching", () => {
  it("calls /api/auth/token only once across multiple requests", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(makeResponse({ token: "tok_once" })) // auth/token — once
      .mockResolvedValue(makeResponse({})); // subsequent requests

    vi.stubGlobal("fetch", fetchMock);

    await api.get("/a");
    await api.get("/b");
    await api.get("/c");

    const tokenCalls = fetchMock.mock.calls.filter((c) =>
      (c[0] as string).includes("/api/auth/token"),
    );
    expect(tokenCalls).toHaveLength(1);
  });

  it("uses provided token option instead of fetching", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(makeResponse({ ok: true }));
    vi.stubGlobal("fetch", fetchMock);

    await api.get("/endpoint", { token: "custom_tok" });

    // No call for /api/auth/token
    const tokenCalls = fetchMock.mock.calls.filter((c) =>
      (c[0] as string).includes("/api/auth/token"),
    );
    expect(tokenCalls).toHaveLength(0);

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("/api/endpoint");
    expect((init.headers as Record<string, string>)["Authorization"]).toBe(
      "Bearer custom_tok",
    );
  });
});

// ─── api.get ─────────────────────────────────────────────────────────────────

describe("api.get", () => {
  it("sends GET request with correct URL and Authorization header", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(makeResponse({ token: "tok" }))
      .mockResolvedValueOnce(makeResponse({ id: 42 }));

    vi.stubGlobal("fetch", fetchMock);

    const result = await api.get<{ id: number }>("/tasks/42");

    expect(result).toEqual({ id: 42 });
    const [url, init] = fetchMock.mock.calls[1] as [string, RequestInit];
    expect(url).toBe("/api/tasks/42");
    expect(init.method).toBe("GET");
    expect((init.headers as Record<string, string>)["Authorization"]).toBe(
      "Bearer tok",
    );
  });

  it("does not attach Content-Type for GET", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(makeResponse({ token: "tok" }))
      .mockResolvedValueOnce(makeResponse({}));

    vi.stubGlobal("fetch", fetchMock);

    await api.get("/tasks");

    const [, init] = fetchMock.mock.calls[1] as [string, RequestInit];
    expect(
      (init.headers as Record<string, string>)["Content-Type"],
    ).toBeUndefined();
  });
});

// ─── api.post ────────────────────────────────────────────────────────────────

describe("api.post", () => {
  it("sends POST with JSON body and Content-Type header", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(makeResponse({ token: "tok" }))
      .mockResolvedValueOnce(makeResponse({ id: 1 }));

    vi.stubGlobal("fetch", fetchMock);

    const payload = { title: "Buy milk", priority: "HIGH" };
    const result = await api.post("/tasks", payload);

    expect(result).toEqual({ id: 1 });
    const [url, init] = fetchMock.mock.calls[1] as [string, RequestInit];
    expect(url).toBe("/api/tasks");
    expect(init.method).toBe("POST");
    expect((init.headers as Record<string, string>)["Content-Type"]).toBe(
      "application/json",
    );
    expect(init.body).toBe(JSON.stringify(payload));
  });
});

// ─── api.patch ───────────────────────────────────────────────────────────────

describe("api.patch", () => {
  it("sends PATCH with JSON body", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(makeResponse({ token: "tok" }))
      .mockResolvedValueOnce(makeResponse({ id: 1, title: "Updated" }));

    vi.stubGlobal("fetch", fetchMock);

    const result = await api.patch("/tasks/1", { title: "Updated" });

    expect(result).toEqual({ id: 1, title: "Updated" });
    const [, init] = fetchMock.mock.calls[1] as [string, RequestInit];
    expect(init.method).toBe("PATCH");
  });
});

// ─── api.delete ──────────────────────────────────────────────────────────────

describe("api.delete", () => {
  it("sends DELETE request without a body", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(makeResponse({ token: "tok" }))
      .mockResolvedValueOnce(makeResponse(null));

    vi.stubGlobal("fetch", fetchMock);

    await api.delete("/tasks/1");

    const [url, init] = fetchMock.mock.calls[1] as [string, RequestInit];
    expect(url).toBe("/api/tasks/1");
    expect(init.method).toBe("DELETE");
    expect(init.body).toBeUndefined();
  });
});

// ─── Error handling ───────────────────────────────────────────────────────────

describe("error handling", () => {
  it("throws when token endpoint returns non-ok", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(makeResponse({}, false, 401)),
    );

    await expect(api.get("/tasks")).rejects.toThrow(
      "Failed to get authentication token",
    );
  });

  it("throws with server error message on non-ok API response", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(makeResponse({ token: "tok" }))
      .mockResolvedValueOnce(
        makeResponse({ message: "Task not found" }, false, 404),
      );

    vi.stubGlobal("fetch", fetchMock);

    await expect(api.get("/tasks/999")).rejects.toThrow("Task not found");
  });

  it("falls back to statusText when error body has no message", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(makeResponse({ token: "tok" }))
      .mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: "Internal Server Error",
        json: () => Promise.reject(new Error("no json")),
      } as unknown as Response);

    vi.stubGlobal("fetch", fetchMock);

    await expect(api.get("/tasks")).rejects.toThrow("Internal Server Error");
  });
});

// ─── getClientToken ───────────────────────────────────────────────────────────

describe("getClientToken", () => {
  it("returns the token from /api/auth/token", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValueOnce(makeResponse({ token: "pub_token" })),
    );

    const token = await getClientToken();
    expect(token).toBe("pub_token");
  });
});
