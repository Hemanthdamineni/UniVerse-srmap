import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import EventsFeedback from "./EventsFeedback";

const getCampusFeedbackGovernance = vi.fn();
const getCampusFeedbackOptions = vi.fn();
const getMyCampusFeedback = vi.fn();
const submitCampusFeedback = vi.fn();
const createCampusFeedbackOption = vi.fn();
const importLegacyCampusFeedback = vi.fn();

vi.mock("../../hooks/useAdminAccess", () => ({
  useAdminAccess: () => ({
    unlocked: false,
    adminHeaders: {},
  }),
}));

vi.mock("../../lib/campus/campusApi", () => ({
  get getCampusFeedbackGovernance() {
    return getCampusFeedbackGovernance;
  },
  get getCampusFeedbackOptions() {
    return getCampusFeedbackOptions;
  },
  get getMyCampusFeedback() {
    return getMyCampusFeedback;
  },
  get submitCampusFeedback() {
    return submitCampusFeedback;
  },
  get createCampusFeedbackOption() {
    return createCampusFeedbackOption;
  },
  get importLegacyCampusFeedback() {
    return importLegacyCampusFeedback;
  },
}));

const governance = {
  official: {
    label: "Official ERP feedback",
    owner: "University ERP workflow",
    routeNamespace: "/api/feedback/end-semester",
    editableThroughCampusModeration: false,
  },
  campus: {
    label: "Campus feedback",
    owner: "Campus community feedback",
    routeNamespace: "/api/campus-feedback",
  },
};

describe("CampusFeedbackPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (globalThis as any).ResizeObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    };
    getCampusFeedbackGovernance.mockResolvedValue(governance);
    getCampusFeedbackOptions.mockResolvedValue([{ id: "event-1", label: "Tech Fest", type: "events" }]);
    getMyCampusFeedback.mockResolvedValue({ items: [], governance: governance.campus });
    importLegacyCampusFeedback.mockResolvedValue({ imported: [], skipped: [], counts: { imported: 0, skipped: 0 } });
    submitCampusFeedback.mockResolvedValue({
      id: "cf-1",
      type: "events",
      typeLabel: "Events Feedback",
      targetId: "events-overall",
      targetLabel: "Campus events and activities",
      ratings: { Experience: 5 },
      comment: "Great event flow",
      status: "pending",
      displayMode: "anonymous",
      createdAt: "2026-05-26T10:00:00.000Z",
      updatedAt: "2026-05-26T10:00:00.000Z",
    });
  });

  it("submits feedback through the campus feedback API and shows moderation status", async () => {
    const user = userEvent.setup();
    render(<EventsFeedback />);

    expect(await screen.findByText("Campus feedback")).toBeInTheDocument();
    await user.click(screen.getAllByRole("radio", { name: "5 star" })[0]);
    await user.type(screen.getByLabelText("Comments"), "Great event flow");
    await user.click(screen.getByRole("button", { name: /Submit Feedback/i }));

    await waitFor(() => expect(submitCampusFeedback).toHaveBeenCalled());
    expect(submitCampusFeedback).toHaveBeenCalledWith(
      "events",
      expect.objectContaining({
        targetId: "events-overall",
        ratings: expect.objectContaining({ Experience: 5 }),
        displayMode: "anonymous",
      })
    );
    expect(await screen.findByText("pending")).toBeInTheDocument();
  });
});
