import { describe, it, expect, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import BookmarksPage from "./BookmarksPage";

vi.mock("../../lib/career/careerApi", () => ({
  listOpportunities: vi.fn(() =>
    Promise.resolve({
      items: [
        {
          id: "b1",
          type: "job",
          title: "Saved",
          shortDescription: "x",
          skills: [],
          tags: [],
          isPanIndia: false,
          eligibleBranches: [],
          eligibleYears: [],
          isFree: true,
          source: "manual",
          sourceUrl: "https://s",
          applyUrl: "https://s",
          viewCount: 0,
          bookmarkCount: 0,
          applyCount: 0,
          relevanceScore: 1,
          isActive: true,
          isVerified: true,
          isFeatured: false,
          isBookmarked: true,
        },
      ],
    })
  ),
}));

describe("BookmarksPage", () => {
  it("lists bookmarked cards", async () => {
    render(
      <MemoryRouter>
        <BookmarksPage />
      </MemoryRouter>
    );
    await waitFor(() => expect(screen.getByText("Saved")).toBeInTheDocument());
  });
});
