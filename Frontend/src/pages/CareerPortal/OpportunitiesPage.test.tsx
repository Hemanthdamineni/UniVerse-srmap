import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import OpportunitiesPage from "./OpportunitiesPage";

vi.mock("../../lib/careerApi", () => ({
  listOpportunities: vi.fn(() =>
    Promise.resolve({
      items: [
        {
          id: "x1",
          type: "internship",
          title: "Listed",
          shortDescription: "d",
          skills: [],
          tags: [],
          isPanIndia: false,
          eligibleBranches: [],
          eligibleYears: [],
          isFree: true,
          source: "manual",
          sourceUrl: "https://x",
          applyUrl: "https://x",
          viewCount: 0,
          bookmarkCount: 0,
          applyCount: 0,
          relevanceScore: 2,
          isActive: true,
          isVerified: true,
          isFeatured: false,
        },
      ],
    })
  ),
}));

describe("OpportunitiesPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("loads items after debounce window", async () => {
    const { listOpportunities } = await import("../../lib/careerApi");
    render(
      <MemoryRouter initialEntries={["/career/opportunities"]}>
        <OpportunitiesPage />
      </MemoryRouter>
    );
    await waitFor(
      () => {
        expect(screen.getByText("Listed")).toBeInTheDocument();
      },
      { timeout: 5000 }
    );
    expect(listOpportunities).toHaveBeenCalled();
  });

  it("applies type filter via job chip", async () => {
    const user = userEvent.setup();
    const { listOpportunities } = await import("../../lib/careerApi");
    render(
      <MemoryRouter initialEntries={["/career/opportunities"]}>
        <OpportunitiesPage />
      </MemoryRouter>
    );
    await waitFor(() => expect(screen.getByText("Listed")).toBeInTheDocument());
    vi.mocked(listOpportunities).mockClear();
    await user.click(screen.getByRole("button", { name: /^job$/i }));
    await waitFor(
      () => {
        expect(listOpportunities).toHaveBeenCalledWith(expect.objectContaining({ type: "job" }));
      },
      { timeout: 5000 }
    );
  });

  it("changes sort option", async () => {
    const user = userEvent.setup();
    const { listOpportunities } = await import("../../lib/careerApi");
    render(
      <MemoryRouter initialEntries={["/career/opportunities"]}>
        <OpportunitiesPage />
      </MemoryRouter>
    );
    await waitFor(() => expect(screen.getByText("Listed")).toBeInTheDocument());
    vi.mocked(listOpportunities).mockClear();
    const sortSelect = screen.getAllByRole("combobox")[0];
    await user.selectOptions(sortSelect, "recent");
    await waitFor(() => {
      expect(listOpportunities).toHaveBeenCalledWith(expect.objectContaining({ sort: "recent" }));
    });
  });
});
