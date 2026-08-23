import type {
  AcademicCalendar,
  AcademicCalendarEvent,
  AcademicHoliday,
  CalendarTerm,
} from "./types";

const DAY_MS = 24 * 60 * 60 * 1000;

export function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

/** Parses SRM calendar dates like "28.09.2026" (dd.MM.yyyy). */
export function parseCalendarDate(dateString: string): Date | null {
  const parts = dateString.trim().split(".");
  if (parts.length !== 3) return null;
  const [day, month, year] = parts.map((p) => Number.parseInt(p, 10));
  if (!day || !month || !year || Number.isNaN(day) || Number.isNaN(month) || Number.isNaN(year)) {
    return null;
  }
  const parsed = new Date(year, month - 1, day);
  if (parsed.getDate() !== day || parsed.getMonth() !== month - 1) return null;
  return parsed;
}

export interface CalendarDateRange {
  start: Date;
  end: Date;
}

/** Parses a calendar date or range string ("28.09.2026 - 01.10.2026") into a start/end pair. */
export function parseCalendarRange(dateString: string): CalendarDateRange | null {
  const segments = dateString.split("-").map((s) => s.trim());
  if (segments.length === 1) {
    const single = parseCalendarDate(segments[0]);
    return single ? { start: single, end: single } : null;
  }
  // Ranges may be "28.09.2026 - 01.10.2026" or shorthand "28 - 30.09.2026".
  const start = parseCalendarDate(segments[0]) ?? parseShorthandDate(segments[0], segments[1]);
  const end = parseCalendarDate(segments[segments.length - 1]);
  if (!start || !end) return null;
  return { start, end };
}

function parseShorthandDate(shorthand: string, reference: string): Date | null {
  const refParts = reference.trim().split(".");
  if (refParts.length !== 3) return null;
  return parseCalendarDate(`${shorthand.trim()}.${refParts[1]}.${refParts[2]}`);
}

export function isRangePassed(dateString: string, now: Date = new Date()): boolean {
  const range = parseCalendarRange(dateString);
  if (!range) return false;
  return endOfDay(range.end).getTime() < now.getTime();
}

function endOfDay(date: Date): Date {
  const end = startOfDay(date);
  end.setHours(23, 59, 59, 999);
  return end;
}

export function formatCalendarDate(dateString: string): string {
  const range = parseCalendarRange(dateString);
  if (!range) return dateString;
  const formatter = new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
  if (range.start.getTime() === range.end.getTime()) {
    return formatter.format(range.start);
  }
  return `${formatter.format(range.start)} – ${formatter.format(range.end)}`;
}

export function daysUntil(date: Date, now: Date = new Date()): number {
  return Math.round((startOfDay(date).getTime() - startOfDay(now).getTime()) / DAY_MS);
}

export function findNextEvent(
  events: AcademicCalendarEvent[],
  now: Date = new Date(),
): AcademicCalendarEvent | null {
  for (const event of events) {
    const range = parseCalendarRange(event.date);
    if (!range) continue;
    if (endOfDay(range.end).getTime() >= now.getTime()) return event;
  }
  return null;
}

export function findNextHoliday(
  holidays: AcademicHoliday[],
  now: Date = new Date(),
): AcademicHoliday | null {
  for (const holiday of holidays) {
    const date = parseCalendarDate(holiday.date);
    if (!date) continue;
    if (endOfDay(date).getTime() >= now.getTime()) return holiday;
  }
  return null;
}

export interface TermWindow {
  term: CalendarTerm;
  classStart: Date | null;
  teachingEnd: Date | null;
}

const CLASS_START_PATTERN = /commencement of classes/i;
const TEACHING_END_PATTERN = /last day of teaching/i;

export function getTermWindows(calendar: AcademicCalendar): Record<CalendarTerm, TermWindow> {
  const build = (term: CalendarTerm, events: AcademicCalendarEvent[]): TermWindow => ({
    term,
    classStart:
      events.find((e) => CLASS_START_PATTERN.test(e.details))
        ? parseCalendarDate(events.find((e) => CLASS_START_PATTERN.test(e.details))!.date)
        : null,
    teachingEnd:
      events.find((e) => TEACHING_END_PATTERN.test(e.details))
        ? parseCalendarDate(events.find((e) => TEACHING_END_PATTERN.test(e.details))!.date)
        : null,
  });
  return {
    odd: build("odd", calendar.oddSemesterData),
    even: build("even", calendar.evenSemesterData),
    summer: build("summer", calendar.summerTermData),
  };
}

function lastEventEndDate(events: AcademicCalendarEvent[]): Date | null {
  let latest: Date | null = null;
  for (const eventItem of events) {
    const range = parseCalendarRange(eventItem.date);
    if (!range) continue;
    if (!latest || range.end.getTime() > latest.getTime()) latest = range.end;
  }
  return latest;
}

/**
 * Resolves which term "now" falls into by class windows; falls back to the
 * nearest upcoming term and finally to a coarse month heuristic.
 */
export function resolveCurrentTerm(
  calendar: AcademicCalendar,
  now: Date = new Date(),
): CalendarTerm {
  const windows = getTermWindows(calendar);

  for (const term of ["odd", "even", "summer"] as CalendarTerm[]) {
    const window = windows[term];
    if (window.classStart && window.teachingEnd) {
      const time = now.getTime();
      if (
        startOfDay(window.classStart).getTime() <= time &&
        time <= endOfDay(window.teachingEnd).getTime()
      ) {
        return term;
      }
    }
  }

  const upcoming = (["odd", "even", "summer"] as CalendarTerm[])
    .map((term) => ({ term, start: windows[term].classStart }))
    .filter((entry): entry is { term: CalendarTerm; start: Date } => entry.start !== null)
    .filter((entry) => startOfDay(entry.start).getTime() > now.getTime())
    .sort((a, b) => a.start.getTime() - b.start.getTime());
  if (upcoming.length > 0) return upcoming[0].term;

  // After every term: pick whichever term's activity ended most recently.
  const termEvents: Record<CalendarTerm, AcademicCalendarEvent[]> = {
    odd: calendar.oddSemesterData,
    even: calendar.evenSemesterData,
    summer: calendar.summerTermData,
  };
  const past = (["even", "summer", "odd"] as CalendarTerm[])
    .map((term) => ({
      term,
      end: windows[term].teachingEnd ?? lastEventEndDate(termEvents[term]),
    }))
    .filter((entry): entry is { term: CalendarTerm; end: Date } => entry.end !== null)
    .sort((a, b) => b.end.getTime() - a.end.getTime());
  if (past.length > 0) return past[0].term;

  const month = now.getMonth();
  if (month >= 7 && month <= 11) return "odd";
  if (month <= 4) return "even";
  return "summer";
}

/** Fraction (0..1) of the teaching period elapsed, or null when unknown. */
export function computeTeachingProgress(
  window: TermWindow,
  now: Date = new Date(),
): number | null {
  if (!window.classStart || !window.teachingEnd) return null;
  const start = startOfDay(window.classStart).getTime();
  const end = endOfDay(window.teachingEnd).getTime();
  const time = now.getTime();
  if (time <= start) return 0;
  if (time >= end) return 1;
  return (time - start) / (end - start);
}
