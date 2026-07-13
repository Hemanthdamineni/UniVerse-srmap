import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import EventsListingPage from "./EventsListingPage";

const eventMocks = vi.hoisted(() => ({
  listEvents: vi.fn(),
  getPlatformRecommendations: vi.fn(),
  recordPlatformRecommendationFeedback: vi.fn(),
  track: vi.fn(),
}));

vi.mock("../../lib/campus/campusApi", () => ({
  listEvents: eventMocks.listEvents,
}));

vi.mock("../../lib/career/profileApi", () => ({
  getPlatformRecommendations: eventMocks.getPlatformRecommendations,
  recordPlatformRecommendationFeedback: eventMocks.recordPlatformRecommendationFeedback,
}));

vi.mock("../../lib/core/analytics", () => ({
  track: eventMocks.track,
}));

describe("EventsListingPage", () => {
  beforeEach(() => {
    (globalThis as any).ResizeObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    };
    vi.clearAllMocks();
    eventMocks.listEvents.mockResolvedValue([
      {
        id: "event-1",
        title: "Campus Hackathon",
        description: "Build useful campus tools.",
        startAt: "2030-07-01T09:00:00.000Z",
        endAt: "2030-07-01T18:00:00.000Z",
        startDate: "2030-07-01",
        endDate: "2030-07-01",
        category: "Technical",
        department: "Computer Science",
        status: "published",
        visibility: "public",
        location: { physical: "Innovation Lab" },
        registeredCount: 12,
        tags: ["React", "Node.js"],
        competitionConfig: { isCompetition: true, rounds: [] },
        featured: true,
      },
      {
        id: "event-2",
        title: "Open Mic Evening",
        description: "Campus cultural evening.",
        startAt: "2030-07-03T17:00:00.000Z",
        endAt: "2030-07-03T20:00:00.000Z",
        startDate: "2030-07-03",
        endDate: "2030-07-03",
        category: "Cultural",
        department: "Student Union",
        status: "published",
        visibility: "public",
        location: { physical: "Auditorium" },
        registeredCount: 4,
        tags: ["music"],
        competitionConfig: null,
        featured: false,
      },
    ]);
    eventMocks.getPlatformRecommendations.mockResolvedValue({
      contractVersion: "recommendations-v1",
      domain: "events",
      generatedAt: "2030-06-01T00:00:00.000Z",
      items: [
        {
          impressionId: "imp-event-1",
          domain: "events",
          itemType: "competition",
          itemId: "event-1",
          title: "Campus Hackathon",
          score: 0.91,
          label: "Competition match",
          reasons: ["Matches skills: React", "Builds career gaps: Node.js"],
          risks: ["Registration may be required"],
          missing: [],
          href: "/events/event-1",
          shownAt: "2030-06-01T00:00:00.000Z",
        },
      ],
    });
    eventMocks.recordPlatformRecommendationFeedback.mockResolvedValue({ recorded: true, id: "fb-1" });
  });

  it("renders personalized event recommendations and records recommendation clicks", async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <EventsListingPage />
      </MemoryRouter>
    );

    const rail = await screen.findByLabelText("Recommended events");
    expect(within(rail).getByText("Campus Hackathon")).toBeInTheDocument();
    expect(within(rail).getByText("Matches skills: React")).toBeInTheDocument();
    expect(within(rail).getByText("91%")).toBeInTheDocument();
    expect(eventMocks.getPlatformRecommendations).toHaveBeenCalledWith("events");

    await waitFor(() =>
      expect(eventMocks.track).toHaveBeenCalledWith("events_recommendations_viewed", {
        count: 1,
        topEventId: "event-1",
      })
    );

    await user.click(within(rail).getByRole("link", { name: /Campus Hackathon/i }));

    expect(eventMocks.track).toHaveBeenCalledWith("events_recommendation_clicked", {
      eventId: "event-1",
      impressionId: "imp-event-1",
      score: 0.91,
    });
    expect(eventMocks.recordPlatformRecommendationFeedback).toHaveBeenCalledWith({
      impressionId: "imp-event-1",
      action: "clicked",
      metadata: { surface: "events_listing" },
    });
  });
});
