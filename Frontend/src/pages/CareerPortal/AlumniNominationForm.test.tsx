import { useState } from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClientProvider } from "@tanstack/react-query";
import { createTestQueryClient } from "../../test/testUtils";
import AlumniNominationForm from "./AlumniNominationForm";
import { listMyAlumniNominations, listSentAlumniRequests, nominateAlumnus } from "../../lib/career/careerApi";

vi.mock("../../lib/career/careerApi", () => ({
  listMyAlumniNominations: vi.fn(),
  listSentAlumniRequests: vi.fn(),
  nominateAlumnus: vi.fn(),
}));

function ControlledForm() {
  const [open, setOpen] = useState(false);
  return <AlumniNominationForm open={open} onOpenChange={setOpen} />;
}

function renderForm() {
  render(
    <QueryClientProvider client={createTestQueryClient()}>
      <ControlledForm />
    </QueryClientProvider>,
  );
}

describe("AlumniNominationForm", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(listMyAlumniNominations).mockResolvedValue({ items: [] } as never);
    vi.mocked(listSentAlumniRequests).mockResolvedValue({ items: [] } as never);
  });

  it("submits a nomination and shows it in the status list", async () => {
    const user = userEvent.setup();
    vi.mocked(nominateAlumnus).mockResolvedValue({
      id: "n1",
      status: "pending",
      name: "Priya Menon",
      submitterName: "Test Student",
    } as never);

    renderForm();
    await user.click(screen.getByRole("button", { name: /suggest an alumnus/i }));
    await user.type(screen.getByLabelText(/^Name \*/i), "Priya Menon");
    await user.type(screen.getByLabelText(/^Email/i), "priya@demo.alumni");
    await user.click(screen.getByRole("button", { name: /submit suggestion/i }));

    await waitFor(() =>
      expect(nominateAlumnus).toHaveBeenCalledWith(expect.objectContaining({ name: "Priya Menon", email: "priya@demo.alumni" })),
    );

    vi.mocked(listMyAlumniNominations).mockResolvedValue({
      items: [{ id: "n1", status: "pending", name: "Priya Menon", submitterName: "Test Student" }],
    } as never);
  });

  it("shows the reviewer's reason on a rejected suggestion", async () => {
    vi.mocked(listMyAlumniNominations).mockResolvedValue({
      items: [
        {
          id: "n1",
          status: "rejected",
          name: "Unverifiable Person",
          submitterName: "Test Student",
          reviewReason: "Could not verify identity",
        },
      ],
    } as never);

    renderForm();
    await waitFor(() => expect(screen.getByText("Unverifiable Person")).toBeInTheDocument());
    expect(screen.getByText(/Could not verify identity/)).toBeInTheDocument();
    expect(screen.getByText("rejected")).toBeInTheDocument();
  });

  it("shows connection-request status once one has been sent", async () => {
    vi.mocked(listSentAlumniRequests).mockResolvedValue({
      items: [{ id: "r1", alumniName: "Dev Patel", alumniCompany: "Umbrella", status: "accepted", reviewNote: "Introduced over email" }],
    } as never);

    renderForm();
    await waitFor(() => expect(screen.getByText("Dev Patel")).toBeInTheDocument());
    expect(screen.getByText("accepted")).toBeInTheDocument();
    expect(screen.getByText(/Introduced over email/)).toBeInTheDocument();
  });
});
