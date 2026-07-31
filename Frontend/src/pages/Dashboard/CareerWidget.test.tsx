import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import CareerWidget from "./CareerWidget";

const mockNavigate = vi.fn();

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom");
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

const mockListOpportunities = vi.fn();
const mockListApplications = vi.fn();

vi.mock("../../lib/career/careerApi", () => ({
  listOpportunities: (...args: unknown[]) => mockListOpportunities(...args),
  listApplications: (...args: unknown[]) => mockListApplications(...args),
}));

function mockOpportunity(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: "opp-default",
    title: "Software Engineer Intern",
    company: "Tech Corp",
    type: "internship",
    deadline: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString(),
    ...overrides,
  };
}

function renderWidget() {
  return render(
    <MemoryRouter>
      <CareerWidget />
    </MemoryRouter>,
  );
}

describe("CareerWidget", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows loading skeleton on mount", () => {
    mockListOpportunities.mockReturnValue(new Promise(() => {}));
    mockListApplications.mockReturnValue(new Promise(() => {}));
    renderWidget();

    expect(screen.getByText("Career Portal")).toBeInTheDocument();
    expect(screen.getByText("Loading")).toBeInTheDocument();
    const skeleton = document.querySelector(".animate-pulse");
    expect(skeleton).toBeInTheDocument();
  });

  it("renders opportunities in success state", async () => {
    const opportunities = [
      mockOpportunity({ id: "opp-1", title: "Frontend Developer", company: "StartupX" }),
      mockOpportunity({ id: "opp-2", title: "Backend Engineer", company: "BigCo" }),
    ];
    mockListOpportunities.mockResolvedValue({ items: opportunities });
    mockListApplications.mockResolvedValue({ items: [] });

    renderWidget();

    await waitFor(() => {
      expect(screen.getByText("Frontend Developer")).toBeInTheDocument();
    });

    expect(screen.getByText("Backend Engineer")).toBeInTheDocument();
    expect(screen.getByText("StartupX")).toBeInTheDocument();
    expect(screen.getByText("BigCo")).toBeInTheDocument();
  });

  it("shows application count badge when applications exist", async () => {
    const opportunities = [mockOpportunity({ id: "opp-1", title: "Dev Role" })];
    mockListOpportunities.mockResolvedValue({ items: opportunities });
    mockListApplications.mockResolvedValue({ items: [{ id: "app-1" }, { id: "app-2" }] });

    renderWidget();

    await waitFor(() => {
      expect(screen.getByText("2 applications")).toBeInTheDocument();
    });
  });

  it("shows singular 'application' text for exactly 1 application", async () => {
    const opportunities = [mockOpportunity({ id: "opp-1", title: "Dev Role" })];
    mockListOpportunities.mockResolvedValue({ items: opportunities });
    mockListApplications.mockResolvedValue({ items: [{ id: "app-1" }] });

    renderWidget();

    await waitFor(() => {
      expect(screen.getByText("1 application")).toBeInTheDocument();
    });
  });

  it("does not show application count when zero applications", async () => {
    const opportunities = [mockOpportunity({ id: "opp-1", title: "Dev Role" })];
    mockListOpportunities.mockResolvedValue({ items: opportunities });
    mockListApplications.mockResolvedValue({ items: [] });

    renderWidget();

    await waitFor(() => {
      expect(screen.getByText("Dev Role")).toBeInTheDocument();
    });

    expect(screen.queryByText(/application/)).not.toBeInTheDocument();
  });

  it("shows expiring soon count with correct number", async () => {
    const opportunities = [
      mockOpportunity({ id: "opp-1", title: "Role A" }),
      mockOpportunity({ id: "opp-2", title: "Role B" }),
      mockOpportunity({ id: "opp-3", title: "Role C" }),
    ];
    mockListOpportunities.mockResolvedValue({ items: opportunities });
    mockListApplications.mockResolvedValue({ items: [] });

    renderWidget();

    await waitFor(() => {
      expect(screen.getByText("3 expiring soon")).toBeInTheDocument();
    });
  });

  it("shows deadline countdown for each opportunity", async () => {
    const opp = mockOpportunity({
      id: "opp-1",
      title: "Urgent Role",
      deadline: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(),
    });
    mockListOpportunities.mockResolvedValue({ items: [opp] });
    mockListApplications.mockResolvedValue({ items: [] });

    renderWidget();

    await waitFor(() => {
      expect(screen.getByText(/days left/)).toBeInTheDocument();
    });
  });

  it('shows "No deadline" when opportunity has no deadline', async () => {
    const opp = mockOpportunity({ id: "opp-1", title: "No Deadline Role", deadline: undefined });
    mockListOpportunities.mockResolvedValue({ items: [opp] });
    mockListApplications.mockResolvedValue({ items: [] });

    renderWidget();

    await waitFor(() => {
      expect(screen.getByText("No deadline")).toBeInTheDocument();
    });
  });

  it("shows empty state when no opportunities returned", async () => {
    mockListOpportunities.mockResolvedValue({ items: [] });
    mockListApplications.mockResolvedValue({ items: [] });

    renderWidget();

    await waitFor(() => {
      expect(screen.getByText("No urgent opportunities")).toBeInTheDocument();
    });
  });

  it("shows empty 'Go to Career Portal' button in empty state", async () => {
    mockListOpportunities.mockResolvedValue({ items: [] });
    mockListApplications.mockResolvedValue({ items: [] });

    renderWidget();

    await waitFor(() => {
      expect(screen.getAllByText("Go to Career Portal").length).toBeGreaterThanOrEqual(1);
    });
  });

  it("shows error state and retry button when API call fails", async () => {
    mockListOpportunities.mockRejectedValue(new Error("Failed to fetch opportunities"));
    mockListApplications.mockResolvedValue({ items: [] });

    renderWidget();

    await waitFor(() => {
      expect(screen.getByText("Failed to fetch opportunities")).toBeInTheDocument();
    });

    expect(screen.getByRole("button", { name: /retry/i })).toBeInTheDocument();
  });

  it("retries fetching on retry button click", async () => {
    mockListOpportunities
      .mockRejectedValueOnce(new Error("Network error"))
      .mockResolvedValueOnce({ items: [mockOpportunity({ id: "opp-1", title: "After Retry" })] });
    mockListApplications.mockResolvedValue({ items: [] });

    renderWidget();

    await waitFor(() => {
      expect(screen.getByText("Network error")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: /retry/i }));

    await waitFor(() => {
      expect(screen.getByText("After Retry")).toBeInTheDocument();
    });
  });

  it("navigates to /career when 'Go to Career Portal' is clicked", async () => {
    mockListOpportunities.mockResolvedValue({ items: [mockOpportunity({ id: "opp-1", title: "Some Role" })] });
    mockListApplications.mockResolvedValue({ items: [] });

    renderWidget();

    await waitFor(() => {
      expect(screen.getByText("Some Role")).toBeInTheDocument();
    });

    const buttons = screen.getAllByText("Go to Career Portal");
    fireEvent.click(buttons[0]);
    expect(mockNavigate).toHaveBeenCalledWith("/career");
  });

  it("navigates to opportunity detail when opportunity card is clicked", async () => {
    const opp = mockOpportunity({ id: "opp-42", title: "Clickable Role" });
    mockListOpportunities.mockResolvedValue({ items: [opp] });
    mockListApplications.mockResolvedValue({ items: [] });

    renderWidget();

    await waitFor(() => {
      expect(screen.getByText("Clickable Role")).toBeInTheDocument();
    });

    const card = screen.getByText("Clickable Role").closest('[role="button"]');
    if (card) {
      fireEvent.click(card);
      expect(mockNavigate).toHaveBeenCalledWith("/career/opportunities/opp-42");
    }
  });

  it("shows 'Unknown company' when company/organizer is missing", async () => {
    const opp = mockOpportunity({ id: "opp-1", title: "Mystery Role", company: undefined, organizer: undefined });
    mockListOpportunities.mockResolvedValue({ items: [opp] });
    mockListApplications.mockResolvedValue({ items: [] });

    renderWidget();

    await waitFor(() => {
      expect(screen.getByText("Unknown company")).toBeInTheDocument();
    });
  });

  it("calls listOpportunities with correct filters", async () => {
    mockListOpportunities.mockResolvedValue({ items: [] });
    mockListApplications.mockResolvedValue({ items: [] });

    renderWidget();

    await waitFor(() => {
      expect(mockListOpportunities).toHaveBeenCalledWith({
        type: "all",
        deadlineSoon: "true",
        limit: "3",
      });
    });
  });
});
