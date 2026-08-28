export interface SlotWindow {
  startHour: number;
  startMinute: number;
  endHour: number;
  endMinute: number;
}

/** SRM AP standard daily slot windows; slot 8 is the long lab window. */
export const SLOT_WINDOWS: SlotWindow[] = [
  { startHour: 9, startMinute: 0, endHour: 9, endMinute: 50 },
  { startHour: 10, startMinute: 0, endHour: 10, endMinute: 50 },
  { startHour: 11, startMinute: 0, endHour: 11, endMinute: 50 },
  { startHour: 12, startMinute: 0, endHour: 12, endMinute: 50 },
  { startHour: 13, startMinute: 0, endHour: 13, endMinute: 50 },
  { startHour: 14, startMinute: 0, endHour: 14, endMinute: 50 },
  { startHour: 15, startMinute: 0, endHour: 15, endMinute: 50 },
  { startHour: 16, startMinute: 0, endHour: 17, endMinute: 30 },
];

function windowStart(base: Date, window: SlotWindow): Date {
  return new Date(base.getFullYear(), base.getMonth(), base.getDate(), window.startHour, window.startMinute, 0, 0);
}

function windowEnd(base: Date, window: SlotWindow): Date {
  return new Date(base.getFullYear(), base.getMonth(), base.getDate(), window.endHour, window.endMinute, 0, 0);
}

function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

export type SlotStatus = "Completed" | "Live" | "Upcoming";

export function deriveSlotStatus(targetDate: Date, slotIndex: number, now: Date = new Date()): SlotStatus {
  const dayDiff = Math.round(
    (new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate()).getTime() -
      new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()) /
      (24 * 60 * 60 * 1000),
  );
  if (dayDiff < 0) return "Completed";
  if (dayDiff > 0) return "Upcoming";

  const window = SLOT_WINDOWS[slotIndex];
  if (!window) return "Upcoming";

  if (now < windowStart(targetDate, window)) return "Upcoming";
  if (now > windowEnd(targetDate, window)) return "Completed";
  return "Live";
}

export interface SlotTiming {
  status: SlotStatus;
  /** Human label like "ends in 12 min" / "starts in 5 min"; null when not today's date. */
  label: string | null;
}

export function describeSlotTiming(
  targetDate: Date,
  slotIndex: number,
  now: Date = new Date(),
): SlotTiming {
  const status = deriveSlotStatus(targetDate, slotIndex, now);
  if (!isSameDay(targetDate, now)) {
    return { status, label: null };
  }

  const window = SLOT_WINDOWS[slotIndex];
  if (!window) return { status, label: null };

  const minutes = (diffMs: number) => Math.max(1, Math.round(diffMs / 60000));

  if (status === "Live") {
    const remaining = windowEnd(targetDate, window).getTime() - now.getTime();
    // Compact units ("in 8h 41m") keep the label short enough that the
    // Schedule row's room text survives next to the status pill.
    return { status, label: `ends in ${minutes(remaining)}m` };
  }
  if (status === "Upcoming") {
    const until = windowStart(targetDate, window).getTime() - now.getTime();
    if (until > 90 * 60 * 1000) {
      const hours = Math.floor(until / (60 * 60 * 1000));
      const mins = Math.round((until % (60 * 60 * 1000)) / 60000);
      return { status, label: mins > 0 ? `in ${hours}h ${mins}m` : `in ${hours}h` };
    }
    return { status, label: `in ${minutes(until)}m` };
  }
  return { status, label: null };
}

/**
 * Index of the slot to bring into view: the live one, else the first
 * upcoming one, else -1.
 */
export function findFocusSlotIndex(
  slotCount: number,
  hasClassAt: (index: number) => boolean,
  targetDate: Date,
  now: Date = new Date(),
): number {
  let firstUpcoming = -1;
  for (let index = 0; index < slotCount; index += 1) {
    if (!hasClassAt(index)) continue;
    const status = deriveSlotStatus(targetDate, index, now);
    if (status === "Live") return index;
    if (status === "Upcoming" && firstUpcoming === -1) firstUpcoming = index;
  }
  return firstUpcoming;
}
