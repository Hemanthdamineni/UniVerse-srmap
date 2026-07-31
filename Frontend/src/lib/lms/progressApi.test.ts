import { afterEach, describe, expect, it, vi } from "vitest";
import {
  generateLearningSession,
  getContinueLearning,
  getLmsAcademicInsights,
  getLmsMastery,
  getLmsProgress,
  getLmsProgressForSubject,
  getLmsProgressOverview,
  getLmsStreak,
  getLmsTrackerHistory,
  getLmsTrackerRecommendationEvents,
  getLmsUnifiedInsights,
  getMyActivity,
  getMyBookmarks,
  getMyContributions,
  getMyLmsRequests,
  getRevisionQueue,
  getWeeklyLeaderboard,
  recordLmsTrackerRecommendationEvent,
  submitRevisionReview,
  updateMyLmsPreferences,
} from "./progressApi";

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

describe("progressApi", () => {
  afterEach(() => vi.restoreAllMocks());

  describe("getLmsProgressOverview", () => {
    it("GETs progress overview data", async () => {
      const overview = { completedCredits: 96, requiredCredits: 160, currentCgpa: "8.20", progressPercent: 60, semesters: [], attendancePct: "80.0", subjectsAtRisk: 1 };
      vi.stubGlobal("fetch", mockFetchSuccess(overview));
      const result = await getLmsProgressOverview();
      expect(result.completedCredits).toBe(96);
      expect(fetch).toHaveBeenCalledWith("/api/lms/tracker/overview", expect.anything());
    });
  });

  describe("getLmsAcademicInsights", () => {
    it("GETs academic insights data", async () => {
      const insights = { gpaTrend: [], categoryPerformance: [], highlights: [], recommendations: [], overview: { progressPercent: 60, attendancePct: "80.0" } };
      vi.stubGlobal("fetch", mockFetchSuccess(insights));
      const result = await getLmsAcademicInsights();
      expect(result.overview.progressPercent).toBe(60);
      expect(fetch).toHaveBeenCalledWith("/api/lms/tracker/insights", expect.anything());
    });
  });

  describe("getLmsUnifiedInsights", () => {
    it("GETs unified insights data", async () => {
      const data = { contractVersion: "v1", generatedAt: "2026-01-01T00:00:00Z", scoringSchema: {}, profileGraph: {} as any, atsScore: {} as any, academicSignals: {} as any, nextSkills: [], opportunityRecommendations: [], actionPlan: [], feedbackLoop: {} as any, lmsSignals: {} as any, qualityMonitoring: {} as any, sourceStatus: {}, responseTimeMs: 0 };
      vi.stubGlobal("fetch", mockFetchSuccess(data));
      const result = await getLmsUnifiedInsights();
      expect(result.contractVersion).toBe("v1");
      expect(fetch).toHaveBeenCalledWith("/api/lms/tracker/unified-insights", expect.anything());
    });
  });

  describe("getLmsTrackerHistory", () => {
    it("GETs history without type filter", async () => {
      vi.stubGlobal("fetch", mockFetchSuccess({ items: [{ id: "snap-1" }] }));
      const result = await getLmsTrackerHistory();
      expect(result.items).toHaveLength(1);
      expect(fetch).toHaveBeenCalledWith("/api/lms/tracker/history", expect.anything());
    });

    it("GETs history with type filter", async () => {
      vi.stubGlobal("fetch", mockFetchSuccess({ items: [] }));
      await getLmsTrackerHistory("overview");
      expect(fetch).toHaveBeenCalledWith("/api/lms/tracker/history?type=overview", expect.anything());
    });
  });

  describe("getLmsTrackerRecommendationEvents", () => {
    it("GETs recommendation events", async () => {
      vi.stubGlobal("fetch", mockFetchSuccess({ items: [{ id: "event-1", eventType: "generated" }] }));
      const result = await getLmsTrackerRecommendationEvents();
      expect(result.items).toHaveLength(1);
      expect(fetch).toHaveBeenCalledWith("/api/lms/tracker/recommendation-events", expect.anything());
    });
  });

  describe("recordLmsTrackerRecommendationEvent", () => {
    it("POSTs event and returns events", async () => {
      const payload = {
        eventType: "clicked",
        recommendationId: "rec-1",
        recommendationTitle: "Frontend Intern",
        sourceDomain: "career_readiness",
        confidence: 0.8,
        action: "save",
      };
      vi.stubGlobal("fetch", mockFetchSuccess({ items: [{ ...payload, id: "event-new" }] }));
      const result = await recordLmsTrackerRecommendationEvent(payload);
      expect(result.items).toHaveLength(1);
      expect(fetch).toHaveBeenCalledWith(
        "/api/lms/tracker/recommendation-events",
        expect.objectContaining({ method: "POST", body: JSON.stringify(payload) })
      );
    });

    it("posts event without optional fields", async () => {
      const payload = {
        eventType: "dismissed",
        recommendationId: "rec-2",
        recommendationTitle: "Test",
        sourceDomain: "lms",
      };
      vi.stubGlobal("fetch", mockFetchSuccess({ items: [] }));
      await recordLmsTrackerRecommendationEvent(payload);
      expect(fetch).toHaveBeenCalledWith(
        "/api/lms/tracker/recommendation-events",
        expect.objectContaining({ body: JSON.stringify(payload) })
      );
    });
  });

  describe("getWeeklyLeaderboard", () => {
    it("GETs weekly leaderboard", async () => {
      const leaderboard = [{ rank: 1, userId: "u1", score: 100 }];
      vi.stubGlobal("fetch", mockFetchSuccess(leaderboard));
      const result = await getWeeklyLeaderboard();
      expect(result).toEqual(leaderboard);
      expect(fetch).toHaveBeenCalledWith("/api/lms/leaderboard/weekly", expect.anything());
    });

    it("returns empty array when no leaderboard data", async () => {
      vi.stubGlobal("fetch", mockFetchSuccess([]));
      const result = await getWeeklyLeaderboard();
      expect(result).toEqual([]);
    });
  });

  describe("getLmsProgress", () => {
    it("GETs progress data", async () => {
      vi.stubGlobal("fetch", mockFetchSuccess({ overall: { completed: 5, total: 10 } }));
      const result = await getLmsProgress();
      expect(result).toEqual({ overall: { completed: 5, total: 10 } });
      expect(fetch).toHaveBeenCalledWith("/api/lms/progress", expect.anything());
    });
  });

  describe("getLmsProgressForSubject", () => {
    it("GETs progress for a specific subject", async () => {
      vi.stubGlobal("fetch", mockFetchSuccess([{ topic: "Indexes", completed: true }]));
      const result = await getLmsProgressForSubject("CSE301");
      expect(result).toEqual([{ topic: "Indexes", completed: true }]);
      expect(fetch).toHaveBeenCalledWith("/api/lms/progress/CSE301", expect.anything());
    });

    it("encodes subjectCode with special chars", async () => {
      vi.stubGlobal("fetch", mockFetchSuccess([]));
      await getLmsProgressForSubject("CS&E");
      expect(fetch).toHaveBeenCalledWith("/api/lms/progress/CS%26E", expect.anything());
    });
  });

  describe("getLmsMastery", () => {
    it("GETs mastery data", async () => {
      vi.stubGlobal("fetch", mockFetchSuccess([{ subjectCode: "CSE301", mastery: 0.8 }]));
      const result = await getLmsMastery();
      expect(result).toEqual([{ subjectCode: "CSE301", mastery: 0.8 }]);
      expect(fetch).toHaveBeenCalledWith("/api/lms/mastery", expect.anything());
    });
  });

  describe("getContinueLearning", () => {
    it("GETs continue learning resource", async () => {
      vi.stubGlobal("fetch", mockFetchSuccess({ id: "res-1", title: "DB Indexing" }));
      const result = await getContinueLearning();
      expect(result).toEqual({ id: "res-1", title: "DB Indexing" });
      expect(fetch).toHaveBeenCalledWith("/api/lms/continue", expect.anything());
    });

    it("returns null when nothing to continue", async () => {
      vi.stubGlobal("fetch", mockFetchSuccess(null));
      const result = await getContinueLearning();
      expect(result).toBeNull();
    });
  });

  describe("getRevisionQueue", () => {
    it("GETs revision queue", async () => {
      vi.stubGlobal("fetch", mockFetchSuccess([{ id: "res-1", title: "SQL Basics" }]));
      const result = await getRevisionQueue();
      expect(result).toEqual([{ id: "res-1", title: "SQL Basics" }]);
      expect(fetch).toHaveBeenCalledWith("/api/lms/revision", expect.anything());
    });

    it("returns empty array when queue is empty", async () => {
      vi.stubGlobal("fetch", mockFetchSuccess([]));
      const result = await getRevisionQueue();
      expect(result).toEqual([]);
    });
  });

  describe("submitRevisionReview", () => {
    it("POSTs score and returns updated queue", async () => {
      vi.stubGlobal("fetch", mockFetchSuccess([{ id: "res-1", reviewed: true }]));
      const result = await submitRevisionReview("res-1", 4);
      expect(result).toEqual([{ id: "res-1", reviewed: true }]);
      expect(fetch).toHaveBeenCalledWith(
        "/api/lms/revision/res-1/review",
        expect.objectContaining({ method: "POST", body: JSON.stringify({ score: 4 }) })
      );
    });
  });

  describe("getLmsStreak", () => {
    it("GETs streak data", async () => {
      vi.stubGlobal("fetch", mockFetchSuccess({ currentStreak: 4, longestStreak: 9 }));
      const result = await getLmsStreak();
      expect(result).toEqual({ currentStreak: 4, longestStreak: 9 });
      expect(fetch).toHaveBeenCalledWith("/api/lms/streak", expect.anything());
    });
  });

  describe("generateLearningSession", () => {
    it("POSTs duration and returns session", async () => {
      vi.stubGlobal("fetch", mockFetchSuccess({ id: "sess-1", durationMinutes: 25 }));
      const result = await generateLearningSession(25);
      expect(result).toEqual({ id: "sess-1", durationMinutes: 25 });
      expect(fetch).toHaveBeenCalledWith(
        "/api/lms/session/generate",
        expect.objectContaining({ method: "POST", body: JSON.stringify({ durationMinutes: 25 }) })
      );
    });

    it("generates session with zero duration", async () => {
      vi.stubGlobal("fetch", mockFetchSuccess({}));
      await generateLearningSession(0);
      expect(fetch).toHaveBeenCalledWith(
        "/api/lms/session/generate",
        expect.objectContaining({ body: JSON.stringify({ durationMinutes: 0 }) })
      );
    });
  });

  describe("getMyContributions", () => {
    it("GETs user contributions", async () => {
      vi.stubGlobal("fetch", mockFetchSuccess({ total: 5, resources: [] }));
      const result = await getMyContributions();
      expect(result).toEqual({ total: 5, resources: [] });
      expect(fetch).toHaveBeenCalledWith("/api/lms/me/contributions", expect.anything());
    });
  });

  describe("getMyBookmarks", () => {
    it("GETs user bookmarks", async () => {
      vi.stubGlobal("fetch", mockFetchSuccess([{ id: "res-1", title: "Bookmarked" }]));
      const result = await getMyBookmarks();
      expect(result).toEqual([{ id: "res-1", title: "Bookmarked" }]);
      expect(fetch).toHaveBeenCalledWith("/api/lms/me/bookmarks", expect.anything());
    });

    it("returns empty array when no bookmarks", async () => {
      vi.stubGlobal("fetch", mockFetchSuccess([]));
      const result = await getMyBookmarks();
      expect(result).toEqual([]);
    });
  });

  describe("getMyActivity", () => {
    it("GETs user activity", async () => {
      vi.stubGlobal("fetch", mockFetchSuccess([{ action: "viewed", resourceId: "res-1" }]));
      const result = await getMyActivity();
      expect(result).toEqual([{ action: "viewed", resourceId: "res-1" }]);
      expect(fetch).toHaveBeenCalledWith("/api/lms/me/activity", expect.anything());
    });
  });

  describe("getMyLmsRequests", () => {
    it("GETs user requests", async () => {
      vi.stubGlobal("fetch", mockFetchSuccess([{ id: "req-1", title: "Need PYQs" }]));
      const result = await getMyLmsRequests();
      expect(result).toEqual([{ id: "req-1", title: "Need PYQs" }]);
      expect(fetch).toHaveBeenCalledWith("/api/lms/me/requests", expect.anything());
    });
  });

  describe("updateMyLmsPreferences", () => {
    it("PUTs preferences and returns updated data", async () => {
      const prefs = { dailyGoal: 30, subjects: ["CSE301"] };
      vi.stubGlobal("fetch", mockFetchSuccess(prefs));
      const result = await updateMyLmsPreferences(prefs);
      expect(result).toEqual(prefs);
      expect(fetch).toHaveBeenCalledWith(
        "/api/lms/me/preferences",
        expect.objectContaining({ method: "PUT", body: JSON.stringify(prefs) })
      );
    });

    it("updates with empty preferences", async () => {
      vi.stubGlobal("fetch", mockFetchSuccess({}));
      await updateMyLmsPreferences({});
      expect(fetch).toHaveBeenCalledWith(
        "/api/lms/me/preferences",
        expect.objectContaining({ body: JSON.stringify({}) })
      );
    });
  });
});
