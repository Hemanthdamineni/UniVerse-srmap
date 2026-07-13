import { useMemo } from "react";
import { sanitizeVisibleText } from "../../components/erp/ErpPrimitives";
import { executePipeline, type TimetableModel } from "../../lib/erp/erpTransformers";
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

const SLOT_WINDOWS = [
  { startHour: 9, startMinute: 0, endHour: 9, endMinute: 50 },
  { startHour: 10, startMinute: 0, endHour: 10, endMinute: 50 },
  { startHour: 11, startMinute: 0, endHour: 11, endMinute: 50 },
  { startHour: 12, startMinute: 0, endHour: 12, endMinute: 50 },
  { startHour: 13, startMinute: 0, endHour: 13, endMinute: 50 },
  { startHour: 14, startMinute: 0, endHour: 14, endMinute: 50 },
  { startHour: 15, startMinute: 0, endHour: 15, endMinute: 50 },
  { startHour: 16, startMinute: 0, endHour: 17, endMinute: 30 },
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
  const token = bracketMatch ? bracketMatch[1] : compact;
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

function startOfDay(value: Date) {
  return new Date(value.getFullYear(), value.getMonth(), value.getDate()).getTime();
}

function deriveSlotStatus(targetDate: Date, slotIndex: number) {
  const dateDiff = startOfDay(targetDate) - startOfDay(new Date());
  if (dateDiff < 0) return "Completed";
  if (dateDiff > 0) return "Upcoming";

  const now = new Date();
  const slot = SLOT_WINDOWS[slotIndex];
  if (!slot) return "Scheduled";

  const start = new Date(targetDate);
  start.setHours(slot.startHour, slot.startMinute, 0, 0);

  const end = new Date(targetDate);
  end.setHours(slot.endHour, slot.endMinute, 0, 0);

  if (now < start) return "Upcoming";
  if (now > end) return "Completed";
  return "Live";
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
    const status = deriveSlotStatus(targetDate, index);

    return {
      time,
      coursename: sanitizeVisibleText(courseDetail?.name || courseInfo?.title),
      courseid: sanitizeVisibleText(courseDetail?.code || courseInfo?.courseCode),
      professor: sanitizeVisibleText(courseDetail?.faculty || "Faculty TBA"),
      type: "Lecture",
      room: sanitizeVisibleText(courseDetail?.room || courseInfo?.room, "TBA"),
      status,
      isEmpty: false,
    };
  });

  return (
    <div className="grid grid-rows-17 grid-cols-12 grid-flow-row-dense p-2 h-full overflow-y-auto">
      {/* Header */}
      <div className="row-span-1 col-span-12 m-2">
        <h1 className="section-title font-bold">Schedule</h1>
      </div>

      {/* Schedule Entries */}
      {scheduleEntries.map((entry, index) => (
        <div key={index} className="row-span-2 col-span-12 grid grid-cols-12 mt-2">
          <div className="col-span-2 items-start">
            <p className="label-text" style={{ textTransform: 'none', letterSpacing: 'normal', fontSize: '12px' }}>{entry.time}</p>
          </div>
          {entry.isEmpty ? (
            <div className="col-span-10 dashboard-subcard p-2 flex items-center justify-center">
              <p className="body-text text-sm italic">Free Period</p>
            </div>
          ) : (
            <div className="col-span-10 dashboard-subcard p-2">
              <div className="flex flex-col h-full justify-between">
                <p className="text-[14px] leading-none capitalize truncate" style={{ color: 'var(--comp-text-primary)' }}>
                  {entry.coursename}
                </p>
                <div className="flex justify-between items-center mt-1">
                  <p className="text-[12px] leading-none flex-1 truncate" style={{ color: 'var(--comp-text-primary)' }}>{entry.professor}</p>
                  <p className="text-[10px] leading-none ml-2" style={{ color: 'var(--comp-text-muted)' }}>
                    [{entry.courseid}]
                  </p>
                </div>
                <div className="flex justify-between items-center mt-1">
                  <p className="text-[10px] leading-none" style={{ color: 'var(--comp-text-muted)' }}>
                    {entry.type} - {entry.room}
                  </p>
                  <StatusBadge status={entry.status} className="text-[10px] ml-2" />
                </div>
              </div>
            </div>
          )}
        </div>
      ))}

      {/* Footer */}
      <div className="row-span-1 col-span-12">
        <h1 className="text-[12px]" style={{ color: 'var(--comp-text-muted)' }}>5:30 pm</h1>
      </div>
    </div>
  );
}

export default Schedule;
