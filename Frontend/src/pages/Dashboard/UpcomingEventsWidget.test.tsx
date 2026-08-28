import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import UpcomingEventsWidget from "./UpcomingEventsWidget";
import { listEvents, type EventSummary } from "../../lib/campus/campusApi";

vi.mock("../../lib/campus/campusApi", () => ({
  listEvents: vi.fn(),
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
    registeredCount: 45,
    seatsAvailable: 55,
  }),
  mockEvent({
    id: "evt-2",
    title: "Cultural Fest 2026 – Dance Competition",
    category: "Cultural",
    startAt: "2026-10-20T10:00:00.000Z",
    endAt: "2026-10-20T18:00:00.000Z",
    startDate: "2026-10-20",
    endDate: "2026-10-20",
    registrationDeadline: "2026-10-18T23:59:00.000Z",
    department: "Student Union",
    registeredCount: 20,
    seatsAvailable: 80,
  }),
  mockEvent({
    id: "evt-3",
    title: "AI Workshop – Introduction to LLMs",
    category: "Workshop",
    startAt: "2026-11-15T09:00:00.000Z",
    endAt: "2026-11-15T17:00:00.000Z",
    startDate: "2026-11-15",
    endDate: "2026-11-15",
    registrationDeadline: "2026-11-12T23:59:00.000Z",
    registeredCount: 60,
    seatsAvailable: 40,
  }),
];

function renderWidget() {
  return render(
    <MemoryRouter>
      <UpcomingEventsWidget />
    </MemoryRouter>,
  );
}

describe("UpcomingEventsWidget", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows loading skeleton while fetching", () => {
    vi.mocked(listEvents).mockReturnValue(new Promise(() => {}));
    renderWidget();
    const skeleton = document.querySelector(".skeleton-shimmer");
    expect(skeleton).toBeInTheDocument();
  });

  it("renders 3 event cards when API returns events", async () => {
    vi.mocked(listEvents).mockResolvedValue(mockEvents);
    renderWidget();

    await waitFor(() => {
      expect(screen.getByText("CodeSprint 2026")).toBeInTheDocument();
    });

    expect(screen.getByText("Cultural Fest 2026 – Dance Competition")).toBeInTheDocument();
    expect(screen.getByText("AI Workshop – Introduction to LLMs")).toBeInTheDocument();
    expect(screen.getAllByText("View").length).toBe(3);
  });

  it("shows deadline countdown chips for each event", async () => {
    vi.mocked(listEvents).mockResolvedValue(mockEvents);
    renderWidget();

    await waitFor(() => {
      const chips = screen.getAllByText(/\d+d left/);
      expect(chips).toHaveLength(3);
    });
  });

  it('shows "No deadline" when event has no deadline date', async () => {
    const eventsNoDeadline = [
      mockEvent({
        registrationDeadline: undefined,
        startAt: undefined,
      }),
    ];
    vi.mocked(listEvents).mockResolvedValue(eventsNoDeadline);
    renderWidget();

    await waitFor(() => {
      expect(screen.getByText("No deadline")).toBeInTheDocument();
    });
  });

  it("shows empty state text when API returns 0 events", async () => {
    vi.mocked(listEvents).mockResolvedValue([]);
    renderWidget();

    await waitFor(() => {
      expect(
        screen.getByText("No upcoming events right now."),
      ).toBeInTheDocument();
    });
  });

  it("shows error state and retry button when API call fails", async () => {
    vi.mocked(listEvents).mockRejectedValue(new Error("Network error"));
    renderWidget();

    await waitFor(() => {
      expect(screen.getByText("Network error")).toBeInTheDocument();
    });

    expect(screen.getByRole("button", { name: /retry/i })).toBeInTheDocument();
  });

  it('"View all events" link navigates to /events', async () => {
    vi.mocked(listEvents).mockResolvedValue(mockEvents);
    renderWidget();

    await waitFor(() => {
      expect(screen.getByText("CodeSprint 2026")).toBeInTheDocument();
    });

    const viewAllBtn = screen.getByRole("button", {
      name: /view all events/i,
    });
    expect(viewAllBtn).toBeInTheDocument();
  });

  it("each event card navigates to /events/:id on click", async () => {
    vi.mocked(listEvents).mockResolvedValue(mockEvents);
    renderWidget();

    await waitFor(() => {
      expect(screen.getByText("CodeSprint 2026")).toBeInTheDocument();
    });

    const viewButtons = screen.getAllByText("View");
    expect(viewButtons[0].closest("button")).toBeInTheDocument();
  });
});
