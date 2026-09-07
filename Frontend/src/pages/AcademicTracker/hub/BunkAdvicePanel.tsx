/**
 * BunkAdvicePanel.tsx — the Academic Hub's answer to "can I skip class?"
 * (Batch B6, T4.1.1 + T4.1.3).
 *
 * Reads the student graph's per-subject attendance and, for each subject,
 * states the concrete number: how many more you can miss before dropping below
 * 75%, or how many you must attend to climb back — plus a blunt flag when 75%
 * is mathematically out of reach for the term.
 */
import { SectionCard } from "../../../components/erp/ErpPrimitives";
import { calculateBunkCapacity } from "../../ERP/components/BunkCalculator";
import type { AttendanceSubject, StudentGraph } from "../../../lib/core/studentGraph";

const THRESHOLD = 75;

// Rough fraction of a term still ahead when a student checks this mid-semester.
// Only used to say "75% is out of reach unless N more classes are held".
const ASSUMED_REMAINING_FRACTION = 0.4;

type Advice = {
  subject: AttendanceSubject;
  tone: "safe" | "caution" | "required" | "unreachable";
  headline: string;
  detail: string;
};

function adviseSubject(s: AttendanceSubject): Advice | null {
  if (s.conducted == null || s.present == null || s.conducted <= 0) return null;

  const r = calculateBunkCapacity(s.conducted, s.present, THRESHOLD, 0);
  const plausibleRemaining = Math.max(1, Math.round(s.conducted * ASSUMED_REMAINING_FRACTION));

  if (r.status === "required") {
    const reachable = r.classesNeededToAttend <= plausibleRemaining;
    return {
      subject: s,
      tone: reachable ? "required" : "unreachable",
      headline: reachable
        ? `Attend the next ${r.classesNeededToAttend} to get back to ${THRESHOLD}%`
        : `${THRESHOLD}% is out of reach this term`,
      detail: reachable
        ? `You're at ${fmtPct(s.pct)}. Miss any of those ${r.classesNeededToAttend} and it slips again.`
        : `You'd need ${r.classesNeededToAttend} more attended classes but only about ${plausibleRemaining} are likely left. Talk to the faculty about make-up sessions or a condonation.`,
    };
  }

  if (r.status === "caution") {
    return {
      subject: s,
      tone: "caution",
      headline: `Only ${r.safeToSkip} class${r.safeToSkip === 1 ? "" : "es"} of slack`,
      detail: `At ${fmtPct(s.pct)}. One or two absences drop you below ${THRESHOLD}%.`,
    };
  }

  return {
    subject: s,
    tone: "safe",
    headline: `You can miss ${r.safeToSkip} more`,
    detail: `At ${fmtPct(s.pct)}, ${r.safeToSkip} absence${r.safeToSkip === 1 ? "" : "s"} still leaves you at or above ${THRESHOLD}%.`,
  };
}

function fmtPct(pct: number | null): string {
  return pct == null ? "—" : `${Math.round(pct)}%`;
}

const TONE_STYLE: Record<Advice["tone"], { border: string; text: string; badge: string }> = {
  safe: { border: "var(--success)", text: "var(--success)", badge: "Safe" },
  caution: { border: "var(--warning)", text: "var(--warning)", badge: "Tight" },
  required: { border: "var(--error)", text: "var(--error)", badge: "Below 75%" },
  unreachable: { border: "var(--error)", text: "var(--error)", badge: "Detention risk" },
};

export function BunkAdvicePanel({ graph }: { graph: StudentGraph | null }) {
  const subjects = graph?.academic.attendance?.subjects ?? [];
  const advice = subjects.map(adviseSubject).filter((a): a is Advice => a !== null);

  if (advice.length === 0) return null;

  const totalSlack = advice
    .filter((a) => a.tone === "safe" || a.tone === "caution")
    .reduce((sum, a) => {
      const r = calculateBunkCapacity(a.subject.conducted!, a.subject.present!, THRESHOLD, 0);
      return sum + r.safeToSkip;
    }, 0);
  const below = advice.filter((a) => a.tone === "required" || a.tone === "unreachable").length;

  return (
    <SectionCard title="Can I skip class?">
      <p className="mb-4 text-sm" style={{ color: "var(--comp-text-secondary)" }}>
        {below > 0
          ? `${below} subject${below === 1 ? " is" : "s are"} below ${THRESHOLD}%. Across the rest you have ${totalSlack} class${totalSlack === 1 ? "" : "es"} of slack.`
          : `You have ${totalSlack} class${totalSlack === 1 ? "" : "es"} of total slack across ${advice.length} subjects.`}
        {graph?.academic.attendance?.asOf ? ` As of ${graph.academic.attendance.asOf}.` : ""}
      </p>

      <ul className="flex list-none flex-col gap-2 p-0">
        {advice
          .slice()
          .sort((a, b) => toneRank(a.tone) - toneRank(b.tone))
          .map((a) => {
            const style = TONE_STYLE[a.tone];
            return (
              <li
                key={a.subject.code}
                className="rounded-lg border p-3"
                style={{ borderColor: `color-mix(in srgb, ${style.border} 45%, transparent)` }}
              >
                <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                  <span className="text-sm font-semibold" style={{ color: "var(--comp-text-primary)" }}>
                    {a.subject.code}
                    <span className="ml-2 font-normal" style={{ color: "var(--comp-text-muted)" }}>
                      {a.subject.name}
                    </span>
                  </span>
                  <span
                    className="rounded-full px-2 py-0.5 text-xs font-semibold"
                    style={{ background: `color-mix(in srgb, ${style.border} 18%, transparent)`, color: style.text }}
                  >
                    {style.badge}
                  </span>
                </div>
                <p className="mt-1.5 text-sm font-medium" style={{ color: style.text }}>
                  {a.headline}
                </p>
                <p className="mt-0.5 text-xs" style={{ color: "var(--comp-text-secondary)" }}>
                  {a.detail}
                </p>
              </li>
            );
          })}
      </ul>
    </SectionCard>
  );
}

function toneRank(tone: Advice["tone"]): number {
  return { unreachable: 0, required: 1, caution: 2, safe: 3 }[tone];
}

