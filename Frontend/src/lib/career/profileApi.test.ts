import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  getMyPublicCareerProfilePreview,
  getPlatformRecommendations,
  getPublicCareerProfile,
  getUnifiedProfile,
  recordPlatformRecommendationFeedback,
  syncProfileAchievements,
  updateAchievementVisibility,
  updateProfilePrivacy,
} from "./profileApi";

function jsonResponse(data: unknown, ok = true, status = 200) {
  return Promise.resolve({
    ok,
    status,
    json: () => Promise.resolve(data),
  } as Response);
}

describe("profileApi", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => jsonResponse({ success: true, data: {} }))
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("loads unified profile through the shared profile route", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() =>
        jsonResponse({
          success: true,
          data: {
            contractVersion: "unified-profile-v1",
            user: { userId: "u1" },
            privacy: { achievements: "private" },
            career: { available: true },
            lms: { available: true },
            events: { available: true },
            skills: [],
            achievements: [],
            signals: [],
            computedAt: "2030-01-01T00:00:00.000Z",
          },
        })
      )
    );

    const profile = await getUnifiedProfile({ recompute: false });

    expect(profile.contractVersion).toBe("unified-profile-v1");
    expect(fetch).toHaveBeenCalledWith("/api/profile/unified?recompute=false", expect.anything());
  });

  it("loads public career profile and authenticated preview", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() =>
        jsonResponse({
          success: true,
          data: {
            contractVersion: "career-public-profile-v1",
            audience: "public",
            user: { userId: "u1", name: "Student One" },
            headline: "Frontend student",
            bio: "Frontend student",
            links: {},
            skills: [],
            achievements: [],
            stats: { visibleSkillCount: 0, visibleAchievementCount: 0, profileCompleteness: 50 },
            updatedAt: "2030-01-01T00:00:00.000Z",
          },
        })
      )
    );

    const profile = await getPublicCareerProfile("u1");
    expect(profile.contractVersion).toBe("career-public-profile-v1");
    expect(fetch).toHaveBeenCalledWith("/api/profile/public/u1", expect.anything());

    vi.stubGlobal(
      "fetch",
      vi.fn(() =>
        jsonResponse({
          success: true,
          data: {
            contractVersion: "career-public-profile-v1",
            audience: "employers",
            user: { userId: "u1", name: "Student One" },
            headline: "Frontend student",
            bio: "Frontend student",
            links: {},
            skills: [],
            achievements: [],
            stats: { visibleSkillCount: 0, visibleAchievementCount: 0, profileCompleteness: 50 },
            updatedAt: "2030-01-01T00:00:00.000Z",
          },
        })
      )
    );
    const preview = await getMyPublicCareerProfilePreview("employers");
    expect(preview.audience).toBe("employers");
    expect(fetch).toHaveBeenCalledWith("/api/profile/public-preview?audience=employers", expect.anything());
  });

  it("syncs achievements and updates privacy", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => jsonResponse({ success: true, data: { synced: [] } }))
    );
    await syncProfileAchievements();
    expect(fetch).toHaveBeenCalledWith("/api/profile/achievements/sync", expect.objectContaining({ method: "POST" }));

    vi.stubGlobal(
      "fetch",
      vi.fn(() => jsonResponse({ success: true, data: { achievements: "public" } }))
    );
    const privacy = await updateProfilePrivacy({ achievements: "public" });
    expect(privacy.achievements).toBe("public");
    expect(fetch).toHaveBeenCalledWith(
      "/api/profile/privacy",
      expect.objectContaining({ method: "PATCH", body: JSON.stringify({ achievements: "public" }) })
    );
  });

  it("updates per-achievement visibility", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() =>
        jsonResponse({
          success: true,
          data: {
            id: "ach-1",
            userId: "u1",
            type: "competition_submission",
            title: "Finalist in Campus Hackathon",
            sourceDomain: "events",
            verificationState: "verified",
            skills: ["React"],
            visibility: "employers",
            createdAt: "2030-01-01T00:00:00.000Z",
          },
        })
      )
    );

    const achievement = await updateAchievementVisibility("ach-1", "employers");

    expect(achievement?.visibility).toBe("employers");
    expect(fetch).toHaveBeenCalledWith(
      "/api/profile/achievements/ach-1/visibility",
      expect.objectContaining({ method: "PATCH", body: JSON.stringify({ visibility: "employers" }) })
    );
  });

  it("loads explainable recommendations and records feedback", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() =>
        jsonResponse({
          success: true,
          data: {
            contractVersion: "recommendations-v1",
            domain: "home",
            generatedAt: "2030-01-01T00:00:00.000Z",
            items: [
              {
                impressionId: "imp-1",
                domain: "career",
                itemType: "opportunity",
                itemId: "opp-1",
                title: "Frontend Intern",
                score: 0.8,
                label: "Strong opportunity match",
                reasons: ["Matches React"],
                risks: [],
                missing: ["Node.js"],
                shownAt: "2030-01-01T00:00:00.000Z",
              },
            ],
          },
        })
      )
    );

    const recommendations = await getPlatformRecommendations("home");
    expect(recommendations.items[0].reasons).toContain("Matches React");
    expect(fetch).toHaveBeenCalledWith("/api/recommendations/home", expect.anything());

    vi.stubGlobal(
      "fetch",
      vi.fn(() => jsonResponse({ success: true, data: { recorded: true, id: "fb-1" } }))
    );
    const result = await recordPlatformRecommendationFeedback({
      impressionId: "imp-1",
      action: "clicked",
      metadata: { surface: "test" },
    });
    expect(result.recorded).toBe(true);
    expect(fetch).toHaveBeenCalledWith(
      "/api/recommendations/feedback",
      expect.objectContaining({ method: "POST" })
    );
  });
});
