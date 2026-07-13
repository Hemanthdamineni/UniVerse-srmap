import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import ProgressOverview from "./ProgressOverview";

const getLmsProgressOverview = vi.fn();

vi.mock("../../lib/lms/index", () => ({
  get getLmsProgressOverview() {
    return getLmsProgressOverview;
  },
}));

describe("ProgressOverview", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (globalThis as any).ResizeObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    };
    getLmsProgressOverview.mockResolvedValue({
      completedCredits: 96,
      requiredCredits: 160,
      currentCgpa: "8.20",
      progressPercent: 60,
      semesters: [
        { semester: 1, label: "Sem 1", credits: 22, sgpa: "8.10", status: "Completed" },
        { semester: 2, label: "Sem 2", credits: 24, sgpa: "7.80", status: "Completed" },
        { semester: 3, label: "Sem 3", credits: 25, sgpa: "8.50", status: "Completed" },
      ],
      attendancePct: "80.0",
      subjectsAtRisk: 1,
      careerReadiness: {
        available: true,
        profileCompleteness: { score: 72, completed: [], missing: [], breakdown: [] },
        resumeScore: { score: 58, hasResume: false, breakdown: [], suggestions: [] },
        skillGaps: [
          {
            skill: "Node.js",
            opportunityCount: 4,
            gapLevel: "missing",
            reason: "Node.js appears in active opportunity matches.",
          },
        ],
        recommendedOpportunities: [],
        nextActions: ["Upload a resume before applying to recommended roles."],
        inputsUsed: {
          careerProfile: true,
          skillGaps: 1,
          opportunities: 0,
          applications: 0,
          academicSignals: ["subjectsAtRisk"],
        },
      },
      snapshot: {
        id: "snap-1",
        snapshotType: "overview",
        createdAt: "2026-05-26T03:30:00.000Z",
        inputsHash: "abc123456789",
        sourceStatus: { attendance: true },
        summary: { currentCgpa: "8.20", progressPercent: 60, subjectsAtRisk: 1, careerAvailable: true },
      },
      history: [
        {
          id: "snap-1",
          snapshotType: "overview",
          createdAt: "2026-05-26T03:30:00.000Z",
          inputsHash: "abc123456789",
          sourceStatus: { attendance: true },
          summary: { currentCgpa: "8.20", progressPercent: 60, subjectsAtRisk: 1, careerAvailable: true },
        },
      ],
    });
  });

  it("renders persisted analytics trace and career readiness signals", async () => {
    render(<ProgressOverview />);

    expect(await screen.findByText("Career Readiness")).toBeInTheDocument();
    expect(screen.getByText("Node.js · 4")).toBeInTheDocument();
    expect(screen.getByText("Analytics Trace")).toBeInTheDocument();
    expect(screen.getByText(/Snapshot saved/i)).toBeInTheDocument();
    expect(screen.getByText(/hash abc12345/i)).toBeInTheDocument();
  });
});
