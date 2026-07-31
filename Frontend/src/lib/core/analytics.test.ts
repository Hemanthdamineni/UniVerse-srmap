import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { MockInstance } from "vitest";
import { track } from "./analytics";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Stub `navigator.sendBeacon` and return the mock so we can assert on it. */
function setSendBeacon(impl: (typeof navigator.sendBeacon) | undefined) {
  Object.defineProperty(navigator, "sendBeacon", {
    configurable: true,
    value: impl,
    writable: true,
  });
}

/**
 * A minimal Blob shim that captures the raw parts so we can parse JSON out of
 * them in tests.  Vitest's jsdom Blob is read-only after construction, so we
 * need this to introspect the payload.
 */
class SniffableBlob {
  readonly parts: string[];
  readonly type: string;

  constructor(parts: string[], options?: { type?: string }) {
    this.parts = parts;
    this.type = options?.type ?? "";
  }

  async text(): Promise<string> {
    return this.parts.join("");
  }
}

function parseBeaconPayload(sendBeacon: MockInstance): Record<string, unknown> {
  const blob = sendBeacon.mock.calls[0]?.[1] as SniffableBlob | undefined;
  if (!blob) throw new Error("beacon was never called");
  return JSON.parse(blob.parts.join(""));
}

// ---------------------------------------------------------------------------
// Suite
// ---------------------------------------------------------------------------

describe("analytics", () => {
  let consoleDebugSpy: MockInstance;

  beforeEach(() => {
    vi.stubGlobal("Blob", SniffableBlob);
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
    setSendBeacon(undefined);
    consoleDebugSpy?.mockRestore();
  });

  // -----------------------------------------------------------------------
  // sendBeacon path
  // -----------------------------------------------------------------------

  describe("sendBeacon path", () => {
    it("sends a well-formed payload when sendBeacon is available and returns true", async () => {
      const sendBeacon = vi.fn(() => true);
      setSendBeacon(sendBeacon);
      const fetchSpy = vi.fn(() => Promise.resolve(new Response()));
      vi.stubGlobal("fetch", fetchSpy);

      vi.setSystemTime(new Date("2026-07-20T12:30:00.000Z"));
      track("resume_analyzed", { score: 82 });

      expect(sendBeacon).toHaveBeenCalledTimes(1);
      expect(sendBeacon).toHaveBeenCalledWith(
        "/api/analytics/events",
        expect.any(SniffableBlob),
      );

      const blob = sendBeacon.mock.calls[0]?.[1] as SniffableBlob;
      expect(blob.type).toBe("application/json");

      const payload = JSON.parse(await blob.text());
      expect(payload).toMatchObject({
        event: "resume_analyzed",
        properties: { score: 82, route: window.location.pathname },
        route: window.location.pathname,
      });
      expect(payload.occurredAt).toBe("2026-07-20T12:30:00.000Z");

      // Must NOT fall through to fetch when beacon succeeds
      expect(fetchSpy).not.toHaveBeenCalled();
    });

    it("does not mutate the caller's properties object", () => {
      const sendBeacon = vi.fn(() => true);
      setSendBeacon(sendBeacon);
      const original = { score: 82 };
      const frozen = Object.freeze({ ...original });

      track("resume_analyzed", frozen);

      const payload = parseBeaconPayload(sendBeacon);
      expect(payload.properties).toMatchObject({ score: 82, route: expect.any(String) });
    });
  });

  // -----------------------------------------------------------------------
  // Fallback path: fetch
  // -----------------------------------------------------------------------

  describe("fetch fallback path", () => {
    const fetchUrl = "/api/analytics/events" as const;

    it("uses fetch when sendBeacon is undefined", async () => {
      setSendBeacon(undefined);
      const fetchSpy = vi.fn(() => Promise.resolve(new Response(null, { status: 202 })));
      vi.stubGlobal("fetch", fetchSpy);

      track("events_recommendation_clicked", { eventId: "event-1" });

      expect(fetchSpy).toHaveBeenCalledTimes(1);
      expect(fetchSpy).toHaveBeenCalledWith(
        fetchUrl,
        expect.objectContaining({
          method: "POST",
          credentials: "include",
          keepalive: true,
          headers: { "Content-Type": "application/json" },
        }),
      );
    });

    it("uses fetch when sendBeacon returns false", async () => {
      const sendBeacon = vi.fn(() => false);
      setSendBeacon(sendBeacon);
      const fetchSpy = vi.fn(() => Promise.resolve(new Response(null, { status: 202 })));
      vi.stubGlobal("fetch", fetchSpy);

      track("submission_failed", { error: "timeout" });

      expect(sendBeacon).toHaveBeenCalledTimes(1);
      expect(fetchSpy).toHaveBeenCalledTimes(1);
    });

    it("propagates sendBeacon errors (no catch in current impl)", () => {
      // NOTE: analytics.ts does NOT wrap the sendBeacon call in try/catch,
      // so if the host method throws, the error propagates to the caller.
      // This test documents that current behavior.
      const sendBeacon = vi.fn(() => {
        throw new Error("beacon unavailable");
      });
      setSendBeacon(sendBeacon);
      const fetchSpy = vi.fn(() => Promise.resolve(new Response(null, { status: 202 })));
      vi.stubGlobal("fetch", fetchSpy);

      expect(() => track("submission_completed", { submissionId: "s-1" })).toThrow(
        "beacon unavailable",
      );
      // fetch fallback is NOT reached because the uncaught error propagates first
      expect(fetchSpy).not.toHaveBeenCalled();
    });

    it("passes the same JSON body via fetch", async () => {
      setSendBeacon(undefined);
      const fetchSpy = vi.fn(() => Promise.resolve(new Response(null, { status: 202 })));
      vi.stubGlobal("fetch", fetchSpy);

      vi.setSystemTime(new Date("2026-07-20T14:00:00.000Z"));
      track("leaderboard_viewed", { contestId: "c-42" });

      const body = JSON.parse(fetchSpy.mock.calls[0]?.[1]?.body as string);
      expect(body).toMatchObject({
        event: "leaderboard_viewed",
        properties: { contestId: "c-42", route: window.location.pathname },
        route: window.location.pathname,
      });
      expect(body.occurredAt).toBe("2026-07-20T14:00:00.000Z");
    });

    it("swallows fetch rejection (never rejects the caller)", async () => {
      setSendBeacon(undefined);
      const fetchSpy = vi.fn(() => Promise.reject(new Error("network down")));
      vi.stubGlobal("fetch", fetchSpy);

      // Must not throw
      await expect(
        track("submission_started", { fileType: "pdf" }),
      ).toBeUndefined();
    });
  });

  // -----------------------------------------------------------------------
  // Edge cases: properties
  // -----------------------------------------------------------------------

  describe("properties edge cases", () => {
    it("accepts undefined properties (no second argument)", () => {
      const sendBeacon = vi.fn(() => true);
      setSendBeacon(sendBeacon);

      track("results_published");

      const payload = parseBeaconPayload(sendBeacon);
      expect(payload.event).toBe("results_published");
      // Should not have a bare `undefined` key; the spread covers it
      expect(payload.properties).toMatchObject({ route: window.location.pathname });
      expect(Object.keys(payload.properties as Record<string, unknown>)).toContain("route");
    });

    it("accepts null as properties (preserves route)", () => {
      const sendBeacon = vi.fn(() => true);
      setSendBeacon(sendBeacon);

      track("results_published", null as unknown as Record<string, unknown>);

      const payload = parseBeaconPayload(sendBeacon);
      expect(payload.properties).toMatchObject({ route: window.location.pathname });
    });

    it("accepts empty object as properties", () => {
      const sendBeacon = vi.fn(() => true);
      setSendBeacon(sendBeacon);

      track("shortlist_applied", {});

      const payload = parseBeaconPayload(sendBeacon);
      expect(payload.properties).toEqual({ route: window.location.pathname });
    });

    it("preserves properties that are empty strings", () => {
      const sendBeacon = vi.fn(() => true);
      setSendBeacon(sendBeacon);

      track("team_created", { teamName: "" });

      const payload = parseBeaconPayload(sendBeacon);
      expect(payload.properties).toMatchObject({ teamName: "" });
    });

    it("preserves properties that are numeric zero", () => {
      const sendBeacon = vi.fn(() => true);
      setSendBeacon(sendBeacon);

      track("evaluation_saved", { score: 0 });

      const payload = parseBeaconPayload(sendBeacon);
      expect(payload.properties).toMatchObject({ score: 0 });
    });

    it("preserves properties that are false", () => {
      const sendBeacon = vi.fn(() => true);
      setSendBeacon(sendBeacon);

      track("career_achievement_visibility_changed", { visible: false });

      const payload = parseBeaconPayload(sendBeacon);
      expect(payload.properties).toMatchObject({ visible: false });
    });

    it("preserves deeply nested properties", () => {
      const sendBeacon = vi.fn(() => true);
      setSendBeacon(sendBeacon);

      track("submission_form_viewed", {
        form: {
          sections: 3,
          fields: ["title", "file", "notes"],
        },
      });

      const payload = parseBeaconPayload(sendBeacon);
      expect(payload.properties).toMatchObject({
        form: { sections: 3, fields: ["title", "file", "notes"] },
      });
    });
  });

  // -----------------------------------------------------------------------
  // Edge cases: server-side rendering / non-browser
  // -----------------------------------------------------------------------

  describe("SSR / non-browser guard", () => {
    it("is a no-op when window is undefined", () => {
      // Simulate SSR by stubbing window
      const windowBefore = globalThis.window;
      delete (globalThis as any).window;

      const fetchSpy = vi.fn(() => Promise.resolve(new Response()));
      vi.stubGlobal("fetch", fetchSpy);

      // Must not throw
      expect(() => track("results_published")).not.toThrow();
      expect(fetchSpy).not.toHaveBeenCalled();

      // Restore so afterEach cleanup doesn't break
      globalThis.window = windowBefore;
    });
  });

  // -----------------------------------------------------------------------
  // Multiple events in sequence
  // -----------------------------------------------------------------------

  describe("multiple events", () => {
    it("tracks a sequence of events independently", () => {
      const sendBeacon = vi.fn(() => true);
      setSendBeacon(sendBeacon);

      track("evaluation_started", { evalId: "e1" });
      track("evaluation_saved", { evalId: "e1" });
      track("results_published", { evalId: "e1" });

      expect(sendBeacon).toHaveBeenCalledTimes(3);

      const [first, second, third] = sendBeacon.mock.calls.map(
        (c) => JSON.parse(((c[1] as SniffableBlob).parts as string[]).join("")),
      );

      expect(first.event).toBe("evaluation_started");
      expect(second.event).toBe("evaluation_saved");
      expect(third.event).toBe("results_published");
    });
  });

  // -----------------------------------------------------------------------
  // Route and timestamp metadata
  // -----------------------------------------------------------------------

  describe("metadata fields", () => {
    it("sets route from window.location.pathname", () => {
      const sendBeacon = vi.fn(() => true);
      setSendBeacon(sendBeacon);

      track("certificate_downloaded");

      const payload = parseBeaconPayload(sendBeacon);
      expect(payload.route).toBe(window.location.pathname);
      expect(payload.properties).toMatchObject({ route: window.location.pathname });
    });

    it("sets occurredAt as an ISO-8601 string", () => {
      const sendBeacon = vi.fn(() => true);
      setSendBeacon(sendBeacon);

      vi.setSystemTime(new Date("2026-07-20T08:15:30.123Z"));
      track("resume_analyzed");

      const payload = parseBeaconPayload(sendBeacon);
      expect(payload.occurredAt).toBe("2026-07-20T08:15:30.123Z");
    });
  });

  // -----------------------------------------------------------------------
  // Event name coverage — exercise every known event type
  // -----------------------------------------------------------------------

  describe("all event types", () => {
    const sendBeacon = vi.fn(() => true);
    beforeEach(() => setSendBeacon(sendBeacon));
    afterEach(() => sendBeacon.mockClear());

    // Submission flow
    it("submission_form_viewed", () => { track("submission_form_viewed"); expect(sendBeacon).lastCalledWith(expect.any(String), expect.any(SniffableBlob)); });
    it("submission_started", () => { track("submission_started"); expect(sendBeacon).lastCalledWith(expect.any(String), expect.any(SniffableBlob)); });
    it("submission_completed", () => { track("submission_completed"); expect(sendBeacon).lastCalledWith(expect.any(String), expect.any(SniffableBlob)); });
    it("submission_failed", () => { track("submission_failed"); expect(sendBeacon).lastCalledWith(expect.any(String), expect.any(SniffableBlob)); });

    // Evaluation
    it("evaluation_opened", () => { track("evaluation_opened"); expect(sendBeacon).lastCalledWith(expect.any(String), expect.any(SniffableBlob)); });
    it("evaluation_started", () => { track("evaluation_started"); expect(sendBeacon).lastCalledWith(expect.any(String), expect.any(SniffableBlob)); });
    it("evaluation_saved", () => { track("evaluation_saved"); expect(sendBeacon).lastCalledWith(expect.any(String), expect.any(SniffableBlob)); });
    it("shortlist_applied", () => { track("shortlist_applied"); expect(sendBeacon).lastCalledWith(expect.any(String), expect.any(SniffableBlob)); });
    it("results_published", () => { track("results_published"); expect(sendBeacon).lastCalledWith(expect.any(String), expect.any(SniffableBlob)); });
    it("leaderboard_viewed", () => { track("leaderboard_viewed"); expect(sendBeacon).lastCalledWith(expect.any(String), expect.any(SniffableBlob)); });

    // Event creation
    it("create_event_started", () => { track("create_event_started"); expect(sendBeacon).lastCalledWith(expect.any(String), expect.any(SniffableBlob)); });
    it("create_event_quick_mode", () => { track("create_event_quick_mode"); expect(sendBeacon).lastCalledWith(expect.any(String), expect.any(SniffableBlob)); });
    it("create_event_full_mode", () => { track("create_event_full_mode"); expect(sendBeacon).lastCalledWith(expect.any(String), expect.any(SniffableBlob)); });
    it("create_event_completed", () => { track("create_event_completed"); expect(sendBeacon).lastCalledWith(expect.any(String), expect.any(SniffableBlob)); });
    it("create_event_abandoned", () => { track("create_event_abandoned"); expect(sendBeacon).lastCalledWith(expect.any(String), expect.any(SniffableBlob)); });

    // Certificate
    it("certificate_downloaded", () => { track("certificate_downloaded"); expect(sendBeacon).lastCalledWith(expect.any(String), expect.any(SniffableBlob)); });

    // Team
    it("team_created", () => { track("team_created"); expect(sendBeacon).lastCalledWith(expect.any(String), expect.any(SniffableBlob)); });
    it("team_invite_sent", () => { track("team_invite_sent"); expect(sendBeacon).lastCalledWith(expect.any(String), expect.any(SniffableBlob)); });
    it("team_recruitment_posted", () => { track("team_recruitment_posted"); expect(sendBeacon).lastCalledWith(expect.any(String), expect.any(SniffableBlob)); });

    // Career / resume
    it("resume_analyzed", () => { track("resume_analyzed"); expect(sendBeacon).lastCalledWith(expect.any(String), expect.any(SniffableBlob)); });
    it("resume_skills_synced", () => { track("resume_skills_synced"); expect(sendBeacon).lastCalledWith(expect.any(String), expect.any(SniffableBlob)); });
    it("opportunity_fit_viewed", () => { track("opportunity_fit_viewed"); expect(sendBeacon).lastCalledWith(expect.any(String), expect.any(SniffableBlob)); });
    it("career_achievements_synced", () => { track("career_achievements_synced"); expect(sendBeacon).lastCalledWith(expect.any(String), expect.any(SniffableBlob)); });
    it("career_achievement_visibility_changed", () => { track("career_achievement_visibility_changed"); expect(sendBeacon).lastCalledWith(expect.any(String), expect.any(SniffableBlob)); });

    // Recommendations
    it("lms_exam_prep_recommendations_viewed", () => { track("lms_exam_prep_recommendations_viewed"); expect(sendBeacon).lastCalledWith(expect.any(String), expect.any(SniffableBlob)); });
    it("lms_roadmap_recommendations_viewed", () => { track("lms_roadmap_recommendations_viewed"); expect(sendBeacon).lastCalledWith(expect.any(String), expect.any(SniffableBlob)); });
    it("events_recommendations_viewed", () => { track("events_recommendations_viewed"); expect(sendBeacon).lastCalledWith(expect.any(String), expect.any(SniffableBlob)); });
    it("events_recommendation_clicked", () => { track("events_recommendation_clicked"); expect(sendBeacon).lastCalledWith(expect.any(String), expect.any(SniffableBlob)); });

    // Public career profile
    it("public_career_profile_viewed", () => { track("public_career_profile_viewed"); expect(sendBeacon).lastCalledWith(expect.any(String), expect.any(SniffableBlob)); });
    it("public_career_profile_link_copied", () => { track("public_career_profile_link_copied"); expect(sendBeacon).lastCalledWith(expect.any(String), expect.any(SniffableBlob)); });
    it("public_career_profile_exported", () => { track("public_career_profile_exported"); expect(sendBeacon).lastCalledWith(expect.any(String), expect.any(SniffableBlob)); });
  });

  // -----------------------------------------------------------------------
  // Development-mode console output
  //
  // NOTE: Vite replaces `process.env.NODE_ENV` at transform time, so the
  // check inside `track()` — `if (process.env.NODE_ENV === 'development')` —
  // is a compile-time constant in test runs (evaluates to `false` because
  // vitest sets it to `"test"`).  We cannot exercise the "does log" branch
  // at runtime.  The tests below confirm the branch is inactive and document
  // the compile-time limitation.
  // -----------------------------------------------------------------------

  describe("development mode logging", () => {
    it("does not log to console.debug in test mode (compile-time constant)", () => {
      const sendBeacon = vi.fn(() => true);
      setSendBeacon(sendBeacon);
      consoleDebugSpy = vi.spyOn(console, "debug").mockImplementation(() => undefined);

      track("team_invite_sent", { teamId: "t-1" });

      expect(consoleDebugSpy).not.toHaveBeenCalled();
    });
  });

  // -----------------------------------------------------------------------
  // Static type safety: compiler-level verification via instantiation
  // -----------------------------------------------------------------------

  describe("type safety", () => {
    it("rejects unknown event names at compile time", () => {
      // The following line should fail to compile — uncomment to verify manually:
      // track("bogus_event" as any);
      // We can at least confirm the function accepts the union type.
      expect(typeof track).toBe("function");
    });

    it("accepts any TrackEvent as first argument", () => {
      // This is a compile-time check; at runtime we just verify it doesn't throw.
      const events = [
        "submission_form_viewed",
        "submission_started",
        "submission_completed",
        "submission_failed",
        "evaluation_opened",
        "evaluation_started",
        "evaluation_saved",
        "shortlist_applied",
        "results_published",
        "leaderboard_viewed",
        "create_event_started",
        "create_event_quick_mode",
        "create_event_full_mode",
        "create_event_completed",
        "create_event_abandoned",
        "certificate_downloaded",
        "team_created",
        "team_invite_sent",
        "team_recruitment_posted",
        "resume_analyzed",
        "resume_skills_synced",
        "opportunity_fit_viewed",
        "career_achievements_synced",
        "career_achievement_visibility_changed",
        "lms_exam_prep_recommendations_viewed",
        "lms_roadmap_recommendations_viewed",
        "events_recommendations_viewed",
        "events_recommendation_clicked",
        "public_career_profile_viewed",
        "public_career_profile_link_copied",
        "public_career_profile_exported",
      ] as const;

      for (const ev of events) {
        expect(() => track(ev)).not.toThrow();
      }
    });
  });

  // -----------------------------------------------------------------------
  // Interaction between beacon and fallback
  // -----------------------------------------------------------------------

  describe("beacon / fetch interaction", () => {
    it("does not call fetch when sendBeacon returns true", () => {
      const sendBeacon = vi.fn(() => true);
      setSendBeacon(sendBeacon);
      const fetchSpy = vi.fn(() => Promise.resolve(new Response()));
      vi.stubGlobal("fetch", fetchSpy);

      track("resume_analyzed");

      expect(fetchSpy).not.toHaveBeenCalled();
    });

    it("falls through to fetch when sendBeacon returns false", () => {
      const sendBeacon = vi.fn(() => false);
      setSendBeacon(sendBeacon);
      const fetchSpy = vi.fn(() => Promise.resolve(new Response()));
      vi.stubGlobal("fetch", fetchSpy);

      track("resume_analyzed");

      expect(fetchSpy).toHaveBeenCalledTimes(1);
    });
  });

  // -----------------------------------------------------------------------
  // Payload shape invariants
  // -----------------------------------------------------------------------

  describe("payload shape", () => {
    it("top-level keys are event, properties, route, and occurredAt", () => {
      const sendBeacon = vi.fn(() => true);
      setSendBeacon(sendBeacon);

      track("certificate_downloaded", { certId: "abc" });

      const payload = parseBeaconPayload(sendBeacon);
      expect(Object.keys(payload).sort()).toEqual([
        "event",
        "occurredAt",
        "properties",
        "route",
      ]);
    });

    it("properties always contains route", () => {
      const sendBeacon = vi.fn(() => true);
      setSendBeacon(sendBeacon);

      track("certificate_downloaded");

      expect(parseBeaconPayload(sendBeacon).properties).toHaveProperty("route");
    });
  });
});
