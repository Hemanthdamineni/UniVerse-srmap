/**
 * LmsHomePage.test.tsx -- Comprehensive Vitest tests for LmsHomePage.
 *
 * Mocks only the API layer (lib/lms/index) and the analytics module,
 * letting all UI components render for real so the test exercises the
 * full component tree.
 *
 * Tests cover:
 *   - Loading state (deferred API promise -> loading overlay)
 *   - Error state (API rejection -> InlineError)
 *   - Full data render (all sections present with correct data)
 *   - Empty / null data (hidden sections, placeholders)
 *   - Analytics tracking (fires on populated data, not on empty)
 *   - Continue Learning visibility
 *   - Roadmap navigation link hrefs and empty placeholder
 *   - Weekly leaderboard hidden when items are empty
 */

import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { QueryClientProvider } from "@tanstack/react-query";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { createTestQueryClient } from "../../test/testUtils";

// Polyfill ResizeObserver for jsdom (used by usePageContrast inside ErpPageShell)
if (typeof ResizeObserver === "undefined") {
  class ResizeObserverStub {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
  Object.defineProperty(globalThis, "ResizeObserver", {
    value: ResizeObserverStub,
    writable: true,
    configurable: true,
  });
}

// ---------------------------------------------------------------------------
// Module mocks -- API layer only
// ---------------------------------------------------------------------------

vi.mock("../../lib/lms/index", () => ({
  getRecommendations: vi.fn(),
  getExamPrepRecommendations: vi.fn(),
  getRoadmapRecommendations: vi.fn(),
  getContinueLearning: vi.fn(),
  getRevisionQueue: vi.fn(),
  getPendingExamFeedback: vi.fn(),
  listLmsRequests: vi.fn(),
  getWeeklyLeaderboard: vi.fn(),
  getLmsStreak: vi.fn(),
}));

vi.mock("../../lib/core/analytics", () => ({
  track: vi.fn(),
}));

// ---------------------------------------------------------------------------
// Imports (after mocks)
// ---------------------------------------------------------------------------

import * as lmsApi from "../../lib/lms/index";
import { track } from "../../lib/core/analytics";
import { LmsHomePage } from "./LmsHomePage";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const mockResource = {
  id: "res-1",
  type: "note" as const,
  title: "Database indexing guide",
  description: "Practical notes for query planning.",
  semester: "6",
  subjectCode: "CSE301",
  subjectName: "Database Systems",
  unit: "Query Optimization",
  unitNormalized: "query-optimization",
  tags: ["indexes"],
  uploadedBy: "AP23110010234",
  uploadedAt: "2026-05-23T08:10:00.000Z",
  viewCount: 100,
  upvotes: 20,
  bookmarkCount: 9,
  commentCount: 3,
  qualityScore: 8,
  effectivenessScore: 2,
  examProvenScore: 1,
  publisher: {
    userId: "AP23110010234",
    displayName: "AP23110010234",
    contributionCount: 8,
    approvedCount: 7,
    flaggedCount: 1,
    hiddenCount: 0,
    qualityAverage: 7.8,
    upvoteTotal: 40,
    trustScore: 88,
  },
  moderation: {
    state: 0,
    label: "Clear",
    flagCount: 0,
    publicEligible: true,
    searchEligible: true,
    recommendationEligible: true,
    needsReview: false,
  },
  reasons: [],
};

const mockResource2 = {
  ...mockResource,
  id: "res-2",
  title: "Database Systems PYQ 2025",
  type: "pyq" as const,
  description: "Previous year question paper.",
  unit: "All Units",
  unitNormalized: "all-units",
  tags: ["pyq", "database"],
  viewCount: 50,
  upvotes: 10,
  bookmarkCount: 5,
  commentCount: 1,
  qualityScore: 7,
  effectivenessScore: 3,
  examProvenScore: 4,
};

const mockRoadmap = {
  id: "roadmap-1",
  title: "Full Stack Developer",
  skill: "Web Development",
  authorId: "user-1",
  viewCount: 0,
  upvotes: 0,
  qualityScore: 0,
  published: 1,
  nodes: [],
  edges: [],
  estimatedHours: 120,
  confidence: 0.85,
  reasons: [
    { code: "careerGap", label: "Fills your career gap identified", weight: 1 },
  ],
};

const mockRoadmap2 = {
  id: "roadmap-2",
  title: "Data Science Foundations",
  skill: "Data Science",
  authorId: "user-2",
  viewCount: 0,
  upvotes: 0,
  qualityScore: 0,
  published: 1,
  nodes: [],
  edges: [],
  estimatedHours: 80,
  confidence: 0.72,
  reasons: [
    { code: "skillsGap", label: "Strengthens a skill gap in your profile", weight: 0.9 },
  ],
};

const mockRequest = {
  id: "req-1",
  userId: "user-1",
  subjectCode: "CSE301",
  subjectName: "Database Systems",
  semester: "6",
  title: "Need more resources on query optimization",
  status: "open" as const,
  upvotes: 3,
  createdAt: "2026-06-01T10:00:00.000Z",
};

const mockContinueResource = {
  ...mockResource,
  id: "res-continue",
  title: "Continue where you left off",
  description: "Resume your learning session.",
};

const mockExamPrepResource = {
  ...mockResource,
  id: "res-exam-prep",
  title: "Exam Prep Notes",
  type: "pyq" as const,
  description: "Exam preparation material.",
  unit: "All Units",
  unitNormalized: "all-units",
  tags: ["pyq", "database"],
  viewCount: 50,
  upvotes: 10,
  bookmarkCount: 5,
  commentCount: 1,
  qualityScore: 7,
  effectivenessScore: 3,
  examProvenScore: 4,
};

const mockStreak = { currentStreak: 5, longestStreak: 12 };
const mockLeaderboardItem = { userId: "user-1", score: 250 };

// ---------------------------------------------------------------------------
// Helper
// ---------------------------------------------------------------------------

function renderPage() {
  const queryClient = createTestQueryClient();
  const view = render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <LmsHomePage />
      </MemoryRouter>
    </QueryClientProvider>
  );
  // Tests that assert settled content can await this instead of racing
  // individual elements across React Query's notification batches.
  return { ...view, queryClient };
}

async function waitForSettledQueries(queryClient: ReturnType<typeof createTestQueryClient>) {
  await waitFor(() => {
    expect(queryClient.isFetching()).toBe(0);
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("LmsHomePage", () => {
  beforeEach(() => {
    // Manual mock reset (clearAllMocks can interfere with module-level mocks).
    lmsApi.getRecommendations.mockClear().mockResolvedValue([]);
    lmsApi.getExamPrepRecommendations.mockClear().mockResolvedValue([]);
    lmsApi.getRoadmapRecommendations.mockClear().mockResolvedValue([]);
    lmsApi.getContinueLearning.mockClear().mockResolvedValue(null);
    lmsApi.getRevisionQueue.mockClear().mockResolvedValue([]);
    lmsApi.getPendingExamFeedback.mockClear().mockResolvedValue([]);
    lmsApi.listLmsRequests.mockClear().mockResolvedValue({
      items: [],
      pagination: { page: 1, limit: 5, total: 0 },
    });
    lmsApi.getWeeklyLeaderboard.mockClear().mockResolvedValue([]);
    lmsApi.getLmsStreak.mockClear().mockResolvedValue(mockStreak);
    track.mockClear();
  });

  // -----------------------------------------------------------------------
  // Loading
  // -----------------------------------------------------------------------

  it("renders the loading overlay while APIs are pending", async () => {
    let resolveRecommendations!: (value: unknown) => void;
    const deferred = new Promise((r) => {
      resolveRecommendations = r;
    });
    lmsApi.getRecommendations.mockReturnValue(deferred);

    renderPage();

    // ErpPageShell shows a PageLoadingOverlay with the loadingMessage text
    expect(screen.getByText("Loading LMS Home...")).toBeInTheDocument();

    // Resolve so the test can complete cleanly
    resolveRecommendations([]);
    await waitFor(() => {
      expect(
        screen.getByRole("heading", { name: "Momentum" })
      ).toBeInTheDocument();
    });
  });

  // -----------------------------------------------------------------------
  // Error
  // -----------------------------------------------------------------------

  it("renders an InlineError when a data-fetching API rejects", async () => {
    lmsApi.getRecommendations.mockRejectedValue(
      new Error("Failed to fetch recommendations")
    );

    renderPage();

    await waitFor(() => {
      expect(screen.getByText("Could not load LMS Home")).toBeInTheDocument();
    });

    expect(screen.getByText("Failed to fetch recommendations")).toBeInTheDocument();
    expect(
      screen.getByText(
        "Your ERP session may have expired, or the LMS service may be temporarily unavailable."
      )
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /Back to LMS home/i })
    ).toHaveAttribute("href", "/resources");
  });

  // -----------------------------------------------------------------------
  // Full happy-path render
  // -----------------------------------------------------------------------

  it("renders every content section with the correct data", async () => {
    lmsApi.getRecommendations.mockResolvedValue([mockResource, mockResource2]);
    lmsApi.getExamPrepRecommendations.mockResolvedValue([mockExamPrepResource]);
    lmsApi.getRoadmapRecommendations.mockResolvedValue([mockRoadmap, mockRoadmap2]);
    lmsApi.getContinueLearning.mockResolvedValue(mockContinueResource);
    lmsApi.getRevisionQueue.mockResolvedValue([{ id: "rev-1" }]);
    lmsApi.getPendingExamFeedback.mockResolvedValue([{ id: "fb-1" }]);
    lmsApi.listLmsRequests.mockResolvedValue({
      items: [mockRequest],
      pagination: { page: 1, limit: 5, total: 1 },
    });
    lmsApi.getWeeklyLeaderboard.mockResolvedValue([mockLeaderboardItem]);

    const { queryClient } = renderPage();

    await waitForSettledQueries(queryClient);

    expect(screen.getByRole("heading", { name: "Momentum" })).toBeInTheDocument();

    // -- Momentum StatCards --
    expect(screen.getByText("Current streak")).toBeInTheDocument();
    expect(screen.getByText(String(mockStreak.currentStreak))).toBeInTheDocument();
    expect(screen.getByText("Revision due")).toBeInTheDocument();
    // Two StatCards show "1" (revision + feedback); check they are there
    const statCards = screen.getAllByRole("heading", { level: 4 });
    const revisionCard = statCards.find((card) => card.textContent === "Revision due");
    expect(revisionCard).toBeInTheDocument();
    const feedbackCard = statCards.find((card) => card.textContent === "Exam feedback pending");
    expect(feedbackCard).toBeInTheDocument();
    expect(screen.getByText("Exam feedback pending")).toBeInTheDocument();

    // -- Continue Learning --
    expect(
      screen.getByRole("heading", { name: "Continue Learning" })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /Continue where you left off/ })
    ).toHaveAttribute("href", "/resources/res-continue");

    // -- Exam prep --
    expect(screen.getByRole("heading", { name: "Exam prep" })).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /Exam Prep Notes/ })
    ).toBeInTheDocument();

    // -- Recommended Roadmaps --
    expect(
      screen.getByRole("heading", { name: "Recommended Roadmaps" })
    ).toBeInTheDocument();

    // Roadmap card links
    const roadmapLink1 = screen.getByRole("link", { name: /Full Stack Developer/ });
    expect(roadmapLink1).toHaveAttribute("href", "/resources/roadmaps/roadmap-1");

    const roadmapLink2 = screen.getByRole("link", {
      name: /Data Science Foundations/,
    });
    expect(roadmapLink2).toHaveAttribute("href", "/resources/roadmaps/roadmap-2");

    // Confidence badges
    expect(screen.getByText("85%")).toBeInTheDocument();
    expect(screen.getByText("72%")).toBeInTheDocument();

    // Reason labels
    expect(
      screen.getByText("Fills your career gap identified")
    ).toBeInTheDocument();
    expect(
      screen.getByText("Strengthens a skill gap in your profile")
    ).toBeInTheDocument();

    // -- Recommended for you --
    expect(
      screen.getByRole("heading", { name: "Recommended for you" })
    ).toBeInTheDocument();

    // -- Open Requests --
    expect(
      screen.getByRole("heading", { name: "Open Requests" })
    ).toBeInTheDocument();
    expect(
      screen.getByText("Need more resources on query optimization")
    ).toBeInTheDocument();

    // -- Weekly leaderboard --
    expect(screen.getByText(/Weekly Leaderboard/i)).toBeInTheDocument();
    expect(screen.getByText("250")).toBeInTheDocument();
  });

  // -----------------------------------------------------------------------
  // Empty / null data
  // -----------------------------------------------------------------------

  it("hides optional sections and shows placeholder text when data is empty or null", async () => {
    // All mocks return the beforeEach defaults (empty arrays / null)
    const { queryClient } = renderPage();

    await waitForSettledQueries(queryClient);

    expect(
      screen.getByRole("heading", { name: "Momentum" })
    ).toBeInTheDocument();

    // Continue Learning is hidden when data is null
    expect(
      screen.queryByRole("heading", { name: "Continue Learning" })
    ).not.toBeInTheDocument();

    // Roadmap section shows the descriptive placeholder
    expect(
      screen.getByText(
        "Roadmap recommendations appear as you build learning history across subjects."
      )
    ).toBeInTheDocument();

    // Open Requests heading still renders (the SectionCard wrapper) but no
    // RequestCard children appear when the items array is empty
    expect(
      screen.getByRole("heading", { name: "Open Requests" })
    ).toBeInTheDocument();

    // Weekly leaderboard is hidden for empty items
    expect(screen.queryByText(/Weekly Leaderboard/i)).not.toBeInTheDocument();

    // Recommendation sections render "0 items" + "No resources found."
    expect(screen.getByText("No exam prep yet")).toBeInTheDocument();
    

    // The stat cards fall back to "0" for empty revision/feedback but still
    // show the streak value from the mock
    expect(screen.getByText(String(mockStreak.currentStreak))).toBeInTheDocument();
  });

  // -----------------------------------------------------------------------
  // Analytics tracking
  // -----------------------------------------------------------------------

  it("calls track when exam prep recommendations arrive", async () => {
    lmsApi.getExamPrepRecommendations.mockResolvedValue([mockResource]);

    renderPage();

    // Wait for the section that depends on exam prep data to render
    await waitFor(() => {
      expect(screen.getByText(mockResource.title)).toBeInTheDocument();
    });

    expect(track).toHaveBeenCalledWith(
      "lms_exam_prep_recommendations_viewed",
      expect.objectContaining({ count: 1, topResourceId: "res-1" })
    );
  });

  it("calls track when roadmap recommendations arrive", async () => {
    lmsApi.getRoadmapRecommendations.mockResolvedValue([mockRoadmap]);

    renderPage();

    // Wait for the roadmap confidence badge (85%) to render,
    // which depends on roadmap data being loaded
    await waitFor(() => {
      expect(screen.getByText("85%")).toBeInTheDocument();
    });

    expect(track).toHaveBeenCalledWith(
      "lms_roadmap_recommendations_viewed",
      expect.objectContaining({ count: 1, topRoadmapId: "roadmap-1" })
    );
  });

  it("does not call track when data is empty", async () => {
    // beforeEach defaults -- all data is empty/null
    renderPage();

    await waitFor(() => {
      expect(
        screen.getByRole("heading", { name: "Momentum" })
      ).toBeInTheDocument();
    });

    expect(track).not.toHaveBeenCalled();
  });

  // -----------------------------------------------------------------------
  // Continue Learning conditional rendering
  // -----------------------------------------------------------------------

  it("hides Continue Learning when getContinueLearning returns null", async () => {
    // beforeEach already resolves with null
    renderPage();

    await waitFor(() => {
      expect(
        screen.getByRole("heading", { name: "Momentum" })
      ).toBeInTheDocument();
    });

    expect(
      screen.queryByRole("heading", { name: "Continue Learning" })
    ).not.toBeInTheDocument();
  });

  it("shows Continue Learning when getContinueLearning returns a resource", async () => {
    lmsApi.getContinueLearning.mockResolvedValue(mockResource);

    renderPage();

    await waitFor(() => {
      expect(
        screen.getByRole("heading", { name: "Continue Learning" })
      ).toBeInTheDocument();
    });

    expect(
      screen.getByRole("link", { name: /Database indexing guide/ })
    ).toHaveAttribute("href", "/resources/res-1");
  });

  // -----------------------------------------------------------------------
  // Roadmap navigation
  // -----------------------------------------------------------------------

  it("renders roadmap cards as links pointing to /resources/roadmaps/:id", async () => {
    lmsApi.getRoadmapRecommendations.mockResolvedValue([mockRoadmap, mockRoadmap2]);

    renderPage();

    await waitFor(() => {
      expect(
        screen.getByRole("link", { name: /Full Stack Developer/ })
      ).toBeInTheDocument();
    });

    expect(
      screen.getByRole("link", { name: /Full Stack Developer/ })
    ).toHaveAttribute("href", "/resources/roadmaps/roadmap-1");

    expect(
      screen.getByRole("link", { name: /Data Science Foundations/ })
    ).toHaveAttribute("href", "/resources/roadmaps/roadmap-2");
  });

  // -----------------------------------------------------------------------
  // Roadmap empty placeholder
  // -----------------------------------------------------------------------

  it("shows the empty-state paragraph when roadmaps are unavailable", async () => {
    // beforeEach default: empty array
    renderPage();

    await waitFor(() => {
      expect(
        screen.getByText(
          "Roadmap recommendations appear as you build learning history across subjects."
        )
      ).toBeInTheDocument();
    });
  });

  // -----------------------------------------------------------------------
  // Leaderboard conditional rendering
  // -----------------------------------------------------------------------

  it("hides the Weekly leaderboard when the leaderboard API returns an empty array", async () => {
    renderPage();

    await waitFor(() => {
      expect(
        screen.getByRole("heading", { name: "Momentum" })
      ).toBeInTheDocument();
    });

    expect(screen.queryByText("Weekly leaderboard")).not.toBeInTheDocument();
  });

  // -----------------------------------------------------------------------
  // API contract: each function is called with expected arguments
  // -----------------------------------------------------------------------

  it("calls each API function with the expected parameters", async () => {
    renderPage();

    await waitFor(() => {
      expect(
        screen.getByRole("heading", { name: "Momentum" })
      ).toBeInTheDocument();
    });

    expect(lmsApi.getRecommendations).toHaveBeenCalledWith({ limit: 6 });
    expect(lmsApi.getExamPrepRecommendations).toHaveBeenCalledWith({ limit: 6 });
    expect(lmsApi.getRoadmapRecommendations).toHaveBeenCalledWith({ limit: 4 });
    expect(lmsApi.getContinueLearning).toHaveBeenCalledWith();
    expect(lmsApi.getRevisionQueue).toHaveBeenCalledWith();
    expect(lmsApi.getPendingExamFeedback).toHaveBeenCalledWith();
    expect(lmsApi.listLmsRequests).toHaveBeenCalledWith({
      status: "open",
      limit: 5,
    });
    expect(lmsApi.getWeeklyLeaderboard).toHaveBeenCalledWith();
    expect(lmsApi.getLmsStreak).toHaveBeenCalledWith();
  });
});
