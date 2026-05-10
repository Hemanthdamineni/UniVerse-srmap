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
          type: "job",
        },
      ],
    });
    vi.spyOn(window, "confirm").mockReturnValue(true);
  });

  it("loads applications and can change status", async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <ApplicationTrackerPage />
      </MemoryRouter>
    );
    await waitFor(() => expect(screen.getAllByText("Role").length).toBeGreaterThan(0));
    const select = document.querySelector("select") as HTMLSelectElement;
    expect(select).toBeTruthy();
    await user.selectOptions(select, "shortlisted");
    await waitFor(() => expect(updateApplication).toHaveBeenCalled());
  });

  it("deletes application when confirmed", async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <ApplicationTrackerPage />
      </MemoryRouter>
    );
    await waitFor(() => expect(screen.getAllByText("Role").length).toBeGreaterThan(0));
    const trash = document.querySelector("svg.lucide-trash2")?.closest("button");
    expect(trash).toBeTruthy();
    await user.click(trash!);
    await waitFor(() => expect(deleteApplication).toHaveBeenCalledWith("app1"));
  });
});
