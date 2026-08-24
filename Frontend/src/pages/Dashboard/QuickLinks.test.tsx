import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import QuickLinks from "./QuickLinks";

const mockNavigate = vi.fn();

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom");
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

function renderQuickLinks(feedbackPendingCount = 0) {
  return render(
    <MemoryRouter>
      <QuickLinks feedbackPendingCount={feedbackPendingCount} />
    </MemoryRouter>,
  );
}

describe("QuickLinks", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders section title", () => {
    renderQuickLinks();
    expect(screen.getByText("Student Tasks")).toBeInTheDocument();
  });

  it("renders all 7 quick-link buttons plus the feedback button (8 total)", () => {
    renderQuickLinks();
    const buttons = screen.getAllByRole("button");
    expect(buttons.length).toBe(8);
  });

  it("renders quick-link labels", () => {
    renderQuickLinks();
    expect(screen.getByText("Today")).toBeInTheDocument();
    expect(screen.getByText("Attendance")).toBeInTheDocument();
    expect(screen.getByText("Marks")).toBeInTheDocument();
    expect(screen.getByText("Fees")).toBeInTheDocument();
    expect(screen.getByText("Resources")).toBeInTheDocument();
    expect(screen.getByText("Events")).toBeInTheDocument();
    expect(screen.getByText("Career")).toBeInTheDocument();
  });

  it("renders Feedback button", () => {
    renderQuickLinks();
    expect(screen.getByText("Feedback")).toBeInTheDocument();
  });

  it('shows "Complete pending" for the feedback description when pending > 0', () => {
    renderQuickLinks(3);
    expect(screen.getByText("Complete pending")).toBeInTheDocument();
  });

  it('shows "Course feedback" for the feedback description when pending is 0', () => {
    renderQuickLinks(0);
    expect(screen.getByText("Course feedback")).toBeInTheDocument();
  });

  it("shows feedback warning banner when pending > 0", () => {
    renderQuickLinks(2);
    expect(screen.getByText(/course feedback items need attention/i)).toBeInTheDocument();
  });

  it("shows singular feedback banner text when exactly 1 pending", () => {
    renderQuickLinks(1);
    expect(
      screen.getByText(/course feedback item need attention/i),
    ).toBeInTheDocument();
  });

  it("does not show feedback banner when pending is 0", () => {
    renderQuickLinks(0);
    expect(
      screen.queryByText(/need attention/i),
    ).not.toBeInTheDocument();
  });

  it("navigates to /academic/timetable when Today is clicked", () => {
    renderQuickLinks();
    fireEvent.click(screen.getByText("Today"));
    expect(mockNavigate).toHaveBeenCalledWith("/academic/timetable");
  });

  it("navigates to /academic/attendance-details when Attendance is clicked", () => {
    renderQuickLinks();
    fireEvent.click(screen.getByText("Attendance"));
    expect(mockNavigate).toHaveBeenCalledWith("/academic/attendance-details");
  });

  it("navigates to /exams/current-semester-results when Marks is clicked", () => {
    renderQuickLinks();
    fireEvent.click(screen.getByText("Marks"));
    expect(mockNavigate).toHaveBeenCalledWith("/exams/current-semester-results");
  });

  it("navigates to /finance/fee-dues when Fees is clicked", () => {
    renderQuickLinks();
    fireEvent.click(screen.getByText("Fees"));
    expect(mockNavigate).toHaveBeenCalledWith("/finance/fee-dues");
  });

  it("navigates to /resources when Resources is clicked", () => {
    renderQuickLinks();
    fireEvent.click(screen.getByText("Resources"));
    expect(mockNavigate).toHaveBeenCalledWith("/learn");
  });

  it("navigates to /events when Events is clicked", () => {
    renderQuickLinks();
    fireEvent.click(screen.getByText("Events"));
    expect(mockNavigate).toHaveBeenCalledWith("/events");
  });

  it("navigates to /career when Career is clicked", () => {
    renderQuickLinks();
    fireEvent.click(screen.getByText("Career"));
    expect(mockNavigate).toHaveBeenCalledWith("/career");
  });

  it("navigates to /feedback/course-feedback when Feedback is clicked", () => {
    renderQuickLinks();
    fireEvent.click(screen.getByText("Feedback"));
    expect(mockNavigate).toHaveBeenCalledWith("/feedback/course-feedback");
  });

  it("renders description text for each link", () => {
    renderQuickLinks();
    expect(screen.getByText("Open timetable")).toBeInTheDocument();
    expect(screen.getByText("Check risk")).toBeInTheDocument();
    expect(screen.getByText("Review results")).toBeInTheDocument();
    expect(screen.getByText("Dues and paid")).toBeInTheDocument();
    expect(screen.getByText("Study material")).toBeInTheDocument();
    expect(screen.getByText("Find and register")).toBeInTheDocument();
    expect(screen.getByText("Apply or track")).toBeInTheDocument();
  });
});
