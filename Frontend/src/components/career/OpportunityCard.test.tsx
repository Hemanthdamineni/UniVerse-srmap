import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import OpportunityCard from "./OpportunityCard";
import type { CareerOpportunity } from "../../lib/careerApi";

const base: CareerOpportunity = {
  id: "o1",
  type: "internship",
  title: "Test Internship",
  shortDescription: "Desc",
  skills: ["Python"],
  tags: [],
  isPanIndia: false,
  eligibleBranches: [],
  eligibleYears: [],
  isFree: true,
  source: "manual",
  sourceUrl: "https://example.com/x",
  applyUrl: "https://example.com/apply",
  viewCount: 0,
  bookmarkCount: 0,
  applyCount: 0,
  relevanceScore: 10,
  isActive: true,
  isVerified: true,
  isFeatured: false,
};

describe("OpportunityCard", () => {
  it("renders title and fires bookmark callback", () => {
    const onBookmark = vi.fn();
    render(
      <MemoryRouter>
        <OpportunityCard opportunity={{ ...base, isBookmarked: false }} onBookmarkToggle={onBookmark} />
      </MemoryRouter>
    );
    expect(screen.getByText("Test Internship")).toBeInTheDocument();
    const bookmarkBtn = document.querySelector("button svg.lucide-bookmark")?.closest("button");
    expect(bookmarkBtn).toBeTruthy();
    fireEvent.click(bookmarkBtn!);
    expect(onBookmark).toHaveBeenCalledWith("o1");
  });

  it("shows match ribbon when personalized score is high", () => {
    render(
      <MemoryRouter>
        <OpportunityCard opportunity={{ ...base, personalizedScore: 80 }} />
      </MemoryRouter>
    );
    expect(screen.getByText(/80%/)).toBeInTheDocument();
  });

  it("truncates long skill lists", () => {
    const skills = ["a", "b", "c", "d", "e"].map((x) => x.toUpperCase());
    render(
      <MemoryRouter>
        <OpportunityCard opportunity={{ ...base, skills }} />
      </MemoryRouter>
    );
    expect(screen.getByText(/\+2 more/i)).toBeInTheDocument();
  });
});
