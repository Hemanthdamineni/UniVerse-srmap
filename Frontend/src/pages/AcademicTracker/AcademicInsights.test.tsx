import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import AcademicInsights from "./AcademicInsights";

const getLmsAcademicInsights = vi.fn();

vi.mock("../../lib/lms/index", () => ({
  get getLmsAcademicInsights() {
    return getLmsAcademicInsights;
  },
}));

describe("AcademicInsights", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (globalThis as any).ResizeObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    };
    getLmsAcademicInsights.mockResolvedValue({
      gpaTrend: [
        { semester: "Sem 1", sgpa: 8.1 },
        { semester: "Sem 2", sgpa: 7.8 },
        { semester: "Sem 3", sgpa: 8.5 },
      ],
      categoryPerformance: [{ category: "Core Engineering", subjects: 2, avgGrade: "A", avgGpa: 8 }],
      highlights: [{ label: "Attendance Risk", value: "1 subject(s) below 75%" }],
      recommendations: [
        {
          title: "Attendance Warning",
          description: "1 subject is below the 75% attendance line.",
          type: "warning",
        },
      ],
      overview: { progressPercent: 60, attendancePct: "80.0" },
      careerReadiness: {
        available: true,
        profileCompleteness: { score: 72, completed: [], missing: [], breakdown: [] },
        resumeScore: { score: 58, hasResume: false, breakdown: [], suggestions: [] },
        skillGaps: [],
        recommendedOpportunities: [
          {
            id: "opp-frontend-intern",
            title: "Frontend Engineering Intern",
            type: "internship",
            organization: "Acme Labs",
            deadline: "2026-06-30",
            matchedSkills: ["React", "SQL"],
            missingSkills: ["Node.js"],
            confidence: 0.72,
            reasons: ["Matches 2 profile skills.", "Missing skills to close: Node.js."],
            inputsUsed: ["careerProfile.skills"],
          },
        ],
        nextActions: ["Review Frontend Engineering Intern and decide whether to save or apply."],
        inputsUsed: {
          careerProfile: true,
          skillGaps: 0,
          opportunities: 1,
          applications: 0,
          academicSignals: ["subjectsAtRisk"],
        },
      },
      snapshot: {
        id: "snap-2",
        snapshotType: "insights",
        createdAt: "2026-05-26T03:31:00.000Z",
        inputsHash: "def456",
        sourceStatus: { attendance: true },
        summary: { currentCgpa: "8.20", progressPercent: 60, subjectsAtRisk: 1, careerAvailable: true },
      },
      history: [],
      recommendationEvents: [
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
    });
  });

  it("renders explainable career recommendations and recommendation event trace", async () => {
    render(<AcademicInsights />);

    expect(await screen.findByText("Career-Aware Action Plan")).toBeInTheDocument();
    expect(screen.getAllByText("Frontend Engineering Intern").length).toBeGreaterThan(0);
    expect(screen.getByText("Recommendation Trace")).toBeInTheDocument();
    expect(screen.getByText(/career_readiness/i)).toBeInTheDocument();
    expect(screen.getAllByText(/72%/).length).toBeGreaterThan(0);
  });
});
