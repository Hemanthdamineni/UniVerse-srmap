import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { QueryClientProvider } from "@tanstack/react-query";
import ApplicationTrackerPage from "./ApplicationTrackerPage";
import { createTestQueryClient } from "../../test/testUtils";

function renderTracker() {
  const queryClient = createTestQueryClient();
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <ApplicationTrackerPage />
      </MemoryRouter>
    </QueryClientProvider>
  );
}

const listApplications = vi.fn();
const updateApplication = vi.fn(() => Promise.resolve({ updated: true }));
const deleteApplication = vi.fn(() => Promise.resolve({ deleted: true }));

vi.mock("../../lib/career/careerApi", () => ({
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
  });

  it("loads applications and renders them in the correct kanban columns", async () => {
    renderTracker();
    await waitFor(() => expect(screen.getByText("Role")).toBeTruthy());
    expect(screen.getByText("Internship Role")).toBeTruthy();

    // Column headers should be present
    expect(screen.getByText("Applied")).toBeTruthy();
    expect(screen.getByText("Shortlisted")).toBeTruthy();

    // Analytics cards shown
    expect(screen.getByText("Total Active")).toBeTruthy();
    expect(screen.getByText("2")).toBeTruthy(); // total active count
  });

  it("deletes application after confirming in the removal dialog", async () => {
    const user = userEvent.setup();
    renderTracker();
    await waitFor(() => expect(screen.getByText("Role")).toBeTruthy());
    const trash = document.querySelector("svg.lucide-trash2")?.closest("button");
    expect(trash).toBeTruthy();
    await user.click(trash!);

    const dialog = await waitFor(() => {
      const el = document.querySelector('[data-slot="dialog-content"]');
      expect(el).toBeTruthy();
      return el as HTMLElement;
    });
    await user.click(within(dialog).getByRole("button", { name: "Remove" }));
    await waitFor(() => expect(deleteApplication).toHaveBeenCalledWith("app1"));
  });

  it("keeps the application when the removal dialog is dismissed", async () => {
    const user = userEvent.setup();
    renderTracker();
    await waitFor(() => expect(screen.getByText("Role")).toBeTruthy());
    const trash = document.querySelector("svg.lucide-trash2")?.closest("button");
    expect(trash).toBeTruthy();
    await user.click(trash!);

    const dialog = await waitFor(() => {
      const el = document.querySelector('[data-slot="dialog-content"]');
      expect(el).toBeTruthy();
      return el as HTMLElement;
    });
    await user.click(within(dialog).getByRole("button", { name: "Keep it" }));
    expect(deleteApplication).not.toHaveBeenCalled();
    expect(screen.getByText("Role")).toBeTruthy();
  });
});
