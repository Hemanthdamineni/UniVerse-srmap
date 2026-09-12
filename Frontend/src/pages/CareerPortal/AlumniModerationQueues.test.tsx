import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClientProvider } from "@tanstack/react-query";
import { createTestQueryClient } from "../../test/testUtils";
import AlumniModerationQueues from "./AlumniModerationQueues";
import {
  listPendingAlumniConnectionRequests,
  listPendingAlumniNominations,
  reviewAlumniConnectionRequest,
  reviewAlumniNomination,
} from "../../lib/career/careerApi";

vi.mock("../../lib/career/careerApi", () => ({
  listPendingAlumniNominations: vi.fn(),
  listPendingAlumniConnectionRequests: vi.fn(),
  reviewAlumniNomination: vi.fn(),
  reviewAlumniConnectionRequest: vi.fn(),
}));

function renderQueues() {
  render(
    <QueryClientProvider client={createTestQueryClient()}>
      <AlumniModerationQueues adminHeaders={{ "x-admin-password": "test" }} />
    </QueryClientProvider>,
  );
}

describe("AlumniModerationQueues", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(listPendingAlumniNominations).mockResolvedValue({ items: [] } as never);
    vi.mocked(listPendingAlumniConnectionRequests).mockResolvedValue({ items: [] } as never);
  });

  it("blocks an approve without a reason, then succeeds once one is provided", async () => {
    const user = userEvent.setup();
    vi.mocked(listPendingAlumniNominations).mockResolvedValue({
      items: [{ id: "n1", name: "Priya Menon", submitterName: "Test Student", status: "pending" }],
    } as never);
    vi.mocked(reviewAlumniNomination).mockResolvedValue({ id: "n1", status: "approved" } as never);

    renderQueues();
    await screen.findByText("Priya Menon");

    await user.click(screen.getByRole("button", { name: /approve/i }));
    expect(reviewAlumniNomination).not.toHaveBeenCalled();
    expect(screen.getByText(/reason is required/i)).toBeInTheDocument();

    await user.type(screen.getByPlaceholderText(/reason for your decision/i), "Verified via LinkedIn");
    await user.click(screen.getByRole("button", { name: /approve/i }));

    await waitFor(() =>
      expect(reviewAlumniNomination).toHaveBeenCalledWith(
        "n1",
        { decision: "approve", reason: "Verified via LinkedIn" },
        { "x-admin-password": "test" },
      ),
    );
  });

  it("accepts a connection request without requiring a note", async () => {
    const user = userEvent.setup();
    vi.mocked(listPendingAlumniConnectionRequests).mockResolvedValue({
      items: [{ id: "r1", requesterName: "Asha Rao", alumniName: "Vikram Shah", alumniCompany: "Initech", message: "Would love to connect", status: "pending" }],
    } as never);
    vi.mocked(reviewAlumniConnectionRequest).mockResolvedValue({ id: "r1", status: "accepted" } as never);

    renderQueues();
    await screen.findByText(/Asha Rao/);

    await user.click(screen.getByRole("button", { name: /accept/i }));
    await waitFor(() =>
      expect(reviewAlumniConnectionRequest).toHaveBeenCalledWith(
        "r1",
        { decision: "accept", note: "" },
        { "x-admin-password": "test" },
      ),
    );
  });

  it("shows empty states when both queues are empty", async () => {
    renderQueues();
    await waitFor(() => expect(screen.getByText(/no pending alumni suggestions/i)).toBeInTheDocument());
    expect(screen.getByText(/no pending connection requests/i)).toBeInTheDocument();
  });
});
