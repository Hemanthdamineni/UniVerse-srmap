import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  addRoadmapEdge,
  addRoadmapNode,
  completeRoadmapNode,
  createRoadmap,
  deleteRoadmap,
  getRoadmap,
  getRoadmapRecommendations,
  listRoadmaps,
} from "./roadmapsApi";

function jsonEnvelope(data: unknown) {
  return Promise.resolve({
    ok: true,
    status: 200,
    json: () => Promise.resolve({ success: true, data }),
  } as Response);
}

function mockFetch(data: unknown) {
  return vi.fn(() => jsonEnvelope(data));
}

describe("roadmapsApi", () => {
  afterEach(() => vi.restoreAllMocks());

  describe("listRoadmaps", () => {
    it("GETs roadmaps with params", async () => {
      vi.stubGlobal("fetch", mockFetch([{ id: "rm-1", title: "SQL Mastery" }]));
      const result = await listRoadmaps({ skill: "SQL", limit: "5" });
      expect(result).toEqual([{ id: "rm-1", title: "SQL Mastery" }]);
      expect(fetch).toHaveBeenCalledWith(
        "/api/lms/roadmaps?skill=SQL&limit=5",
        expect.anything()
      );
    });

    it("omits empty params", async () => {
      vi.stubGlobal("fetch", mockFetch([]));
      await listRoadmaps({ skill: "SQL", query: undefined, extra: "" });
      expect(fetch).toHaveBeenCalledWith(
        "/api/lms/roadmaps?skill=SQL",
        expect.anything()
      );
    });

    it("handles no params", async () => {
      vi.stubGlobal("fetch", mockFetch([]));
      await listRoadmaps();
      expect(fetch).toHaveBeenCalledWith("/api/lms/roadmaps?", expect.anything());
    });
  });

  describe("getRoadmapRecommendations", () => {
    it("loads cross-domain roadmap recommendations with params", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn(() =>
          jsonEnvelope([
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
          ])
        )
      );
      const items = await getRoadmapRecommendations({ limit: 4 });
      expect(items[0].title).toBe("SQL Interview Readiness");
      expect(items[0].reasons?.[0].code).toBe("skillGapMatch");
      expect(fetch).toHaveBeenCalledWith("/api/lms/recommendations/roadmaps?limit=4", expect.anything());
    });

    it("handles empty params", async () => {
      vi.stubGlobal("fetch", mockFetch([]));
      await getRoadmapRecommendations();
      expect(fetch).toHaveBeenCalledWith("/api/lms/recommendations/roadmaps?", expect.anything());
    });
  });

  describe("createRoadmap", () => {
    it("POSTs payload and returns roadmap", async () => {
      const payload = { title: "New Roadmap", skill: "React" };
      vi.stubGlobal("fetch", mockFetch({ id: "rm-new", ...payload }));
      const result = await createRoadmap(payload);
      expect(result).toEqual({ id: "rm-new", title: "New Roadmap", skill: "React" });
      expect(fetch).toHaveBeenCalledWith(
        "/api/lms/roadmaps",
        expect.objectContaining({ method: "POST", body: JSON.stringify(payload) })
      );
    });
  });

  describe("getRoadmap", () => {
    it("GETs a single roadmap by id", async () => {
      vi.stubGlobal("fetch", mockFetch({ id: "rm-1", title: "Roadmap" }));
      const result = await getRoadmap("rm-1");
      expect(result).toEqual({ id: "rm-1", title: "Roadmap" });
      expect(fetch).toHaveBeenCalledWith("/api/lms/roadmaps/rm-1", expect.anything());
    });

    it("encodes id with special chars", async () => {
      vi.stubGlobal("fetch", mockFetch({}));
      await getRoadmap("rm/1");
      expect(fetch).toHaveBeenCalledWith("/api/lms/roadmaps/rm%2F1", expect.anything());
    });
  });

  describe("deleteRoadmap", () => {
    it("DELETEs roadmap and returns confirmation", async () => {
      vi.stubGlobal("fetch", mockFetch({ deleted: true, id: "rm-1" }));
      const result = await deleteRoadmap("rm-1");
      expect(result).toEqual({ deleted: true, id: "rm-1" });
      expect(fetch).toHaveBeenCalledWith(
        "/api/lms/roadmaps/rm-1",
        expect.objectContaining({ method: "DELETE" })
      );
    });
  });

  describe("addRoadmapNode", () => {
    it("POSTs node to roadmap", async () => {
      const payload = { title: "Learn Basics", nodeType: "concept" };
      vi.stubGlobal("fetch", mockFetch({ id: "rm-1", nodes: [{ ...payload, id: "node-new" }] }));
      const result = await addRoadmapNode("rm-1", payload);
      expect(result.nodes).toHaveLength(1);
      expect(fetch).toHaveBeenCalledWith(
        "/api/lms/roadmaps/rm-1/nodes",
        expect.objectContaining({ method: "POST", body: JSON.stringify(payload) })
      );
    });
  });

  describe("addRoadmapEdge", () => {
    it("POSTs edge to roadmap", async () => {
      const payload = { fromNodeId: "n1", toNodeId: "n2" };
      vi.stubGlobal("fetch", mockFetch({ id: "rm-1", edges: [{ ...payload, roadmapId: "rm-1" }] }));
      const result = await addRoadmapEdge("rm-1", payload);
      expect(result.edges).toHaveLength(1);
      expect(fetch).toHaveBeenCalledWith(
        "/api/lms/roadmaps/rm-1/edges",
        expect.objectContaining({ method: "POST", body: JSON.stringify(payload) })
      );
    });
  });

  describe("completeRoadmapNode", () => {
    it("POSTs to mark node complete", async () => {
      vi.stubGlobal("fetch", mockFetch({ id: "rm-1" }));
      await completeRoadmapNode("rm-1", "node-1");
      expect(fetch).toHaveBeenCalledWith(
        "/api/lms/roadmaps/rm-1/nodes/node-1/complete",
        expect.objectContaining({ method: "POST" })
      );
    });
  });
});
