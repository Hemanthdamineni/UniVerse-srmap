import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  closeLmsRequest,
  createLmsRequest,
  deleteLmsAnnotation,
  flagLmsResource,
  fulfillLmsRequest,
  getLmsAnnotations,
  getLmsComments,
  listLmsRequests,
  markLmsResourceOutdated,
  postLmsComment,
  rateLmsResource,
  recordLmsResourceView,
  saveLmsAnnotation,
  toggleCommentHelpful,
  toggleResourceBookmark,
  toggleResourceUpvote,
  upvoteLmsRequest,
} from "./communityApi";

/** Helper: mock fetch to return a JSON envelope `{ success, data }`. */
function mockFetchSuccess(data: unknown) {
  return vi.fn(() =>
    Promise.resolve({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ success: true, data }),
    } as Response)
  );
}

/** Helper: mock fetch to return a non-envelope response (raw payload). */
function mockFetchRaw(data: unknown) {
  return vi.fn(() =>
    Promise.resolve({
      ok: true,
      status: 200,
      json: () => Promise.resolve(data),
    } as Response)
  );
}

/** Helper: mock fetch to reject with an error. */
function mockFetchError(status: number, message: string) {
  return vi.fn(() =>
    Promise.resolve({
      ok: false,
      status,
      json: () => Promise.resolve({ message, code: "TEST_ERROR" }),
    } as Response)
  );
}

describe("communityApi (upvote / bookmark)", () => {
  afterEach(() => vi.restoreAllMocks());

  describe("toggleResourceUpvote", () => {
    it("POSTs to the correct URL and returns active state", async () => {
      vi.stubGlobal("fetch", mockFetchSuccess({ active: true }));
      const result = await toggleResourceUpvote("res-123");
      expect(result).toEqual({ active: true });
      expect(fetch).toHaveBeenCalledWith(
        "/api/lms/resources/res-123/upvote",
        expect.objectContaining({ method: "POST" })
      );
    });

    it("handles upvote toggled off", async () => {
      vi.stubGlobal("fetch", mockFetchSuccess({ active: false }));
      const result = await toggleResourceUpvote("res-123");
      expect(result).toEqual({ active: false });
    });

    it("encodes special characters in id", async () => {
      vi.stubGlobal("fetch", mockFetchSuccess({ active: true }));
      await toggleResourceUpvote("res/123");
      expect(fetch).toHaveBeenCalledWith(
        "/api/lms/resources/res%2F123/upvote",
        expect.anything()
      );
    });
  });

  describe("toggleResourceBookmark", () => {
    it("POSTs to the correct URL and returns active state", async () => {
      vi.stubGlobal("fetch", mockFetchSuccess({ active: true }));
      const result = await toggleResourceBookmark("res-456");
      expect(result).toEqual({ active: true });
      expect(fetch).toHaveBeenCalledWith(
        "/api/lms/resources/res-456/bookmark",
        expect.objectContaining({ method: "POST" })
      );
    });
  });
});

describe("communityApi (flag / mark outdated / rate / view)", () => {
  afterEach(() => vi.restoreAllMocks());

  describe("flagLmsResource", () => {
    it("POSTs with reason and returns moderation data", async () => {
      vi.stubGlobal("fetch", mockFetchRaw({ flagCount: 1, moderationState: 1 }));
      const result = await flagLmsResource("res-789", "Spam content");
      expect(result).toEqual({ flagCount: 1, moderationState: 1 });
      expect(fetch).toHaveBeenCalledWith(
        "/api/lms/resources/res-789/flag",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({ reason: "Spam content" }),
        })
      );
    });

    it("encodes id with special characters", async () => {
      vi.stubGlobal("fetch", mockFetchRaw({}));
      await flagLmsResource("res/789", "reason");
      expect(fetch).toHaveBeenCalledWith(
        "/api/lms/resources/res%2F789/flag",
        expect.anything()
      );
    });
  });

  describe("markLmsResourceOutdated", () => {
    it("POSTs with reason", async () => {
      vi.stubGlobal("fetch", mockFetchRaw({ success: true }));
      await markLmsResourceOutdated("res-111", "Content is stale");
      expect(fetch).toHaveBeenCalledWith(
        "/api/lms/resources/res-111/mark-outdated",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({ reason: "Content is stale" }),
        })
      );
    });
  });

  describe("rateLmsResource", () => {
    it("POSTs rating payload and returns resource", async () => {
      vi.stubGlobal("fetch", mockFetchSuccess({ id: "res-222", type: "note" }));
      const payload = { rating: 4, review: "Good", dimensionTags: ["clear"] };
      const result = await rateLmsResource("res-222", payload);
      expect(result).toEqual({ id: "res-222", type: "note" });
      expect(fetch).toHaveBeenCalledWith(
        "/api/lms/resources/res-222/rate",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify(payload),
        })
      );
    });

    it("sends minimal payload without optional fields", async () => {
      vi.stubGlobal("fetch", mockFetchSuccess({ id: "res-222" }));
      await rateLmsResource("res-222", { rating: 3 });
      expect(fetch).toHaveBeenCalledWith(
        "/api/lms/resources/res-222/rate",
        expect.objectContaining({
          body: JSON.stringify({ rating: 3 }),
        })
      );
    });
  });

  describe("recordLmsResourceView", () => {
    it("POSTs view with empty payload by default", async () => {
      vi.stubGlobal("fetch", mockFetchRaw({}));
      await recordLmsResourceView("res-333");
      expect(fetch).toHaveBeenCalledWith(
        "/api/lms/resources/res-333/view",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({}),
        })
      );
    });

    it("POSTs view with timeSpentMs and metadata", async () => {
      vi.stubGlobal("fetch", mockFetchRaw({}));
      await recordLmsResourceView("res-333", {
        timeSpentMs: 45000,
        metadata: { source: "recommendations" },
      });
      expect(fetch).toHaveBeenCalledWith(
        "/api/lms/resources/res-333/view",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({
            timeSpentMs: 45000,
            metadata: { source: "recommendations" },
          }),
        })
      );
    });
  });
});

describe("communityApi (comments)", () => {
  afterEach(() => vi.restoreAllMocks());

  describe("getLmsComments", () => {
    it("GETs comments for a resource", async () => {
      const comments = [
        { id: "c1", resourceId: "res-1", userId: "u1", content: "Thanks!", helpful: 2, createdAt: "2026-01-01T00:00:00Z" },
      ];
      vi.stubGlobal("fetch", mockFetchSuccess(comments));
      const result = await getLmsComments("res-1");
      expect(result).toEqual(comments);
      expect(fetch).toHaveBeenCalledWith(
        "/api/lms/resources/res-1/comments",
        expect.anything()
      );
    });
  });

  describe("postLmsComment", () => {
    it("POSTs content and returns comment array", async () => {
      vi.stubGlobal("fetch", mockFetchSuccess([{ id: "c2", content: "Nice!" }]));
      const result = await postLmsComment("res-1", "Nice!");
      expect(result).toEqual([{ id: "c2", content: "Nice!" }]);
      expect(fetch).toHaveBeenCalledWith(
        "/api/lms/resources/res-1/comments",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({ content: "Nice!" }),
        })
      );
    });
  });

  describe("toggleCommentHelpful", () => {
    it("POSTs to comment helpful endpoint", async () => {
      vi.stubGlobal("fetch", mockFetchSuccess({ active: true }));
      const result = await toggleCommentHelpful("comment-99");
      expect(result).toEqual({ active: true });
      expect(fetch).toHaveBeenCalledWith(
        "/api/lms/comments/comment-99/helpful",
        expect.objectContaining({ method: "POST" })
      );
    });
  });
});

describe("communityApi (annotations)", () => {
  afterEach(() => vi.restoreAllMocks());

  describe("getLmsAnnotations", () => {
    it("GETs annotations for a resource", async () => {
      vi.stubGlobal("fetch", mockFetchSuccess([{ id: "a1", content: "Highlight" }]));
      const result = await getLmsAnnotations("res-1");
      expect(result).toEqual([{ id: "a1", content: "Highlight" }]);
      expect(fetch).toHaveBeenCalledWith(
        "/api/lms/resources/res-1/annotations",
        expect.anything()
      );
    });
  });

  describe("saveLmsAnnotation", () => {
    it("POSTs content and returns annotation array", async () => {
      vi.stubGlobal("fetch", mockFetchSuccess([{ id: "a2", content: "Note" }]));
      const result = await saveLmsAnnotation("res-1", "Note");
      expect(result).toEqual([{ id: "a2", content: "Note" }]);
      expect(fetch).toHaveBeenCalledWith(
        "/api/lms/resources/res-1/annotations",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({ content: "Note" }),
        })
      );
    });
  });

  describe("deleteLmsAnnotation", () => {
    it("DELETEs annotation and returns confirmation", async () => {
      vi.stubGlobal("fetch", mockFetchSuccess({ deleted: true, id: "a1" }));
      const result = await deleteLmsAnnotation("a1");
      expect(result).toEqual({ deleted: true, id: "a1" });
      expect(fetch).toHaveBeenCalledWith(
        "/api/lms/annotations/a1",
        expect.objectContaining({ method: "DELETE" })
      );
    });
  });
});

describe("communityApi (requests)", () => {
  afterEach(() => vi.restoreAllMocks());

  describe("listLmsRequests", () => {
    it("GETs requests with query params", async () => {
      vi.stubGlobal("fetch", mockFetchSuccess({ items: [], pagination: { page: 1, limit: 10, total: 0 } }));
      const result = await listLmsRequests({ status: "open", limit: 10 });
      expect(result).toEqual({ items: [], pagination: { page: 1, limit: 10, total: 0 } });
      expect(fetch).toHaveBeenCalledWith(
        "/api/lms/requests?status=open&limit=10",
        expect.anything()
      );
    });

    it("omits undefined/null/empty params", async () => {
      vi.stubGlobal("fetch", mockFetchSuccess({ items: [], pagination: { page: 1, limit: 20, total: 0 } }));
      await listLmsRequests({ status: "open", query: undefined, extra: "", empty: null });
      expect(fetch).toHaveBeenCalledWith(
        "/api/lms/requests?status=open",
        expect.anything()
      );
    });

    it("uses default params when none provided", async () => {
      vi.stubGlobal("fetch", mockFetchSuccess({ items: [], pagination: { page: 1, limit: 20, total: 0 } }));
      const result = await listLmsRequests();
      expect(result.items).toEqual([]);
      expect(fetch).toHaveBeenCalledWith("/api/lms/requests?", expect.anything());
    });

    it("encodes special characters in param values", async () => {
      vi.stubGlobal("fetch", mockFetchSuccess({ items: [], pagination: { page: 1, limit: 20, total: 0 } }));
      await listLmsRequests({ q: "hello world", filter: "a&b=c" });
      expect(fetch).toHaveBeenCalledWith(
        "/api/lms/requests?q=hello+world&filter=a%26b%3Dc",
        expect.anything()
      );
    });
  });

  describe("createLmsRequest", () => {
    it("POSTs payload and returns request", async () => {
      const payload = { title: "Need more PYQs", subjectCode: "CSE301" };
      vi.stubGlobal("fetch", mockFetchSuccess({ id: "req-1", ...payload }));
      const result = await createLmsRequest(payload);
      expect(result).toEqual({ id: "req-1", title: "Need more PYQs", subjectCode: "CSE301" });
      expect(fetch).toHaveBeenCalledWith(
        "/api/lms/requests",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify(payload),
        })
      );
    });
  });

  describe("upvoteLmsRequest", () => {
    it("POSTs to upvote endpoint", async () => {
      vi.stubGlobal("fetch", mockFetchSuccess({ active: true }));
      const result = await upvoteLmsRequest("req-1");
      expect(result).toEqual({ active: true });
      expect(fetch).toHaveBeenCalledWith(
        "/api/lms/requests/req-1/upvote",
        expect.objectContaining({ method: "POST" })
      );
    });
  });

  describe("fulfillLmsRequest", () => {
    it("POSTs with resourceId and returns fulfilled request", async () => {
      const fulfilled = { id: "req-1", status: "fulfilled", fulfilledResourceId: "res-999" };
      vi.stubGlobal("fetch", mockFetchSuccess(fulfilled));
      const result = await fulfillLmsRequest("req-1", "res-999");
      expect(result).toEqual(fulfilled);
      expect(fetch).toHaveBeenCalledWith(
        "/api/lms/requests/req-1/fulfill",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({ resourceId: "res-999" }),
        })
      );
    });
  });

  describe("closeLmsRequest", () => {
    it("DELETEs request and returns it", async () => {
      vi.stubGlobal("fetch", mockFetchSuccess({ id: "req-1", status: "closed" }));
      const result = await closeLmsRequest("req-1");
      expect(result).toEqual({ id: "req-1", status: "closed" });
      expect(fetch).toHaveBeenCalledWith(
        "/api/lms/requests/req-1",
        expect.objectContaining({ method: "DELETE" })
      );
    });
  });
});
