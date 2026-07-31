import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook } from "@testing-library/react";
import { useAdminAccess } from "./useAdminAccess";

// ---------------------------------------------------------------------------
// Hoist a mock for useAdminMode so we can control what the context returns
// without needing the real AdminModeProvider (and its async effect).
// ---------------------------------------------------------------------------

const { mockUseAdminMode } = vi.hoisted(() => ({
  mockUseAdminMode: vi.fn(),
}));

vi.mock("../contexts/AdminModeContext", () => ({
  useAdminMode: mockUseAdminMode,
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Convenience: build the full shape useAdminMode would return. */
function contextValue(overrides: Record<string, unknown> = {}) {
  return {
    potentialAdmin: false,
    isAdmin: false,
    registerNo: "",
    showPrompt: false,
    busy: false,
    error: "",
    promptPassword: "",
    setPromptPassword: vi.fn(),
    skipPrompt: vi.fn(),
    openPrompt: vi.fn(),
    unlock: vi.fn().mockResolvedValue(undefined),
    disable: vi.fn().mockResolvedValue(undefined),
    adminHeaders: {},
    ...overrides,
  } as const;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

beforeEach(() => {
  mockUseAdminMode.mockReset();
});

// ---------------------------------------------------------------------------
// Error handling
// ---------------------------------------------------------------------------

describe("error handling", () => {
  it("throws when used outside AdminModeProvider", () => {
    mockUseAdminMode.mockImplementation(() => {
      throw new Error("useAdminMode must be used within AdminModeProvider");
    });

    expect(() => renderHook(() => useAdminAccess())).toThrow(
      "useAdminMode must be used within AdminModeProvider",
    );
  });

  it("does not throw when useAdminMode returns normally", () => {
    mockUseAdminMode.mockReturnValue(contextValue());

    expect(() => renderHook(() => useAdminAccess())).not.toThrow();
  });

  it("exposes the error string from the context", () => {
    mockUseAdminMode.mockReturnValue(contextValue({ error: "Bad password" }));

    const { result } = renderHook(() => useAdminAccess());

    expect(result.current.error).toBe("Bad password");
  });

  it("exposes an empty error string by default", () => {
    mockUseAdminMode.mockReturnValue(contextValue({ error: "" }));

    const { result } = renderHook(() => useAdminAccess());

    expect(result.current.error).toBe("");
  });
});

// ---------------------------------------------------------------------------
// Admin state (unlocked)
// ---------------------------------------------------------------------------

describe("admin state (unlocked)", () => {
  it("returns unlocked=false when not admin", () => {
    mockUseAdminMode.mockReturnValue(contextValue({ isAdmin: false }));

    const { result } = renderHook(() => useAdminAccess());

    expect(result.current.unlocked).toBe(false);
  });

  it("returns unlocked=true when admin is active", () => {
    mockUseAdminMode.mockReturnValue(contextValue({ isAdmin: true }));

    const { result } = renderHook(() => useAdminAccess());

    expect(result.current.unlocked).toBe(true);
  });

  it("returns adminHeaders when admin is active", () => {
    const headers = { "x-admin-password": "tok_abc" };
    mockUseAdminMode.mockReturnValue(
      contextValue({ isAdmin: true, adminHeaders: headers }),
    );

    const { result } = renderHook(() => useAdminAccess());

    expect(result.current.adminHeaders).toEqual(headers);
  });

  it("returns empty adminHeaders when not admin", () => {
    mockUseAdminMode.mockReturnValue(contextValue({ adminHeaders: {} }));

    const { result } = renderHook(() => useAdminAccess());

    expect(result.current.adminHeaders).toEqual({});
  });
});

// ---------------------------------------------------------------------------
// Busy / loading state
// ---------------------------------------------------------------------------

describe("busy / loading state", () => {
  it("reflects busy=true when an operation is in progress", () => {
    mockUseAdminMode.mockReturnValue(contextValue({ busy: true }));

    const { result } = renderHook(() => useAdminAccess());

    expect(result.current.busy).toBe(true);
  });

  it("reflects busy=false when idle", () => {
    mockUseAdminMode.mockReturnValue(contextValue({ busy: false }));

    const { result } = renderHook(() => useAdminAccess());

    expect(result.current.busy).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Password field
// ---------------------------------------------------------------------------

describe("password field", () => {
  it("exposes the current promptPassword as password", () => {
    mockUseAdminMode.mockReturnValue(
      contextValue({ promptPassword: "my-password" }),
    );

    const { result } = renderHook(() => useAdminAccess());

    expect(result.current.password).toBe("my-password");
  });

  it("exposes an empty password by default", () => {
    mockUseAdminMode.mockReturnValue(contextValue({ promptPassword: "" }));

    const { result } = renderHook(() => useAdminAccess());

    expect(result.current.password).toBe("");
  });

  it("forwards setPassword calls to setPromptPassword", () => {
    const setPromptPassword = vi.fn();
    mockUseAdminMode.mockReturnValue(contextValue({ setPromptPassword }));

    const { result } = renderHook(() => useAdminAccess());

    result.current.setPassword("new-password");
    expect(setPromptPassword).toHaveBeenCalledWith("new-password");
  });

  it("forwards setPassword with an empty string", () => {
    const setPromptPassword = vi.fn();
    mockUseAdminMode.mockReturnValue(contextValue({ setPromptPassword }));

    const { result } = renderHook(() => useAdminAccess());

    result.current.setPassword("");
    expect(setPromptPassword).toHaveBeenCalledWith("");
  });
});

// ---------------------------------------------------------------------------
// Function delegation: unlock / lock
// ---------------------------------------------------------------------------

describe("function delegation – unlock", () => {
  it("calls the context unlock when invoked", async () => {
    const unlock = vi.fn().mockResolvedValue(undefined);
    mockUseAdminMode.mockReturnValue(contextValue({ unlock }));

    const { result } = renderHook(() => useAdminAccess());

    await result.current.unlock();
    expect(unlock).toHaveBeenCalledOnce();
  });

  it("returns the promise from context unlock", async () => {
    const unlock = vi.fn().mockResolvedValue("resolved");
    mockUseAdminMode.mockReturnValue(contextValue({ unlock }));

    const { result } = renderHook(() => useAdminAccess());

    const ret = await result.current.unlock();
    expect(ret).toBe("resolved");
  });

  it("propagates rejection from context unlock", async () => {
    const unlock = vi.fn().mockRejectedValue(new Error("Access denied"));
    mockUseAdminMode.mockReturnValue(contextValue({ unlock }));

    const { result } = renderHook(() => useAdminAccess());

    await expect(result.current.unlock()).rejects.toThrow("Access denied");
  });
});

describe("function delegation – lock (disable)", () => {
  it("calls the context disable when invoked", async () => {
    const disable = vi.fn().mockResolvedValue(undefined);
    mockUseAdminMode.mockReturnValue(contextValue({ disable }));

    const { result } = renderHook(() => useAdminAccess());

    await result.current.lock();
    expect(disable).toHaveBeenCalledOnce();
  });

  it("returns the promise from context disable", async () => {
    const disable = vi.fn().mockResolvedValue("locked");
    mockUseAdminMode.mockReturnValue(contextValue({ disable }));

    const { result } = renderHook(() => useAdminAccess());

    const ret = await result.current.lock();
    expect(ret).toBe("locked");
  });

  it("propagates rejection from context disable", async () => {
    const disable = vi.fn().mockRejectedValue(new Error("Network error"));
    mockUseAdminMode.mockReturnValue(contextValue({ disable }));

    const { result } = renderHook(() => useAdminAccess());

    await expect(result.current.lock()).rejects.toThrow("Network error");
  });
});

// ---------------------------------------------------------------------------
// Exposed API shape
// ---------------------------------------------------------------------------

describe("API shape", () => {
  it("returns the expected set of keys", () => {
    mockUseAdminMode.mockReturnValue(contextValue());

    const { result } = renderHook(() => useAdminAccess());

    expect(Object.keys(result.current).sort()).toEqual([
      "adminHeaders",
      "busy",
      "error",
      "lock",
      "password",
      "setPassword",
      "unlock",
      "unlocked",
    ]);
  });

  it("does not expose internal context properties directly", () => {
    mockUseAdminMode.mockReturnValue(contextValue());

    const { result } = renderHook(() => useAdminAccess());

    expect(result.current).not.toHaveProperty("potentialAdmin");
    expect(result.current).not.toHaveProperty("showPrompt");
    expect(result.current).not.toHaveProperty("skipPrompt");
    expect(result.current).not.toHaveProperty("openPrompt");
    expect(result.current).not.toHaveProperty("promptPassword");
  });
});
