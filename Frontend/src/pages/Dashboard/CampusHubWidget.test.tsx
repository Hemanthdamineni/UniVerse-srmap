import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import CampusHubWidget from "./CampusHubWidget";
import { listEvents, type EventSummary } from "../../lib/campus/campusApi";

const mockNavigate = vi.fn();

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom");
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

vi.mock("../../lib/campus/campusApi", () => ({
  listEvents: vi.fn(),
}));

const mockListOpportunities = vi.fn();
const mockListApplications = vi.fn();

vi.mock("../../lib/career/careerApi", () => ({
  listOpportunities: (...args: unknown[]) => mockListOpportunities(...args),
  listApplications: (...args: unknown[]) => mockListApplications(...args),
}));

function mockEvent(overrides: Partial<EventSummary> = {}): EventSummary {
  return {
    id: "evt-default",
    title: "Test Event",
    description: "A test event",
    startAt: "2026-10-15T09:00:00.000Z",
    startDate: "2026-10-15",
    endAt: "2026-10-16T09:00:00.000Z",
    endDate: "2026-10-16",
    category: "Technical",
    department: "CS Department",
    status: "published",
    visibility: "public",
    venue: "Campus",
    registeredCount: 0,
    seatsAvailable: 100,
    ...overrides,
  };
}

const mockEvents = [
  mockEvent({
    id: "evt-1",
    title: "CodeSprint 2026",
    category: "Technical",
    registrationDeadline: "2026-10-10T23:59:00.000Z",
  }),
  mockEvent({
    id: "evt-2",
    title: "Cultural Fest 2026 – Dance Competition",
    category: "Cultural",
    registrationDeadline: "2026-10-18T23:59:00.000Z",
  }),
];

const mockOpportunities = [
  {
    id: "opp-1",
    title: "Frontend Developer Intern",
    company: "StartupX",
    type: "internship",
    deadline: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: "opp-2",
    title: "Data Analyst",
    company: "BigCo",
    type: "full-time",
    deadline: new Date(Date.now() + 12 * 24 * 60 * 60 * 1000).toISOString(),
  },
];

function renderWidget() {
  return render(
    <MemoryRouter>
      <CampusHubWidget />
    </MemoryRouter>,
  );
}

function resolveHappyApis() {
  vi.mocked(listEvents).mockResolvedValue(mockEvents);
  mockListOpportunities.mockResolvedValue({ items: mockOpportunities });
  mockListApplications.mockResolvedValue({ items: [] });
}

describe("CampusHubWidget", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders Events tab by default with event cards", async () => {
    resolveHappyApis();
    renderWidget();

    expect(screen.getAllByRole("button", { name: /events/i }).length).toBeGreaterThan(0);

    await waitFor(() => {
      expect(screen.getByText("CodeSprint 2026")).toBeInTheDocument();
    });
    expect(screen.getByText("Cultural Fest 2026 – Dance Competition")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /browse all events/i }),
    ).toBeInTheDocument();
  });

  it("fetches both events and career data on mount", async () => {
    resolveHappyApis();
    renderWidget();

    await waitFor(() => {
      expect(listEvents).toHaveBeenCalledWith({ status: "published", type: "upcoming" });
      expect(mockListOpportunities).toHaveBeenCalled();
      expect(mockListApplications).toHaveBeenCalled();
    });
  });

  it("switches to the Career tab and shows opportunities", async () => {
    resolveHappyApis();
    renderWidget();

    await waitFor(() => {
      expect(screen.getByText("CodeSprint 2026")).toBeInTheDocument();
    });

    fireEvent.click(screen.getAllByRole("button", { name: /career/i })[0]);

    await waitFor(() => {
      expect(screen.getByText("Frontend Developer Intern")).toBeInTheDocument();
    });
    expect(screen.getByText("BigCo")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /go to career portal/i }),
    ).toBeInTheDocument();
  });

  it("shows empty state for events when API returns none", async () => {
    vi.mocked(listEvents).mockResolvedValue([]);
    mockListOpportunities.mockResolvedValue({ items: [] });
    mockListApplications.mockResolvedValue({ items: [] });
    renderWidget();

    await waitFor(() => {
      expect(screen.getByText("No upcoming events right now.")).toBeInTheDocument();
    });
  });

  it("shows retry button when events fail to load", async () => {
    vi.mocked(listEvents).mockRejectedValue(new Error("Network error"));
    mockListOpportunities.mockResolvedValue({ items: [] });
    mockListApplications.mockResolvedValue({ items: [] });
    renderWidget();

    await waitFor(() => {
      expect(screen.getByText("Network error")).toBeInTheDocument();
    });
    expect(screen.getByRole("button", { name: /retry/i })).toBeInTheDocument();
  });

  it("navigates to an event on click", async () => {
    resolveHappyApis();
    renderWidget();

    await waitFor(() => {
      expect(screen.getByText("CodeSprint 2026")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText("CodeSprint 2026"));
    expect(mockNavigate).toHaveBeenCalledWith("/events/evt-1");
  });
});
