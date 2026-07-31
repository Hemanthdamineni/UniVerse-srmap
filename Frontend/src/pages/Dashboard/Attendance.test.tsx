import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import Attendance from "./Attendance";

const mockExecutePipeline = vi.fn();

vi.mock("../../lib/erp/erpTransformers", () => ({
  executePipeline: (...args: unknown[]) => mockExecutePipeline(...args),
}));

function makeAttendanceData(
  records: Array<{
    subjectCode: string;
    subjectDescription: string;
    attendancePct: number;
  }>,
) {
  return { records };
}

describe("Attendance", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows empty state when attendanceData is undefined", () => {
    render(<Attendance />);
    expect(
      screen.getByText("No attendance data available for this semester."),
    ).toBeInTheDocument();
  });

  it("shows empty state when executePipeline returns null", () => {
    mockExecutePipeline.mockReturnValue(null);
    render(<Attendance attendanceData={{}} />);
    expect(
      screen.getByText("No attendance data available for this semester."),
    ).toBeInTheDocument();
  });

  it("shows empty state when executePipeline returns invalid result", () => {
    mockExecutePipeline.mockReturnValue({ isValid: false, data: null });
    render(<Attendance attendanceData={{}} />);
    expect(
      screen.getByText("No attendance data available for this semester."),
    ).toBeInTheDocument();
  });

  it("shows empty state when records array is empty", () => {
    mockExecutePipeline.mockReturnValue({
      isValid: true,
      data: makeAttendanceData([]),
    });
    render(<Attendance attendanceData={{}} />);
    expect(
      screen.getByText("No attendance data available for this semester."),
    ).toBeInTheDocument();
  });

  it("renders average attendance percentage", () => {
    const records = [
      {
        subjectCode: "CS101",
        subjectDescription: "Data Structures",
        attendancePct: 85,
      },
      {
        subjectCode: "CS102",
        subjectDescription: "Algorithms",
        attendancePct: 72,
      },
    ];
    mockExecutePipeline.mockReturnValue({
      isValid: true,
      data: makeAttendanceData(records),
    });
    render(<Attendance attendanceData={{}} />);

    const avg = Math.round((85 + 72) / 2);
    expect(screen.getByText(`${avg}%`)).toBeInTheDocument();
  });

  it("renders lowest attendance percentage", () => {
    const records = [
      { subjectCode: "CS101", subjectDescription: "DS", attendancePct: 90 },
      { subjectCode: "CS102", subjectDescription: "Algo", attendancePct: 45 },
    ];
    mockExecutePipeline.mockReturnValue({
      isValid: true,
      data: makeAttendanceData(records),
    });
    render(<Attendance attendanceData={{}} />);

    expect(screen.getByText("45%")).toBeInTheDocument();
  });

  it("renders safe count (attendance >= 75)", () => {
    const records = [
      { subjectCode: "CS101", subjectDescription: "DS", attendancePct: 90 },
      { subjectCode: "CS102", subjectDescription: "Algo", attendancePct: 65 },
      { subjectCode: "CS103", subjectDescription: "DBMS", attendancePct: 80 },
    ];
    mockExecutePipeline.mockReturnValue({
      isValid: true,
      data: makeAttendanceData(records),
    });
    render(<Attendance attendanceData={{}} />);

    expect(screen.getByText("2/3")).toBeInTheDocument();
  });

  it("renders at-risk count when attendance < 75", () => {
    const records = [
      { subjectCode: "CS101", subjectDescription: "DS", attendancePct: 50 },
      { subjectCode: "CS102", subjectDescription: "Algo", attendancePct: 60 },
    ];
    mockExecutePipeline.mockReturnValue({
      isValid: true,
      data: makeAttendanceData(records),
    });
    render(<Attendance attendanceData={{}} />);

    expect(screen.getByText("2")).toBeInTheDocument();
    expect(screen.getByText("Risk")).toBeInTheDocument();
  });

  it("renders 0 at-risk count when all safe", () => {
    const records = [
      { subjectCode: "CS101", subjectDescription: "DS", attendancePct: 80 },
      { subjectCode: "CS102", subjectDescription: "Algo", attendancePct: 90 },
    ];
    mockExecutePipeline.mockReturnValue({
      isValid: true,
      data: makeAttendanceData(records),
    });
    render(<Attendance attendanceData={{}} />);

    expect(screen.getByText("0")).toBeInTheDocument();
  });

  it("renders section title", () => {
    mockExecutePipeline.mockReturnValue({
      isValid: true,
      data: makeAttendanceData([
        { subjectCode: "CS101", subjectDescription: "DS", attendancePct: 80 },
      ]),
    });
    render(<Attendance attendanceData={{}} />);

    const titles = screen.getAllByText("Attendance");
    expect(titles.length).toBeGreaterThanOrEqual(1);
  });

  it("renders summary stat labels", () => {
    mockExecutePipeline.mockReturnValue({
      isValid: true,
      data: makeAttendanceData([
        { subjectCode: "CS101", subjectDescription: "DS", attendancePct: 80 },
      ]),
    });
    render(<Attendance attendanceData={{}} />);

    expect(screen.getByText("Avg")).toBeInTheDocument();
    expect(screen.getByText("Lowest")).toBeInTheDocument();
    expect(screen.getByText("Safe")).toBeInTheDocument();
  });

  it("renders a chart container with subject data", () => {
    const records = [
      {
        subjectCode: "CS101",
        subjectDescription: "Data Structures",
        attendancePct: 82,
      },
    ];
    mockExecutePipeline.mockReturnValue({
      isValid: true,
      data: makeAttendanceData(records),
    });
    render(<Attendance attendanceData={{}} />);

    // ChartContainer renders a div with data-slot="chart"
    const chartContainer = document.querySelector('[data-slot="chart"]');
    expect(chartContainer).toBeInTheDocument();
  });

  it("passes attendanceData to executePipeline", () => {
    const attendanceData = { key: "value" };
    mockExecutePipeline.mockReturnValue({
      isValid: true,
      data: makeAttendanceData([
        { subjectCode: "CS101", subjectDescription: "DS", attendancePct: 80 },
      ]),
    });
    render(<Attendance attendanceData={attendanceData} />);

    expect(mockExecutePipeline).toHaveBeenCalledWith(
      "attendance",
      attendanceData,
    );
  });
});
