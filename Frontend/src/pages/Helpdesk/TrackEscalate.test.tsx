import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import TrackEscalate from "./TrackEscalate";

const adminHeaders = { "x-admin-password": "test-admin" };
const listHelpdeskTickets = vi.fn();
const updateHelpdeskTicket = vi.fn();
const replyToHelpdeskTicket = vi.fn();
const bulkUpdateHelpdeskTickets = vi.fn();
const escalateHelpdeskTicket = vi.fn();

vi.mock("../../hooks/useAdminAccess", () => ({
  useAdminAccess: () => ({
    unlocked: true,
    adminHeaders,
  }),
}));

vi.mock("../../lib/campusApi", () => ({
  get listHelpdeskTickets() {
    return listHelpdeskTickets;
  },
  get updateHelpdeskTicket() {
    return updateHelpdeskTicket;
  },
  get replyToHelpdeskTicket() {
    return replyToHelpdeskTicket;
  },
  get bulkUpdateHelpdeskTickets() {
    return bulkUpdateHelpdeskTickets;
  },
  get escalateHelpdeskTicket() {
    return escalateHelpdeskTicket;
  },
}));

describe("TrackEscalate", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (globalThis as any).ResizeObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    };
    listHelpdeskTickets.mockResolvedValue({
      counts: {
        total: 1,
        filtered: 1,
        open: 1,
        inProgress: 0,
        escalated: 0,
        resolved: 0,
        slaBreached: 1,
        queues: { new: 0, "in-progress": 0, escalated: 0, breached: 1, resolved: 0 },
      },
      workload: [{ assignedTeam: "IT Support", ownerName: "Asha Rao", open: 1, breached: 1, total: 1 }],
      items: [
        {
          id: "ticket-1",
          category: "IT Support",
          priority: "urgent",
          subject: "ERP login blocked",
          description: "The student portal fails after OTP.",
          status: "open",
          queueState: "breached",
          assignedTo: "Asha Rao",
          assignedTeam: "IT Support",
          ownerName: "Asha Rao",
          createdAt: "2026-05-25T03:00:00.000Z",
          updatedAt: "2026-05-26T03:00:00.000Z",
          slaBreached: true,
          sla: { policyHours: 4, dueAt: "2026-05-25T07:00:00.000Z", breachedAt: "2026-05-25T07:00:00.000Z" },
          replies: [],
          auditTrail: [
            {
              id: "audit-1",
              action: "created",
              fromStatus: "",
              toStatus: "open",
              note: "Ticket created",
              actorName: "Student One",
              actorRole: "student",
              createdAt: "2026-05-25T03:00:00.000Z",
            },
          ],
        },
      ],
    });
    updateHelpdeskTicket.mockResolvedValue({ id: "ticket-1" });
    replyToHelpdeskTicket.mockResolvedValue({ id: "ticket-1" });
    bulkUpdateHelpdeskTickets.mockResolvedValue({ counts: { requested: 1, updated: 1, failed: 0 } });
  });

  it("supports admin triage, required resolution summary, internal notes, and bulk action", async () => {
    const user = userEvent.setup();
    render(<TrackEscalate adminMode />);

    expect(await screen.findByText("ERP login blocked")).toBeInTheDocument();
    expect(screen.getByText("Asha Rao: 1 active, 1 breached")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^Resolve$/i })).toBeDisabled();

    await user.type(screen.getByPlaceholderText("Resolution summary"), "Reset account lock and verified login.");
    await user.click(screen.getByRole("button", { name: /^Resolve$/i }));
    await waitFor(() => expect(updateHelpdeskTicket).toHaveBeenCalled());
    expect(updateHelpdeskTicket).toHaveBeenCalledWith(
      "ticket-1",
      {
        status: "resolved",
        resolutionSummary: "Reset account lock and verified login.",
        note: "Ticket resolved with admin summary",
      },
      adminHeaders
    );

    await user.type(screen.getByPlaceholderText("Add admin reply or resolution note"), "Do not show this to student.");
    await user.click(screen.getByRole("button", { name: "Internal Note" }));
    await waitFor(() => expect(replyToHelpdeskTicket).toHaveBeenCalled());
    expect(replyToHelpdeskTicket).toHaveBeenCalledWith(
      "ticket-1",
      { message: "Do not show this to student.", visibility: "internal" },
      adminHeaders
    );

    await user.click(screen.getByLabelText("Select ticket ticket-1"));
    await user.click(screen.getByRole("button", { name: /Bulk: mark in progress/i }));
    await waitFor(() => expect(bulkUpdateHelpdeskTickets).toHaveBeenCalled());
    expect(bulkUpdateHelpdeskTickets).toHaveBeenCalledWith(
      {
        ticketIds: ["ticket-1"],
        status: "in-progress",
        note: "Bulk triage moved selected tickets to in progress",
      },
      adminHeaders
    );
  });
});
