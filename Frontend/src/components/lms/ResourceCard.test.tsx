import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import ResourceCard from "./ResourceCard";
import type { LmsResource } from "../../lib/lms/index";

const resource: LmsResource = {
  id: "res-1",
  type: "note",
  title: "Database indexing guide",
  description: "Practical notes for query planning.",
  semester: "6",
  subjectCode: "CSE301",
  subjectName: "Database Systems",
  unit: "Query Optimization",
  unitNormalized: "query-optimization",
  tags: ["indexes"],
  uploadedBy: "AP23110010234",
  uploadedAt: "2026-05-23T08:10:00.000Z",
  viewCount: 100,
  upvotes: 20,
  bookmarkCount: 9,
  commentCount: 3,
  qualityScore: 8,
  effectivenessScore: 2,
  examProvenScore: 1,
  publisher: {
    userId: "AP23110010234",
    displayName: "AP23110010234",
    contributionCount: 8,
    approvedCount: 7,
    flaggedCount: 1,
    hiddenCount: 0,
    qualityAverage: 7.8,
    upvoteTotal: 40,
    trustScore: 88,
  },
  moderation: {
    state: 0,
    label: "Clear",
    flagCount: 0,
    publicEligible: true,
    searchEligible: true,
    recommendationEligible: true,
    needsReview: false,
  },
  reasons: [
    { code: "subjectMatch", label: "Matches your subject focus", weight: 1 },
    { code: "engagementScore", label: "High community engagement", weight: 0.8 },
  ],
};

describe("ResourceCard", () => {
  it("renders publisher name and recommendation reasons", () => {
    render(
      <MemoryRouter>
        <ResourceCard resource={resource} />
      </MemoryRouter>
    );

    expect(screen.getByText("AP23110010234")).toHaveAttribute("href", "/learn/contributors/AP23110010234");
    expect(screen.getByText("Matches your subject focus")).toBeInTheDocument();
    expect(screen.getByText("High community engagement")).toBeInTheDocument();
    expect(screen.queryByText(/Trust/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/approved/i)).not.toBeInTheDocument();
  });
});