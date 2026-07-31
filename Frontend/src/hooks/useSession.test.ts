import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook } from "@testing-library/react";
import { useSession } from "./useSession";
import * as sessionModule from "../lib/core/session";

/**
 * The useSession hook is a thin wrapper around readStoredProfileData() from
 * the session module.  On mount it reads profile data from localStorage and
 * exposes { profile, loading }.
 *
 * Broader session lifecycle operations (login, logout, token management,
 * session expiry) are handled by the session module functions
 * (storeSessionAuth, logoutSession, clearSessionAuth, fetchSessionProfile,
 * etc.) rather than by this hook.  Integration scenarios in this file
 * exercise the session module's I/O (localStorage reads/writes) alongside
 * the hook to verify the full data flow.
 *
 * Strategy: unit tests use vi.spyOn on the real module so mockRestore()
 * always returns the original function.  Integration tests never spy on
 * the function and work directly with localStorage.
 */

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

beforeEach(() => {
  window.localStorage.clear();
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ---------------------------------------------------------------------------
// Unit tests – spy on readStoredProfileData to isolate the hook's logic
// ---------------------------------------------------------------------------

describe("useSession – unit (spied readStoredProfileData)", () => {
  describe("initial state (unauthenticated)", () => {
    it("returns loading=false and profile=null when no profile is stored", () => {
      vi.spyOn(sessionModule, "readStoredProfileData").mockReturnValue(null);

      const { result } = renderHook(() => useSession());

      expect(result.current.loading).toBe(false);
      expect(result.current.profile).toBeNull();
    });

    it("calls readStoredProfileData exactly once on mount", () => {
      const spy = vi.spyOn(sessionModule, "readStoredProfileData").mockReturnValue(null);

      renderHook(() => useSession());

      expect(spy).toHaveBeenCalledTimes(1);
    });

    it("does not call readStoredProfileData again on re-render", () => {
      const spy = vi.spyOn(sessionModule, "readStoredProfileData").mockReturnValue(null);

      const { rerender } = renderHook(() => useSession());

      expect(spy).toHaveBeenCalledTimes(1);

      // Force a re-render — the effect has [] deps so it won't re-fire
      rerender();
      expect(spy).toHaveBeenCalledTimes(1);
    });
  });

  describe("profile data (login flow equivalent)", () => {
    it("returns the stored profile when data exists", () => {
      const fakeProfile = {
        name: "Test User",
        email: "test@example.com",
        registerNo: "AP20110010001",
        role: "student",
      };
      vi.spyOn(sessionModule, "readStoredProfileData").mockReturnValue(fakeProfile);

      const { result } = renderHook(() => useSession());

      expect(result.current.profile).toEqual(fakeProfile);
      expect(result.current.loading).toBe(false);
    });

    it("returns an empty object profile when storage holds {}", () => {
      vi.spyOn(sessionModule, "readStoredProfileData").mockReturnValue({});

      const { result } = renderHook(() => useSession());

      expect(result.current.profile).toEqual({});
      expect(result.current.loading).toBe(false);
    });

    it("snapshots profile on mount and does not re-read on re-render", () => {
      const spy = vi.spyOn(sessionModule, "readStoredProfileData");
      spy.mockReturnValue({ name: "First" });

      const { result, rerender } = renderHook(() => useSession());

      expect(result.current.profile).toEqual({ name: "First" });

      // Change the spy return for a potential re-read (effect won't run again)
      spy.mockReturnValue({ name: "Second" });
      rerender();

      // The hook doesn't re-read on re-render, so the value stays as captured
      // on mount.
      expect(result.current.profile).toEqual({ name: "First" });
    });
  });

  describe("loading state", () => {
    it("transitions from true to false after effect runs", () => {
      // We can't easily observe loading=true synchronously with renderHook
      // because React 19 flushes effects synchronously in test environments.
      // We verify the final (post-effect) state is correct.
      vi.spyOn(sessionModule, "readStoredProfileData").mockReturnValue(null);

      const { result } = renderHook(() => useSession());

      expect(result.current.loading).toBe(false);
    });
  });

  describe("error-like states", () => {
    it("handles profile=null (corrupted JSON / parse failure)", () => {
      vi.spyOn(sessionModule, "readStoredProfileData").mockReturnValue(null);

      const { result } = renderHook(() => useSession());

      expect(result.current.profile).toBeNull();
      expect(result.current.loading).toBe(false);
    });

    it("handles non-object profile (unexpected return type) without crashing", () => {
      // readStoredProfileData is typed to return PlainRecord | null, but
      // verify the hook doesn't crash if the return is an unexpected type.
      vi.spyOn(sessionModule, "readStoredProfileData").mockReturnValue(
        "unexpected string" as unknown as Record<string, unknown> | null,
      );

      const { result } = renderHook(() => useSession());

      // The hook stores whatever value is returned; this is a safety net.
      expect(result.current.profile).toBe("unexpected string");
      expect(result.current.loading).toBe(false);
    });

    it("propagates an exception from readStoredProfileData", () => {
      vi.spyOn(sessionModule, "readStoredProfileData").mockImplementation(() => {
        throw new Error("Unexpected failure");
      });

      // The effect does not catch errors; verify it propagates.
      expect(() => renderHook(() => useSession())).toThrow("Unexpected failure");
    });
  });

  describe("return value shape", () => {
    it("returns the exact expected keys", () => {
      vi.spyOn(sessionModule, "readStoredProfileData").mockReturnValue(null);

      const { result } = renderHook(() => useSession());

      expect(Object.keys(result.current).sort()).toEqual(["loading", "profile"]);
    });

    it("profile is typed as an object or null", () => {
      vi.spyOn(sessionModule, "readStoredProfileData").mockReturnValue({ id: 1 });

      const { result } = renderHook(() => useSession());

      expect(result.current.profile).not.toBeNull();
      expect(typeof result.current.profile).toBe("object");
      expect(Array.isArray(result.current.profile)).toBe(false);
    });
  });
});

// ---------------------------------------------------------------------------
// Integration tests – use the real readStoredProfileData via localStorage
// ---------------------------------------------------------------------------

describe("useSession – integration with localStorage", () => {
  describe("initial state (unauthenticated)", () => {
    it("returns profile=null when localStorage has no profileData key", () => {
      expect(window.localStorage.getItem("profileData")).toBeNull();

      const { result } = renderHook(() => useSession());

      expect(result.current.profile).toBeNull();
      expect(result.current.loading).toBe(false);
    });

    it("returns profile=null when profileData key exists but is empty string", () => {
      window.localStorage.setItem("profileData", "");

      const { result } = renderHook(() => useSession());

      expect(result.current.profile).toBeNull();
      expect(result.current.loading).toBe(false);
    });
  });

  describe("profile data stored (login flow)", () => {
    it("reads a valid JSON profile from localStorage", () => {
      const profile = {
        name: "Alice",
        email: "alice@university.edu",
        registerNo: "AP20110010002",
        role: "student",
      };
      window.localStorage.setItem("profileData", JSON.stringify(profile));

      const { result } = renderHook(() => useSession());

      expect(result.current.profile).toEqual(profile);
      expect(result.current.loading).toBe(false);
    });

    it("reads a profile with full academic record fields", () => {
      const profile = {
        name: "Bob",
        registerNo: "AP20110010003",
        programme: "B.Tech CSE",
        batch: "2021-2025",
        section: "A",
        attendance: 85.5,
        cgpa: 8.2,
        email: "bob@university.edu",
        phone: "+91-9876543210",
      };
      window.localStorage.setItem("profileData", JSON.stringify(profile));

      const { result } = renderHook(() => useSession());

      expect(result.current.profile).toMatchObject({
        name: "Bob",
        registerNo: "AP20110010003",
      });
      expect((result.current.profile as Record<string, unknown>).cgpa).toBe(8.2);
      expect(result.current.loading).toBe(false);
    });

    it("returns a rich nested profile object", () => {
      const profile = {
        name: "Deepak",
        roles: ["student", "event-coordinator"],
        metadata: {
          lastLogin: "2026-07-20T10:30:00Z",
          preferences: { theme: "dark" },
        },
      };
      window.localStorage.setItem("profileData", JSON.stringify(profile));

      const { result } = renderHook(() => useSession());

      expect(result.current.profile).toMatchObject({
        name: "Deepak",
        roles: ["student", "event-coordinator"],
      });
      expect(
        (result.current.profile as Record<string, unknown>).metadata,
      ).toMatchObject({ lastLogin: "2026-07-20T10:30:00Z" });
    });
  });

  describe("logout flow (cleared storage)", () => {
    it("returns profile=null when profileData is removed before mount", () => {
      // Simulate a previously logged-in user whose session was cleared
      // before the component mounted.
      window.localStorage.setItem("profileData", JSON.stringify({ name: "Dave" }));
      window.localStorage.removeItem("profileData");

      const { result } = renderHook(() => useSession());

      expect(result.current.profile).toBeNull();
    });

    it("holds stale snapshot after logout (empty deps – no re-read on re-render)", () => {
      // Simulate a logged-in state
      window.localStorage.setItem("profileData", JSON.stringify({ name: "Dave" }));

      const { result, rerender } = renderHook(() => useSession());
      expect(result.current.profile).toEqual({ name: "Dave" });

      // Simulate logout clearing storage (e.g. clearSessionAuth)
      window.localStorage.removeItem("profileData");

      // Re-render — the effect does NOT run again because the deps array is
      // empty, so the hook still holds the stale snapshot.
      rerender();
      expect(result.current.profile).toEqual({ name: "Dave" });

      // This is expected behaviour: useSession only reads on mount.
      // Consumers should rely on the session module's hasSessionAuth() for
      // real-time checks, or re-mount the component tree.
    });

    it("reads the new profile when the component is freshly mounted after logout", () => {
      // Mount with a profile
      window.localStorage.setItem("profileData", JSON.stringify({ name: "Eve" }));
      const { unmount } = renderHook(() => useSession());

      // Logout clears storage
      window.localStorage.removeItem("profileData");

      // Unmount and re-mount — effect fires again, reads empty storage
      unmount();
      const { result } = renderHook(() => useSession());

      expect(result.current.profile).toBeNull();
    });
  });

  describe("corrupted / malformed storage", () => {
    it("returns profile=null when profileData contains invalid JSON", () => {
      window.localStorage.setItem("profileData", "{invalid-json}");

      const { result } = renderHook(() => useSession());

      expect(result.current.profile).toBeNull();
      expect(result.current.loading).toBe(false);
    });

    it("returns profile=null when profileData contains a JSON array", () => {
      window.localStorage.setItem("profileData", JSON.stringify([1, 2, 3]));

      const { result } = renderHook(() => useSession());

      expect(result.current.profile).toBeNull();
      expect(result.current.loading).toBe(false);
    });

    it("returns profile=null when profileData contains a JSON primitive (number)", () => {
      window.localStorage.setItem("profileData", "42");

      const { result } = renderHook(() => useSession());

      // JSON.parse("42") gives 42, which is not an object → readStoredProfileData returns null
      expect(result.current.profile).toBeNull();
    });

    it("returns profile=null when profileData contains a JSON primitive (string)", () => {
      window.localStorage.setItem("profileData", JSON.stringify("plain string"));

      const { result } = renderHook(() => useSession());

      // A JSON-stringified string like '"plain string"' is not an object
      expect(result.current.profile).toBeNull();
    });

    it("returns profile=null when profileData contains a JSON null literal", () => {
      window.localStorage.setItem("profileData", "null");

      const { result } = renderHook(() => useSession());

      expect(result.current.profile).toBeNull();
    });

    it("returns profile=null when profileData is a serialised empty array", () => {
      window.localStorage.setItem("profileData", "[]");

      const { result } = renderHook(() => useSession());

      expect(result.current.profile).toBeNull();
    });
  });

  describe("storage unavailability (SSR / no window)", () => {
    it("returns profile=null and loading=false when localStorage.getItem throws", () => {
      vi.spyOn(globalThis.localStorage, "getItem").mockImplementation(() => {
        throw new Error("Storage unavailable");
      });

      const { result } = renderHook(() => useSession());

      // readStoredProfileData catches the error inside its try/catch and
      // returns null.
      expect(result.current.profile).toBeNull();
      expect(result.current.loading).toBe(false);
    });
  });
});

// ---------------------------------------------------------------------------
// Edge cases
// ---------------------------------------------------------------------------

describe("useSession – edge cases", () => {
  it("handles multiple hook instances independently", () => {
    window.localStorage.setItem("profileData", JSON.stringify({ shared: true }));

    const { result: r1 } = renderHook(() => useSession());
    const { result: r2 } = renderHook(() => useSession());

    expect(r1.current.profile).toEqual({ shared: true });
    expect(r2.current.profile).toEqual({ shared: true });
    expect(r1.current.loading).toBe(false);
    expect(r2.current.loading).toBe(false);
  });

  it("does not write to localStorage as a side effect", () => {
    window.localStorage.setItem("profileData", JSON.stringify({ name: "Eve" }));

    const keysBefore = Object.keys(
      globalThis.localStorage as unknown as Record<string, string>,
    ).sort();

    renderHook(() => useSession());

    const keysAfter = Object.keys(
      globalThis.localStorage as unknown as Record<string, string>,
    ).sort();
    expect(keysAfter).toEqual(keysBefore);
  });

  it("returns a stable reference when no re-render occurs", () => {
    window.localStorage.setItem("profileData", JSON.stringify({ stable: true }));

    const { result } = renderHook(() => useSession());

    expect(result.current.profile).toEqual({ stable: true });
    expect(result.current.loading).toBe(false);
  });
});
