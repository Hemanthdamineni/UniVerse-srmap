import { useEffect, useMemo, useRef, useState } from "react";
import type { AcademicCalendar, AcademicCalendarEvent, CalendarTerm } from "../../../lib/erp/types";
import {
  formatCalendarDate,
  isRangePassed,
  parseCalendarRange,
} from "../../../lib/erp/calendarUtils";
import { handleTabArrowKeys } from "./tabKeyboard";

const TERM_TABS: Array<{ value: CalendarTerm; label: string }> = [
  { value: "odd", label: "Odd" },
  { value: "even", label: "Even" },
  { value: "summer", label: "Summer" },
];

const TERM_EVENT_KEY = {
  odd: "oddSemesterData",
  even: "evenSemesterData",
  summer: "summerTermData",
} as const;

type EventState = "past" | "ongoing" | "upcoming";

function eventState(event: AcademicCalendarEvent, now: Date): EventState {
  const range = parseCalendarRange(event.date);
  if (!range) return "upcoming";
  const time = now.getTime();
  if (time > range.end.getTime() && isRangePassed(event.date, now)) {
    const endOfDay = new Date(range.end);
    endOfDay.setHours(23, 59, 59, 999);
    if (time > endOfDay.getTime()) return "past";
  }
  if (time >= range.start.getTime()) return "ongoing";
  return "upcoming";
}

export function AcademicTimelineSection({
  calendar,
  now = new Date(),
}: {
  calendar: AcademicCalendar;
  now?: Date;
}) {
  const [term, setTerm] = useState<CalendarTerm>("odd");
  const events: AcademicCalendarEvent[] = calendar[TERM_EVENT_KEY[term]];

  const nextIndex = useMemo(() => {
    for (let i = 0; i < events.length; i += 1) {
      if (eventState(events[i], now) !== "past") return i;
    }
    return -1;
  }, [events, now]);

  const upcomingRef = useRef<HTMLLIElement | null>(null);
  const hasScrolledRef = useRef(false);

  useEffect(() => {
    hasScrolledRef.current = false;
  }, [term]);

  useEffect(() => {
    if (nextIndex < 0 || hasScrolledRef.current) return;
    const node = upcomingRef.current;
    if (!node) return;
    hasScrolledRef.current = true;
    const reduceMotion =
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (typeof node.scrollIntoView === "function") {
      node.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "nearest" });
    }
  }, [nextIndex, term]);

  return (
    <div className="flex flex-col gap-4">
      <div
        role="tablist"
        aria-label="Select semester"
        className="inline-flex w-fit max-w-full overflow-x-auto rounded-lg border p-1"
        style={{ borderColor: "var(--comp-border)" }}
        onKeyDown={handleTabArrowKeys}
      >
        {TERM_TABS.map((tab) => (
          <button
            key={tab.value}
            role="tab"
            type="button"
            aria-selected={term === tab.value}
            data-term-tab={tab.value}
            onClick={() => setTerm(tab.value)}
            onKeyDown={handleTabArrowKeys}
            className="rounded-md px-4 py-1.5 text-sm font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2"
            style={
              term === tab.value
                ? { background: "var(--comp-accent)", color: "var(--comp-accent-fg)" }
                : { color: "var(--comp-text-secondary)" }
            }
          >
            {tab.label}
          </button>
        ))}
      </div>

      <ol className="relative flex flex-col gap-2" role="tabpanel" aria-label={`${term} semester events`}>
        {events.length === 0 ? (
          <li className="dashboard-card p-4 text-sm text-[var(--comp-text-muted)]">
            No events published for this term.
          </li>
        ) : null}
        {events.map((event, index) => {
          const state = eventState(event, now);
          const isNext = index === nextIndex;
          return (
            <li
              key={`${event.id}-${event.details}`}
              ref={isNext ? upcomingRef : undefined}
              tabIndex={isNext ? -1 : undefined}
              className="flex gap-3 rounded-xl border p-3 md:p-4"
              style={{
                borderColor:
                  state === "ongoing"
                    ? "color-mix(in srgb, var(--warning) 45%, transparent)"
                    : isNext
                      ? "color-mix(in srgb, var(--comp-accent) 45%, transparent)"
                      : "var(--comp-border)",
                background:
                  state === "past"
                    ? "color-mix(in srgb, var(--success) 6%, transparent)"
                    : state === "ongoing"
                      ? "color-mix(in srgb, var(--warning) 8%, transparent)"
                      : "transparent",
                opacity: state === "past" ? 0.75 : 1,
              }}
            >
              <span
                aria-hidden="true"
                className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full"
                style={{
                  background:
                    state === "past"
                      ? "var(--success)"
                      : state === "ongoing"
                        ? "var(--warning)"
                        : "var(--comp-accent)",
                }}
              />
              <div className="flex min-w-0 flex-1 flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-[var(--comp-text-primary)] md:text-base">
                    {event.details}
                    {state === "ongoing" ? (
                      <span
                        className="ml-2 rounded-full px-2 py-0.5 align-middle text-xs font-semibold"
                        style={{
                          background: "color-mix(in srgb, var(--warning) 16%, transparent)",
                          color: "var(--warning)",
                        }}
                      >
                        Ongoing
                      </span>
                    ) : null}
                  </p>
                  <p className="mt-0.5 text-xs text-[var(--comp-text-muted)] md:text-sm">
                    {event.day}
                  </p>
                </div>
                <time
                  className="shrink-0 whitespace-nowrap text-xs font-semibold text-[var(--comp-text-secondary)] md:text-sm"
                  dateTime={event.date}
                >
                  {formatCalendarDate(event.date)}
                </time>
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
