import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  createLearningMaterialItem,
  createResourceRecommendation,
  deleteLearningMaterialItem,
  executeLearningMaterialBulkAction,
  getContentWorkflow,
  getLearningMaterialCatalog,
  getLearningMaterialHistory,
  getLearningMaterialLibrary,
  getLearningMaterialSubjects,
  listAdminLearningMaterialItems,
  listResourceRecommendations,
  previewLearningMaterialBulkAction,
  reviewResourceRecommendation,
  transitionLearningMaterialLifecycle,
  updateLearningMaterialItem,
  uploadResourceFile,
} from "./learningMaterialsApi";

let originalStatic: string | undefined;

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

function mockFetchError(status: number, message: string) {
  return vi.fn(() =>
    Promise.resolve({
      ok: false,
      status,
      json: () => Promise.resolve({ message, code: "TEST_ERR" }),
    } as Response)
  );
}

describe("learningMaterialsApi", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("getLearningMaterialCatalog", () => {
    it("GETs catalog without year param", async () => {
      const catalog = { years: [2, 3], selectedYear: null, courses: [] };
      vi.stubGlobal("fetch", mockFetchSuccess(catalog));
      const result = await getLearningMaterialCatalog();
      expect(result).toEqual(catalog);
      expect(fetch).toHaveBeenCalledWith("/api/resources/catalog", expect.anything());
    });

    it("GETs catalog with year param", async () => {
      vi.stubGlobal("fetch", mockFetchSuccess({ years: [2], selectedYear: 2, courses: [] }));
      await getLearningMaterialCatalog(2);
      expect(fetch).toHaveBeenCalledWith("/api/resources/catalog?year=2", expect.anything());
    });

    it("passes null year as no query param", async () => {
      vi.stubGlobal("fetch", mockFetchSuccess({ years: [], selectedYear: null, courses: [] }));
      await getLearningMaterialCatalog(null);
      expect(fetch).toHaveBeenCalledWith("/api/resources/catalog", expect.anything());
    });
  });

  describe("getLearningMaterialSubjects", () => {
    it("GETs subjects with year and courseCode", async () => {
      const subjects = { year: 2, courseCode: "CSE", subjects: [] };
      vi.stubGlobal("fetch", mockFetchSuccess(subjects));
      const result = await getLearningMaterialSubjects(2, "CSE");
      expect(result).toEqual(subjects);
      expect(fetch).toHaveBeenCalledWith(
        "/api/resources/subjects?year=2&courseCode=CSE",
        expect.anything()
      );
    });

    it("encodes courseCode with special chars", async () => {
      vi.stubGlobal("fetch", mockFetchSuccess({ year: 1, courseCode: "CS&E", subjects: [] }));
      await getLearningMaterialSubjects(1, "CS&E");
      expect(fetch).toHaveBeenCalledWith(
        "/api/resources/subjects?year=1&courseCode=CS%26E",
        expect.anything()
      );
    });
  });

  describe("getLearningMaterialLibrary", () => {
    it("GETs library with all required params", async () => {
      const libResponse = { subject: {} as any, groups: [], totalItems: 0, totalResources: 0 };
      vi.stubGlobal("fetch", mockFetchSuccess(libResponse));
      const result = await getLearningMaterialLibrary({
        year: 2,
        courseCode: "CSE",
        subjectCode: "CSE304",
      });
      expect(result).toEqual(libResponse);
      expect(fetch).toHaveBeenCalledWith(
        "/api/resources/library?year=2&courseCode=CSE&subjectCode=CSE304",
        expect.anything()
      );
    });

    it("includes query param when provided", async () => {
      vi.stubGlobal("fetch", mockFetchSuccess({ subject: {} as any, groups: [], totalItems: 0, totalResources: 0 }));
      await getLearningMaterialLibrary({
        year: 2,
        courseCode: "CSE",
        subjectCode: "CSE304",
        query: "operating systems",
      });
      expect(fetch).toHaveBeenCalledWith(
        "/api/resources/library?year=2&courseCode=CSE&subjectCode=CSE304&query=operating+systems",
        expect.anything()
      );
    });

    it("omits query if blank/whitespace only", async () => {
      vi.stubGlobal("fetch", mockFetchSuccess({ subject: {} as any, groups: [], totalItems: 0, totalResources: 0 }));
      await getLearningMaterialLibrary({
        year: 2,
        courseCode: "CSE",
        subjectCode: "CSE304",
        query: "   ",
      });
      expect(fetch).toHaveBeenCalledWith(
        "/api/resources/library?year=2&courseCode=CSE&subjectCode=CSE304",
        expect.anything()
      );
    });
  });

  describe("listAdminLearningMaterialItems", () => {
    it("GETs admin items with filters", async () => {
      vi.stubGlobal("fetch", mockFetchSuccess({ items: [{ id: "item-1", title: "OS Notes" }] }));
      const result = await listAdminLearningMaterialItems({ lifecycleState: "draft" });
      expect(result.items).toHaveLength(1);
      expect(fetch).toHaveBeenCalledWith(
        "/api/resources/admin/items?lifecycleState=draft",
        expect.anything()
      );
    });

    it("passes custom headers as plain object", async () => {
      vi.stubGlobal("fetch", mockFetchSuccess({ items: [] }));
      await listAdminLearningMaterialItems({}, { "X-Custom": "value" } as any);
      expect(fetch).toHaveBeenCalledWith(
        "/api/resources/admin/items?",
        expect.objectContaining({ headers: expect.objectContaining({ "X-Custom": "value" }) })
      );
    });
  });

  describe("createLearningMaterialItem", () => {
    it("POSTs payload and returns created item", async () => {
      const payload = { title: "New Notes", description: "Desc" };
      vi.stubGlobal("fetch", mockFetchSuccess({ id: "item-new", ...payload }));
      const result = await createLearningMaterialItem(payload);
      expect(result).toEqual({ id: "item-new", title: "New Notes", description: "Desc" });
      expect(fetch).toHaveBeenCalledWith(
        "/api/resources/items",
        expect.objectContaining({ method: "POST", body: JSON.stringify(payload) })
      );
    });

    it("accepts custom headers object", async () => {
      vi.stubGlobal("fetch", mockFetchSuccess({ id: "item-new" }));
      await createLearningMaterialItem({ title: "Test" }, { Authorization: "Bearer test" });
      expect(fetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ headers: expect.objectContaining({ Authorization: "Bearer test" }) })
      );
    });
  });

  describe("updateLearningMaterialItem", () => {
    it("PUTs payload and returns updated item", async () => {
      vi.stubGlobal("fetch", mockFetchSuccess({ id: "item-1", title: "Updated" }));
      const result = await updateLearningMaterialItem("item-1", { title: "Updated" });
      expect(result).toEqual({ id: "item-1", title: "Updated" });
      expect(fetch).toHaveBeenCalledWith(
        "/api/resources/items/item-1",
        expect.objectContaining({ method: "PUT", body: JSON.stringify({ title: "Updated" }) })
      );
    });
  });

  describe("deleteLearningMaterialItem", () => {
    it("DELETEs item and returns confirmation", async () => {
      vi.stubGlobal("fetch", mockFetchSuccess({ deleted: true }));
      const result = await deleteLearningMaterialItem("item-1");
      expect(result).toEqual({ deleted: true });
      expect(fetch).toHaveBeenCalledWith(
        "/api/resources/items/item-1",
        expect.objectContaining({ method: "DELETE" })
      );
    });
  });

  describe("getContentWorkflow", () => {
    it("GETs workflow spec", async () => {
      const spec = { states: ["draft", "published"], transitions: [], permissions: {}, bulkSafety: {} as any };
      vi.stubGlobal("fetch", mockFetchSuccess(spec));
      const result = await getContentWorkflow();
      expect(result).toEqual(spec);
      expect(fetch).toHaveBeenCalledWith("/api/content/admin/workflow", expect.anything());
    });

    it("passes custom headers as plain object", async () => {
      vi.stubGlobal("fetch", mockFetchSuccess({ states: [], transitions: [], permissions: {}, bulkSafety: {} as any }));
      await getContentWorkflow({ "X-Trace": "abc" } as any);
      expect(fetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ headers: expect.objectContaining({ "X-Trace": "abc" }) })
      );
    });
  });

  describe("getLearningMaterialHistory", () => {
    it("GETs history for content item", async () => {
      const history = { items: [{ id: "audit-1", action: "edit" }] };
      vi.stubGlobal("fetch", mockFetchSuccess(history));
      const result = await getLearningMaterialHistory("item-1");
      expect(result).toEqual(history);
      expect(fetch).toHaveBeenCalledWith(
        "/api/resources/items/item-1/history",
        expect.anything()
      );
    });
  });

  describe("transitionLearningMaterialLifecycle", () => {
    it("PATCHes lifecycle with action", async () => {
      vi.stubGlobal("fetch", mockFetchSuccess({ id: "item-1", lifecycleState: "archived" }));
      const result = await transitionLearningMaterialLifecycle("item-1", { action: "archive", reason: "No longer needed" });
      expect(result.lifecycleState).toBe("archived");
      expect(fetch).toHaveBeenCalledWith(
        "/api/resources/items/item-1/lifecycle",
        expect.objectContaining({
          method: "PATCH",
          body: JSON.stringify({ action: "archive", reason: "No longer needed" }),
        })
      );
    });

    it("transitions without reason", async () => {
      vi.stubGlobal("fetch", mockFetchSuccess({ id: "item-1", lifecycleState: "published" }));
      await transitionLearningMaterialLifecycle("item-1", { action: "publish" });
      expect(fetch).toHaveBeenCalledWith(
        "/api/resources/items/item-1/lifecycle",
        expect.objectContaining({
          body: JSON.stringify({ action: "publish" }),
        })
      );
    });

    it("encodes contentId with special chars", async () => {
      vi.stubGlobal("fetch", mockFetchSuccess({ id: "item/1" }));
      await transitionLearningMaterialLifecycle("item/1", { action: "delete" });
      expect(fetch).toHaveBeenCalledWith(
        "/api/resources/items/item%2F1/lifecycle",
        expect.anything()
      );
    });
  });

  describe("previewLearningMaterialBulkAction", () => {
    it("POSTs bulk preview payload", async () => {
      const payload = { ids: ["item-1", "item-2"], action: "archive" };
      const preview = { action: "archive", valid: true, invalidCount: 0, items: [] };
      vi.stubGlobal("fetch", mockFetchSuccess(preview));
      const result = await previewLearningMaterialBulkAction(payload);
      expect(result).toEqual(preview);
      expect(fetch).toHaveBeenCalledWith(
        "/api/resources/admin/items/bulk-preview",
        expect.objectContaining({ method: "POST", body: JSON.stringify(payload) })
      );
    });

    it("handles invalid preview", async () => {
      const payload = { ids: ["bad-id"], action: "publish" };
      const preview = { action: "publish", valid: false, invalidCount: 1, items: [{ id: "bad-id", valid: false }] };
      vi.stubGlobal("fetch", mockFetchSuccess(preview));
      const result = await previewLearningMaterialBulkAction(payload);
      expect(result.valid).toBe(false);
    });
  });

  describe("executeLearningMaterialBulkAction", () => {
    it("POSTs bulk execute payload", async () => {
      const payload = { ids: ["item-1"], action: "archive", reason: "Cleanup" };
      const response = { action: "archive", updated: 1, items: [] };
      vi.stubGlobal("fetch", mockFetchSuccess(response));
      const result = await executeLearningMaterialBulkAction(payload);
      expect(result).toEqual(response);
      expect(fetch).toHaveBeenCalledWith(
        "/api/resources/admin/items/bulk-execute",
        expect.objectContaining({ method: "POST", body: JSON.stringify(payload) })
      );
    });

    it("executes without reason", async () => {
      vi.stubGlobal("fetch", mockFetchSuccess({ action: "publish", updated: 1, items: [] }));
      await executeLearningMaterialBulkAction({ ids: ["item-1"], action: "publish" });
      expect(fetch).toHaveBeenCalledWith(
        "/api/resources/admin/items/bulk-execute",
        expect.objectContaining({ body: JSON.stringify({ ids: ["item-1"], action: "publish" }) })
      );
    });
  });

  describe("createResourceRecommendation", () => {
    it("POSTs recommendation payload", async () => {
      const payload = { title: "Useful link", url: "https://example.com", kind: "link" };
      vi.stubGlobal("fetch", mockFetchSuccess({ id: "rec-1", title: "Useful link" }));
      const result = await createResourceRecommendation(payload);
      expect(result).toEqual({ id: "rec-1", title: "Useful link" });
      expect(fetch).toHaveBeenCalledWith(
        "/api/resources/recommendations",
        expect.objectContaining({ method: "POST", body: JSON.stringify(payload) })
      );
    });
  });

  describe("uploadResourceFile", () => {
    it("POSTs FormData with file to uploads endpoint", async () => {
      const file = new File(["content"], "doc.pdf", { type: "application/pdf" });
      const uploaded = { fileName: "doc.pdf", mimeType: "application/pdf", sizeBytes: 7, url: "https://example.com/doc.pdf" };
      vi.stubGlobal("fetch", mockFetchSuccess(uploaded));
      const result = await uploadResourceFile(file);
      expect(result).toEqual(uploaded);
      expect(fetch).toHaveBeenCalledWith(
        "/api/uploads",
        expect.objectContaining({ method: "POST" })
      );
      // Verify FormData was passed as body
      const callBody = (fetch as any).mock.calls[0][1].body;
      expect(callBody).toBeInstanceOf(FormData);
      expect(callBody.get("file")).toBe(file);
    });
  });

  describe("listResourceRecommendations", () => {
    it("GETs recommendations list", async () => {
      vi.stubGlobal("fetch", mockFetchSuccess({ items: [{ id: "rec-1" }] }));
      const result = await listResourceRecommendations();
      expect(result.items).toHaveLength(1);
      expect(fetch).toHaveBeenCalledWith("/api/resources/recommendations", expect.anything());
    });

    it("accepts custom headers object", async () => {
      vi.stubGlobal("fetch", mockFetchSuccess({ items: [] }));
      await listResourceRecommendations({ "X-Role": "admin" } as any);
      expect(fetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ headers: expect.objectContaining({ "X-Role": "admin" }) })
      );
    });
  });

  describe("reviewResourceRecommendation", () => {
    it("PATCHes recommendation with status", async () => {
      const payload = { status: "approved" as const, reviewerNotes: "Looks good" };
      vi.stubGlobal("fetch", mockFetchSuccess({ id: "rec-1", lifecycleState: "published" }));
      const result = await reviewResourceRecommendation("rec-1", payload);
      expect(result.lifecycleState).toBe("published");
      expect(fetch).toHaveBeenCalledWith(
        "/api/resources/recommendations/rec-1",
        expect.objectContaining({
          method: "PATCH",
          body: JSON.stringify(payload),
        })
      );
    });

    it("reviews with minimal payload", async () => {
      vi.stubGlobal("fetch", mockFetchSuccess({}));
      await reviewResourceRecommendation("rec-1", { status: "rejected" });
      expect(fetch).toHaveBeenCalledWith(
        "/api/resources/recommendations/rec-1",
        expect.objectContaining({
          body: JSON.stringify({ status: "rejected" }),
        })
      );
    });
  });
});
