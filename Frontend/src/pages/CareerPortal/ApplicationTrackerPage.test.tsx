import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import ApplicationTrackerPage from "./ApplicationTrackerPage";

const listApplications = vi.fn();
const updateApplication = vi.fn(() => Promise.resolve({ updated: true }));
const deleteApplication = vi.fn(() => Promise.resolve({ deleted: true }));

vi.mock("../../lib/careerApi", () => ({
  get listApplications() {
    return listApplications;
  },
  get updateApplication() {
    return updateApplication;
  },
  get deleteApplication() {
    return deleteApplication;
  },
}));

describe("ApplicationTrackerPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    listApplications.mockResolvedValue({
      items: [
        {
          id: "app1",
          opportunityId: "o1",
          userId: "u1",
          status: "applied",
          appliedAt: "2026-01-01",
          opportunityTitle: "Role",
          company: "Company",
          type: "job",
        },
        {
          id: "app2",
          opportunityId: "o2",
          userId: "u1",
          status: "shortlisted",
          appliedAt: "2026-02-15",
          opportunityTitle: "Internship Role",
          company: "Another Co",
          type: "internship",
        },
      ],
    });
    vi.spyOn(window, "confirm").mockReturnValue(true);
  });

  it("loads applications and renders them in the correct kanban columns", async () => {
    render(
      <MemoryRouter>
        <ApplicationTrackerPage />
      </MemoryRouter>
    );
    await waitFor(() => expect(screen.getByText("Role")).toBeTruthy());
    expect(screen.getByText("Internship Role")).toBeTruthy();

    // Column headers should be present
    expect(screen.getByText("Applied")).toBeTruthy();
    expect(screen.getByText("Shortlisted")).toBeTruthy();

    // Analytics cards shown
    expect(screen.getByText("Total Active")).toBeTruthy();
    expect(screen.getByText("2")).toBeTruthy(); // total active count
  });

  it("deletes application when confirmed", async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <ApplicationTrackerPage />
      </MemoryRouter>
    );
    await waitFor(() => expect(screen.getByText("Role")).toBeTruthy());
    const trash = document.querySelector("svg.lucide-trash2")?.closest("button");
    expect(trash).toBeTruthy();
    await user.click(trash!);
    await waitFor(() => expect(deleteApplication).toHaveBeenCalledWith("app1"));
  });
});
