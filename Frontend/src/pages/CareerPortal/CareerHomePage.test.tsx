import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import CareerHomePage from "./CareerHomePage";

vi.mock("../../lib/career/careerApi", () => ({
  listOpportunities: vi.fn(() =>
    Promise.resolve({
      items: [
        {
          id: "1",
          type: "job",
          title: "Job A",
          shortDescription: "d",
          skills: [],
          tags: [],
          isPanIndia: false,
          eligibleBranches: [],
          eligibleYears: [],
          isFree: true,
          source: "manual",
          sourceUrl: "https://a",
          applyUrl: "https://a",
          viewCount: 0,
          bookmarkCount: 0,
          applyCount: 0,
          relevanceScore: 1,
          isActive: true,
          isVerified: true,
          isFeatured: false,
        },
      ],
    })
  ),
  getPersonalizedFeed: vi.fn(() => Promise.resolve({ items: [] })),
}));

describe("CareerHomePage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders portal heading and loads opportunities", async () => {
    render(
      <MemoryRouter>
        <CareerHomePage />
      </MemoryRouter>
    );
    expect(screen.getByText(/Career Portal/i)).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getAllByText("Job A").length).toBeGreaterThan(0);
    });
  });
});
