import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  hasSeenOnboarding,
  markOnboardingSeen,
  ONBOARDING_VERSION,
} from "./onboarding";

const SEEN_KEY = "erp.onboarding.seenVersion";

describe("onboarding state", () => {
  beforeEach(() => {
    window.localStorage.clear();
    vi.restoreAllMocks();
  });

  it("reports unseen when no flag is stored", () => {
    expect(hasSeenOnboarding()).toBe(false);
  });

  it("persists the current version once marked seen", () => {
    markOnboardingSeen();

    expect(window.localStorage.getItem(SEEN_KEY)).toBe(String(ONBOARDING_VERSION));
    expect(hasSeenOnboarding()).toBe(true);
  });

  it("treats only equal-or-newer stored versions as seen", () => {
    window.localStorage.setItem(SEEN_KEY, "1");

    expect(hasSeenOnboarding(1)).toBe(true);
    expect(hasSeenOnboarding(2)).toBe(false);
  });

  it("ignores malformed stored values", () => {
    window.localStorage.setItem(SEEN_KEY, "not-a-number");

    expect(hasSeenOnboarding()).toBe(false);
  });

  it("defaults to seen (never nag) when storage reads fail", () => {
    // jsdom installs storage methods as own properties, so the instance
    // (not Storage.prototype) must be stubbed.
    vi.spyOn(window.localStorage, "getItem").mockImplementation(() => {
      throw new Error("storage blocked");
    });

    expect(hasSeenOnboarding()).toBe(true);
  });

  it("does not throw when storage writes fail", () => {
    vi.spyOn(window.localStorage, "setItem").mockImplementation(() => {
      throw new Error("storage blocked");
    });

    expect(() => markOnboardingSeen()).not.toThrow();
  });
});
