import { useMemo, useState } from "react";
import type { AcademicCalendar, CalendarTerm } from "../../../lib/erp/types";
import {
  formatCalendarDate,
  isRangePassed,
  parseCalendarRange,
} from "../../../lib/erp/calendarUtils";

const SEMESTER_TABS: Array<{ value: CalendarTerm; label: string }> = [
  { value: "odd", label: "Odd Semester" },
  { value: "even", label: "Even Semester" },
];

interface BreakCard {
  title: string;
  date: string;
  day: string;
}

function findBreaks(calendar: AcademicCalendar): BreakCard[] {
  const breaks: BreakCard[] = [];
  for (const event of [...calendar.oddSemesterData, ...calendar.evenSemesterData]) {
    if (/break for students/i.test(event.details)) {
      breaks.push({ title: event.details, date: event.date, day: event.day });
    }
  }
  return breaks;
}

export function HolidaysSection({
  calendar,
  now = new Date(),
}: {
  calendar: AcademicCalendar;
  now?: Date;
}) {
  const [semester, setSemester] = useState<CalendarTerm>("odd");
  const holidays = semester === "odd" ? calendar.oddSemesterHolidays : calendar.evenSemesterHolidays;
  const breaks = useMemo(() => findBreaks(calendar), [calendar]);

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        {breaks.map((brk) => (
          <BreakBanner key={brk.title} card={brk} now={now} />
        ))}
      </div>

      <div
        role="tablist"
        aria-label="Select holiday list"
        className="inline-flex w-fit max-w-full overflow-x-auto rounded-lg border p-1"
        style={{ borderColor: "var(--comp-border)" }}
      >
        {SEMESTER_TABS.map((tab) => (
          <button
            key={tab.value}
            role="tab"
            type="button"
            aria-selected={semester === tab.value}
            onClick={() => setSemester(tab.value)}
            className="rounded-md px-4 py-1.5 text-sm font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2"
            style={
              semester === tab.value
                ? { background: "var(--comp-accent)", color: "var(--comp-accent-fg)" }
                : { color: "var(--comp-text-secondary)" }
            }
          >
            {tab.label}
          </button>
        ))}
      </div>

      <ul role="tabpanel" aria-label={`${semester} semester holidays`} className="flex flex-col gap-2">
        {holidays.length === 0 ? (
          <li className="dashboard-card p-4 text-sm text-[var(--comp-text-muted)]">
            No holidays published for this semester.
          </li>
        ) : null}
        {holidays.map((holiday) => {
          const passed = isRangePassed(holiday.date, now);
          return (
            <li
              key={`${holiday.id}-${holiday.occasion}`}
              className="flex items-center justify-between gap-3 rounded-xl border p-3 md:p-4"
              style={{
                borderColor: "var(--comp-border)",
                background: passed
                  ? "color-mix(in srgb, var(--success) 6%, transparent)"
                  : "transparent",
                opacity: passed ? 0.75 : 1,
              }}
            >
              <div>
                <p className="text-sm font-medium text-[var(--comp-text-primary)] md:text-base">
                  {holiday.occasion}
                </p>
                <p className="mt-0.5 text-xs text-[var(--comp-text-muted)] md:text-sm">{holiday.day}</p>
              </div>
              <time
                dateTime={holiday.date}
                className="shrink-0 whitespace-nowrap text-xs font-semibold text-[var(--comp-text-secondary)] md:text-sm"
              >
                {formatCalendarDate(holiday.date)}
              </time>
            </li>
          );
        })}
      </ul>

      {calendar.importantNotes.length > 0 ? (
        <div className="dashboard-card p-4">
          <p className="text-sm font-semibold text-[var(--comp-text-primary)]">Important Notes</p>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-xs text-[var(--comp-text-muted)] md:text-sm">
            {calendar.importantNotes.map((note) => (
              <li key={note}>{note}</li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

function BreakBanner({ card, now }: { card: BreakCard; now: Date }) {
  const range = parseCalendarRange(card.date);
  const time = now.getTime();
  let tone = "var(--info)";
  let status = "Upcoming";
  if (range) {
    const endOfDay = new Date(range.end);
    endOfDay.setHours(23, 59, 59, 999);
    if (time > endOfDay.getTime()) {
      tone = "var(--success)";
      status = "Completed";
    } else if (time >= range.start.getTime()) {
      tone = "var(--warning)";
      status = "Ongoing";
    }
  }

  return (
    <div
      className="rounded-xl border p-4"
      style={{
        borderColor: `color-mix(in srgb, ${tone} 35%, transparent)`,
        background: `color-mix(in srgb, ${tone} 8%, transparent)`,
      }}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-semibold text-[var(--comp-text-primary)] md:text-base">
          {card.title}
        </p>
        <span
          className="shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold"
          style={{ background: `color-mix(in srgb, ${tone} 16%, transparent)`, color: tone }}
        >
          {status}
        </span>
      </div>
      <p className="mt-1 text-xs text-[var(--comp-text-muted)] md:text-sm">
        {formatCalendarDate(card.date)} &middot; {card.day}
      </p>
    </div>
  );
}
