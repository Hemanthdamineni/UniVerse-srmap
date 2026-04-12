import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import * as careerApi from "./careerApi";

function jsonResponse(data: unknown, ok = true, status = 200) {
  return Promise.resolve({
    ok,
    status,
    json: () => Promise.resolve(data),
  } as Response);
}

describe("careerApi", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() =>
        jsonResponse({
          success: true,
          data: {},
        })
      )
    );
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("getCareerPermissions", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => jsonResponse({ success: true, data: { canModerateSubmissions: true } }))
    );
    const p = await careerApi.getCareerPermissions();
    expect(p.canModerateSubmissions).toBe(true);
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining("/api/career/permissions"),
      expect.anything()
    );
  });

  it("listTrendingOpportunities encodes limit", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => jsonResponse({ success: true, data: { items: [] } }))
    );
    await careerApi.listTrendingOpportunities(8);
    expect(fetch).toHaveBeenCalledWith(
      expect.stringMatching(/\/api\/career\/trending\?limit=8/),
      expect.anything()
    );
  });

  it("listOpportunities builds query string", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => jsonResponse({ success: true, data: { items: [] } }))
    );
    await careerApi.listOpportunities({ type: "job", sort: "recent" });
    const url = String((fetch as ReturnType<typeof vi.fn>).mock.calls[0][0]);
    expect(url).toContain("type=job");
    expect(url).toContain("sort=recent");
  });

  it("listDeadlineSoonBookmarked", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => jsonResponse({ success: true, data: { items: [] } }))
    );
    await careerApi.listDeadlineSoonBookmarked(5);
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining("/api/career/deadline-soon?days=5"),
      expect.anything()
    );
  });

  it("getPersonalizedFeed", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => jsonResponse({ success: true, data: { items: [] } }))
    );
    await careerApi.getPersonalizedFeed();
    expect(fetch).toHaveBeenCalledWith("/api/career/feed", expect.anything());
  });

  it("getOpportunity", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() =>
        jsonResponse({
          success: true,
          data: { id: "x", type: "job", title: "T", skills: [], tags: [], isPanIndia: false, eligibleBranches: [], eligibleYears: [], isFree: true, source: "m", sourceUrl: "u", applyUrl: "a", viewCount: 0, bookmarkCount: 0, applyCount: 0, relevanceScore: 0, isActive: true, isVerified: true, isFeatured: false },
        })
      )
    );
    const o = await careerApi.getOpportunity("abc");
    expect(o.id).toBe("x");
    expect(fetch).toHaveBeenCalledWith("/api/career/opportunities/abc", expect.anything());
  });

  it("getProfile and updateProfile", async () => {
    const profile = {
      userId: "u1",
      skills: [],
      preferredTypes: [],
      preferredLocations: [],
      updatedAt: "now",
    };
    vi.stubGlobal(
      "fetch",
      vi.fn(() => jsonResponse({ success: true, data: profile }))
    );
    await careerApi.getProfile();
    expect(fetch).toHaveBeenCalledWith("/api/career/profile", expect.anything());
    vi.stubGlobal(
      "fetch",
      vi.fn(() => jsonResponse({ success: true, data: { updated: true } }))
    );
    await careerApi.updateProfile({ bio: "hi" });
    expect(fetch).toHaveBeenCalledWith(
      "/api/career/profile",
      expect.objectContaining({ method: "PUT" })
    );
  });

  it("uploadResume posts FormData", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() =>
        jsonResponse({
          url: "/files/r.pdf",
          fileName: "r.pdf",
        })
      )
    );
    const file = new File(["%PDF"], "r.pdf", { type: "application/pdf" });
    const r = await careerApi.uploadResume(file);
    expect(r.fileName).toBe("r.pdf");
    expect(fetch).toHaveBeenCalledWith(
      "/api/career/profile/resume",
      expect.objectContaining({ method: "POST", body: expect.any(FormData) })
    );
  });

  it("uploadResume throws on error body", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() =>
        Promise.resolve({
          ok: false,
          status: 400,
          json: () => Promise.resolve({ message: "bad" }),
        } as Response)
      )
    );
    await expect(
      careerApi.uploadResume(new File([], "x.pdf", { type: "application/pdf" }))
    ).rejects.toThrow(/bad/);
  });

  it("listSkillGaps", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => jsonResponse({ success: true, data: { items: [] } }))
    );
    await careerApi.listSkillGaps();
    expect(fetch).toHaveBeenCalledWith("/api/career/profile/skill-gaps", expect.anything());
  });

  it("bookmarkOpportunity dismissOpportunity trackApply flagOpportunity trackView", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => jsonResponse({ success: true, data: { bookmarked: true } }))
    );
    await careerApi.bookmarkOpportunity("o1");
    vi.stubGlobal(
      "fetch",
      vi.fn(() => jsonResponse({ success: true, data: { dismissed: true } }))
    );
    await careerApi.dismissOpportunity("o1");
    vi.stubGlobal(
      "fetch",
      vi.fn(() => jsonResponse({ success: true, data: { tracked: true } }))
    );
    await careerApi.trackApply("o1");
    await careerApi.trackView("o1");
    vi.stubGlobal(
      "fetch",
      vi.fn(() => jsonResponse({ success: true, data: { flagged: true } }))
    );
    await careerApi.flagOpportunity("o1", "spam");
    expect(fetch).toHaveBeenCalled();
  });

  it("listApplications createApplication updateApplication deleteApplication", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => jsonResponse({ success: true, data: { items: [] } }))
    );
    await careerApi.listApplications();
    vi.stubGlobal(
      "fetch",
      vi.fn(() =>
        jsonResponse({
          success: true,
          data: {
            id: "a1",
            opportunityId: "o",
            userId: "u",
            status: "applied",
            appliedAt: "t",
          },
        })
      )
    );
    await careerApi.createApplication("o", "n");
    vi.stubGlobal(
      "fetch",
      vi.fn(() => jsonResponse({ success: true, data: { updated: true } }))
    );
    await careerApi.updateApplication("a1", "shortlisted");
    vi.stubGlobal(
      "fetch",
      vi.fn(() => jsonResponse({ success: true, data: { deleted: true } }))
    );
    await careerApi.deleteApplication("a1");
    expect(fetch).toHaveBeenCalled();
  });

  it("submitOpportunity listPendingSubmissions approveSubmission", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => jsonResponse({ success: true, data: { id: "s", status: "pending" } }))
    );
    await careerApi.submitOpportunity({ title: "x".repeat(12), applyUrl: "https://a.com/x" });
    vi.stubGlobal(
      "fetch",
      vi.fn(() => jsonResponse({ success: true, data: { items: [] } }))
    );
    await careerApi.listPendingSubmissions();
    vi.stubGlobal(
      "fetch",
      vi.fn(() => jsonResponse({ success: true, data: { approved: true } }))
    );
    await careerApi.approveSubmission("s");
    expect(fetch).toHaveBeenCalled();
  });

  it("getCareerHealth getCareerStats", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => jsonResponse({ success: true, data: { sources: [], recentRuns: [] } }))
    );
    await careerApi.getCareerHealth();
    vi.stubGlobal(
      "fetch",
      vi.fn(() =>
        jsonResponse({
          success: true,
          data: {
            byType: [],
            totalActive: 1,
            totalBookmarks: 0,
            totalApplications: 0,
          },
        })
      )
    );
    await careerApi.getCareerStats();
    expect(fetch).toHaveBeenCalled();
  });
});
