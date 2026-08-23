import { useEffect, useMemo, useState } from "react";
import {
  buildTrendSummary,
  getAttendanceHistory,
  type AttendanceSnapshot,
} from "../../../lib/erp/attendanceHistoryApi";

function formatDelta(delta: number): string {
  const rounded = Math.round(delta * 10) / 10;
  if (rounded > 0) return `+${rounded}%`;
  if (rounded < 0) return `${rounded}%`;
  return "±0%";
}

function Sparkline({ series }: { series: Array<{ date: string; average: number }> }) {
  if (series.length < 2) return null;
  const width = 220;
  const height = 48;
  const values = series.map((point) => point.average);
  const min = Math.min(...values, 40);
  const max = Math.max(...values, 100);
  const range = max - min || 1;
  const step = width / (series.length - 1);
  const points = series
    .map((point, index) => {
      const x = index * step;
      const y = height - ((point.average - min) / range) * (height - 6) - 3;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");

  return (
    <svg
      role="img"
      aria-label={`Average attendance over the last ${series.length} snapshots`}
      viewBox={`0 0 ${width} ${height}`}
      className="w-full max-w-60"
    >
      <polyline
        points={points}
        fill="none"
        stroke="var(--comp-accent)"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function AttendanceTrendSection({ refreshTrigger = 0 }: { refreshTrigger?: number }) {
  const [history, setHistory] = useState<AttendanceSnapshot[] | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let active = true;
    getAttendanceHistory()
      .then((data) => {
        if (!active) return;
        setHistory(Array.isArray(data) ? data : []);
      })
      .catch(() => {
        if (active) setFailed(true);
      });
    return () => {
      active = false;
    };
  }, [refreshTrigger]);

  const summary = useMemo(() => buildTrendSummary(history ?? []), [history]);

  if (failed || !summary || summary.series.length === 0) {
    // Trend is supplementary; absence is not an error worth surfacing.
    return null;
  }

  const deltaColor =
    summary.averageDelta > 0 ? "var(--success)" : summary.averageDelta < 0 ? "var(--error)" : "var(--comp-text-muted)";

  return (
    <section aria-label="Attendance trend" className="dashboard-card flex flex-col gap-2 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm text-[var(--comp-text-secondary)]">Average attendance</p>
          <div className="mt-1 flex items-baseline gap-2">
            <p className="text-2xl font-semibold text-[var(--comp-text-primary)]">
              {summary.currentAverage}%
            </p>
            <span className="text-sm font-semibold" style={{ color: deltaColor }}>
              {formatDelta(summary.averageDelta)} vs previous snapshot
            </span>
          </div>
          <p className="mt-1 text-xs text-[var(--comp-text-muted)]">
            Based on {summary.series.length} daily snapshot{summary.series.length !== 1 ? "s" : ""}
          </p>
        </div>
        <Sparkline series={summary.series} />
      </div>

      {summary.subjects.length > 0 ? (
        <div className="flex flex-col gap-2 border-t pt-3" style={{ borderColor: "var(--comp-border)" }}>
          <p className="text-xs font-semibold text-[var(--comp-text-secondary)]">Changes this snapshot</p>
          <ul className="grid grid-cols-1 gap-x-6 gap-y-1 md:grid-cols-2">
            {summary.subjects.map((subject) => (
              <li key={subject.subjectCode} className="flex items-center justify-between gap-3 text-sm">
                <span className="min-w-0 truncate text-[var(--comp-text-primary)]">
                  <span className="font-medium">{subject.subjectCode}</span>{" "}
                  <span className="text-[var(--comp-text-muted)]">{subject.subjectDescription}</span>
                </span>
                <span
                  className="shrink-0 font-semibold"
                  style={{
                    color:
                      subject.delta > 0 ? "var(--success)" : subject.delta < 0 ? "var(--error)" : "var(--comp-text-muted)",
                  }}
                >
                  {formatDelta(subject.delta)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}
