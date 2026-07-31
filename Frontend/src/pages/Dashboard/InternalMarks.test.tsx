import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import InternalMarks from "./InternalMarks";

const mockNavigate = vi.fn();

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom");
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

const mockExecutePipeline = vi.fn();

vi.mock("../../lib/erp/erpTransformers", () => ({
  executePipeline: (...args: unknown[]) => mockExecutePipeline(...args),
}));

function makeMarksModel(subjects: Array<{ code: string; marksObtained: number; maxMarks: number; percentage: number; status: string }>) {
  const avgPct =
    subjects.length > 0
      ? subjects.reduce((sum, s) => sum + s.percentage, 0) / subjects.length
      : 0;
  return {
    subjects,
    averagePercentage: avgPct,
  };
}

describe("InternalMarks", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows empty state when marksData is undefined", () => {
    render(
      <MemoryRouter>
        <InternalMarks />
      </MemoryRouter>,
    );
    expect(
      screen.getByText("No internal marks data available for this semester."),
    ).toBeInTheDocument();
  });

  it("shows empty state when executePipeline returns null", () => {
    mockExecutePipeline.mockReturnValue(null);
    render(
      <MemoryRouter>
        <InternalMarks marksData={{}} />
      </MemoryRouter>,
    );
    expect(
      screen.getByText("No internal marks data available for this semester."),
    ).toBeInTheDocument();
  });

  it("shows empty state when subjects array is empty", () => {
    mockExecutePipeline.mockReturnValue({
      isValid: true,
      data: makeMarksModel([]),
    });
    render(
      <MemoryRouter>
        <InternalMarks marksData={{}} />
      </MemoryRouter>,
    );
    expect(
      screen.getByText("No internal marks data available for this semester."),
    ).toBeInTheDocument();
  });

  it("renders section title and course count", () => {
    mockExecutePipeline.mockReturnValue({
      isValid: true,
      data: makeMarksModel([
        { code: "CS101", marksObtained: 40, maxMarks: 50, percentage: 80, status: "good" },
      ]),
    });
    render(
      <MemoryRouter>
        <InternalMarks marksData={{}} />
      </MemoryRouter>,
    );

    const titles = screen.getAllByText("Internal Marks");
    expect(titles.length).toBeGreaterThanOrEqual(1);
  });

  it("renders average percentage badge", () => {
    const subjects = [
      { code: "CS101", marksObtained: 45, maxMarks: 50, percentage: 90, status: "excellent" },
      { code: "CS102", marksObtained: 30, maxMarks: 50, percentage: 60, status: "good" },
    ];
    const avgPct = (90 + 60) / 2;
    mockExecutePipeline.mockReturnValue({
      isValid: true,
      data: makeMarksModel(subjects),
    });
    render(
      <MemoryRouter>
        <InternalMarks marksData={{}} />
      </MemoryRouter>,
    );

    expect(screen.getByText(`${avgPct.toFixed(0)}% avg`)).toBeInTheDocument();
  });

  it("renders 'at risk' indicator when subjects below 60% exist", () => {
    const subjects = [
      { code: "CS101", marksObtained: 20, maxMarks: 50, percentage: 40, status: "needs-improvement" },
      { code: "CS102", marksObtained: 45, maxMarks: 50, percentage: 90, status: "excellent" },
    ];
    mockExecutePipeline.mockReturnValue({
      isValid: true,
      data: makeMarksModel(subjects),
    });
    render(
      <MemoryRouter>
        <InternalMarks marksData={{}} />
      </MemoryRouter>,
    );

    expect(screen.getByText("1 at risk")).toBeInTheDocument();
  });

  it("does not render 'at risk' when no subject below 60%", () => {
    const subjects = [
      { code: "CS101", marksObtained: 45, maxMarks: 50, percentage: 90, status: "excellent" },
    ];
    mockExecutePipeline.mockReturnValue({
      isValid: true,
      data: makeMarksModel(subjects),
    });
    render(
      <MemoryRouter>
        <InternalMarks marksData={{}} />
      </MemoryRouter>,
    );

    expect(screen.queryByText(/at risk/)).not.toBeInTheDocument();
  });

  it("renders course code and marks for each subject", () => {
    const subjects = [
      { code: "CS101", marksObtained: 42, maxMarks: 50, percentage: 84, status: "excellent" },
    ];
    mockExecutePipeline.mockReturnValue({
      isValid: true,
      data: makeMarksModel(subjects),
    });
    render(
      <MemoryRouter>
        <InternalMarks marksData={{}} />
      </MemoryRouter>,
    );

    expect(screen.getByText("CS101")).toBeInTheDocument();
    expect(screen.getByText("42/50")).toBeInTheDocument();
  });

  it("renders correct plural 'courses' for multiple subjects", () => {
    const subjects = [
      { code: "CS101", marksObtained: 40, maxMarks: 50, percentage: 80, status: "good" },
      { code: "CS102", marksObtained: 35, maxMarks: 50, percentage: 70, status: "good" },
    ];
    mockExecutePipeline.mockReturnValue({
      isValid: true,
      data: makeMarksModel(subjects),
    });
    render(
      <MemoryRouter>
        <InternalMarks marksData={{}} />
      </MemoryRouter>,
    );

    expect(screen.getByText("2 courses")).toBeInTheDocument();
  });

  it("renders 'course' (singular) for exactly one subject", () => {
    const subjects = [
      { code: "CS101", marksObtained: 40, maxMarks: 50, percentage: 80, status: "good" },
    ];
    mockExecutePipeline.mockReturnValue({
      isValid: true,
      data: makeMarksModel(subjects),
    });
    render(
      <MemoryRouter>
        <InternalMarks marksData={{}} />
      </MemoryRouter>,
    );

    expect(screen.getByText("1 course")).toBeInTheDocument();
  });

  it("navigates to semester results when a subject row is clicked", () => {
    const subjects = [
      { code: "CS101", marksObtained: 40, maxMarks: 50, percentage: 80, status: "good" },
    ];
    mockExecutePipeline.mockReturnValue({
      isValid: true,
      data: makeMarksModel(subjects),
    });
    render(
      <MemoryRouter>
        <InternalMarks marksData={{}} />
      </MemoryRouter>,
    );

    const button = screen.getByRole("button");
    fireEvent.click(button);
    expect(mockNavigate).toHaveBeenCalledWith("/exams/current-semester-results");
  });

  it("passes marksData to executePipeline", () => {
    const marksData = { semester: "4" };
    mockExecutePipeline.mockReturnValue({
      isValid: true,
      data: makeMarksModel([
        { code: "CS101", marksObtained: 40, maxMarks: 50, percentage: 80, status: "good" },
      ]),
    });
    render(
      <MemoryRouter>
        <InternalMarks marksData={marksData} />
      </MemoryRouter>,
    );

    expect(mockExecutePipeline).toHaveBeenCalledWith("internal-marks", marksData);
  });
});
