import { useMemo } from "react";
import type { AcademicCalendar } from "../../../lib/erp/types";
import {
  computeTeachingProgress,
  daysUntil,
  findNextEvent,
  findNextHoliday,
  formatCalendarDate,
  getTermWindows,
  resolveCurrentTerm,
} from "../../../lib/erp/calendarUtils";

const TERM_LABEL: Record<string, string> = {
  odd: "Odd Semester",
  even: "Even Semester",
  summer: "Summer Term",
};

const TERM_EVENT_KEY = {
  odd: "oddSemesterData",
  even: "evenSemesterData",
  summer: "summerTermData",
} as const;

function formatCountdown(days: number): string {
  if (days <= 0) return "Today";
  if (days === 1) return "Tomorrow";
  return `in ${days} days`;
}

export function TermContextStrip({
  calendar,
  now = new Date(),
}: {
  calendar: AcademicCalendar;
  now?: Date;
}) {
  const currentTerm = useMemo(() => resolveCurrentTerm(calendar, now), [calendar, now]);
  const windows = useMemo(() => getTermWindows(calendar), [calendar]);

  const nextMilestone = useMemo(
    () => findNextEvent(calendar[TERM_EVENT_KEY[currentTerm]], now),
    [calendar, currentTerm, now],
  );

  const nextHoliday = useMemo(() => {
    const all = [...calendar.oddSemesterHolidays, ...calendar.evenSemesterHolidays];
    return findNextHoliday(all, now);
  }, [calendar, now]);

  const progress = useMemo(() => computeTeachingProgress(windows[currentTerm], now), [
    windows,
    currentTerm,
    now,
  ]);

  const milestoneDays = nextMilestone ? daysUntilSafe(nextMilestone.date, now) : null;
  const holidayDays = nextHoliday ? daysUntilSafe(nextHoliday.date, now) : null;

  return (
    <section aria-label="Current term overview" className="grid grid-cols-1 gap-3 lg:grid-cols-3">
      <div className="dashboard-card p-4">
        <p className="text-sm text-[var(--comp-text-secondary)]">Current Term</p>
        <p className="mt-1 text-xl font-semibold text-[var(--comp-text-primary)]">
          {TERM_LABEL[currentTerm]}
        </p>
        {progress !== null ? (
          <div className="mt-3">
            <div
              role="progressbar"
              aria-label="Teaching weeks elapsed"
              aria-valuenow={Math.round(progress * 100)}
              aria-valuemin={0}
              aria-valuemax={100}
              className="h-2 w-full overflow-hidden rounded-full"
              style={{ background: "color-mix(in srgb, var(--comp-accent) 12%, transparent)" }}
            >
              <div
                className="h-full w-full origin-left rounded-full transition-transform duration-700"
                style={{
                  transform: `scaleX(${progress})`,
                  background: "var(--comp-accent)",
                  transitionTimingFunction: "cubic-bezier(0.16, 1, 0.3, 1)",
                }}
              />
            </div>
            <p className="mt-1 text-xs text-[var(--comp-text-muted)]">
              {Math.round(progress * 100)}% through the teaching period
            </p>
          </div>
        ) : (
          <p className="mt-3 text-xs text-[var(--comp-text-muted)]">Teaching dates unavailable</p>
        )}
      </div>

      <div className="dashboard-card p-4">
        <p className="text-sm text-[var(--comp-text-secondary)]">Next Milestone</p>
        {nextMilestone ? (
          <>
            <p className="mt-1 line-clamp-2 text-base font-semibold text-[var(--comp-text-primary)]">
              {nextMilestone.details}
            </p>
            <p className="mt-1 flex flex-wrap items-baseline gap-x-2 text-sm text-[var(--comp-text-muted)]">
              <span>{formatCalendarDate(nextMilestone.date)}</span>
              {milestoneDays !== null && Number.isFinite(milestoneDays) ? (
                <span
                  className="rounded-full px-2 py-0.5 text-xs font-semibold"
                  style={{
                    background: "color-mix(in srgb, var(--comp-accent) 14%, transparent)",
                    color: "var(--comp-accent)",
                  }}
                >
                  {formatCountdown(milestoneDays)}
                </span>
              ) : null}
            </p>
          </>
        ) : (
          <p className="mt-3 text-xs text-[var(--comp-text-muted)]">
            No upcoming events this term
          </p>
        )}
      </div>

      <div className="dashboard-card p-4">
        <p className="text-sm text-[var(--comp-text-secondary)]">Next Holiday</p>
        {nextHoliday ? (
          <>
            <p className="mt-1 text-base font-semibold text-[var(--comp-text-primary)]">
              {nextHoliday.occasion}
            </p>
            <p className="mt-1 flex flex-wrap items-baseline gap-x-2 text-sm text-[var(--comp-text-muted)]">
              <span>{formatCalendarDate(nextHoliday.date)}</span>
              {holidayDays !== null && Number.isFinite(holidayDays) ? (
                <span
                  className="rounded-full px-2 py-0.5 text-xs font-semibold"
                  style={{
                    background: "color-mix(in srgb, var(--success) 14%, transparent)",
                    color: "var(--success)",
                  }}
                >
                  {formatCountdown(holidayDays)}
                </span>
              ) : null}
            </p>
          </>
        ) : (
          <p className="mt-3 text-xs text-[var(--comp-text-muted)]">
            No upcoming holidays listed
          </p>
        )}
      </div>
    </section>
  );
}

function parseDate(dateString: string): Date | null {
  const parts = dateString.trim().split(".");
  if (parts.length !== 3) return null;
  const [d, m, y] = parts.map((p) => Number.parseInt(p, 10));
  if (!d || !m || !y) return null;
  return new Date(y, m - 1, d);
}

function daysUntilSafe(dateString: string, now: Date): number | null {
  const range = dateString.split(" - ");
  const target = parseDate((range[0] ?? "").trim());
  if (!target) return null;
  return daysUntil(target, now);
}
