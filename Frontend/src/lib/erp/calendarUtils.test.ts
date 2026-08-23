import { describe, expect, it } from "vitest";
import type { AcademicCalendar, AcademicCalendarEvent } from "./types";
import {
  computeTeachingProgress,
  daysUntil,
  findNextEvent,
  findNextHoliday,
  formatCalendarDate,
  getTermWindows,
  isRangePassed,
  parseCalendarDate,
  parseCalendarRange,
  resolveCurrentTerm,
} from "./calendarUtils";

function utcDate(y: number, m: number, d: number): Date {
  // Local-time constructor keeps comparisons consistent with calendarUtils.
  return new Date(y, m - 1, d);
}

const event = (id: number, details: string, date: string): AcademicCalendarEvent => ({
  id,
  details,
  date,
  day: "",
});

describe("parseCalendarDate", () => {
  it("parses dd.MM.yyyy dates", () => {
    expect(parseCalendarDate("28.09.2026")).toEqual(utcDate(2026, 9, 28));
  });

  it("returns null for malformed input", () => {
    expect(parseCalendarDate("2026-09-28")).toBeNull();
    expect(parseCalendarDate("32.13.2026")).toBeNull();
    expect(parseCalendarDate("")).toBeNull();
  });
});

describe("parseCalendarRange", () => {
  it("expands a single date into start==end", () => {
    const range = parseCalendarRange("28.09.2026");
    expect(range?.start).toEqual(utcDate(2026, 9, 28));
    expect(range?.end).toEqual(utcDate(2026, 9, 28));
  });

  it("parses full ranges", () => {
    const range = parseCalendarRange("28.09.2026 - 01.10.2026");
    expect(range?.start).toEqual(utcDate(2026, 9, 28));
    expect(range?.end).toEqual(utcDate(2026, 10, 1));
  });

  it("parses shorthand ranges sharing month and year", () => {
    const range = parseCalendarRange("22 - 26.12.2026");
    expect(range?.start).toEqual(utcDate(2026, 12, 22));
    expect(range?.end).toEqual(utcDate(2026, 12, 26));
  });

  it("returns null when unparseable", () => {
    expect(parseCalendarRange("not a date")).toBeNull();
  });
});

describe("isRangePassed", () => {
  it("is false while the end date is today", () => {
    expect(isRangePassed("20.08.2026 - 22.08.2026", utcDate(2026, 8, 22))).toBe(false);
  });

  it("is true the day after the end date", () => {
    expect(isRangePassed("20.08.2026 - 21.08.2026", utcDate(2026, 8, 22))).toBe(true);
  });
});

describe("formatCalendarDate", () => {
  it("formats single dates", () => {
    expect(formatCalendarDate("02.10.2026")).toBe("2 Oct 2026");
  });

  it("formats ranges with an en dash", () => {
    expect(formatCalendarDate("07.12.2026 - 21.12.2026")).toBe("7 Dec 2026 – 21 Dec 2026");
  });

  it("falls back to raw text when unparseable", () => {
    expect(formatCalendarDate("TBD")).toBe("TBD");
  });
});

describe("daysUntil", () => {
  it("counts whole days regardless of time of day", () => {
    const now = new Date(2026, 7, 22, 18, 30);
    expect(daysUntil(utcDate(2026, 8, 26), now)).toBe(4);
    expect(daysUntil(new Date(2026, 7, 22, 6, 0), now)).toBe(0);
  });
});

describe("findNextEvent / findNextHoliday", () => {
  const events = [
    event(1, "Past thing", "01.08.2026"),
    event(2, "Current thing", "20.08.2026 - 25.08.2026"),
    event(3, "Future thing", "28.09.2026"),
  ];

  it("skips past events including multi-day ranges still running", () => {
    const next = findNextEvent(events, utcDate(2026, 8, 24));
    expect(next?.id).toBe(2);
  });

  it("returns the first event ending after now", () => {
    const next = findNextEvent(events, utcDate(2026, 8, 26));
    expect(next?.id).toBe(3);
  });

  it("returns null when everything has passed", () => {
    expect(findNextEvent(events, utcDate(2027, 1, 1))).toBeNull();
  });

  it("finds the next holiday", () => {
    const holidays = [
      { id: 1, occasion: "Old", date: "01.01.2026", day: "" },
      { id: 2, occasion: "Eid Milad-Un-Nabi", date: "26.08.2026", day: "Tuesday" },
    ];
    expect(findNextHoliday(holidays, utcDate(2026, 8, 22))?.occasion).toBe("Eid Milad-Un-Nabi");
    expect(findNextHoliday(holidays, utcDate(2026, 8, 27))).toBeNull();
  });
});

const CALENDAR: AcademicCalendar = {
  oddSemesterData: [
    event(5, "Commencement of Classes", "03.08.2026"),
    event(10, "Midterm Examinations/ Assessments", "28.09.2026 - 01.10.2026"),
    event(18, "Last Day of Teaching", "30.11.2026"),
  ],
  evenSemesterData: [
    event(4, "Commencement of Classes", "04.01.2027"),
    event(17, "Last Day of Teaching", "30.04.2027"),
  ],
  summerTermData: [
    event(2, "Commencement of Classes", "02.06.2027"),
    event(3, "Window for Summer Term Examinations", "02.08.2027 - 04.08.2027"),
  ],
  oddSemesterHolidays: [],
  evenSemesterHolidays: [],
  importantNotes: [],
};

describe("resolveCurrentTerm", () => {
  it("detects odd semester inside its teaching window", () => {
    expect(resolveCurrentTerm(CALENDAR, utcDate(2026, 9, 15))).toBe("odd");
  });

  it("detects even semester inside its teaching window", () => {
    expect(resolveCurrentTerm(CALENDAR, utcDate(2027, 2, 15))).toBe("even");
  });

  it("detects summer term inside its window", () => {
    expect(resolveCurrentTerm(CALENDAR, utcDate(2027, 6, 20))).toBe("summer");
  });

  it("picks the nearest upcoming term during breaks (winter)", () => {
    expect(resolveCurrentTerm(CALENDAR, utcDate(2026, 12, 25))).toBe("even");
  });

  it("falls back to the most recently ended term after everything", () => {
    expect(resolveCurrentTerm(CALENDAR, utcDate(2028, 1, 1))).toBe("summer");
  });
});

describe("getTermWindows / computeTeachingProgress", () => {
  it("extracts class start and teaching end per term", () => {
    const windows = getTermWindows(CALENDAR);
    expect(windows.odd.classStart).toEqual(utcDate(2026, 8, 3));
    expect(windows.odd.teachingEnd).toEqual(utcDate(2026, 11, 30));
    expect(windows.summer.teachingEnd).toBeNull();
  });

  it("clamps progress to 0..1", () => {
    const windows = getTermWindows(CALENDAR);
    expect(computeTeachingProgress(windows.odd, utcDate(2026, 7, 1))).toBe(0);
    expect(computeTeachingProgress(windows.odd, utcDate(2026, 12, 15))).toBe(1);

    const progress = computeTeachingProgress(windows.odd, utcDate(2026, 9, 16));
    expect(progress).toBeGreaterThan(0);
    expect(progress).toBeLessThan(1);
  });

  it("returns null without teaching dates", () => {
    expect(computeTeachingProgress(getTermWindows(CALENDAR).summer, utcDate(2026, 8, 22))).toBeNull();
  });
});
