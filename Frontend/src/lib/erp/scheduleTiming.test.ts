import { describe, expect, it } from "vitest";
import {
  deriveSlotStatus,
  describeSlotTiming,
  findFocusSlotIndex,
} from "./scheduleTiming";

const TODAY = new Date(2026, 7, 22); // Sat 22 Aug 2026, midnight
const at = (h: number, m: number) => new Date(2026, 7, 22, h, m);

describe("deriveSlotStatus", () => {
  it("marks slots live within their window", () => {
    expect(deriveSlotStatus(TODAY, 0, at(9, 30))).toBe("Live");
    // Slot 8 is the long lab window (16:00–17:30).
    expect(deriveSlotStatus(TODAY, 7, at(17, 15))).toBe("Live");
  });

  it("is boundary-exact at window edges", () => {
    expect(deriveSlotStatus(TODAY, 0, at(9, 0))).toBe("Live");
    expect(deriveSlotStatus(TODAY, 0, at(9, 51))).toBe("Completed");
  });

  it("classifies past and future days wholesale", () => {
    const yesterday = new Date(2026, 7, 21);
    const tomorrow = new Date(2026, 7, 23);
    expect(deriveSlotStatus(yesterday, 3, at(10, 0))).toBe("Completed");
    expect(deriveSlotStatus(tomorrow, 3, at(10, 0))).toBe("Upcoming");
  });

  it("returns Upcoming for unknown slot indexes today", () => {
    expect(deriveSlotStatus(TODAY, 99, at(10, 0))).toBe("Upcoming");
  });
});

describe("describeSlotTiming", () => {
  it("labels live slots with remaining minutes", () => {
    const timing = describeSlotTiming(TODAY, 0, at(9, 38));
    expect(timing.status).toBe("Live");
    expect(timing.label).toMatch(/^ends in \d+m$/);
  });

  it("labels upcoming slots with a compact start countdown", () => {
    const timing = describeSlotTiming(TODAY, 2, at(9, 45));
    expect(timing.status).toBe("Upcoming");
    expect(timing.label).toBe("in 75m");
  });

  it("uses hour formatting for distant slots", () => {
    expect(describeSlotTiming(TODAY, 7, at(9, 0)).label).toBe("in 7h");
    expect(describeSlotTiming(TODAY, 2, at(7, 45)).label).toBe("in 3h 15m");
  });

  it("gives no label for other days or completed slots", () => {
    const otherDay = new Date(2026, 7, 25);
    expect(describeSlotTiming(otherDay, 0, at(9, 30)).label).toBeNull();
    expect(describeSlotTiming(TODAY, 0, at(12, 0)).label).toBeNull();
  });
});

describe("findFocusSlotIndex", () => {
  const hasClassAt = (index: number) => index === 1 || index === 4 || index === 6;

  it("prefers the live slot", () => {
    expect(findFocusSlotIndex(8, hasClassAt, TODAY, at(10, 30))).toBe(1);
  });

  it("falls back to the first upcoming class", () => {
    expect(findFocusSlotIndex(8, hasClassAt, TODAY, at(12, 10))).toBe(4);
  });

  it("returns -1 outside teaching hours", () => {
    expect(findFocusSlotIndex(8, hasClassAt, TODAY, at(20, 0))).toBe(-1);
  });
});
