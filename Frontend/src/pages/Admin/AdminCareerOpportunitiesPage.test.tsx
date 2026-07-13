import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import AdminCareerOpportunitiesPage from "./AdminCareerOpportunitiesPage";

const adminHeaders = { "x-admin-password": "test-admin" };
const listCareerOpportunities = vi.fn();
const listPendingSubmissions = vi.fn();
const reviewCareerSubmission = vi.fn();
const createCareerOpportunity = vi.fn();
const updateCareerOpportunity = vi.fn();
const deleteCareerOpportunity = vi.fn();

vi.mock("../../hooks/useAdminAccess", () => ({
  useAdminAccess: () => ({ unlocked: true, adminHeaders }),
}));

vi.mock("../../lib/career/careerApi", () => ({
  get listCareerOpportunities() {
    return listCareerOpportunities;
  },
  get listPendingSubmissions() {
    return listPendingSubmissions;
  },
  get reviewCareerSubmission() {
    return reviewCareerSubmission;
  },
  get createCareerOpportunity() {
    return createCareerOpportunity;
  },
  get updateCareerOpportunity() {
    return updateCareerOpportunity;
  },
  get deleteCareerOpportunity() {
    return deleteCareerOpportunity;
  },
  saveCareerOpportunity: vi.fn(() => Promise.resolve({ saved: true })),
  unsaveCareerOpportunity: vi.fn(() => Promise.resolve({ unsaved: true })),
  applyToCareerOpportunity: vi.fn(() => Promise.resolve({ applied: true })),
}));

describe("AdminCareerOpportunitiesPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (globalThis as any).ResizeObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    };
    listCareerOpportunities.mockResolvedValue({
      items: [
        {
          id: "opp-1",
          type: "internship",
          title: "Frontend Platform Internship",
          organization: "Acme Labs",
          deadline: "2030-06-30",
          description: "Build student workflows.",
          tags: ["frontend"],
          link: "https://careers.example.com/frontend-platform-internship",
          status: "active",
          featured: false,
          saved: false,
          applied: false,
        },
      ],
    });
    listPendingSubmissions.mockResolvedValue({
      items: [
        {
          id: "sub-1",
          submittedBy: "student-1",
          status: "pending",
          type: "workshop",
          title: "Cloud Platform Workshop",
          company: "Cloud Guild",
          description: "Hands-on deployment workshop.",
          skills: ["Cloud"],
          tags: ["cloud"],
          eligibleBranches: ["CSE"],
          eligibleYears: [3],
          applyUrl: "https://careers.example.com/cloud-workshop",
          createdAt: "2026-05-25T10:00:00.000Z",
          audit: [{ id: "audit-1", action: "submitted", actorId: "student-1", createdAt: "2026-05-25T10:00:00.000Z" }],
        },
      ],
    });
    reviewCareerSubmission.mockResolvedValue({ id: "sub-1", status: "approved" });
    createCareerOpportunity.mockResolvedValue({ id: "opp-new" });
    updateCareerOpportunity.mockResolvedValue({ updated: true });
    deleteCareerOpportunity.mockResolvedValue({ deleted: true });
  });

  it("renders pending submissions and requires reasoned admin decisions", async () => {
    const user = userEvent.setup();
    render(<AdminCareerOpportunitiesPage />);

    expect(await screen.findByText("Submission Review Queue")).toBeInTheDocument();
    expect(screen.getByText("Cloud Platform Workshop")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Approve" }));
    expect(await screen.findByText("Review reason is required before deciding a submission.")).toBeInTheDocument();
    expect(reviewCareerSubmission).not.toHaveBeenCalled();

    await user.type(screen.getByLabelText("Review reason for sub-1"), "Verified official workshop source.");
    await user.click(screen.getByRole("button", { name: "Approve" }));
    await waitFor(() => expect(reviewCareerSubmission).toHaveBeenCalled());
    expect(reviewCareerSubmission).toHaveBeenCalledWith(
      "sub-1",
      { decision: "approve", reason: "Verified official workshop source." },
      adminHeaders
    );
  });
});
