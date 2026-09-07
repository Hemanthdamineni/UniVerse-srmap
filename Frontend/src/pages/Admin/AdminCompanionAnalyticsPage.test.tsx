import { beforeEach, describe, expect, it, vi } from "vitest";
import { QueryClientProvider } from "@tanstack/react-query";
import { createTestQueryClient } from "../../test/testUtils";
import { render, screen, waitFor } from "@testing-library/react";
import AdminCompanionAnalyticsPage from "./AdminCompanionAnalyticsPage";

const getCompanionAnalyticsReport = vi.fn();

vi.mock("../../lib/career/companionAnalyticsApi", () => ({
  get getCompanionAnalyticsReport() {
    return getCompanionAnalyticsReport;
  },
}));

describe("AdminCompanionAnalyticsPage", () => {
  beforeEach(() => {
    (globalThis as any).ResizeObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    };
    vi.clearAllMocks();
    getCompanionAnalyticsReport.mockResolvedValue({
      contractVersion: "companion-analytics-report-v1",
      windowDays: 30,
      generatedAt: "2030-01-02T10:00:00.000Z",
      totals: {
        totalEvents: 4,
        activeActors: 2,
        sessions: 2,
        firstEventAt: "2030-01-01T10:00:00.000Z",
        lastEventAt: "2030-01-02T10:00:00.000Z",
      },
      recommendationCtr: {
        impressions: 2,
        clicks: 1,
        rate: 0.5,
      },
      byCategory: [
        { category: "recommendation", count: 3 },
        { category: "career", count: 1 },
      ],
      topEvents: [
        { eventName: "events_recommendations_viewed", category: "recommendation", count: 2, actors: 2 },
      ],
      funnel: [
        { eventName: "events_recommendation_clicked", count: 1 },
        { eventName: "resume_analyzed", count: 1 },
      ],
      pageViews: {
        totalViews: 42,
        distinctRoutes: 3,
        byRoute: [
          { route: "/dashboard", views: 20, actors: 2 },
          { route: "/events", views: 15, actors: 2 },
          { route: "/career/opportunities", views: 7, actors: 1 },
        ],
      },
      recent: [
        {
          id: "evt-1",
          eventName: "events_recommendation_clicked",
          category: "recommendation",
          userId: "AP23110010001",
          role: "student",
          route: "/events",
          properties: { eventId: "event-1" },
          occurredAt: "2030-01-02T10:00:00.000Z",
          receivedAt: "2030-01-02T10:00:01.000Z",
        },
      ],
    });
  });

  it("renders companion analytics report metrics and conversion evidence", async () => {
    render(
      <QueryClientProvider client={createTestQueryClient()}>
        <AdminCompanionAnalyticsPage />
      </QueryClientProvider>
    );

    await waitFor(() => expect(getCompanionAnalyticsReport).toHaveBeenCalledWith({ days: 30, limit: 12 }));
    expect((await screen.findAllByRole("heading", { name: "Companion Analytics" })).length).toBeGreaterThan(0);
    expect(screen.getByText("50%")).toBeInTheDocument();
    expect(screen.getAllByText("Events Recommendation Clicked").length).toBeGreaterThan(0);
    expect(screen.getByText("Resume Analyzed")).toBeInTheDocument();
    // "/events" now appears in both the Top Pages table and Recent Signals.
    expect(screen.getAllByText("/events").length).toBeGreaterThan(0);
    expect(screen.getByText("AP23110010001")).toBeInTheDocument();

    // Top Pages section renders the page-view breakdown.
    expect(screen.getByText("Top Pages")).toBeInTheDocument();
    expect(screen.getByText("/career/opportunities")).toBeInTheDocument();
  });
});
