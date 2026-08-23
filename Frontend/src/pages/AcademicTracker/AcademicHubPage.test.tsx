import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import AcademicHubPage from "./AcademicHubPage";
import { getLmsProgressOverview, getLmsAcademicInsights, getLmsUnifiedInsights, getLmsStreak } from "../../lib/lms/index";
import { getErpBatch } from "../../lib/erp";

vi.mock("../../lib/lms/index", () => ({
  getLmsProgressOverview: vi.fn(),
  getLmsAcademicInsights: vi.fn(),
  getLmsUnifiedInsights: vi.fn(),
  getLmsStreak: vi.fn(),
}));

vi.mock("../../lib/erp/index", () => ({
  getErpBatch: vi.fn(),
}));

describe("AcademicHubPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (getLmsProgressOverview as any).mockResolvedValue({
      completedCredits: 80,
      requiredCredits: 120,
      currentCgpa: "8.5",
      progressPercent: 66,
      attendancePct: "90",
      subjectsAtRisk: 0,
      semesters: [],
    });
    (getLmsAcademicInsights as any).mockResolvedValue({
      gpaTrend: [],
      categoryPerformance: [],
      highlights: [],
      recommendations: [],
      overview: { progressPercent: 66, attendancePct: "90" },
    });
    (getLmsUnifiedInsights as any).mockResolvedValue({
      actionPlan: [],
      academicSignals: { currentCgpa: "8.5", progressPercent: 66, attendancePct: "90", subjectsAtRisk: 0, recommendations: [] },
      opportunityRecommendations: [],
      nextSkills: [],
    });
    (getLmsStreak as any).mockResolvedValue({
      currentStreak: 0,
      longestStreak: 0,
      totalDays: 0,
    });
  });

  it("renders the academic hub successfully with KPI metrics", async () => {
    render(
      <MemoryRouter>
        <AcademicHubPage />
      </MemoryRouter>
    );

    // Initial loading state
    expect(screen.getByText(/Loading academic data.../i)).toBeInTheDocument();

    // Verification of KPI grid items
    await waitFor(() => {
      expect(screen.getByText("8.5")).toBeInTheDocument();
      expect(screen.getByText("66%")).toBeInTheDocument();
      expect(screen.getByText(/80\/120 credits/)).toBeInTheDocument();
      expect(screen.getAllByText("90%")).toHaveLength(2); // KPI grid + attendance detail
    });

    // Verification of tabs
    expect(screen.getByText("Where am I?")).toBeInTheDocument();
    expect(screen.getByText("What did I do?")).toBeInTheDocument();
    expect(screen.getByText("What if...")).toBeInTheDocument();
    expect(screen.getByText("Where am I vulnerable?")).toBeInTheDocument();
    expect(screen.getByText("What now?")).toBeInTheDocument();
  });
});
