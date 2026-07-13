import { afterEach, describe, expect, it, vi } from "vitest";
import { track } from "./analytics";

function setBeacon(value: unknown) {
  Object.defineProperty(navigator, "sendBeacon", {
    configurable: true,
    value,
  });
}

describe("analytics", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    setBeacon(undefined);
  });

  it("sends product analytics through sendBeacon when available", async () => {
    class TestBlob {
      parts: string[];
      constructor(parts: string[]) {
        this.parts = parts;
      }
      async text() {
        return this.parts.join("");
      }
    }
    vi.stubGlobal("Blob", TestBlob);
    const sendBeacon = vi.fn((_url: string, _data?: BodyInit | null) => true);
    setBeacon(sendBeacon);

    track("resume_analyzed", { score: 82 });

    expect(sendBeacon).toHaveBeenCalledWith("/api/analytics/events", expect.any(TestBlob));
    const beaconBody = sendBeacon.mock.calls[0]?.[1];
    expect(beaconBody).toBeInstanceOf(TestBlob);
    const body = JSON.parse(await (beaconBody as unknown as TestBlob).text());
    expect(body.event).toBe("resume_analyzed");
    expect(body.properties.score).toBe(82);
    expect(body.route).toBe(window.location.pathname);
  });

  it("falls back to fetch when sendBeacon is unavailable", () => {
    setBeacon(undefined);
    const fetch = vi.fn(() => Promise.resolve(new Response(null, { status: 202 })));
    vi.stubGlobal("fetch", fetch);

    track("events_recommendation_clicked", { eventId: "event-1" });

    expect(fetch).toHaveBeenCalledWith(
      "/api/analytics/events",
      expect.objectContaining({
        method: "POST",
        credentials: "include",
        keepalive: true,
      })
    );
  });
});
