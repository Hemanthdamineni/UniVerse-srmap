import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import ResourceGrid from "./ResourceGrid";
import type { LmsResource } from "../../lib/lms/index";

describe("ResourceGrid", () => {
  it("renders empty state with browse button when no items", () => {
    render(
      <MemoryRouter>
        <ResourceGrid items={[]} />
      </MemoryRouter>
    );

    expect(screen.getByText("No saved resources yet")).toBeInTheDocument();
    expect(screen.getByText("Start building your personal library by bookmarking notes, PYQs, guides, and more from across the platform.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Browse Resources" })).toBeInTheDocument();
  });

  it("renders resource cards when items exist", () => {
    const items: LmsResource[] = [{
      id: "1",
      title: "Test Resource",
      description: "Test",
      type: "note",
      subjectCode: "CS101",
      subjectName: "Test Subject",
      semester: "1",
      difficulty: "easy",
      tags: [],
      uploadedAt: new Date().toISOString(),
      uploadedBy: "user1",
      viewCount: 0,
      upvotes: 0,
      bookmarkCount: 0,
      commentCount: 0,
      qualityScore: 0,
      effectivenessScore: 0,
      examProvenScore: 0,
      unit: "",
      unitNormalized: "",
    }];
    render(
      <MemoryRouter>
        <ResourceGrid items={items} />
      </MemoryRouter>
    );
    expect(screen.getByText("Test Resource")).toBeInTheDocument();
  });
});