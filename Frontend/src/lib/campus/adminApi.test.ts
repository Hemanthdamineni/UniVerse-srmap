import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  verifyAdminPassword,
  getAdminAccessStatus,
  unlockAdminMode,
  disableAdminMode,
} from "./adminApi";
import type { AdminAccessStatus } from "./adminApi";
import { ApiError } from "../erp/api";

// ── module-level mocks (vi.hoisted so factories can capture them) ──

const { mockIsStaticPrototype, mockGetCurrentRegNo } = vi.hoisted(() => ({
  mockIsStaticPrototype: vi.fn<() => boolean>().mockReturnValue(false),
  mockGetCurrentRegNo: vi.fn<() => string>().mockReturnValue("AP23110010419"),
}));

vi.mock("../core/prototype", () => ({
  isStaticPrototype: mockIsStaticPrototype,
}));

vi.mock("../core/identity", () => ({
  getCurrentRegNo: mockGetCurrentRegNo,
}));

// ── helpers ────────────────────────────────────────────────────────

function createMockResponse(data: unknown, status = 200, ok?: boolean): Response {
  const isOk = ok ?? (status >= 200 && status < 300);
  return {
    ok: isOk,
    status,
    statusText: status === 200 ? "OK" : "Error",
    headers: new Headers({ "Content-Type": "application/json" }),
    redirected: false,
    type: "basic" as const,
    url: "http://localhost",
    clone: () => createMockResponse(data, status, isOk),
    json: vi.fn().mockResolvedValue(data),
    text: vi.fn().mockResolvedValue(JSON.stringify(data)),
    body: null,
    bodyUsed: false,
    arrayBuffer: vi.fn(),
    blob: vi.fn(),
    formData: vi.fn(),
  } as unknown as Response;
}

/** Helper: assert that the most recent fetch call sent the given headers. */
function expectFetchHeaders(url: string, expected: Record<string, string>) {
  const call = vi.mocked(fetch).mock.calls[vi.mocked(fetch).mock.calls.length - 1];
  expect(call[0]).toBe(url);
  const init = call[1] as RequestInit;
  for (const [key, value] of Object.entries(expected)) {
    expect(init.headers).toHaveProperty(key, value);
  }
}

/** Helper: assert that a header is absent from the most recent fetch call. */
function expectFetchHeaderAbsent(url: string, key: string) {
  const call = vi.mocked(fetch).mock.calls[vi.mocked(fetch).mock.calls.length - 1];
  expect(call[0]).toBe(url);
  const init = call[1] as RequestInit;
  const headers = init.headers as Record<string, string>;
  expect(headers[key]).toBeUndefined();
}

beforeEach(() => {
  vi.stubGlobal("fetch", vi.fn());
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

// ═══════════════════════════════════════════════════════════════════
//  verifyAdminPassword
// ═══════════════════════════════════════════════════════════════════

describe("verifyAdminPassword", () => {
  const ENDPOINT = "/api/content/admin/verify";

  it("sends POST with password in header and body, returns verified status", async () => {
    vi.mocked(fetch).mockResolvedValue(
      createMockResponse({ success: true, data: { verified: true } }),
    );

    const result = await verifyAdminPassword("my-password");

    expect(fetch).toHaveBeenCalledWith(
      ENDPOINT,
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ adminPassword: "my-password" }),
      }),
    );
    expectFetchHeaders(ENDPOINT, {
      "Content-Type": "application/json",
      "x-admin-password": "my-password",
    });
    expect(result).toEqual({ verified: true });
  });

  it("trims whitespace from password before sending", async () => {
    vi.mocked(fetch).mockResolvedValue(
      createMockResponse({ success: true, data: { verified: true } }),
    );

    await verifyAdminPassword("  spaced-out  ");

    expectFetchHeaders(ENDPOINT, {
      "x-admin-password": "spaced-out",
    });
  });

  it("sends empty headers object when password is empty", async () => {
    vi.mocked(fetch).mockResolvedValue(
      createMockResponse({ success: true, data: { verified: false } }),
    );

    await verifyAdminPassword("");

    expectFetchHeaderAbsent(ENDPOINT, "x-admin-password");
  });

  it("sends empty headers when password is only whitespace", async () => {
    vi.mocked(fetch).mockResolvedValue(
      createMockResponse({ success: true, data: { verified: false } }),
    );

    await verifyAdminPassword("   ");

    expectFetchHeaderAbsent(ENDPOINT, "x-admin-password");
  });

  it("handles non-string password", async () => {
    vi.mocked(fetch).mockResolvedValue(
      createMockResponse({ success: true, data: { verified: true } }),
    );

    // @ts-expect-error -- deliberate edge case: non-string at runtime
    await verifyAdminPassword(12345);

    expectFetchHeaders(ENDPOINT, {
      "x-admin-password": "12345", // String(12345).trim() === "12345"
    });
  });

  it("handles false/verified response without success wrapper", async () => {
    vi.mocked(fetch).mockResolvedValue(
      createMockResponse({ verified: false }),
    );

    const result = await verifyAdminPassword("wrong");

    // requestData does NOT unwrap because there is no `success` key
    expect(result).toEqual({ verified: false });
  });

  it("throws ApiError on 401", async () => {
    vi.mocked(fetch).mockResolvedValue(
      createMockResponse(
        { error: { message: "Invalid password", code: "AUTH_FAILED" } },
        401,
      ),
    );

    await expect(verifyAdminPassword("wrong")).rejects.toThrow(ApiError);
    await expect(verifyAdminPassword("wrong")).rejects.toMatchObject({
      status: 401,
      message: "Invalid password",
      code: "AUTH_FAILED",
      retryable: false,
    });
  });

  it("throws ApiError on 403 with string error", async () => {
    vi.mocked(fetch).mockResolvedValue(
      createMockResponse({ error: "Forbidden" }, 403),
    );

    await expect(verifyAdminPassword("wrong")).rejects.toMatchObject({
      status: 403,
      message: "Forbidden",
      code: "UNKNOWN",
    });
  });

  it("throws ApiError on 500 with message field", async () => {
    vi.mocked(fetch).mockResolvedValue(
      createMockResponse({ message: "Internal server error" }, 500),
    );

    await expect(verifyAdminPassword("panic")).rejects.toMatchObject({
      status: 500,
      message: "Internal server error",
      code: "UNKNOWN",
    });
  });

  it("throws ApiError with fallback message on 500 with unparseable body", async () => {
    vi.mocked(fetch).mockResolvedValue(
      createMockResponse({ malformed: true }, 500),
    );

    await expect(verifyAdminPassword("panic")).rejects.toMatchObject({
      status: 500,
      message: "Request failed with status 500",
      code: "UNKNOWN",
    });
  });

  it("throws ApiError on non-JSON 500 response (parseJsonSafe returns null)", async () => {
    const resp = createMockResponse(null, 500);
    resp.json = vi.fn().mockRejectedValue(new SyntaxError("Unexpected token"));
    vi.mocked(fetch).mockResolvedValue(resp);

    await expect(verifyAdminPassword("panic")).rejects.toMatchObject({
      status: 500,
      message: "Request failed with status 500",
    });
  });

  it("propagates network / fetch errors", async () => {
    vi.mocked(fetch).mockRejectedValue(new TypeError("Failed to fetch"));

    await expect(verifyAdminPassword("online?")).rejects.toThrow(TypeError);
  });
});

// ═══════════════════════════════════════════════════════════════════
//  getAdminAccessStatus
// ═══════════════════════════════════════════════════════════════════

describe("getAdminAccessStatus", () => {
  it("returns status from the API in normal mode", async () => {
    const expected: AdminAccessStatus = {
      registerNo: "AP23110010419",
      potentialAdmin: true,
      isAdmin: true,
    };
    vi.mocked(fetch).mockResolvedValue(
      createMockResponse({ success: true, data: expected }),
    );

    const result = await getAdminAccessStatus();

    expect(fetch).toHaveBeenCalledWith(
      "/api/admin/access/status",
      expect.objectContaining({
        credentials: "include",
        headers: expect.objectContaining({ "Content-Type": "application/json" }),
      }),
    );
    expect(result).toEqual(expected);
  });

  it("returns registerNo, potentialAdmin and isAdmin from unwrapped response", async () => {
    const payload: AdminAccessStatus = {
      registerNo: "AP23110010333",
      potentialAdmin: false,
      isAdmin: false,
    };
    vi.mocked(fetch).mockResolvedValue(
      createMockResponse({ success: true, data: payload }),
    );

    const result = await getAdminAccessStatus();
    expect(result.registerNo).toBe("AP23110010333");
    expect(result.potentialAdmin).toBe(false);
    expect(result.isAdmin).toBe(false);
  });

  it("returns data directly when API response has no success/data wrapper", async () => {
    const payload = { registerNo: "AP23110010419", potentialAdmin: true, isAdmin: true };
    vi.mocked(fetch).mockResolvedValue(createMockResponse(payload));

    const result = await getAdminAccessStatus();
    expect(result).toEqual(payload);
  });

  it("throws ApiError on 4xx", async () => {
    vi.mocked(fetch).mockResolvedValue(
      createMockResponse({ error: { message: "Unauthorized" } }, 403),
    );

    await expect(getAdminAccessStatus()).rejects.toThrow(ApiError);
  });

  it("throws ApiError on 5xx", async () => {
    vi.mocked(fetch).mockResolvedValue(
      createMockResponse({ message: "Server error" }, 502),
    );

    await expect(getAdminAccessStatus()).rejects.toMatchObject({
      status: 502,
    });
  });

  it("propagates network errors", async () => {
    vi.mocked(fetch).mockRejectedValue(new TypeError("Network error"));

    await expect(getAdminAccessStatus()).rejects.toThrow(TypeError);
  });

  // ── static-prototype path ──

  it("keeps administration unavailable in static prototype mode", async () => {
    mockIsStaticPrototype.mockReturnValueOnce(true);

    const result = await getAdminAccessStatus();

    expect(fetch).not.toHaveBeenCalled();
    expect(result).toEqual({
      registerNo: "AP23110010419",
      potentialAdmin: false,
      isAdmin: false,
    });
  });

  it("falls back to hard-coded registerNo when getCurrentRegNo returns empty", async () => {
    mockIsStaticPrototype.mockReturnValueOnce(true);
    mockGetCurrentRegNo.mockReturnValueOnce("");

    const result = await getAdminAccessStatus();

    expect(result.registerNo).toBe("AP23110010419");
  });

  it("uses getCurrentRegNo when available in static prototype mode", async () => {
    mockIsStaticPrototype.mockReturnValueOnce(true);
    mockGetCurrentRegNo.mockReturnValueOnce("AP22000100001");

    const result = await getAdminAccessStatus();

    expect(result.registerNo).toBe("AP22000100001");
  });
});

// ═══════════════════════════════════════════════════════════════════
//  unlockAdminMode
// ═══════════════════════════════════════════════════════════════════

describe("unlockAdminMode", () => {
  const ENDPOINT = "/api/admin/access/unlock";

  it("sends POST with admin password header and returns unlock result", async () => {
    vi.mocked(fetch).mockResolvedValue(
      createMockResponse({ success: true, data: { isAdmin: true } }),
    );

    const result = await unlockAdminMode("sekret");

    expect(fetch).toHaveBeenCalledWith(
      ENDPOINT,
      expect.objectContaining({ method: "POST" }),
    );
    expectFetchHeaders(ENDPOINT, {
      "Content-Type": "application/json",
      "x-admin-password": "sekret",
    });
    expect(result).toEqual({ isAdmin: true });
  });

  it("trims whitespace from password header", async () => {
    vi.mocked(fetch).mockResolvedValue(
      createMockResponse({ success: true, data: { isAdmin: true } }),
    );

    await unlockAdminMode("  key  ");

    expectFetchHeaders(ENDPOINT, { "x-admin-password": "key" });
  });

  it("sends empty password header when password is empty", async () => {
    vi.mocked(fetch).mockResolvedValue(
      createMockResponse({ success: true, data: { isAdmin: false } }),
    );

    await unlockAdminMode("");

    expectFetchHeaderAbsent(ENDPOINT, "x-admin-password");
  });

  it("rejects with ApiError when password is wrong (403)", async () => {
    vi.mocked(fetch).mockResolvedValue(
      createMockResponse(
        { error: { message: "Invalid admin password", code: "ACCESS_DENIED" } },
        403,
      ),
    );

    await expect(unlockAdminMode("wrong")).rejects.toMatchObject({
      status: 403,
      message: "Invalid admin password",
      code: "ACCESS_DENIED",
    });
  });

  it("rejects with ApiError on server error (5xx)", async () => {
    vi.mocked(fetch).mockResolvedValue(
      createMockResponse({ message: "Service unavailable" }, 503),
    );

    await expect(unlockAdminMode("panic")).rejects.toMatchObject({
      status: 503,
    });
  });

  it("propagates network errors", async () => {
    vi.mocked(fetch).mockRejectedValue(new TypeError("Failed to fetch"));

    await expect(unlockAdminMode("online?")).rejects.toThrow(TypeError);
  });

  it("returns data directly when response has no success/data wrapper", async () => {
    vi.mocked(fetch).mockResolvedValue(
      createMockResponse({ isAdmin: true }),
    );

    const result = await unlockAdminMode("key");
    expect(result).toEqual({ isAdmin: true });
  });

  // ── static-prototype path ──

  it("rejects admin unlock in static prototype mode without calling fetch", async () => {
    mockIsStaticPrototype.mockReturnValueOnce(true);

    await expect(unlockAdminMode("anything")).rejects.toThrow(
      "Admin mode is not available in the static prototype.",
    );
    expect(fetch).not.toHaveBeenCalled();
  });
});

// ═══════════════════════════════════════════════════════════════════
//  disableAdminMode
// ═══════════════════════════════════════════════════════════════════

describe("disableAdminMode", () => {
  const ENDPOINT = "/api/admin/access/disable";

  it("sends POST request to disable admin mode", async () => {
    vi.mocked(fetch).mockResolvedValue(
      createMockResponse({ success: true, data: { isAdmin: false } }),
    );

    const result = await disableAdminMode();

    expect(fetch).toHaveBeenCalledWith(
      ENDPOINT,
      expect.objectContaining({ method: "POST" }),
    );
    expectFetchHeaders(ENDPOINT, { "Content-Type": "application/json" });
    expect(result).toEqual({ isAdmin: false });
  });

  it("does not send x-admin-password header", async () => {
    vi.mocked(fetch).mockResolvedValue(
      createMockResponse({ success: true, data: { isAdmin: false } }),
    );

    await disableAdminMode();

    expectFetchHeaderAbsent(ENDPOINT, "x-admin-password");
  });

  it("rejects with ApiError on 403", async () => {
    vi.mocked(fetch).mockResolvedValue(
      createMockResponse({ error: { message: "Not allowed", code: "FORBIDDEN" } }, 403),
    );

    await expect(disableAdminMode()).rejects.toMatchObject({
      status: 403,
      message: "Not allowed",
      code: "FORBIDDEN",
    });
  });

  it("rejects with ApiError on server error", async () => {
    vi.mocked(fetch).mockResolvedValue(
      createMockResponse({ message: "Oops" }, 500),
    );

    await expect(disableAdminMode()).rejects.toMatchObject({ status: 500 });
  });

  it("propagates network errors", async () => {
    vi.mocked(fetch).mockRejectedValue(new TypeError("Failed to fetch"));

    await expect(disableAdminMode()).rejects.toThrow(TypeError);
  });

  it("returns data directly when response has no success/data wrapper", async () => {
    vi.mocked(fetch).mockResolvedValue(
      createMockResponse({ isAdmin: true }),
    );

    const result = await disableAdminMode();
    expect(result).toEqual({ isAdmin: true });
  });

  // ── static-prototype path ──

  it("returns { isAdmin: false } when disabling static prototype admin mode", async () => {
    mockIsStaticPrototype.mockReturnValueOnce(true);

    const result = await disableAdminMode();

    expect(fetch).not.toHaveBeenCalled();
    expect(result).toEqual({ isAdmin: false });
  });
});
