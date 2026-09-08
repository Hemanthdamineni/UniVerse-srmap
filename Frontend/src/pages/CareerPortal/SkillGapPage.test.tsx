import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { QueryClientProvider } from "@tanstack/react-query";
import { createTestQueryClient } from "../../test/testUtils";
import SkillGapPage from "./SkillGapPage";
import {
  listSkillGaps,
  listLearningPlans,
  createLearningPlan,
  updateLearningPlan,
} from "../../lib/career/careerApi";

vi.mock("../../lib/career/careerApi", () => ({
  listSkillGaps: vi.fn(),
  listLearningPlans: vi.fn(),
  createLearningPlan: vi.fn(),
  updateLearningPlan: vi.fn(),
  deleteLearningPlan: vi.fn(),
}));

const NO_PLANS = { items: [], stats: { active: 0, closed: 0, closedThisMonth: 0 } };

function renderPage() {
  render(
    <QueryClientProvider client={createTestQueryClient()}>
      <MemoryRouter>
        <SkillGapPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("SkillGapPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(listSkillGaps).mockResolvedValue({
      items: [{ skill: "kubernetes", opportunityCount: 12, updatedAt: "2026-01-01" }],
    } as never);
    vi.mocked(listLearningPlans).mockResolvedValue(NO_PLANS as never);
    vi.mocked(createLearningPlan).mockResolvedValue({
      id: "p1",
      skill: "kubernetes",
      status: "active",
      startedAt: "2026-01-02",
      closedAt: null,
      closedReason: null,
    } as never);
    vi.mocked(updateLearningPlan).mockResolvedValue({
      id: "p1",
      skill: "kubernetes",
      status: "closed",
      startedAt: "2026-01-02",
      closedAt: "2026-01-03",
      closedReason: "manual",
    } as never);
  });

  it("lists gaps with resource / roadmap / jobs links", async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText("kubernetes")).toBeInTheDocument());
    expect(screen.getByText(/12 active opportunities/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Roadmap/i })).toHaveAttribute(
      "href",
      "/learn/roadmaps?q=kubernetes",
    );
    expect(screen.getByRole("link", { name: /Resources/i })).toHaveAttribute(
      "href",
      "/learn/discover?q=kubernetes",
    );
  });

  it("shows empty copy when no gaps", async () => {
    vi.mocked(listSkillGaps).mockResolvedValue({ items: [] } as never);
    renderPage();
    await waitFor(() =>
      expect(screen.getByText(/No major skill gaps identified/i)).toBeInTheDocument(),
    );
  });

  it("starts a learning plan from a gap (T4.3.2)", async () => {
    const user = userEvent.setup();
    renderPage();
    await user.click(await screen.findByRole("button", { name: "Close this gap" }));
    await waitFor(() => expect(createLearningPlan).toHaveBeenCalledWith("kubernetes"));
  });

  it("shows the progress card once plans exist and can mark one done (T4.3.3)", async () => {
    const user = userEvent.setup();
    vi.mocked(listLearningPlans).mockResolvedValue({
      items: [
        { id: "p1", skill: "kubernetes", status: "active", startedAt: "x", closedAt: null, closedReason: null },
        { id: "p2", skill: "docker", status: "closed", startedAt: "x", closedAt: "y", closedReason: "acquired" },
      ],
      stats: { active: 1, closed: 1, closedThisMonth: 1 },
    } as never);

    renderPage();
    await waitFor(() => expect(screen.getByText("gaps closed")).toBeInTheDocument());
    expect(screen.getByText(/now on your profile/)).toBeInTheDocument();

    await user.click(screen.getAllByRole("button", { name: /Mark done/i })[0]);
    await waitFor(() =>
      expect(updateLearningPlan).toHaveBeenCalledWith("p1", "closed"),
    );
  });
});
