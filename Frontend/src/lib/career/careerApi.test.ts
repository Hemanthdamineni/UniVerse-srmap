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

  it("resume intelligence endpoints", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() =>
        jsonResponse({
          success: true,
          data: {
            id: "r1",
            userId: "u1",
            fileName: "resume.txt",
            filePath: "/uploads/resume.txt",
            parsedJson: { skills: ["React"] },
            qualityScore: 76,
            createdAt: "2026-01-01",
          },
        })
      )
    );
    await careerApi.createResumeVersion({ fileName: "resume.txt", extractedText: "React project" });
    expect(fetch).toHaveBeenCalledWith(
      "/api/career/resumes",
      expect.objectContaining({ method: "POST", body: expect.stringContaining("React project") })
    );

    vi.stubGlobal("fetch", vi.fn(() => jsonResponse({ success: true, data: { items: [] } })));
    await careerApi.listResumeVersions();
    expect(fetch).toHaveBeenCalledWith("/api/career/resumes", expect.anything());

    vi.stubGlobal(
      "fetch",
      vi.fn(() =>
        jsonResponse({
          success: true,
          data: {
            score: 76,
            rubric: [],
            suggestions: [],
            resume: {
              id: "r1",
              userId: "u1",
              fileName: "resume.txt",
              filePath: "/uploads/resume.txt",
              parsedJson: {},
              qualityScore: 76,
              createdAt: "2026-01-01",
            },
          },
        })
      )
    );
    await careerApi.getResumeAnalysis("r1");
    expect(fetch).toHaveBeenCalledWith("/api/career/resumes/r1/analysis", expect.anything());

    vi.stubGlobal(
      "fetch",
      vi.fn(() =>
        jsonResponse({
          success: true,
          data: { updated: true, profile: { userId: "u1", skills: ["React"], preferredTypes: [], preferredLocations: [], updatedAt: "now" }, mergedSkills: ["React"] },
        })
      )
    );
    await careerApi.mergeResumeToProfile("r1");
    expect(fetch).toHaveBeenCalledWith(
      "/api/career/resumes/r1/merge-to-profile",
      expect.objectContaining({ method: "POST" })
    );
  });

  it("getOpportunityFit includes optional resume version", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() =>
        jsonResponse({
          success: true,
          data: {
            fitScore: 80,
            breakdown: {},
            matchedSkills: ["React"],
            missingSkills: [],
            eligibility: { eligible: true, branchEligible: true, yearEligible: true },
            reasons: [],
            recommendations: [],
            resumeVersionId: "r1",
            opportunityId: "o1",
          },
        })
      )
    );
    await careerApi.getOpportunityFit("o1", "r1");
    expect(fetch).toHaveBeenCalledWith("/api/career/opportunities/o1/fit?resumeVersionId=r1", expect.anything());
  });

  it("listSkillGaps", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => jsonResponse({ success: true, data: { items: [] } }))
    );
    await careerApi.listSkillGaps();
    expect(fetch).toHaveBeenCalledWith("/api/career/profile/skill-gaps", expect.anything());
  });

  it("bookmarkOpportunity trackApply flagOpportunity trackView", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => jsonResponse({ success: true, data: { bookmarked: true } }))
    );
    await careerApi.bookmarkOpportunity("o1");
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
