import { describe, expect, it } from "vitest";
import {
  buildTrendSummary,
  type AttendanceSnapshot,
} from "./attendanceHistoryApi";

function snapshot(date: string, values: Record<string, number | null>): AttendanceSnapshot {
  return {
    date,
    subjects: Object.entries(values).map(([subjectCode, attendancePercentage]) => ({
      subjectCode,
      subjectDescription: `Desc ${subjectCode}`,
      attendancePercentage,
      classesConducted: null,
      present: null,
    })),
  };
}

const HISTORY: AttendanceSnapshot[] = [
  snapshot("2026-08-20", { CSE301: 80, CSE302: 70 }),
  snapshot("2026-08-21", { CSE301: 85, CSE302: 66.67 }),
];

describe("buildTrendSummary", () => {
  it("computes averages, series, and per-subject deltas", () => {
    const summary = buildTrendSummary(HISTORY);
    expect(summary).not.toBeNull();
    expect(summary?.currentAverage).toBeCloseTo(75.83, 1);
    expect(summary?.previousAverage).toBe(75);
    expect(summary?.series).toHaveLength(2);

    // Sorted best-mover first.
    expect(summary?.subjects[0]).toMatchObject({ subjectCode: "CSE301", delta: 5 });
    expect(summary?.subjects[1]).toMatchObject({ subjectCode: "CSE302", delta: -3.33 });
  });

  it("returns null without history or numeric data", () => {
    expect(buildTrendSummary([])).toBeNull();
    expect(buildTrendSummary([snapshot("2026-08-21", { CSE301: null })])).toBeNull();
  });

  it("omits per-subject deltas when only one snapshot exists", () => {
    const summary = buildTrendSummary([HISTORY[0]]);
    expect(summary?.subjects).toHaveLength(0);
    expect(summary?.averageDelta).toBe(0);
  });

  it("skips subjects missing a previous reading", () => {
    const history = [
      snapshot("2026-08-20", { CSE301: 80 }),
      snapshot("2026-08-21", { CSE301: 84, CSE999: 50 }),
    ];
    const summary = buildTrendSummary(history);
    expect(summary?.subjects.map((s) => s.subjectCode)).toEqual(["CSE301"]);
  });
});
