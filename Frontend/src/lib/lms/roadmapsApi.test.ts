import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getRoadmapRecommendations } from "./roadmapsApi";

function jsonResponse(data: unknown) {
  return Promise.resolve({
    ok: true,
    status: 200,
    json: () => Promise.resolve(data),
  } as Response);
}

describe("roadmapsApi", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() =>
        jsonResponse({
          success: true,
          data: [
            {
              id: "roadmap-1",
              title: "SQL Interview Readiness",
              skill: "SQL",
              authorId: "mentor-1",
              viewCount: 0,
              upvotes: 0,
              qualityScore: 8,
              published: 1,
              nodes: [],
              edges: [],
              recommendationScore: 0.82,
              confidence: 0.9,
              reasons: [{ code: "skillGapMatch", label: "Targets a career skill gap", weight: 1 }],
            },
          ],
        })
      )
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("loads cross-domain roadmap recommendations", async () => {
    const items = await getRoadmapRecommendations({ limit: 4 });

    expect(items[0].title).toBe("SQL Interview Readiness");
    expect(items[0].reasons?.[0].code).toBe("skillGapMatch");
    expect(fetch).toHaveBeenCalledWith("/api/lms/recommendations/roadmaps?limit=4", expect.anything());
  });
});
