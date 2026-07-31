import { afterEach, describe, expect, it, vi } from "vitest";
import {
  addGuideSection,
  createGuide,
  deleteGuide,
  getGuide,
  listGuides,
  markGuideSectionRead,
  toggleGuideUpvote,
  updateGuide,
  updateGuideSection,
} from "./guidesApi";

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

describe("guidesApi", () => {
  afterEach(() => vi.restoreAllMocks());

  describe("listGuides", () => {
    it("GETs guides with query params", async () => {
      const guides = [{ id: "g1", title: "DB Guide" }];
      vi.stubGlobal("fetch", mockFetchSuccess(guides));
      const result = await listGuides({ subjectCode: "CSE301", limit: "5" });
      expect(result).toEqual(guides);
      expect(fetch).toHaveBeenCalledWith(
        "/api/lms/guides?subjectCode=CSE301&limit=5",
        expect.anything()
      );
    });

    it("omits undefined/null/empty params", async () => {
      vi.stubGlobal("fetch", mockFetchSuccess([]));
      await listGuides({ subjectCode: "CSE301", query: undefined, extra: "" });
      expect(fetch).toHaveBeenCalledWith(
        "/api/lms/guides?subjectCode=CSE301",
        expect.anything()
      );
    });

    it("handles empty params", async () => {
      vi.stubGlobal("fetch", mockFetchSuccess([]));
      await listGuides();
      expect(fetch).toHaveBeenCalledWith("/api/lms/guides?", expect.anything());
    });

    it("encodes special characters in params", async () => {
      vi.stubGlobal("fetch", mockFetchSuccess([]));
      await listGuides({ q: "hello world" });
      expect(fetch).toHaveBeenCalledWith(
        "/api/lms/guides?q=hello+world",
        expect.anything()
      );
    });
  });

  describe("createGuide", () => {
    it("POSTs payload and returns guide", async () => {
      const payload = { title: "New Guide", subjectCode: "CSE301" };
      vi.stubGlobal("fetch", mockFetchSuccess({ id: "g-new", ...payload }));
      const result = await createGuide(payload);
      expect(result).toEqual({ id: "g-new", title: "New Guide", subjectCode: "CSE301" });
      expect(fetch).toHaveBeenCalledWith(
        "/api/lms/guides",
        expect.objectContaining({ method: "POST", body: JSON.stringify(payload) })
      );
    });

    it("creates guide with empty payload", async () => {
      vi.stubGlobal("fetch", mockFetchSuccess({ id: "g-empty" }));
      const result = await createGuide({});
      expect(result).toEqual({ id: "g-empty" });
    });
  });

  describe("getGuide", () => {
    it("GETs a single guide by id", async () => {
      vi.stubGlobal("fetch", mockFetchSuccess({ id: "g1", title: "Guide" }));
      const result = await getGuide("g1");
      expect(result).toEqual({ id: "g1", title: "Guide" });
      expect(fetch).toHaveBeenCalledWith("/api/lms/guides/g1", expect.anything());
    });

    it("encodes id with special chars", async () => {
      vi.stubGlobal("fetch", mockFetchSuccess({ id: "g/1" }));
      await getGuide("g/1");
      expect(fetch).toHaveBeenCalledWith("/api/lms/guides/g%2F1", expect.anything());
    });
  });

  describe("updateGuide", () => {
    it("PUTs payload and returns updated guide", async () => {
      const payload = { title: "Updated" };
      vi.stubGlobal("fetch", mockFetchSuccess({ id: "g1", title: "Updated" }));
      const result = await updateGuide("g1", payload);
      expect(result).toEqual({ id: "g1", title: "Updated" });
      expect(fetch).toHaveBeenCalledWith(
        "/api/lms/guides/g1",
        expect.objectContaining({ method: "PUT", body: JSON.stringify(payload) })
      );
    });
  });

  describe("deleteGuide", () => {
    it("DELETEs guide and returns confirmation", async () => {
      vi.stubGlobal("fetch", mockFetchSuccess({ deleted: true, id: "g1" }));
      const result = await deleteGuide("g1");
      expect(result).toEqual({ deleted: true, id: "g1" });
      expect(fetch).toHaveBeenCalledWith(
        "/api/lms/guides/g1",
        expect.objectContaining({ method: "DELETE" })
      );
    });
  });

  describe("addGuideSection", () => {
    it("POSTs section payload to guide", async () => {
      const payload = { title: "Intro", content: "Content here" };
      vi.stubGlobal("fetch", mockFetchSuccess({ id: "g1", sections: [payload] }));
      const result = await addGuideSection("g1", payload);
      expect(result.sections).toHaveLength(1);
      expect(fetch).toHaveBeenCalledWith(
        "/api/lms/guides/g1/sections",
        expect.objectContaining({ method: "POST", body: JSON.stringify(payload) })
      );
    });
  });

  describe("updateGuideSection", () => {
    it("PUTs section payload", async () => {
      const payload = { title: "Updated Section" };
      vi.stubGlobal("fetch", mockFetchSuccess({ id: "g1" }));
      await updateGuideSection("g1", "sec-123", payload);
      expect(fetch).toHaveBeenCalledWith(
        "/api/lms/guides/g1/sections/sec-123",
        expect.objectContaining({ method: "PUT", body: JSON.stringify(payload) })
      );
    });
  });

  describe("markGuideSectionRead", () => {
    it("POSTs to mark section read", async () => {
      vi.stubGlobal("fetch", mockFetchSuccess({ id: "g1" }));
      const result = await markGuideSectionRead("g1", "sec-123");
      expect(result).toEqual({ id: "g1" });
      expect(fetch).toHaveBeenCalledWith(
        "/api/lms/guides/g1/sections/sec-123/read",
        expect.objectContaining({ method: "POST" })
      );
    });
  });

  describe("toggleGuideUpvote", () => {
    it("POSTs to upvote endpoint", async () => {
      vi.stubGlobal("fetch", mockFetchSuccess({ active: true }));
      const result = await toggleGuideUpvote("g1");
      expect(result).toEqual({ active: true });
      expect(fetch).toHaveBeenCalledWith(
        "/api/lms/guides/g1/upvote",
        expect.objectContaining({ method: "POST" })
      );
    });
  });
});
