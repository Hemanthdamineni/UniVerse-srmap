import { afterEach, describe, expect, it, vi } from "vitest";
import {
  addToLmsCollection,
  checkLmsDuplicate,
  createLmsCollection,
  createLmsResource,
  deleteLmsResource,
  getContributorProfile,
  getExamPrepRecommendations,
  getExploreData,
  getLmsCollection,
  getLmsResource,
  getLmsResourceModerationQueue,
  getNextStepRecommendation,
  getPyqBank,
  getRecommendations,
  getSubjectOverview,
  getSubjectPresence,
  getTopicGraph,
  getUpcomingPyqs,
  listLmsCollections,
  listLmsResources,
  moderateLmsResource,
  removeFromLmsCollection,
  restoreLmsResource,
  updateLmsResource,
} from "./resourceDiscoveryApi";

function mockFetchSuccess(data: unknown) {
  return vi.fn(() =>
    Promise.resolve({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ success: true, data }),
    } as Response)
  );
}

function mockFetchRaw(data: unknown) {
  return vi.fn(() =>
    Promise.resolve({
      ok: true,
      status: 200,
      json: () => Promise.resolve(data),
    } as Response)
  );
}

describe("resourceDiscoveryApi", () => {
  afterEach(() => vi.restoreAllMocks());

  describe("listLmsResources", () => {
    it("GETs resources with query params", async () => {
      const response = {
        items: [{ id: "res-1", title: "DB Guide" }],
        pagination: { page: 1, limit: 20, total: 1 },
      };
      vi.stubGlobal("fetch", mockFetchSuccess(response));
      const result = await listLmsResources({ subjectCode: "CSE301", type: "note", limit: "10" });
      expect(result).toEqual(response);
      expect(fetch).toHaveBeenCalledWith(
        "/api/lms/resources?subjectCode=CSE301&type=note&limit=10",
        expect.anything()
      );
    });

    it("omits undefined/null/empty params", async () => {
      vi.stubGlobal("fetch", mockFetchSuccess({ items: [], pagination: { page: 1, limit: 20, total: 0 } }));
      await listLmsResources({ subjectCode: "CSE301", query: undefined, extra: "", type: null });
      expect(fetch).toHaveBeenCalledWith(
        "/api/lms/resources?subjectCode=CSE301",
        expect.anything()
      );
    });

    it("handles no params", async () => {
      vi.stubGlobal("fetch", mockFetchSuccess({ items: [], pagination: { page: 1, limit: 20, total: 0 } }));
      await listLmsResources();
      expect(fetch).toHaveBeenCalledWith("/api/lms/resources?", expect.anything());
    });

    it("encodes search query", async () => {
      vi.stubGlobal("fetch", mockFetchSuccess({ items: [], pagination: { page: 1, limit: 20, total: 0 } }));
      await listLmsResources({ query: "sql join" });
      expect(fetch).toHaveBeenCalledWith(
        "/api/lms/resources?query=sql+join",
        expect.anything()
      );
    });
  });

  describe("getLmsResource", () => {
    it("GETs single resource by id", async () => {
      vi.stubGlobal("fetch", mockFetchSuccess({ id: "res-1", title: "DB Guide" }));
      const result = await getLmsResource("res-1");
      expect(result).toEqual({ id: "res-1", title: "DB Guide" });
      expect(fetch).toHaveBeenCalledWith("/api/lms/resources/res-1", expect.anything());
    });

    it("encodes id with special chars", async () => {
      vi.stubGlobal("fetch", mockFetchSuccess({ id: "res/1" }));
      await getLmsResource("res/1");
      expect(fetch).toHaveBeenCalledWith("/api/lms/resources/res%2F1", expect.anything());
    });
  });

  describe("createLmsResource", () => {
    it("POSTs JSON when no file present", async () => {
      const payload = { title: "New Note", type: "note" };
      vi.stubGlobal("fetch", mockFetchSuccess({ id: "res-new", ...payload }));
      const result = await createLmsResource(payload);
      expect(result).toEqual({ id: "res-new", title: "New Note", type: "note" });
      expect(fetch).toHaveBeenCalledWith(
        "/api/lms/resources",
        expect.objectContaining({ method: "POST", body: JSON.stringify(payload) })
      );
    });

    it("sends multipart when payload includes a File", async () => {
      const file = new File(["content"], "doc.pdf");
      vi.stubGlobal("fetch", mockFetchSuccess({ id: "res-new" }));
      await createLmsResource({ title: "Doc", file });
      const callBody = (fetch as any).mock.calls[0][1].body;
      expect(callBody).toBeInstanceOf(FormData);
      expect(fetch).toHaveBeenCalledWith(
        "/api/lms/resources",
        expect.objectContaining({ body: expect.any(FormData) })
      );
    });
  });

  describe("updateLmsResource", () => {
    it("PUTs JSON when no file", async () => {
      vi.stubGlobal("fetch", mockFetchSuccess({ id: "res-1", title: "Updated" }));
      const result = await updateLmsResource("res-1", { title: "Updated" });
      expect(result).toEqual({ id: "res-1", title: "Updated" });
      expect(fetch).toHaveBeenCalledWith(
        "/api/lms/resources/res-1",
        expect.objectContaining({ method: "PUT", body: JSON.stringify({ title: "Updated" }) })
      );
    });

    it("sends multipart when payload includes a File", async () => {
      const file = new File(["content"], "updated.pdf");
      vi.stubGlobal("fetch", mockFetchSuccess({ id: "res-1" }));
      await updateLmsResource("res-1", { title: "Updated", file });
      const callBody = (fetch as any).mock.calls[0][1].body;
      expect(callBody).toBeInstanceOf(FormData);
    });
  });

  describe("deleteLmsResource", () => {
    it("DELETEs resource", async () => {
      vi.stubGlobal("fetch", mockFetchSuccess({ deleted: true, id: "res-1" }));
      const result = await deleteLmsResource("res-1");
      expect(result).toEqual({ deleted: true, id: "res-1" });
      expect(fetch).toHaveBeenCalledWith(
        "/api/lms/resources/res-1",
        expect.objectContaining({ method: "DELETE" })
      );
    });
  });

  describe("restoreLmsResource", () => {
    it("POSTs to restore endpoint", async () => {
      vi.stubGlobal("fetch", mockFetchSuccess({ id: "res-1", title: "Restored" }));
      const result = await restoreLmsResource("res-1");
      expect(result).toEqual({ id: "res-1", title: "Restored" });
      expect(fetch).toHaveBeenCalledWith(
        "/api/lms/resources/res-1/restore",
        expect.objectContaining({ method: "POST" })
      );
    });
  });

  describe("checkLmsDuplicate", () => {
    it("GETs duplicate check results", async () => {
      const result = { exact: null, similar: [], hasDuplicate: false };
      vi.stubGlobal("fetch", mockFetchSuccess(result));
      const output = await checkLmsDuplicate({ title: "DB Guide", subjectCode: "CSE301" });
      expect(output).toEqual(result);
      expect(fetch).toHaveBeenCalledWith(
        "/api/lms/resources/check-duplicate?title=DB+Guide&subjectCode=CSE301",
        expect.anything()
      );
    });

    it("omits empty params", async () => {
      vi.stubGlobal("fetch", mockFetchSuccess({ exact: null, similar: [], hasDuplicate: false }));
      await checkLmsDuplicate({ title: "Guide", query: "" });
      expect(fetch).toHaveBeenCalledWith(
        "/api/lms/resources/check-duplicate?title=Guide",
        expect.anything()
      );
    });
  });

  describe("getPyqBank", () => {
    it("GETs PYQs for subject", async () => {
      const response = { items: [{ id: "pyq-1" }], pagination: { page: 1, limit: 20, total: 1 } };
      vi.stubGlobal("fetch", mockFetchSuccess(response));
      const result = await getPyqBank("CSE301", { year: "2025" });
      expect(result).toEqual(response);
      expect(fetch).toHaveBeenCalledWith(
        "/api/lms/pyq/CSE301?year=2025",
        expect.anything()
      );
    });

    it("handles no params", async () => {
      vi.stubGlobal("fetch", mockFetchSuccess({ items: [], pagination: { page: 1, limit: 20, total: 0 } }));
      await getPyqBank("CSE301");
      expect(fetch).toHaveBeenCalledWith("/api/lms/pyq/CSE301?", expect.anything());
    });
  });

  describe("getUpcomingPyqs", () => {
    it("GETs upcoming PYQs", async () => {
      vi.stubGlobal("fetch", mockFetchSuccess([{ id: "pyq-1" }]));
      const result = await getUpcomingPyqs();
      expect(result).toEqual([{ id: "pyq-1" }]);
      expect(fetch).toHaveBeenCalledWith("/api/lms/pyq/upcoming", expect.anything());
    });
  });

  describe("collections", () => {
    it("listLmsCollections GETs collections", async () => {
      vi.stubGlobal("fetch", mockFetchSuccess([{ id: "col-1", name: "Saved" }]));
      const result = await listLmsCollections();
      expect(result).toEqual([{ id: "col-1", name: "Saved" }]);
      expect(fetch).toHaveBeenCalledWith("/api/lms/collections", expect.anything());
    });

    it("createLmsCollection POSTs payload", async () => {
      vi.stubGlobal("fetch", mockFetchSuccess({ id: "col-new", name: "New Collection" }));
      const result = await createLmsCollection({ name: "New Collection" });
      expect(result).toEqual({ id: "col-new", name: "New Collection" });
      expect(fetch).toHaveBeenCalledWith(
        "/api/lms/collections",
        expect.objectContaining({ method: "POST", body: JSON.stringify({ name: "New Collection" }) })
      );
    });

    it("getLmsCollection GETs single collection", async () => {
      vi.stubGlobal("fetch", mockFetchSuccess({ id: "col-1" }));
      const result = await getLmsCollection("col-1");
      expect(result).toEqual({ id: "col-1" });
      expect(fetch).toHaveBeenCalledWith("/api/lms/collections/col-1", expect.anything());
    });

    it("addToLmsCollection POSTs resourceId", async () => {
      vi.stubGlobal("fetch", mockFetchSuccess({ id: "col-1", items: [{ id: "res-1" }] }));
      const result = await addToLmsCollection("col-1", "res-1");
      expect(result.items).toHaveLength(1);
      expect(fetch).toHaveBeenCalledWith(
        "/api/lms/collections/col-1/items",
        expect.objectContaining({ method: "POST", body: JSON.stringify({ resourceId: "res-1" }) })
      );
    });

    it("removeFromLmsCollection DELETEs resource from collection", async () => {
      vi.stubGlobal("fetch", mockFetchSuccess({ id: "col-1", items: [] }));
      const result = await removeFromLmsCollection("col-1", "res-1");
      expect(result.items).toHaveLength(0);
      expect(fetch).toHaveBeenCalledWith(
        "/api/lms/collections/col-1/items/res-1",
        expect.objectContaining({ method: "DELETE" })
      );
    });
  });

  describe("recommendations", () => {
    it("getRecommendations GETs recommendations with params", async () => {
      vi.stubGlobal("fetch", mockFetchSuccess([{ id: "rec-1" }]));
      const result = await getRecommendations({ limit: "5", subjectCode: "CSE301" });
      expect(result).toEqual([{ id: "rec-1" }]);
      expect(fetch).toHaveBeenCalledWith(
        "/api/lms/recommendations?limit=5&subjectCode=CSE301",
        expect.anything()
      );
    });

    it("getRecommendations handles empty params", async () => {
      vi.stubGlobal("fetch", mockFetchSuccess([]));
      await getRecommendations();
      expect(fetch).toHaveBeenCalledWith("/api/lms/recommendations?", expect.anything());
    });

    it("getExamPrepRecommendations GETs exam prep", async () => {
      vi.stubGlobal("fetch", mockFetchSuccess([{ id: "pyq-1", type: "pyq" }]));
      const result = await getExamPrepRecommendations({ subjectCode: "CSE301" });
      expect(result).toEqual([{ id: "pyq-1", type: "pyq" }]);
      expect(fetch).toHaveBeenCalledWith(
        "/api/lms/recommendations/exam-prep?subjectCode=CSE301",
        expect.anything()
      );
    });

    it("getNextStepRecommendation GETs next step for resource", async () => {
      vi.stubGlobal("fetch", mockFetchSuccess([{ id: "next-1" }]));
      const result = await getNextStepRecommendation("res-1");
      expect(result).toEqual([{ id: "next-1" }]);
      expect(fetch).toHaveBeenCalledWith(
        "/api/lms/recommendations/next-step?resourceId=res-1",
        expect.anything()
      );
    });

    it("encodes resourceId in next-step", async () => {
      vi.stubGlobal("fetch", mockFetchSuccess([]));
      await getNextStepRecommendation("res/1");
      expect(fetch).toHaveBeenCalledWith(
        "/api/lms/recommendations/next-step?resourceId=res%2F1",
        expect.anything()
      );
    });
  });

  describe("getExploreData", () => {
    it("GETs explore data", async () => {
      const explore = { trending: [], topRated: [], examReady: [] };
      vi.stubGlobal("fetch", mockFetchSuccess(explore));
      const result = await getExploreData();
      expect(result).toEqual(explore);
      expect(fetch).toHaveBeenCalledWith("/api/lms/explore", expect.anything());
    });
  });

  describe("subject endpoints", () => {
    it("getSubjectOverview GETs overview", async () => {
      vi.stubGlobal("fetch", mockFetchSuccess({ subjectCode: "CSE301", progress: 60 }));
      const result = await getSubjectOverview("CSE301");
      expect(result).toEqual({ subjectCode: "CSE301", progress: 60 });
      expect(fetch).toHaveBeenCalledWith("/api/lms/subjects/CSE301/overview", expect.anything());
    });

    it("getSubjectPresence GETs presence count", async () => {
      vi.stubGlobal("fetch", mockFetchSuccess({ subjectCode: "CSE301", count: 15 }));
      const result = await getSubjectPresence("CSE301");
      expect(result).toEqual({ subjectCode: "CSE301", count: 15 });
      expect(fetch).toHaveBeenCalledWith("/api/lms/subjects/CSE301/presence", expect.anything());
    });

    it("getTopicGraph GETs topic graph", async () => {
      vi.stubGlobal("fetch", mockFetchSuccess({ nodes: [], edges: [] }));
      const result = await getTopicGraph("CSE301");
      expect(result).toEqual({ nodes: [], edges: [] });
      expect(fetch).toHaveBeenCalledWith(
        "/api/lms/topics/graph?subjectCode=CSE301",
        expect.anything()
      );
    });
  });

  describe("getContributorProfile", () => {
    it("GETs contributor profile by userId", async () => {
      const profile = { userId: "u1", displayName: "Student", trust: {} as any, totals: {} as any, recentResources: [], contributions: {} as any };
      vi.stubGlobal("fetch", mockFetchSuccess(profile));
      const result = await getContributorProfile("u1");
      expect(result).toEqual(profile);
      expect(fetch).toHaveBeenCalledWith("/api/lms/contributors/u1", expect.anything());
    });
  });

  describe("moderation", () => {
    it("getLmsResourceModerationQueue GETs queue with params", async () => {
      const queue = { items: [], counts: { total: 0, flagged: 0, hidden: 0, removed: 0, visible: 0 }, pagination: { page: 1, limit: 25, total: 0 } };
      vi.stubGlobal("fetch", mockFetchSuccess(queue));
      const result = await getLmsResourceModerationQueue({ status: "flagged" });
      expect(result).toEqual(queue);
      expect(fetch).toHaveBeenCalledWith(
        "/api/lms/admin/resource-flags?status=flagged",
        expect.anything()
      );
    });

    it("getLmsResourceModerationQueue passes custom headers as plain object", async () => {
      vi.stubGlobal("fetch", mockFetchSuccess({ items: [], counts: {} as any, pagination: { page: 1, limit: 25, total: 0 } }));
      await getLmsResourceModerationQueue({}, { Authorization: "Bearer test" } as any);
      expect(fetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ headers: expect.objectContaining({ Authorization: "Bearer test" }) })
      );
    });

    it("moderateLmsResource PATCHes decision", async () => {
      const payload = { decision: "approve" as const, reason: "Looks good" };
      vi.stubGlobal("fetch", mockFetchSuccess({ resource: { id: "res-1" }, audit: [] }));
      const result = await moderateLmsResource("res-1", payload);
      expect(result.resource.id).toBe("res-1");
      expect(fetch).toHaveBeenCalledWith(
        "/api/lms/admin/resources/res-1/moderation",
        expect.objectContaining({ method: "PATCH", body: JSON.stringify(payload) })
      );
    });

    it("moderateLmsResource with hide decision", async () => {
      vi.stubGlobal("fetch", mockFetchSuccess({ resource: { id: "res-1" }, audit: [] }));
      await moderateLmsResource("res-1", { decision: "hide", reason: "Inappropriate" });
      expect(fetch).toHaveBeenCalledWith(
        "/api/lms/admin/resources/res-1/moderation",
        expect.objectContaining({ body: JSON.stringify({ decision: "hide", reason: "Inappropriate" }) })
      );
    });

    it("moderateLmsResource passes custom headers as plain object", async () => {
      vi.stubGlobal("fetch", mockFetchSuccess({ resource: { id: "res-1" }, audit: [] }));
      await moderateLmsResource("res-1", { decision: "remove", reason: "Spam" }, { "X-Mod": "reviewer-1" } as any);
      expect(fetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ headers: expect.objectContaining({ "X-Mod": "reviewer-1" }) })
      );
    });
  });
});
