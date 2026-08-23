import { useEffect, useMemo, useRef } from "react";
import { sanitizeVisibleText } from "../../components/erp/ErpPrimitives";
import { executePipeline, type TimetableModel } from "../../lib/erp/erpTransformers";
import {
  describeSlotTiming,
  findFocusSlotIndex,
  SLOT_WINDOWS,
} from "../../lib/erp/scheduleTiming";
import { StatusBadge } from "../../components/ui/Badges";

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

  const match = token.match(/^([A-Z]{2,}\s*\d{2,4}(?:\s*[A-Z])?)\s*(?:\(|-)??\s*([^()-]+?)?\s*(?:\)|-)?$/i);

  if (match) {
    const courseCode = sanitizeVisibleText(match[1].replace(/\s+/g, " "));
    const room = sanitizeVisibleText(match[2], "TBA");
    return {
      title: courseCode,
      courseCode,
      room,
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

    return {
      time,
      coursename: sanitizeVisibleText(courseDetail?.name || courseInfo?.title),
      courseid: sanitizeVisibleText(courseDetail?.code || courseInfo?.courseCode),
      professor: sanitizeVisibleText(courseDetail?.faculty || "Faculty TBA"),
      type: "Lecture",
      room: sanitizeVisibleText(courseDetail?.room || courseInfo?.room, "TBA"),
      status: timing.status,
      timingLabel: timing.label,
      isEmpty: false,
    };
  });

  const entryRefs = useRef<Array<HTMLDivElement | null>>([]);
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
    const node = entryRefs.current[focusSlotIndex];
    if (!node || typeof node.scrollIntoView !== "function") return;
    hasAutoScrolledRef.current = true;
    const reduceMotion =
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    node.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "center" });
  }, [focusSlotIndex]);

  return (
    <div className="flex h-full flex-col overflow-y-auto p-4">
      <h2 className="card-title mb-3 font-semibold shrink-0">Schedule</h2>

      {/* Slot list: flat column rhythm via gap; auto-scroll-to-live targets
          these rows (unchanged behavior). */}
      <div className="flex flex-col gap-2">
        {scheduleEntries.map((entry, index) => (
          <div
            key={index}
            ref={(el) => {
              entryRefs.current[index] = el;
            }}
            className="flex items-stretch gap-2"
          >
            <div className="flex w-16 shrink-0 flex-col items-start gap-0.5 pt-2 min-[480px]:w-20">
              {entry.time.split(/\s+TO\s+/i).map((part, i) => (
                <p key={i} className="label-text leading-tight">
                  {part}
                </p>
              ))}
            </div>
            {entry.isEmpty ? (
              <div className="flex-1 dashboard-subcard p-2 flex items-center justify-center">
                <p className="body-text text-sm italic">Free Period</p>
              </div>
            ) : (
              <div className="flex-1 min-w-0 dashboard-subcard p-2">
                <div className="flex flex-col h-full justify-between">
                  <p className="text-sm leading-none capitalize truncate" style={{ color: 'var(--comp-text-primary)' }}>
                    {entry.coursename}
                  </p>
                  <div className="flex justify-between items-center mt-1">
                    <p className="text-xs leading-none flex-1 truncate" style={{ color: 'var(--comp-text-primary)' }}>{entry.professor}</p>
                    <p className="text-xs leading-none ml-2 shrink-0" style={{ color: 'var(--comp-text-muted)' }}>
                      [{entry.courseid}]
                    </p>
                  </div>
                  <div className="flex justify-between items-center mt-1">
                    <p className="text-xs leading-none truncate" style={{ color: 'var(--comp-text-muted)' }}>
                      {entry.type} - {entry.room}
                    </p>
                    <span className="ml-2 shrink-0 flex items-center gap-2">
                      {entry.timingLabel ? (
                        <span
                          className="text-xs leading-none font-semibold"
                          style={{ color: entry.status === "Live" ? "var(--warning)" : "var(--comp-text-muted)" }}
                        >
                          {entry.timingLabel}
                        </span>
                      ) : null}
                      <StatusBadge status={entry.status} />
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
