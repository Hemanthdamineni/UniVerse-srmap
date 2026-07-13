import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import LmsHomePage from "./LmsHomePage";

const lmsMocks = vi.hoisted(() => ({
  getRecommendations: vi.fn(),
  getExamPrepRecommendations: vi.fn(),
  getRoadmapRecommendations: vi.fn(),
  getContinueLearning: vi.fn(),
  getRevisionQueue: vi.fn(),
  getPendingExamFeedback: vi.fn(),
  listLmsRequests: vi.fn(),
  getWeeklyLeaderboard: vi.fn(),
  getLmsStreak: vi.fn(),
  track: vi.fn(),
}));

vi.mock("./_shared/LmsPageShared", async () => {
  const React = await vi.importActual<typeof import("react")>("react");
  const unusedAsync = vi.fn(() => Promise.resolve(null));
  const unusedSync = vi.fn();

  function useAsyncPage<T>(loader: () => Promise<T>, deps: unknown[]) {
    const [data, setData] = React.useState<T | null>(null);
    const [loading, setLoading] = React.useState(true);
    const [error, setError] = React.useState<string | null>(null);

    React.useEffect(() => {
      let active = true;
      setLoading(true);
      setError(null);
      loader()
        .then((value) => {
          if (active) setData(value);
        })
        .catch((err) => {
          if (active) setError(err instanceof Error ? err.message : "Request failed");
        })
        .finally(() => {
          if (active) setLoading(false);
        });
      return () => {
        active = false;
      };
    }, deps);

    return { data, setData, loading, error };
  }

  return {
    useEffect: React.useEffect,
    useMemo: React.useMemo,
    useState: React.useState,
    Link: ({ to, children, ...props }: { to: string; children: React.ReactNode }) =>
      React.createElement("a", { href: to, ...props }, children),
    useNavigate: () => vi.fn(),
    useParams: () => ({}),
    useSearchParams: () => [new URLSearchParams(), vi.fn()],
    SectionCard: ({ title, children }: { title: string; children: React.ReactNode }) =>
      React.createElement("section", null, React.createElement("h2", null, title), children),
    InlineError: ({ message }: { message: string }) => React.createElement("p", null, message),
    StatCard: ({ label, value }: { label: string; value: string }) =>
      React.createElement("div", null, `${label}: ${value}`),
    AnnotationPanel: () => null,
    DuplicateWarning: () => null,
    ExamFeedbackCard: () => null,
    InteractiveFlashcardDeck: () => null,
    GuideSection: () => null,
    OutdatedWarning: () => null,
    QuizRunner: () => null,
    RecommendationSection: ({ title, items }: { title: string; items: Array<{ title?: string }> }) =>
      React.createElement(
        "section",
        null,
        React.createElement("h2", null, title),
        items.map((item, index) => React.createElement("p", { key: index }, item.title))
      ),
    RequestCard: ({ request }: { request: { title?: string } }) => React.createElement("p", null, request.title),
    ResourceFilterPanel: () => null,
    ResourceGrid: ({ items }: { items: Array<{ title?: string }> }) =>
      React.createElement("div", null, items.map((item, index) => React.createElement("p", { key: index }, item.title))),
    RoadmapGraph: () => null,
    TopicMasteryHeatmap: () => null,
    WeeklyLeaderboard: () => null,
    addRoadmapNode: unusedAsync,
    buildQuizFromQuestionBank: unusedSync,
    checkLmsDuplicate: unusedAsync,
    completeRoadmapNode: unusedAsync,
    createGuide: unusedAsync,
    createLmsCollection: unusedAsync,
    createLmsRequest: unusedAsync,
    createLmsResource: unusedAsync,
    deleteGuide: unusedAsync,
    deleteLmsResource: unusedAsync,
    createQuestionBankItem: unusedAsync,
    createRoadmap: unusedAsync,
    deleteLmsAnnotation: unusedAsync,
    deleteRoadmap: unusedAsync,
    flagLmsResource: unusedAsync,
    generateLearningSession: unusedAsync,
    getContinueLearning: lmsMocks.getContinueLearning,
    getContributorProfile: unusedAsync,
    getExamPrepRecommendations: lmsMocks.getExamPrepRecommendations,
    getExploreData: unusedAsync,
    getGuide: unusedAsync,
    getLmsAnnotations: unusedAsync,
    getLmsMastery: unusedAsync,
    getLmsProgress: unusedAsync,
    getLmsResource: unusedAsync,
    getLmsStreak: lmsMocks.getLmsStreak,
    getMyBookmarks: unusedAsync,
    getMyContributions: unusedAsync,
    getPendingExamFeedback: lmsMocks.getPendingExamFeedback,
    getPyqBank: unusedAsync,
    getRecommendations: lmsMocks.getRecommendations,
    getRevisionQueue: lmsMocks.getRevisionQueue,
    getRoadmap: unusedAsync,
    getRoadmapRecommendations: lmsMocks.getRoadmapRecommendations,
    getSubjectOverview: unusedAsync,
    getWeeklyLeaderboard: lmsMocks.getWeeklyLeaderboard,
    listGuides: unusedAsync,
    listLmsCollections: unusedAsync,
    listLmsRequests: lmsMocks.listLmsRequests,
    listLmsResources: unusedAsync,
    listQuestionBank: unusedAsync,
    listRoadmaps: unusedAsync,
    markGuideSectionRead: unusedAsync,
    markLmsResourceOutdated: unusedAsync,
    postLmsComment: unusedAsync,
    rateLmsResource: unusedAsync,
    recordLmsResourceView: unusedAsync,
    saveLmsAnnotation: unusedAsync,
    submitExamFeedback: unusedAsync,
    submitQuizAttempt: unusedAsync,
    submitRevisionReview: unusedAsync,
    toggleGuideUpvote: unusedAsync,
    toggleResourceBookmark: unusedAsync,
    toggleResourceUpvote: unusedAsync,
    updateGuide: unusedAsync,
    updateLmsResource: unusedAsync,
    upvoteLmsRequest: unusedAsync,
    upvoteQuestionBankItem: unusedAsync,
    useSession: () => ({ profile: null, loading: false }),
    isProfileAdmin: () => false,
    getProfileRegisterNo: () => "",
    createEmptyResourceForm: unusedSync,
    resourceToForm: unusedSync,
    buildResourcePayload: unusedSync,
    useAsyncPage,
    LmsFrame: ({ title, children, error }: { title: string; children: React.ReactNode; error?: string | null }) =>
      React.createElement("main", null, React.createElement("h1", null, title), error ? React.createElement("p", null, error) : null, children),
    renderResourceBody: unusedSync,
  };
});

vi.mock("../../lib/core/analytics", () => ({
  track: lmsMocks.track,
}));

describe("LmsHomePage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    lmsMocks.getRecommendations.mockResolvedValue([]);
    lmsMocks.getExamPrepRecommendations.mockResolvedValue([]);
    lmsMocks.getRoadmapRecommendations.mockResolvedValue([
      {
        id: "roadmap-sql",
        title: "SQL Interview Readiness",
        skill: "SQL",
        estimatedHours: 6,
        confidence: 0.91,
        reasons: [{ code: "skillGapMatch", label: "Targets a career skill gap", weight: 1 }],
      },
    ]);
    lmsMocks.getContinueLearning.mockResolvedValue(null);
    lmsMocks.getRevisionQueue.mockResolvedValue([]);
    lmsMocks.getPendingExamFeedback.mockResolvedValue([]);
    lmsMocks.listLmsRequests.mockResolvedValue({ items: [] });
    lmsMocks.getWeeklyLeaderboard.mockResolvedValue([]);
    lmsMocks.getLmsStreak.mockResolvedValue({ currentStreak: 0 });
  });

  it("surfaces career and competition roadmap recommendations", async () => {
    render(<LmsHomePage />);

    expect(await screen.findByText("Career and Competition Roadmaps")).toBeInTheDocument();
    expect(await screen.findByText("SQL Interview Readiness")).toBeInTheDocument();
    expect(screen.getByText("Targets a career skill gap")).toBeInTheDocument();
    expect(screen.getByText("91%")).toBeInTheDocument();

    await waitFor(() => expect(lmsMocks.getRoadmapRecommendations).toHaveBeenCalledWith({ limit: 4 }));
    await waitFor(() =>
      expect(lmsMocks.track).toHaveBeenCalledWith("lms_roadmap_recommendations_viewed", {
        count: 1,
        topRoadmapId: "roadmap-sql",
      })
    );
  });
});
