import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import Dashboard from "./Dashboard";

// React.lazy resolves asynchronously; mock lazy-loaded widgets as
// non-lazy so they render within the same microtask.
vi.mock("./Attendance", () => ({
  default: ({ attendanceData }: { attendanceData?: unknown }) => (
    <div data-testid="attendance-widget">Attendance Widget</div>
  ),
}));

vi.mock("./InternalMarks", () => ({
  default: ({ marksData }: { marksData?: unknown }) => (
    <div data-testid="internal-marks-widget">Internal Marks Widget</div>
  ),
}));

vi.mock("./CampusHubWidget", () => ({
  default: () => <div data-testid="campus-hub-widget">Campus Hub Widget</div>,
}));

vi.mock("../../hooks/usePageContrast", () => ({
  usePageContrast: vi.fn(),
}));

vi.mock("../../components/ui/Feedback", () => ({
  InlineError: ({ title, message }: { title: string; message: string }) => (
    <div data-testid="inline-error">
      <h3>{title}</h3>
      <p>{message}</p>
    </div>
  ),
  EmptyState: ({ title }: { title: string }) => (
    <div data-testid="empty-state">{title}</div>
  ),
}));

vi.mock("../../components/ui/SectionCard", () => ({
  SectionCard: ({
    children,
    title,
    interactive,
    className,
  }: {
    children: React.ReactNode;
    title?: string;
    interactive?: boolean;
    className?: string;
  }) => (
    <div data-testid="section-card" data-interactive={interactive} className={className}>
      {title && <h3>{title}</h3>}
      {children}
    </div>
  ),
}));

vi.mock("../../components/ui/Skeletons", () => ({
  SkeletonCard: ({ className }: { className?: string }) => (
    <div data-testid="skeleton-card" className={className} />
  ),
}));

vi.mock("../../components/layout/PageLayouts", () => ({
  DashboardLayout: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="dashboard-layout">{children}</div>
  ),
}));

const mockHasSessionAuth = vi.fn();
const mockGetErpBatch = vi.fn();
const mockFetchSessionProfile = vi.fn();
const mockGetEndSemesterFeedbackStatus = vi.fn();

vi.mock("../../lib/core/session", () => ({
  hasSessionAuth: (...args: unknown[]) => mockHasSessionAuth(...args),
  fetchSessionProfile: (...args: unknown[]) => mockFetchSessionProfile(...args),
}));

vi.mock("../../lib/erp/index", () => ({
  getErpBatch: (...args: unknown[]) => mockGetErpBatch(...args),
}));

vi.mock("../../lib/campus/studentToolsApi", () => ({
  getEndSemesterFeedbackStatus: (...args: unknown[]) =>
    mockGetEndSemesterFeedbackStatus(...args),
}));

const mockProfile = {
  TableContent: {
    "Student Name": "Alice Johnson",
    "Register No.": "AP23110010419",
  },
};

function renderDashboard() {
  return render(
    <MemoryRouter>
      <Dashboard />
    </MemoryRouter>,
  );
}

describe("Dashboard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Existing suites cover the returning-user layout; first-run tests opt
    // out by removing this flag.
    window.localStorage.setItem("erp.onboarding.seenVersion", "1");
  });

  // --- Loading state ---

  it("shows loading skeleton while data is being fetched", () => {
    mockHasSessionAuth.mockReturnValue(true);
    mockGetErpBatch.mockReturnValue(new Promise(() => {}));
    mockFetchSessionProfile.mockReturnValue(new Promise(() => {}));
    mockGetEndSemesterFeedbackStatus.mockReturnValue(new Promise(() => {}));

    renderDashboard();

    const skeletons = screen.getAllByTestId("skeleton-card");
    expect(skeletons.length).toBeGreaterThanOrEqual(5);
  });

  // --- Session expired ---

  it("shows error when no session ID is found", async () => {
    mockHasSessionAuth.mockReturnValue(false);
    mockGetErpBatch.mockReturnValue(new Promise(() => {}));
    mockFetchSessionProfile.mockReturnValue(new Promise(() => {}));
    mockGetEndSemesterFeedbackStatus.mockReturnValue(Promise.resolve({ totalPending: 0 }));

    renderDashboard();

    await waitFor(() => {
      expect(screen.getByText("Dashboard could not load")).toBeInTheDocument();
    });

    expect(
      screen.getByText("Your session has expired. Please log in to continue."),
    ).toBeInTheDocument();
  });

  // --- ERP batch fetch error ---

  it("shows error when getErpBatch fails", async () => {
    mockHasSessionAuth.mockReturnValue(true);
    mockGetErpBatch.mockRejectedValue(new Error("ERP connection failed"));
    mockFetchSessionProfile.mockResolvedValue(mockProfile);
    mockGetEndSemesterFeedbackStatus.mockResolvedValue({ totalPending: 0 });

    renderDashboard();

    await waitFor(() => {
      expect(screen.getByText("Dashboard could not load")).toBeInTheDocument();
    });

    expect(screen.getByText("ERP connection failed")).toBeInTheDocument();
  });

  // --- Profile fetch error ---

  it("shows profile error when fetchSessionProfile fails", async () => {
    mockHasSessionAuth.mockReturnValue(true);
    mockGetErpBatch.mockResolvedValue({});
    mockFetchSessionProfile.mockRejectedValue(new Error("Profile unavailable"));
    mockGetEndSemesterFeedbackStatus.mockResolvedValue({ totalPending: 0 });

    renderDashboard();

    await waitFor(() => {
      expect(screen.getByText("Profile could not load")).toBeInTheDocument();
    });
  });

  // --- Null profile data ---

  it("shows profile error when profileData is null", async () => {
    mockHasSessionAuth.mockReturnValue(true);
    mockGetErpBatch.mockResolvedValue({});
    mockFetchSessionProfile.mockResolvedValue(null);
    mockGetEndSemesterFeedbackStatus.mockResolvedValue({ totalPending: 0 });

    renderDashboard();

    await waitFor(() => {
      expect(screen.getByText("Profile could not load")).toBeInTheDocument();
    });
  });

  // --- Successful full render ---

  it("renders all dashboard widgets in success state", async () => {
    mockHasSessionAuth.mockReturnValue(true);
    mockGetErpBatch.mockResolvedValue({
      "academic/time-table": {},
      "academic/attendance-details": {},
    });
    mockFetchSessionProfile.mockResolvedValue(mockProfile);
    mockGetEndSemesterFeedbackStatus.mockResolvedValue({ totalPending: 0 });

    renderDashboard();

    await waitFor(() => {
      expect(screen.getByTestId("dashboard-layout")).toBeInTheDocument();
    });

    // Welcome card
    expect(screen.getByText("Welcome back!")).toBeInTheDocument();

    // Basic Info section
    expect(screen.getByText("Basic Info")).toBeInTheDocument();

    // InternalMarks was removed from the dashboard (code kept in ./InternalMarks.tsx)
    expect(screen.queryByTestId("internal-marks-widget")).not.toBeInTheDocument();

    // Combined Events + Career widget
    expect(screen.getByTestId("campus-hub-widget")).toBeInTheDocument();

    // Lazy loaded widgets (React.lazy needs waitFor to resolve)
    await waitFor(() => {
      expect(screen.getByTestId("attendance-widget")).toBeInTheDocument();
    });
  });

  it("renders QuickLinks, UpcomingEventsWidget, and CareerWidget", async () => {
    mockHasSessionAuth.mockReturnValue(true);
    mockGetErpBatch.mockResolvedValue({});
    mockFetchSessionProfile.mockResolvedValue(mockProfile);
    mockGetEndSemesterFeedbackStatus.mockResolvedValue({ totalPending: 0 });

    renderDashboard();

    await waitFor(() => {
      expect(screen.getByText("Welcome back!")).toBeInTheDocument();
    });

    expect(screen.getByText("Student Tasks")).toBeInTheDocument();
  });

  it("renders ToDo widget", async () => {
    mockHasSessionAuth.mockReturnValue(true);
    mockGetErpBatch.mockResolvedValue({});
    mockFetchSessionProfile.mockResolvedValue(mockProfile);
    mockGetEndSemesterFeedbackStatus.mockResolvedValue({ totalPending: 0 });

    renderDashboard();

    await waitFor(() => {
      expect(screen.getByText("Welcome back!")).toBeInTheDocument();
    });

    expect(screen.getByText("To-Do-List (0)")).toBeInTheDocument();
  });

  it("renders WeekCalendar and Schedule in the sidebar", async () => {
    mockHasSessionAuth.mockReturnValue(true);
    mockGetErpBatch.mockResolvedValue({});
    mockFetchSessionProfile.mockResolvedValue(mockProfile);
    mockGetEndSemesterFeedbackStatus.mockResolvedValue({ totalPending: 0 });

    renderDashboard();

    await waitFor(() => {
      expect(screen.getByText("Welcome back!")).toBeInTheDocument();
    });

    // Week calendar shows day names
    expect(screen.getByText("Sun")).toBeInTheDocument();
    expect(screen.getByText("Schedule")).toBeInTheDocument();
  });

  // --- ERP batch data passed to widgets ---

  it("calls getErpBatch with correct page keys", async () => {
    mockHasSessionAuth.mockReturnValue(true);
    mockGetErpBatch.mockResolvedValue({});
    mockFetchSessionProfile.mockResolvedValue(mockProfile);
    mockGetEndSemesterFeedbackStatus.mockResolvedValue({ totalPending: 0 });

    renderDashboard();

    await waitFor(() => {
      expect(mockGetErpBatch).toHaveBeenCalledWith([
        "academic/time-table",
        "academic/attendance-details",
      ]);
    });
  });

  // --- Feedback status ---

  it("passes feedbackPendingCount to QuickLinks", async () => {
    mockHasSessionAuth.mockReturnValue(true);
    mockGetErpBatch.mockResolvedValue({});
    mockFetchSessionProfile.mockResolvedValue(mockProfile);
    mockGetEndSemesterFeedbackStatus.mockResolvedValue({ totalPending: 3 });

    renderDashboard();

    await waitFor(() => {
      expect(screen.getByText("Welcome back!")).toBeInTheDocument();
    });

    expect(
      screen.getByText(/course feedback items need attention/i),
    ).toBeInTheDocument();
  });

  it("handles feedback status API failure gracefully", async () => {
    mockHasSessionAuth.mockReturnValue(true);
    mockGetErpBatch.mockResolvedValue({});
    mockFetchSessionProfile.mockResolvedValue(mockProfile);
    mockGetEndSemesterFeedbackStatus.mockRejectedValue(new Error("Server error"));

    renderDashboard();

    await waitFor(() => {
      expect(screen.getByText("Welcome back!")).toBeInTheDocument();
    });

    // Should not crash — feedbackPendingCount defaults to 0
    expect(screen.queryByText(/course feedback/)).not.toBeInTheDocument();
  });

  // --- First-run onboarding ---

  it("shows the first-run guide and personal greeting for first-time logins", async () => {
    window.localStorage.removeItem("erp.onboarding.seenVersion");
    mockHasSessionAuth.mockReturnValue(true);
    mockGetErpBatch.mockResolvedValue({});
    mockFetchSessionProfile.mockResolvedValue(mockProfile);
    mockGetEndSemesterFeedbackStatus.mockResolvedValue({ totalPending: 0 });

    renderDashboard();

    await waitFor(() => {
      expect(screen.getByText("Welcome, Alice!")).toBeInTheDocument();
    });
    expect(screen.getByText("Synced with your SRM account")).toBeInTheDocument();
    expect(screen.queryByText("Welcome back!")).not.toBeInTheDocument();
  });
});
