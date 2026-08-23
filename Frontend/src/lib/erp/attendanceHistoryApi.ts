import { requestData } from "../core/apiClient";
import { isStaticPrototype } from "../core/prototype";

export interface AttendanceSnapshotSubject {
  subjectCode: string;
  subjectDescription: string;
  attendancePercentage: number | null;
  classesConducted: number | null;
  present: number | null;
}

export interface AttendanceSnapshot {
  /** India-time calendar date, yyyy-MM-dd. */
  date: string;
  subjects: AttendanceSnapshotSubject[];
}

export async function getAttendanceHistory(): Promise<AttendanceSnapshot[]> {
  if (isStaticPrototype()) {
    return STATIC_ATTENDANCE_HISTORY_FIXTURE;
  }
  return requestData<AttendanceSnapshot[]>("/api/attendance/history");
}

export interface SubjectTrend {
  subjectCode: string;
  subjectDescription: string;
  current: number;
  previous: number;
  delta: number;
}

export interface AttendanceTrendSummary {
  currentAverage: number;
  previousAverage: number;
  averageDelta: number;
  series: Array<{ date: string; average: number }>;
  subjects: SubjectTrend[];
}

function snapshotAverage(snapshot: AttendanceSnapshot): number | null {
  const values = snapshot.subjects
    .map((s) => s.attendancePercentage)
    .filter((v): v is number => v !== null && Number.isFinite(v));
  if (values.length === 0) return null;
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

/** Derives averages, a day-series, and per-subject deltas from snapshots. */
export function buildTrendSummary(history: AttendanceSnapshot[]): AttendanceTrendSummary | null {
  if (history.length === 0) return null;

  const series = history
    .map((snapshot) => ({ date: snapshot.date, average: snapshotAverage(snapshot) }))
    .filter((point): point is { date: string; average: number } => point.average !== null);
  if (series.length === 0) return null;

  const latest = history[history.length - 1];
  const prior = history.length >= 2 ? history[history.length - 2] : null;

  const subjects: SubjectTrend[] = [];
  if (prior) {
    const priorByCode = new Map(
      prior.subjects.map((s) => [s.subjectCode, s.attendancePercentage]),
    );
    for (const subject of latest.subjects) {
      const current = subject.attendancePercentage;
      const previous = priorByCode.get(subject.subjectCode);
      if (current === null || previous === null || previous === undefined) continue;
      subjects.push({
        subjectCode: subject.subjectCode,
        subjectDescription: subject.subjectDescription,
        current,
        previous,
        delta: Math.round((current - previous) * 100) / 100,
      });
    }
    subjects.sort((a, b) => b.delta - a.delta);
  }

  const currentAverage = series[series.length - 1].average;
  const previousAverage = series.length >= 2 ? series[series.length - 2].average : currentAverage;
  return {
    currentAverage: Math.round(currentAverage * 100) / 100,
    previousAverage: Math.round(previousAverage * 100) / 100,
    averageDelta: Math.round((currentAverage - previousAverage) * 100) / 100,
    series,
    subjects,
  };
}

const STATIC_ATTENDANCE_HISTORY_FIXTURE: AttendanceSnapshot[] = [
  {
    date: "2026-08-20",
    subjects: [
      { subjectCode: "CSE301", subjectDescription: "Operating Systems", attendancePercentage: 86, classesConducted: 18, present: 16 },
      { subjectCode: "CSE302", subjectDescription: "DBMS", attendancePercentage: 72, classesConducted: 16, present: 12 },
    ],
  },
  {
    date: "2026-08-21",
    subjects: [
      { subjectCode: "CSE301", subjectDescription: "Operating Systems", attendancePercentage: 90, classesConducted: 20, present: 18 },
      { subjectCode: "CSE302", subjectDescription: "DBMS", attendancePercentage: 66.67, classesConducted: 18, present: 12 },
    ],
  },
];
