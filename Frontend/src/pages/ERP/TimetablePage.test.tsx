import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PageBlueprint } from "../../config/erpBlueprints";
import type { TimetableModel } from "../../lib/erp/erpTransformers";
import TimetablePage from "./TimetablePage";
import { createTestQueryClient } from "../../test/testUtils";

// ── Module mocks ──────────────────────────────────────────────────────

const getErpBatch = vi.fn();

vi.mock("../../lib/erp/api", () => ({
  get getErpBatch() {
    return getErpBatch;
  },
}));

const executePipeline = vi.fn();

vi.mock("../../lib/erp/erpTransformers", () => ({
  get executePipeline() {
    return executePipeline;
  },
}));

// ── Helpers ───────────────────────────────────────────────────────────

function renderPage(blueprint?: Partial<PageBlueprint>) {
  const defaultBlueprint: PageBlueprint = {
    route: "/academic/timetable",
    heading: "Class Timetable",
    fetchKeys: ["academic/time-table"],
    domain: "erp",
    sourceMode: "erp",
    integrationState: "native",
    renderer: "timetable",
    loadingMessage: "Loading timetable...",
  };
  return render(
    <QueryClientProvider client={createTestQueryClient()}>
      <MemoryRouter>
        <TimetablePage blueprint={{ ...defaultBlueprint, ...blueprint }} />
      </MemoryRouter>
    </QueryClientProvider>
  );
}

function setupBatchResponse(result: Partial<Record<string, unknown>>) {
  getErpBatch.mockResolvedValue({
    "academic/time-table": {
      success: true,
      pageKey: "academic/time-table",
      data: {},
      ...result,
    },
  });
}

function stubResizeObserver() {
  (globalThis as any).ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
}

// ── Suite ─────────────────────────────────────────────────────────────

describe("TimetablePage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    stubResizeObserver();
  });

  // ── Loading state ────────────────────────────────────────────────

  it("renders loading overlay with the configured message", () => {
    getErpBatch.mockReturnValue(new Promise(() => {}));
    renderPage();
    expect(screen.getByText("Loading timetable...")).toBeInTheDocument();
  });

  it("renders the heading while loading", () => {
    getErpBatch.mockReturnValue(new Promise(() => {}));
    renderPage();
    expect(screen.getByText("Class Timetable")).toBeInTheDocument();
  });

  // ── Error states ─────────────────────────────────────────────────

  it("renders error message when the batch request rejects", async () => {
    getErpBatch.mockRejectedValue(new Error("Network failure"));
    renderPage();
    expect(await screen.findByText("Network failure")).toBeInTheDocument();
  });

  it("renders empty state when batch returns success=false", async () => {
    getErpBatch.mockResolvedValue({
      "academic/time-table": {
        success: false,
        pageKey: "academic/time-table",
        error: "Session expired",
        status: 401,
        code: "SESSION_EXPIRED",
      },
    });
    renderPage();
    expect(await screen.findByText("Timetable not available")).toBeInTheDocument();
  });

  it("renders empty state when the batch result is missing entirely", async () => {
    getErpBatch.mockResolvedValue({});
    renderPage();
    expect(await screen.findByText("Timetable not available")).toBeInTheDocument();
  });

  it("renders error when executePipeline returns invalid", async () => {
    setupBatchResponse();
    executePipeline.mockReturnValue({ isValid: false, data: null, errors: ["malformed schedule"] });
    renderPage();
    expect(await screen.findByText("Invalid timetable data format.")).toBeInTheDocument();
  });

  it("renders error when executePipeline returns null", async () => {
    setupBatchResponse();
    executePipeline.mockReturnValue(null);
    renderPage();
    expect(await screen.findByText("Invalid timetable data format.")).toBeInTheDocument();
  });

  it("provides a retry button that re-fetches data", async () => {
    getErpBatch.mockRejectedValue(new Error("First attempt failed"));
    renderPage();
    expect(await screen.findByText("First attempt failed")).toBeInTheDocument();
    expect(getErpBatch).toHaveBeenCalledTimes(1);

    // Reconfigure mock to succeed on retry
    getErpBatch.mockResolvedValue({
      "academic/time-table": {
        success: true,
        pageKey: "academic/time-table",
        data: {},
      },
    });
    executePipeline.mockReturnValue({
      isValid: true,
      data: { timeSlots: [], days: [], subjects: [] } satisfies TimetableModel,
      errors: [],
    });

    await userEvent.click(screen.getByRole("button", { name: /try again/i }));

    // After retry the page should re-fetch
    await vi.waitFor(() => {
      expect(getErpBatch).toHaveBeenCalledTimes(2);
    });
  });

  // ── Empty states ─────────────────────────────────────────────────

  it("shows empty schedule message when days array is empty", async () => {
    const emptyModel: TimetableModel = { timeSlots: ["08:00-08:50"], days: [], subjects: [] };
    setupBatchResponse();
    executePipeline.mockReturnValue({ isValid: true, data: emptyModel, errors: [] });
    renderPage();
    // Table headers are always visible
    expect(await screen.findByText("Day")).toBeInTheDocument();
    expect(screen.getByText("08:00-08:50")).toBeInTheDocument();
    // Empty state message inside the table body
    expect(screen.getByText("No schedule data available")).toBeInTheDocument();
  });

  it("shows table headers even when days are empty", async () => {
    const emptyModel: TimetableModel = { timeSlots: ["08:00-08:50", "09:00-09:50"], days: [], subjects: [] };
    setupBatchResponse();
    executePipeline.mockReturnValue({ isValid: true, data: emptyModel, errors: [] });
    renderPage();
    // Table headers are always visible even when no data
    expect(await screen.findByText("Day")).toBeInTheDocument();
    expect(screen.getByText("08:00-08:50")).toBeInTheDocument();
    expect(screen.getByText("09:00-09:50")).toBeInTheDocument();
    // Empty state message inside the table body
    expect(screen.getByText("No schedule data available")).toBeInTheDocument();
  });

  it("does not render the subject legend when subjects are empty", async () => {
    const model: TimetableModel = {
      timeSlots: ["08:00-08:50"],
      days: [{ day: "Monday", slots: [{ time: "08:00-08:50", classDetails: "CS101" }] }],
      subjects: [],
    };
    setupBatchResponse();
    executePipeline.mockReturnValue({ isValid: true, data: model, errors: [] });
    renderPage();
    expect(await screen.findByText("Monday")).toBeInTheDocument();
    expect(screen.queryByText("Course Details & Faculty")).not.toBeInTheDocument();
  });

  // ── Success / data rendering ─────────────────────────────────────

  it("renders timetable grid with day rows and time-slot columns", async () => {
    const model: TimetableModel = {
      timeSlots: ["08:00-08:50", "09:00-09:50"],
      days: [
        { day: "Monday", slots: [{ time: "08:00-08:50", classDetails: "CS101" }, { time: "09:00-09:50", classDetails: "MA101" }] },
        { day: "Tuesday", slots: [{ time: "08:00-08:50", classDetails: "" }, { time: "09:00-09:50", classDetails: "PH101" }] },
      ],
      subjects: [],
    };
    setupBatchResponse();
    executePipeline.mockReturnValue({ isValid: true, data: model, errors: [] });
    renderPage();

    // Day rows
    expect(await screen.findByText("Monday")).toBeInTheDocument();
    expect(screen.getByText("Tuesday")).toBeInTheDocument();

    // Time slot column headers
    expect(screen.getByText("08:00-08:50")).toBeInTheDocument();
    expect(screen.getByText("09:00-09:50")).toBeInTheDocument();

    // Class details rendered in cells
    expect(screen.getByText("CS101")).toBeInTheDocument();
    expect(screen.getByText("MA101")).toBeInTheDocument();
    expect(screen.getByText("PH101")).toBeInTheDocument();

    // Empty slot renders em dash
    expect(screen.getByText("—")).toBeInTheDocument();
  });

  it("renders the subject legend with code, name, credits, faculty, and room", async () => {
    const model: TimetableModel = {
      timeSlots: ["08:00-08:50"],
      days: [{ day: "Monday", slots: [{ time: "08:00-08:50", classDetails: "CS101" }] }],
      subjects: [
        { code: "CS201", name: "Data Structures", ltpc: "3-1-0-4", faculty: "Dr. Smith", room: "AB-301" },
        { code: "MA201", name: "Calculus", ltpc: "4-0-0-4", faculty: "Dr. Jones", room: "AB-302" },
      ],
    };
    setupBatchResponse();
    executePipeline.mockReturnValue({ isValid: true, data: model, errors: [] });
    renderPage();

    expect(await screen.findByText("Course Details & Faculty")).toBeInTheDocument();

    // Subject 1
    expect(screen.getByText("CS201")).toBeInTheDocument();
    expect(screen.getByText("Data Structures")).toBeInTheDocument();
    expect(screen.getByText("3-1-0-4")).toBeInTheDocument();
    expect(screen.getByText("Dr. Smith")).toBeInTheDocument();
    expect(screen.getByText("AB-301")).toBeInTheDocument();

    // Subject 2
    expect(screen.getByText("MA201")).toBeInTheDocument();
    expect(screen.getByText("Calculus")).toBeInTheDocument();
    expect(screen.getByText("Dr. Jones")).toBeInTheDocument();
    expect(screen.getByText("AB-302")).toBeInTheDocument();

    // Study links
    const studyLinks = screen.getAllByRole("link", { name: /study/i });
    expect(studyLinks).toHaveLength(2);
    expect(studyLinks[0]).toHaveAttribute("href", "/learn/subjects/CS201");
    expect(studyLinks[1]).toHaveAttribute("href", "/learn/subjects/MA201");
  });

  it("shows em dash for missing room number in subject legend", async () => {
    const model: TimetableModel = {
      timeSlots: ["08:00-08:50"],
      days: [{ day: "Monday", slots: [{ time: "08:00-08:50", classDetails: "CS101" }] }],
      subjects: [
        { code: "CS101", name: "DS", ltpc: "3-1-0-4", faculty: "Dr. Smith", room: "" },
      ],
    };
    setupBatchResponse();
    executePipeline.mockReturnValue({ isValid: true, data: model, errors: [] });
    renderPage();
    // Wait for data render first
    await screen.findByText("Monday");

    // There should be at least one em dash (from the empty room column)
    // In this case, there is no empty slot in schedule, so the only em dash is from the room
    const dashes = screen.getAllByText("—");
    expect(dashes.length).toBeGreaterThanOrEqual(1);
  });

  it("shows empty state inside table when model has no time slots or days", async () => {
    const model: TimetableModel = { timeSlots: [], days: [], subjects: [] };
    setupBatchResponse();
    executePipeline.mockReturnValue({ isValid: true, data: model, errors: [] });
    renderPage();
    expect(await screen.findByText(/no schedule/i)).toBeInTheDocument();
    // Headers are always visible — fallback "Schedule" column when timeSlots is empty
    expect(screen.getByText("Day")).toBeInTheDocument();
    expect(screen.getByText("Schedule")).toBeInTheDocument();
  });

  // ── Refresh ──────────────────────────────────────────────────────

  it("calls getErpBatch again when the Refresh button is clicked", async () => {
    const model: TimetableModel = { timeSlots: [], days: [], subjects: [] };
    setupBatchResponse();
    executePipeline.mockReturnValue({ isValid: true, data: model, errors: [] });
    renderPage();
    expect(await screen.findByText("Class Timetable")).toBeInTheDocument();
    expect(getErpBatch).toHaveBeenCalledTimes(1);

    await userEvent.click(screen.getByRole("button", { name: /refresh/i }));
    expect(getErpBatch).toHaveBeenCalledTimes(2);
  });

  // ── Custom blueprint props ───────────────────────────────────────

  it("uses the blueprint heading and loading message", () => {
    getErpBatch.mockReturnValue(new Promise(() => {}));
    renderPage({ heading: "Weekly Timetable", loadingMessage: "Fetching schedule..." });
    expect(screen.getByText("Weekly Timetable")).toBeInTheDocument();
    expect(screen.getByText("Fetching schedule...")).toBeInTheDocument();
  });
});
