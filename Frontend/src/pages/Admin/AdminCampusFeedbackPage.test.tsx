import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { QueryClientProvider } from "@tanstack/react-query";
import { createTestQueryClient } from "../../test/testUtils";
import AdminCampusFeedbackPage from "./AdminCampusFeedbackPage";

const getAdminCampusFeedback = vi.fn();
const moderateCampusFeedback = vi.fn();

vi.mock("../../hooks/useAdminAccess", () => ({
  useAdminAccess: () => ({
    unlocked: true,
    adminHeaders: { "x-admin-password": "test-admin" },
  }),
}));

vi.mock("../../lib/campus/campusApi", () => ({
  get getAdminCampusFeedback() {
    return getAdminCampusFeedback;
  },
  get moderateCampusFeedback() {
    return moderateCampusFeedback;
  },
}));

describe("AdminCampusFeedbackPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (globalThis as any).ResizeObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    };
    getAdminCampusFeedback.mockResolvedValue({
      counts: { total: 1, pending: 1, approved: 0, rejected: 0 },
      governance: {
        label: "Unofficial campus feedback",
        owner: "Campus community feedback",
        routeNamespace: "/api/campus-feedback",
      },
      items: [
        {
          id: "cf-1",
          type: "transport",
          typeLabel: "Transport Feedback",
          targetId: "route-1",
          targetLabel: "Route 1",
          ratings: { Safety: 4 },
          comment: "Driver was careful",
          status: "pending",
          displayMode: "anonymous",
          createdAt: "2026-05-26T10:00:00.000Z",
          updatedAt: "2026-05-26T10:00:00.000Z",
          createdBy: {
            userId: "AP23110010001",
            name: "Student One",
            email: "student@example.edu",
            department: "CSE",
            displayName: "Anonymous student",
          },
          audit: [],
        },
      ],
    });
    moderateCampusFeedback.mockResolvedValue({ id: "cf-1", status: "approved" });
  });

  it("requires a reason and sends admin moderation decisions to campus feedback only", async () => {
    const user = userEvent.setup();
    render(
      <QueryClientProvider client={createTestQueryClient()}>
        <AdminCampusFeedbackPage />
      </QueryClientProvider>
    );

    expect(await screen.findByText("Route 1")).toBeInTheDocument();
    await user.type(screen.getByPlaceholderText("Moderation reason"), "Constructive and policy compliant");
    await user.click(screen.getByRole("button", { name: "Approve" }));

    await waitFor(() => expect(moderateCampusFeedback).toHaveBeenCalled());
    expect(moderateCampusFeedback).toHaveBeenCalledWith(
      "cf-1",
      { status: "approved", reason: "Constructive and policy compliant" },
      { "x-admin-password": "test-admin" }
    );
  });
});
