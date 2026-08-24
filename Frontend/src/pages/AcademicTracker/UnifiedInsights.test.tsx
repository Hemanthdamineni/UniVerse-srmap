import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { QueryClientProvider } from "@tanstack/react-query";
import { createTestQueryClient } from "../../test/testUtils";
import UnifiedInsights from "./UnifiedInsights";

const getLmsUnifiedInsights = vi.fn();
const recordLmsTrackerRecommendationEvent = vi.fn();

vi.mock("../../lib/lms/index", () => ({
  get getLmsUnifiedInsights() {
    return getLmsUnifiedInsights;
  },
  get recordLmsTrackerRecommendationEvent() {
    return recordLmsTrackerRecommendationEvent;
  },
}));

describe("UnifiedInsights", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (globalThis as any).ResizeObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    };
    recordLmsTrackerRecommendationEvent.mockResolvedValue({ items: [] });
    getLmsUnifiedInsights.mockResolvedValue({
      contractVersion: "unified-insights-v1",
      generatedAt: "2026-05-26T03:35:00.000Z",
      scoringSchema: {},
      profileGraph: {
        nodes: [
          {
            id: "academic",
            type: "source",
            label: "Academic Record",
            status: "ready",
            value: "8.20 CGPA",
            confidence: 0.86,
            inputsUsed: ["cgpa", "attendance"],
          },
          {
            id: "resume",
            type: "source",
            label: "Resume",
            status: "missing",
            value: "58% ATS score",
            confidence: 0.56,
            inputsUsed: ["resumeFile"],
          },
        ],
        edges: [{ from: "academic", to: "resume", signal: "CGPA and progress influence ATS rubric." }],
        coverage: { readySignals: 1, totalSignals: 2, missingSignals: ["Resume"] },
      },
      atsScore: {
        score: 58,
        hasResume: false,
        confidence: 0.56,
        rubric: [
          { label: "Resume file", score: 0, max: 25, reason: "Resume file needs improvement before high-fit applications." },
          { label: "Skills evidence", score: 20, max: 25, reason: "Skills evidence needs improvement before high-fit applications." },
        ],
        suggestions: ["Upload a current resume before applying."],
        inputsUsed: ["careerProfile"],
      },
      academicSignals: {
        currentCgpa: "8.20",
        progressPercent: 60,
        attendancePct: "80.0",
        subjectsAtRisk: 1,
        recommendations: [],
      },
      nextSkills: [
        {
          id: "skill-node-js",
          skill: "Node.js",
          title: "Build Node.js",
          opportunityDemand: 4,
          gapLevel: "missing",
          confidence: 0.68,
          feedbackBoost: 0,
          reasons: ["Node.js appears in 4 active opportunity match(es)."],
          inputsUsed: ["careerSkillGaps"],
        },
      ],
      opportunityRecommendations: [
        {
          id: "opp-frontend-intern",
          title: "Frontend Engineering Intern",
          type: "internship",
          organization: "Acme Labs",
          deadline: "2026-06-30",
          matchedSkills: ["React", "SQL"],
          missingSkills: ["Node.js"],
          confidence: 0.72,
          feedbackBoost: 0,
          eligibility: {
            eligible: true,
            branch: "computer science",
            year: "3",
            filtersApplied: ["activeOpportunity", "branchEligible", "yearEligible"],
          },
          reasons: ["Matches 2 profile skills.", "Missing skills to close: Node.js."],
          inputsUsed: ["careerProfile.skills", "careerEligibility"],
        },
      ],
      actionPlan: [
        {
          id: "action-attendance-risk",
          domain: "academic",
          priority: "high",
          title: "Recover attendance risk",
          description: "1 subject is below the attendance safety line.",
          confidence: 0.9,
          reasons: ["Attendance below threshold blocks exam eligibility and should be resolved first."],
          inputsUsed: ["attendanceRecords"],
        },
      ],
      feedbackLoop: {
        recentEvents: [
          {
            id: "event-1",
            eventType: "generated",
            recommendationId: "opp-frontend-intern",
            recommendationTitle: "Frontend Engineering Intern",
            sourceDomain: "career_readiness",
            confidence: 0.72,
            createdAt: "2026-05-26T03:31:00.000Z",
          },
        ],
        adaptiveSignals: 1,
        modelInfluence: "Prior clicks, saves, applies, and dismissals adjust confidence in later rankings.",
      },
      lmsSignals: { recommendations: [] },
      qualityMonitoring: {
        baseline: "offline-fixture-v1",
        measuredLatencyMs: 28,
        metrics: {
          recommendationCount: 3,
          explainabilityCoverage: 1,
          eligibleOpportunityRate: 1,
          profileSignalCoverage: 0.5,
          feedbackEventCount: 1,
        },
        thresholds: { recommendationApiP95Ms: 400 },
        dashboardCards: [
          { label: "Explainability", value: "100%" },
          { label: "Eligible opportunities", value: "100%" },
          { label: "Feedback events", value: "1" },
        ],
      },
      sourceStatus: { careerStore: true },
      responseTimeMs: 28,
      history: [],
    });
  });

  it("renders profile graph, ATS rubric, eligible recommendations, and saves feedback", async () => {
    render(
      <QueryClientProvider client={createTestQueryClient()}>
        <UnifiedInsights />
      </QueryClientProvider>
    );

    expect(await screen.findByRole("heading", { name: "Unified Insights" })).toBeInTheDocument();
    // Graph nodes render only after the insights query lands — anchor on it.
    await screen.findByText("Academic Record");
    expect(screen.getByText("ATS Rubric")).toBeInTheDocument();
    expect(screen.getByText("Build Node.js")).toBeInTheDocument();
    expect(screen.getByText("Frontend Engineering Intern")).toBeInTheDocument();
    expect(screen.getByText("Quality Monitoring")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: /Applied/i }));

    await waitFor(() => {
      expect(recordLmsTrackerRecommendationEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: "applied",
          recommendationId: "opp-frontend-intern",
          sourceDomain: "unified_insights",
        })
      );
    });
    expect(screen.getByText(/Feedback saved/i)).toBeInTheDocument();
  });
});
