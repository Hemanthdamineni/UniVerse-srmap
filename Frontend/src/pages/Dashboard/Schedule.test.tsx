import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import Schedule from "./Schedule";

const mockExecutePipeline = vi.fn();

vi.mock("../../lib/erp/erpTransformers", () => ({
  executePipeline: (...args: unknown[]) => mockExecutePipeline(...args),
}));

// July 20, 2026 is a Monday
const MONDAY = new Date("2026-07-20T09:00:00");

function makeTimetableData(overrides: Record<string, unknown> = {}) {
  return {
    timeSlots: ["9:00 am", "10:00 am", "11:00 am"],
    days: [
      {
        day: "Monday",
        slots: [
          { classDetails: "CS101" },
          { classDetails: "CS102" },
          { classDetails: "" },
        ],
      },
    ],
    subjects: [
      { code: "CS101", name: "Data Structures", faculty: "Dr. Smith", room: "Room 101" },
      { code: "CS102", name: "Algorithms", faculty: "Dr. Jones", room: "Room 102" },
    ],
    ...overrides,
  };
}

function renderSchedule(scheduleData?: unknown, selectedDate?: Date) {
  return render(
    <Schedule scheduleData={scheduleData} selectedDate={selectedDate} />,
  );
}

describe("Schedule", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders schedule header", () => {
    mockExecutePipeline.mockReturnValue({
      isValid: true,
      data: makeTimetableData(),
    });
    renderSchedule({});
    expect(screen.getByText("Schedule")).toBeInTheDocument();
  });

  it("renders time slots", () => {
    mockExecutePipeline.mockReturnValue({
      isValid: true,
      data: makeTimetableData(),
    });
    renderSchedule({});
    expect(screen.getByText("9:00 am")).toBeInTheDocument();
    expect(screen.getByText("10:00 am")).toBeInTheDocument();
    expect(screen.getByText("11:00 am")).toBeInTheDocument();
  });

  it("renders course names from timetable data with a selectedDate", () => {
    mockExecutePipeline.mockReturnValue({
      isValid: true,
      data: makeTimetableData(),
    });
    renderSchedule({}, MONDAY);
    expect(screen.getByText("Data Structures")).toBeInTheDocument();
  });

  it("renders professor names", () => {
    mockExecutePipeline.mockReturnValue({
      isValid: true,
      data: makeTimetableData(),
    });
    renderSchedule({}, MONDAY);
    expect(screen.getByText("Dr. Smith")).toBeInTheDocument();
    expect(screen.getByText("Dr. Jones")).toBeInTheDocument();
  });

  it("renders 'Free Period' for empty slots", () => {
    mockExecutePipeline.mockReturnValue({
      isValid: true,
      data: makeTimetableData(),
    });
    renderSchedule({}, MONDAY);
    expect(screen.getByText("Free Period")).toBeInTheDocument();
  });

  it("renders course IDs in brackets (sanitizer title-cases all-caps)", () => {
    mockExecutePipeline.mockReturnValue({
      isValid: true,
      data: makeTimetableData(),
    });
    renderSchedule({}, MONDAY);
    // sanitizeErpDisplayText title-cases all-caps strings, so CS101 becomes Cs101
    expect(screen.getByText(/\[Cs101\]/)).toBeInTheDocument();
    expect(screen.getByText(/\[Cs102\]/)).toBeInTheDocument();
  });

  it("renders room numbers alongside lecture type", () => {
    mockExecutePipeline.mockReturnValue({
      isValid: true,
      data: makeTimetableData(),
    });
    renderSchedule({}, MONDAY);
    expect(screen.getByText(/Lecture - Room 101/)).toBeInTheDocument();
    expect(screen.getByText(/Lecture - Room 102/)).toBeInTheDocument();
  });

  it("renders 5:30 pm footer", () => {
    mockExecutePipeline.mockReturnValue({
      isValid: true,
      data: makeTimetableData(),
    });
    renderSchedule({});
    expect(screen.getByText("5:30 pm")).toBeInTheDocument();
  });

  it("shows 'Faculty TBA' when a subject has no faculty info", () => {
    const data = makeTimetableData({
      days: [
        {
          day: "Monday",
          slots: [
            { classDetails: "CS101" },
            { classDetails: "" },
            { classDetails: "" },
          ],
        },
      ],
      subjects: [
        { code: "CS101", name: "Data Structures", room: "Room 101" },
      ],
    });
    mockExecutePipeline.mockReturnValue({ isValid: true, data });
    renderSchedule({}, MONDAY);
    const facultyElements = screen.getAllByText("Faculty TBA");
    expect(facultyElements.length).toBeGreaterThanOrEqual(1);
  });

  it("handles null scheduleData gracefully", () => {
    mockExecutePipeline.mockReturnValue(null);
    renderSchedule(null);
    expect(screen.getByText("Schedule")).toBeInTheDocument();
  });

  it("uses default time slots when timetable has none", () => {
    const data = makeTimetableData({ timeSlots: [] });
    mockExecutePipeline.mockReturnValue({ isValid: true, data });
    renderSchedule({});
    expect(screen.getByText("9:00 am")).toBeInTheDocument();
  });

  it("shows all free periods when no matching day is found", () => {
    const data = makeTimetableData({
      days: [
        {
          day: "Tuesday",
          slots: [
            { classDetails: "CS201" },
            { classDetails: "" },
            { classDetails: "" },
          ],
        },
      ],
    });
    mockExecutePipeline.mockReturnValue({ isValid: true, data });
    renderSchedule({}, MONDAY);
    const freePeriods = screen.getAllByText("Free Period");
    expect(freePeriods.length).toBe(3);
  });

  it("passes scheduleData to executePipeline", () => {
    const scheduleData = { raw: "data" };
    mockExecutePipeline.mockReturnValue({
      isValid: true,
      data: makeTimetableData(),
    });
    renderSchedule(scheduleData, MONDAY);
    expect(mockExecutePipeline).toHaveBeenCalledWith("timetable", scheduleData);
  });

  it("applies Completed status for past dates", () => {
    const data = makeTimetableData();
    mockExecutePipeline.mockReturnValue({ isValid: true, data });
    renderSchedule({}, MONDAY);
    const completedBadges = screen.getAllByText("Completed");
    expect(completedBadges.length).toBeGreaterThan(0);
  });

  it("handles new format with em dash: 'CODE(ROOM) — Full Subject Name'", () => {
    const data = makeTimetableData({
      days: [
        {
          day: "Monday",
          slots: [
            { classDetails: "CSE401(C311) — CODING SKILLS - III" },
            { classDetails: "" },
            { classDetails: "" },
          ],
        },
      ],
      subjects: [
        { code: "CSE401", name: "CODING SKILLS - III", faculty: "Dr. Shreeram Hudda", room: "C 311" },
      ],
    });
    mockExecutePipeline.mockReturnValue({ isValid: true, data });
    renderSchedule({}, MONDAY);
    // Should match subject by code and show faculty/room from subjects
    // CSS capitalize transforms text, so "CODING SKILLS - III" becomes "Coding Skills - Iii"
    expect(screen.getByText("Coding Skills - Iii")).toBeInTheDocument();
    expect(screen.getByText("Dr. Shreeram Hudda")).toBeInTheDocument();
    expect(screen.getByText(/Lecture - C 311/)).toBeInTheDocument();
  });
});
