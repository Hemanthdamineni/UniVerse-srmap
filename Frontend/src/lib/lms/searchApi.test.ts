import { afterEach, describe, expect, it, vi } from "vitest";
import { searchLmsContent } from "./searchApi";

function mockFetchSuccess(data: unknown) {
  return vi.fn(() =>
    Promise.resolve({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ success: true, data }),
    } as Response)
  );
}

describe("searchApi", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    delete (import.meta.env as Record<string, unknown>).VITE_STATIC_PROTOTYPE;
  });

  it("GETs /api/lms/search with non-empty params", async () => {
    const response = {
      query: "indexing",
      groups: {
        resources: { items: [{ id: "res-1" }], total: 1 },
        guides: { items: [], total: 0 },
        roadmaps: { items: [], total: 0 },
        questions: { items: [], total: 0 },
      },
    };
    vi.stubGlobal("fetch", mockFetchSuccess(response));
    const result = await searchLmsContent({ query: "indexing", subjectCode: "cse301", limit: 8 });
    expect(result).toEqual(response);
    expect(fetch).toHaveBeenCalledWith(
      "/api/lms/search?query=indexing&subjectCode=cse301&limit=8",
      expect.anything()
    );
  });

  it("omits undefined/null/empty params", async () => {
    vi.stubGlobal("fetch", mockFetchSuccess({ query: "", groups: {} }));
    await searchLmsContent({ query: undefined, types: "", page: undefined });
    expect(fetch).toHaveBeenCalledWith("/api/lms/search?", expect.anything());
  });

  it("returns filtered fixture groups in static prototype mode", async () => {
    (import.meta.env as Record<string, unknown>).VITE_STATIC_PROTOTYPE = "true";
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const hit = await searchLmsContent({ query: "normalization" });
    expect(hit.groups.guides.items.map((guide) => guide.id)).toContain("guide-normalization");
    expect(hit.groups.resources.items.length).toBeGreaterThan(0);
    expect(hit.groups.resources.items.every((item) => item.title.toLowerCase().includes("normalization"))).toBe(true);

    const browse = await searchLmsContent({ types: "resources" });
    expect(browse.groups.resources.items.length).toBeGreaterThan(0);

    expect(fetchMock).not.toHaveBeenCalled();
  });
});
