import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { PageBlueprint } from "../../config/erpBlueprints";
import type { AcademicCalendar, CurriculumModel } from "../../lib/erp/types";
import CurriculumPage from "./CurriculumPage";
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

const getAcademicCalendar = vi.fn();

vi.mock("../../lib/erp/calendarApi", () => ({
  get getAcademicCalendar() {
    return getAcademicCalendar;
  },
}));

// ── Helpers ───────────────────────────────────────────────────────────

function renderPage(blueprint?: Partial<PageBlueprint>) {
  const defaultBlueprint: PageBlueprint = {
    route: "/academic/curriculum",
    heading: "Curriculum",
    fetchKeys: ["academic/student-wise-subjects"],
    domain: "erp",
    sourceMode: "erp",
    integrationState: "native",
    renderer: "curriculum",
    loadingMessage: "Loading curriculum...",
  };
  return render(
    <QueryClientProvider client={createTestQueryClient()}>
      <MemoryRouter>
        <CurriculumPage blueprint={{ ...defaultBlueprint, ...blueprint }} />
      </MemoryRouter>
    </QueryClientProvider>
  );
}

const MODEL: CurriculumModel = {
  subjects: [
    { semester: "5", code: "CSE301", description: "Operating Systems", credit: "4", group: "Professional Core" },
    { semester: "5", code: "CSE302", description: "Elective: Cloud Computing", credit: "3", group: "Program Elective" },
  ],
};

const CALENDAR: AcademicCalendar = {
  oddSemesterData: [
    { id: 5, details: "Commencement of Classes", date: "03.08.2026", day: "Monday" },
    { id: 10, details: "Midterm Examinations/ Assessments", date: "28.09.2026 - 01.10.2026", day: "Monday - Thursday" },
    { id: 18, details: "Last Day of Teaching", date: "30.11.2026", day: "Monday" },
    { id: 28, details: "Winter Break for Students", date: "22.12.2026 - 03.01.2027", day: "Tuesday - Sunday" },
  ],
  evenSemesterData: [
    { id: 4, details: "Commencement of Classes", date: "04.01.2027", day: "Monday" },
    { id: 17, details: "Last Day of Teaching", date: "30.04.2027", day: "Friday" },
  ],
  summerTermData: [
    { id: 2, details: "Commencement of Classes", date: "02.06.2027", day: "Wednesday" },
  ],
  oddSemesterHolidays: [
    { id: 2, occasion: "Eid Milad-Un-Nabi", date: "26.08.2026", day: "Tuesday" },
    { id: 5, occasion: "Mahatma Gandhi Jayanthi", date: "02.10.2026", day: "Friday" },
  ],
  evenSemesterHolidays: [
    { id: 2, occasion: "Pongal/Sankranthi", date: "15.01.2027", day: "Friday" },
  ],
  importantNotes: ["Dates are subject to change as per the university's discretion."],
};

function stubResizeObserver() {
  (globalThis as any).ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
}

// ── Suite ─────────────────────────────────────────────────────────────

describe("CurriculumPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    stubResizeObserver();
    // Pin "today" inside the odd-semester window so countdowns are deterministic.
    vi.useFakeTimers({ now: new Date(2026, 7, 22, 10, 0, 0), shouldAdvanceTime: true });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("renders loading overlay with the configured message", () => {
    getErpBatch.mockReturnValue(new Promise(() => {}));
    getAcademicCalendar.mockReturnValue(new Promise(() => {}));
    renderPage();
    expect(screen.getByText("Loading curriculum...")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Curriculum" })).toBeInTheDocument();
  });

  it("renders curriculum subjects on the default tab", async () => {
    getErpBatch.mockResolvedValue({
      "academic/student-wise-subjects": { success: true, data: {} },
    });
    executePipeline.mockReturnValue({ isValid: true, data: MODEL, errors: [] });
    getAcademicCalendar.mockResolvedValue(CALENDAR);

    renderPage();
    expect(await screen.findByText("CSE301")).toBeInTheDocument();
    expect(screen.getByText("Operating Systems")).toBeInTheDocument();
    expect(screen.getByText("Semester 5")).toBeInTheDocument();
  });

  it("renders term context strip with detected term and countdowns", async () => {
    getErpBatch.mockResolvedValue({
      "academic/student-wise-subjects": { success: true, data: {} },
    });
    executePipeline.mockReturnValue({ isValid: true, data: MODEL, errors: [] });
    getAcademicCalendar.mockResolvedValue(CALENDAR);

    renderPage();
    expect(await screen.findByText("Current Term")).toBeInTheDocument();
    expect(screen.getByText("Odd Semester")).toBeInTheDocument();
    expect(screen.getByText("Midterm Examinations/ Assessments")).toBeInTheDocument();
    expect(screen.getByText("Next Holiday")).toBeInTheDocument();
    expect(screen.getByText("Eid Milad-Un-Nabi")).toBeInTheDocument();
  });

  it("switches to the calendar tab and shows the odd-semester timeline", async () => {
    getErpBatch.mockResolvedValue({
      "academic/student-wise-subjects": { success: true, data: {} },
    });
    executePipeline.mockReturnValue({ isValid: true, data: MODEL, errors: [] });
    getAcademicCalendar.mockResolvedValue(CALENDAR);

    renderPage();
    await screen.findByText("CSE301");

    await userEvent.click(screen.getByRole("tab", { name: "Calendar" }));
    expect(await screen.findByRole("tabpanel", { name: /odd semester events/i })).toBeInTheDocument();
    expect(screen.getByText("Last Day of Teaching")).toBeInTheDocument();
    expect(screen.getByText("Winter Break for Students")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("tab", { name: "Even" }));
    expect(await screen.findByRole("tabpanel", { name: /even semester events/i })).toBeInTheDocument();
    expect(screen.getAllByText(/Commencement of Classes/i).length).toBeGreaterThan(0);
  });

  it("switches to the holidays tab with segregated lists and notes", async () => {
    getErpBatch.mockResolvedValue({
      "academic/student-wise-subjects": { success: true, data: {} },
    });
    executePipeline.mockReturnValue({ isValid: true, data: MODEL, errors: [] });
    getAcademicCalendar.mockResolvedValue(CALENDAR);

    renderPage();
    await screen.findByText("CSE301");

    await userEvent.click(screen.getByRole("tab", { name: "Holidays" }));
    expect((await screen.findAllByText("Eid Milad-Un-Nabi")).length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("Mahatma Gandhi Jayanthi")).toBeInTheDocument();
    expect(screen.getByText("Important Notes")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("tab", { name: "Even Semester" }));
    expect(await screen.findByText("Pongal/Sankranthi")).toBeInTheDocument();
  });

  it("still renders subjects when the calendar request fails", async () => {
    getErpBatch.mockResolvedValue({
      "academic/student-wise-subjects": { success: true, data: {} },
    });
    executePipeline.mockReturnValue({ isValid: true, data: MODEL, errors: [] });
    getAcademicCalendar.mockRejectedValue(new Error("calendar down"));

    renderPage();
    expect(await screen.findByText("CSE301")).toBeInTheDocument();
    expect(screen.queryByText("Current Term")).not.toBeInTheDocument();
  });

  it("shows curriculum error while keeping the calendar strip", async () => {
    getErpBatch.mockRejectedValue(new Error("ERP session expired"));
    getAcademicCalendar.mockResolvedValue(CALENDAR);

    renderPage();
    expect(await screen.findByText("ERP session expired")).toBeInTheDocument();
    expect(screen.getByText("Current Term")).toBeInTheDocument();
  });

  it("provides a retry button that re-fetches data", async () => {
    getErpBatch.mockRejectedValue(new Error("First attempt failed"));
    getAcademicCalendar.mockResolvedValue(CALENDAR);
    renderPage();
    expect(await screen.findByText("First attempt failed")).toBeInTheDocument();
    expect(getErpBatch).toHaveBeenCalledTimes(1);

    getErpBatch.mockResolvedValue({
      "academic/student-wise-subjects": { success: true, data: {} },
    });
    executePipeline.mockReturnValue({ isValid: true, data: MODEL, errors: [] });

    await userEvent.click(screen.getByRole("button", { name: /try again/i }));
    await vi.waitFor(() => {
      expect(getErpBatch).toHaveBeenCalledTimes(2);
    });
  });
});
