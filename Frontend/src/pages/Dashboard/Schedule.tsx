import { useEffect, useMemo, useRef } from "react";
import { sanitizeVisibleText } from "../../components/erp/ErpPrimitives";
import { executePipeline, type TimetableModel } from "../../lib/erp/erpTransformers";
import {
  describeSlotTiming,
  findFocusSlotIndex,
  SLOT_WINDOWS,
} from "../../lib/erp/scheduleTiming";

const TIME_SLOTS = [
  { slot: "1", time: "9:00 am" },
  { slot: "2", time: "10:00 am" },
  { slot: "3", time: "11:00 am" },
  { slot: "4", time: "12:00 pm" },
  { slot: "5", time: "1:00 pm" },
  { slot: "6", time: "2:00 pm" },
  { slot: "7", time: "3:00 pm" },
  { slot: "8", time: "4:00 pm" },
];

const DAY_ALIASES: Record<string, string[]> = {
  sunday: ["sun", "sunday"],
  monday: ["mon", "monday"],
  tuesday: ["tue", "tues", "tuesday"],
  wednesday: ["wed", "weds", "wednesday"],
  thursday: ["thu", "thur", "thurs", "thursday"],
  friday: ["fri", "friday"],
  saturday: ["sat", "saturday"],
};

function normalizeText(value: unknown) {
  return String(value || "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function normalizeCodeToken(value: unknown) {
  return normalizeText(value).replace(/[^a-z0-9]/g, "");
}

function matchesDayLabel(cellValue: unknown, targetDay: string) {
  const normalizedCell = normalizeText(cellValue);
  if (!normalizedCell) return false;

  const normalizedTarget = normalizeText(targetDay);
  if (normalizedCell === normalizedTarget) return true;

  const aliases = DAY_ALIASES[normalizedTarget] || [normalizedTarget];
  return aliases.some((alias) => normalizedCell === alias || normalizedCell.includes(alias));
}

/** Normalizes a room token's single-letter block prefix: "c 507"/"C507" → "C 507". */
function formatRoomToken(room: string) {
  return room.replace(/^([a-z])\s*(\d+)$/i, (_m, letter: string, digits: string) => `${letter.toUpperCase()} ${digits}`);
}

function extractCourseInfo(rawValue: string) {
  const trimmed = sanitizeVisibleText(rawValue);
  if (!trimmed) return null;

  const compact = trimmed.replace(/\s+/g, " ").trim();
  const bracketMatch = compact.match(/\[([^\]]+)\]/);
  let token = bracketMatch ? bracketMatch[1] : compact;

  // Handle new format: "CSE401(C311) — CODING SKILLS - III"
  // Extract just the code(room) part before the em dash
  const dashIndex = token.indexOf(" — ");
  if (dashIndex > 0) {
    token = token.substring(0, dashIndex).trim();
  }

  // Split the course code from its room list. ERP emits one or more
  // parenthesized rooms ("CSE457(C 302)(c 507)") or a dash-delimited room
  // ("CSE457-C302"); the old single-group regex dropped everything past the
  // first ")" and dumped the raw string into the title.
  const codeMatch = token.match(/^([A-Za-z]{2,}\s*\d{2,4}(?:\s*[A-Za-z])?)\s*(.*)$/);

  if (codeMatch) {
    const courseCode = codeMatch[1].replace(/\s+/g, " ").trim().toUpperCase();
    const rooms: string[] = [];
    let rest = codeMatch[2]
      .replace(/\(([^)]*)\)/g, (_m, inner: string) => {
        if (inner.trim()) rooms.push(inner.trim());
        return " ";
      })
      .replace(/\s+/g, " ")
      .trim();
    if (rooms.length === 0 && rest) {
      rest = rest.replace(/^[-\s]+|[-\s]+$/g, "");
      if (rest) rooms.push(rest);
    }
    return {
      title: courseCode,
      courseCode,
      room: rooms.length ? rooms.map(formatRoomToken).join(", ") : "TBA",
    };
  }

  return {
    title: compact,
    courseCode: compact,
    room: "TBA",
  };
}

function Schedule({ scheduleData, selectedDate }: { scheduleData?: unknown; selectedDate?: Date }) {
  const targetDate = selectedDate || new Date();
  const currentDay = targetDate.toLocaleDateString('en-US', { weekday: 'long' });
  const timetable = useMemo(() => {
    const pipelineResult = executePipeline("timetable", scheduleData);
    if (!pipelineResult?.isValid || !pipelineResult.data) return null;
    return pipelineResult.data as TimetableModel;
  }, [scheduleData]);

  const referenceTimes = timetable?.timeSlots?.length
    ? timetable.timeSlots
    : TIME_SLOTS.map(({ time }) => time);
  const daySchedule = timetable?.days.find((day) => matchesDayLabel(day.day, currentDay)) || null;
  // Day closing boundary comes from the standard slot windows (the long last
  // lab slot ends 17:30) rather than a hardcoded literal.
  const closingTimeLabel = (() => {
    const lastWindow = SLOT_WINDOWS[SLOT_WINDOWS.length - 1];
    return new Date(2000, 0, 1, lastWindow.endHour, lastWindow.endMinute)
      .toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true })
      .toLowerCase();
  })();

  const scheduleEntries = referenceTimes.map((time, index) => {
    const classInfo = sanitizeVisibleText(daySchedule?.slots[index]?.classDetails);

    if (!classInfo) {
      return {
        time,
        coursename: "",
        courseid: "",
        professor: "",
        type: "",
        room: "",
        status: "",
        isEmpty: true,
      };
    }

    const courseInfo = extractCourseInfo(classInfo);
    const courseDetail =
      timetable?.subjects.find((subject) => normalizeCodeToken(subject.code) === normalizeCodeToken(courseInfo?.courseCode)) ||
      timetable?.subjects.find((subject) => normalizeCodeToken(subject.code) === normalizeCodeToken(classInfo)) ||
      timetable?.subjects.find((subject) => normalizeText(subject.name) === normalizeText(classInfo)) ||
      null;
    const timing = describeSlotTiming(targetDate, index);
    // Subject names are raw model values and need sanitizing; the extracted
    // fallback title was already sanitized + uppercased inside
    // extractCourseInfo, and a second pass would re-title-case codes
    // ("CSE 306" → "Cse 306").
    const resolvedName = courseDetail?.name
      ? sanitizeVisibleText(courseDetail.name)
      : String(courseInfo?.title || "").trim();
    // Codes are normalized upstream (uppercase); sanitizeVisibleText would
    // re-title-case them ("CSE 457" → "Cse 457"), so only trim here.
    const resolvedId = String(courseDetail?.code || courseInfo?.courseCode || "").trim();

    return {
      time,
      coursename: resolvedName,
      courseid: resolvedId,
      // When no subject matched, the title IS the code — don't render it twice.
      showCourseId: resolvedName !== resolvedId,
      professor: sanitizeVisibleText(courseDetail?.faculty || "Faculty TBA"),
      type: "Lecture",
      room: sanitizeVisibleText(courseDetail?.room || courseInfo?.room, "TBA"),
      status: timing.status,
      timingLabel: timing.label,
      isEmpty: false,
    };
  });

  const entryRefs = useRef<Array<HTMLDivElement | null>>([]);
  const listRef = useRef<HTMLDivElement | null>(null);
  const hasAutoScrolledRef = useRef(false);

  const focusSlotIndex = useMemo(
    () =>
      findFocusSlotIndex(
        scheduleEntries.length,
        (index) => !scheduleEntries[index]?.isEmpty,
        targetDate,
      ),
    [scheduleEntries, targetDate],
  );

  useEffect(() => {
    if (focusSlotIndex < 0 || hasAutoScrolledRef.current) return;
    const list = listRef.current;
    const node = entryRefs.current[focusSlotIndex];
    if (!list || !node) return;
    hasAutoScrolledRef.current = true;
    const reduceMotion =
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    // Center the live slot within this list only. scrollIntoView would climb
    // past the list (equal-grow rows often leave it without overflow) into
    // the overflow-hidden app shell and shift the whole page up.
    const listRect = list.getBoundingClientRect();
    const nodeRect = node.getBoundingClientRect();
    const target =
      list.scrollTop + (nodeRect.top - listRect.top) - (list.clientHeight - nodeRect.height) / 2;
    list.scrollTo({ top: Math.max(0, target), behavior: reduceMotion ? "auto" : "smooth" });
  }, [focusSlotIndex]);

  return (
    <div className="flex h-full flex-col p-4 pb-20">
      <h2 className="card-title mb-2 font-semibold shrink-0">Schedule</h2>

      {/* Slot list: calendar-grid semantics — basis-0 + equal grow gives
          every slot an identical share of the card, so Free Period blocks
          are exactly as tall as class blocks (user preference). The 70px
          floor mirrors the class card's content height (3 rows + padding)
          so equal shares never shrink a slot below readable. auto-scroll-
          to-live targets these rows (unchanged behavior). The root is NOT
          the scroller — this inner list is — so the root's pb-20 stays a
          fixed blank footer and the floating search/shortcuts overlay
          always sits on empty card surface, never on a row. */}
      <div ref={listRef} className="flex min-h-0 flex-1 flex-col gap-1.5 overflow-y-auto">
        {scheduleEntries.map((entry, index) => (
          <div
            key={index}
            ref={(el) => {
              entryRefs.current[index] = el;
            }}
            className="flex min-h-[70px] grow basis-0 items-stretch gap-2"
          >
            <div className="flex w-12 shrink-0 flex-col items-start pt-2.5 min-[480px]:w-14">
              <p className="label-text leading-tight">
                {entry.time.split(/\s+TO\s+/i)[0]}
              </p>
            </div>
            {entry.isEmpty ? (
              <div className="flex-1 dashboard-subcard p-2.5 flex items-center justify-center">
                <p className="body-text text-sm italic">Free Period</p>
              </div>
            ) : (
              <div
                className="flex-1 min-w-0 dashboard-subcard p-2.5"
                // Local surface lift: a whisper of the brand teal so class
                // blocks read solid next to the neutral Free Period cards
                // (dashboard-subcard's own bg is shared with QuickLinks and
                // stays near-invisible at 12% mix).
                style={{ background: "color-mix(in srgb, var(--comp-accent) 5%, var(--comp-surface))" }}
              >
                <div className="flex flex-col h-full">
                  <p className="text-sm leading-none capitalize truncate" style={{ color: 'var(--comp-text-primary)' }}>
                    {entry.coursename}
                  </p>
                  <div className="flex justify-between items-center mt-1">
                    <p className="text-xs leading-none flex-1 truncate" style={{ color: 'var(--comp-text-primary)' }}>{entry.professor}</p>
                    {entry.showCourseId ? (
                      <p className="text-xs leading-none ml-2 shrink-0 tabular-nums" style={{ color: 'var(--comp-text-muted)' }}>
                        {entry.courseid}
                      </p>
                    ) : null}
                  </div>
                  <div className="flex justify-between items-center mt-1">
                    {/* Room only: the type is hardcoded "Lecture" for every
                        entry, and the prefix crowded the room into ellipsis. */}
                    <p className="text-xs leading-none truncate" style={{ color: 'var(--comp-text-muted)' }}>
                      {entry.room}
                    </p>
                    {/* The countdown takes the status pill's place — same
                        status-badge chassis and token colors, but the label
                        is the timer. The status word remains only where no
                        countdown exists (viewing another day). Inline
                        metrics keep the pill at 14px so rows stay on their
                        64px floor and the rail keeps fitting the viewport. */}
                    <span
                      className={`ml-2 shrink-0 status-badge tabular-nums ${
                        entry.status === "Live"
                          ? "status-badge-live"
                          : entry.status === "Upcoming"
                            ? "status-badge-open"
                            : "status-badge-closed"
                      }`}
                      style={{ paddingTop: 1, paddingBottom: 1, lineHeight: 1, borderWidth: 0 }}
                    >
                      {entry.timingLabel ?? entry.status}
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>
        ))}

        {/* Closing boundary of the teaching day */}
        <p className="text-xs" style={{ color: 'var(--comp-text-muted)' }}>{closingTimeLabel}</p>
      </div>
    </div>
  );
}

export default Schedule;
