import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import SubmitOpportunityPage from "./SubmitOpportunityPage";

vi.mock("../../lib/careerApi", () => ({
  submitOpportunity: vi.fn(() => Promise.resolve({ id: "s1", status: "pending" })),
  listMyOpportunitySubmissions: vi.fn(() =>
    Promise.resolve({
      items: [
        {
          id: "sub-rejected",
          title: "Unverified Internship",
          status: "rejected",
          reviewReason: "Company posting could not be verified.",
          submittedBy: "student-1",
          type: "internship",
          skills: [],
          tags: [],
          eligibleBranches: [],
          eligibleYears: [],
          applyUrl: "https://example.com/unverified",
          createdAt: "2026-05-25T10:00:00.000Z",
        },
      ],
    })
  ),
}));

describe("SubmitOpportunityPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("submits valid form and shows success state", async () => {
    const user = userEvent.setup();
    const { submitOpportunity } = await import("../../lib/careerApi");
    render(
      <MemoryRouter>
        <SubmitOpportunityPage />
      </MemoryRouter>
    );
    expect(await screen.findByText("Your Submission Status")).toBeInTheDocument();
    expect(screen.getByText("Review reason: Company posting could not be verified.")).toBeInTheDocument();
    await user.type(
      screen.getByPlaceholderText(/Software Engineering Intern/i),
      "Summer Research Internship"
    );
    await user.type(screen.getByPlaceholderText("https://..."), "https://example.com/apply-here");
    await user.click(screen.getByRole("button", { name: /Submit Opportunity/i }));
    await waitFor(() => {
      expect(submitOpportunity).toHaveBeenCalled();
    });
    await waitFor(() => {
      expect(screen.getByText(/Successfully Submitted/i)).toBeInTheDocument();
    });
    expect(screen.getByText(/will stay out of the public feed until admin approval/i)).toBeInTheDocument();
  });
});
