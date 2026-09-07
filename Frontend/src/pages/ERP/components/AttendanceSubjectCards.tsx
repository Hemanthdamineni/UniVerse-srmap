import { Link } from "react-router-dom";
import { calculateBunkCapacity } from "./BunkCalculator";

/**
 * Mobile presentation of the attendance table.
 *
 * The desktop table carries twelve columns; on a 390px screen that pushed the
 * attendance percentage — the number students open the app for — off the first
 * paint. Each subject becomes a card that leads with the percentage and the
 * resulting action ("you can miss 3 more"), with the raw counts demoted.
 */

export type AttendanceRecord = {
  subjectCode: string;
  subjectDescription: string;
  classesConducted: number;
  attendanceEntered: number;
  odMlTaken: number;
  present: number;
  odMlApprovedPct: number;
  attendancePct: number;
};

const STATUS_COLOR: Record<string, string> = {
  safe: "var(--success)",
  caution: "var(--warning)",
  required: "var(--error)",
};

function actionLine(status: string, safeToSkip: number, needed: number): string {
  if (status === "required") {
    return needed > 0
      ? `Attend ${needed} more ${needed === 1 ? "class" : "classes"} to reach 75%`
      : "Attend every remaining class to stay at 75%";
  }
  return `You can miss ${safeToSkip} more ${safeToSkip === 1 ? "class" : "classes"}`;
}

export default function AttendanceSubjectCards({ records }: { records: AttendanceRecord[] }) {
  return (
    <ul className="flex list-none flex-col gap-3 p-0">
      {records.map((rec) => {
        const bunk = calculateBunkCapacity(
          rec.classesConducted,
          rec.present,
          75,
          rec.odMlTaken,
        );
        const color = STATUS_COLOR[bunk.status] ?? "var(--comp-text-secondary)";
        const below = rec.attendancePct < 75;

        return (
          <li
            key={rec.subjectCode}
            className="rounded-xl border p-4"
            style={{ borderColor: "var(--comp-border)", backgroundColor: "var(--comp-surface)" }}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-semibold" style={{ color: "var(--comp-text-primary)" }}>
                  {rec.subjectCode}
                </p>
                <p className="mt-0.5 text-xs" style={{ color: "var(--comp-text-secondary)" }}>
                  {rec.subjectDescription}
                </p>
              </div>
              <p
                className="shrink-0 text-2xl font-bold leading-none tabular-nums"
                style={{ color: below ? "var(--error)" : "var(--success)" }}
              >
                {rec.attendancePct.toFixed(0)}%
              </p>
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-2">
              <span
                className="erp-status-pill"
                style={{
                  backgroundColor: `color-mix(in srgb, ${color} 20%, transparent)`,
                  color,
                }}
              >
                {bunk.status === "safe" ? "✓ Safe" : bunk.status === "caution" ? "⚠ Caution" : "✕ Required"}
              </span>
              <span className="text-xs font-medium" style={{ color }}>
                {actionLine(bunk.status, bunk.safeToSkip, bunk.classesNeededToAttend)}
              </span>
            </div>

            <dl
              className="mt-3 grid grid-cols-3 gap-2 border-t pt-3 text-xs"
              style={{ borderColor: "var(--comp-border)" }}
            >
              {[
                ["Conducted", rec.classesConducted],
                ["Present", rec.present],
                ["OD/ML", rec.odMlTaken],
              ].map(([label, value]) => (
                <div key={String(label)}>
                  <dt style={{ color: "var(--comp-text-muted)" }}>{label}</dt>
                  <dd className="m-0 font-semibold tabular-nums" style={{ color: "var(--comp-text-primary)" }}>
                    {value}
                  </dd>
                </div>
              ))}
            </dl>

            <Link
              to={`/learn/discover?subjectCode=${encodeURIComponent(rec.subjectCode)}`}
              className="comp-btn-ghost mt-3 inline-flex min-h-11 rounded-full px-3 py-1 text-xs font-semibold"
            >
              Resources
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
