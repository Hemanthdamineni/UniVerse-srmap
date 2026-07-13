import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import SkillGapPage from "./SkillGapPage";

const listSkillGaps = vi.fn();

vi.mock("../../lib/career/careerApi", () => ({
  get listSkillGaps() {
    return listSkillGaps;
  },
}));

describe("SkillGapPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("lists gaps when API returns items", async () => {
    listSkillGaps.mockResolvedValue({
      items: [{ skill: "kubernetes", opportunityCount: 12, updatedAt: "2026-01-01" }],
    });
    render(
      <MemoryRouter>
        <SkillGapPage />
      </MemoryRouter>
    );
    await waitFor(() => expect(screen.getByText("kubernetes")).toBeInTheDocument());
    expect(screen.getByText(/12 active opportunities/i)).toBeInTheDocument();
  });

  it("shows empty copy when no gaps", async () => {
    listSkillGaps.mockResolvedValue({ items: [] });
    render(
      <MemoryRouter>
        <SkillGapPage />
      </MemoryRouter>
    );
    await waitFor(() =>
      expect(screen.getByText(/No major skill gaps identified/i)).toBeInTheDocument()
    );
  });
});
