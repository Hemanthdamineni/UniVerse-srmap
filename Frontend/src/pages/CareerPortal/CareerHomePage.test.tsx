import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import CareerHomePage from "./CareerHomePage";
import { listOpportunities, getPersonalizedFeed } from "../../lib/career/careerApi";

vi.mock("../../lib/career/careerApi", () => ({
  listOpportunities: vi.fn(),
  getPersonalizedFeed: vi.fn(),
  bookmarkOpportunity: vi.fn(() => Promise.resolve({ bookmarked: true })),
}));

function opp(id: string, title: string) {
  return {
    id,
    type: "job",
    title,
    shortDescription: "d",
    skills: [],
    tags: [],
    isPanIndia: false,
    eligibleBranches: [],
    eligibleYears: [],
    isFree: true,
    source: "manual",
    sourceUrl: `https://x/${id}`,
    applyUrl: `https://x/${id}`,
    viewCount: 0,
    bookmarkCount: 0,
    applyCount: 0,
    relevanceScore: 1,
    isActive: true,
    isVerified: true,
    isFeatured: false,
  };
}

describe("CareerHomePage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(listOpportunities).mockImplementation((q?: Record<string, string>) =>
      Promise.resolve({
        // `sort: recent` = Latest rail, `sort: deadline` = Expiring rail.
        items: q?.sort === "deadline" ? [opp("2", "Job B")] : [opp("1", "Job A"), opp("2", "Job B")],
      } as never),
    );
    vi.mocked(getPersonalizedFeed).mockResolvedValue({ items: [opp("1", "Job A")] } as never);
  });

  it("renders portal heading and loads opportunities", async () => {
    render(
      <MemoryRouter>
        <CareerHomePage />
      </MemoryRouter>
    );
    expect(screen.getByText(/Career Portal/i)).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText("Job A")).toBeInTheDocument());
  });

  it("shows each opportunity in only one rail (T4.2.5)", async () => {
    render(
      <MemoryRouter>
        <CareerHomePage />
      </MemoryRouter>
    );
    // Job A: personalized. Job B: expiring (deduped out of latest).
    await waitFor(() => expect(screen.getByText("Job B")).toBeInTheDocument());
    expect(screen.getAllByText("Job A")).toHaveLength(1);
    expect(screen.getAllByText("Job B")).toHaveLength(1);
  });
});
