/**
 * BunkAdvicePanel.tsx — the Academic Hub's answer to "can I skip class?"
 * (Batch B6, T4.1.1 + T4.1.3).
 *
 * Reads the student graph's per-subject attendance and, for each subject,
 * states the concrete number: how many more you can miss before dropping below
 * 75%, or how many you must attend to climb back. When the ERP academic
 * calendar is available (`graph.derived.termProgress`), it projects each
 * subject to the last day of teaching using the classes-per-week pace so far —
 * so "75% is out of reach" is a real end-of-term forecast, not a guess.
 */
import { SectionCard } from "../../../components/erp/ErpPrimitives";
import { calculateBunkCapacity } from "../../ERP/components/BunkCalculator";
import type { AttendanceSubject, StudentGraph, TermProgress } from "../../../lib/core/studentGraph";

const THRESHOLD = 75;

// Fallback fraction of a term still ahead, used only when the academic
// calendar isn't available to give a real "weeks remaining".
const ASSUMED_REMAINING_FRACTION = 0.4;

type Advice = {
  subject: AttendanceSubject;
  tone: "safe" | "caution" | "required" | "unreachable";
  headline: string;
  detail: string;
};

/** Classes still to be held for this subject, from the pace so far. */
function projectRemainingClasses(conducted: number, term: TermProgress): number | null {
  if (!term.inTerm || term.weeksRemaining <= 0 || term.elapsedFraction <= 0.05) return null;
  const totalWeeks = term.weeksRemaining / Math.max(0.05, 1 - term.elapsedFraction);
  const weeksElapsed = totalWeeks - term.weeksRemaining;
  if (weeksElapsed < 2) return null; // too early for a stable rate
  const perWeek = conducted / weeksElapsed;
  return Math.max(0, Math.round(perWeek * term.weeksRemaining));
}

function adviseSubject(s: AttendanceSubject, term: TermProgress | null): Advice | null {
  if (s.conducted == null || s.present == null || s.conducted <= 0) return null;

  const r = calculateBunkCapacity(s.conducted, s.present, THRESHOLD, 0);

  // Real projection to the last day of teaching, when we have the calendar.
  const projectedRemaining = term ? projectRemainingClasses(s.conducted, term) : null;
  if (projectedRemaining != null) {
    const finalConducted = s.conducted + projectedRemaining;
    const bestCasePct = (finalConducted > 0 ? (s.present + projectedRemaining) / finalConducted : 0) * 100;
    // Min of the remaining classes to attend to clear 75% by term end.
    const mustAttend = Math.max(
      0,
      Math.ceil((THRESHOLD / 100) * finalConducted - s.present),
    );

    if (bestCasePct < THRESHOLD - 0.5) {
      return {
        subject: s,
        tone: "unreachable",
        headline: `${THRESHOLD}% is out of reach this term`,
        detail: `At ${fmtPct(s.pct)} with about ${projectedRemaining} class${
          projectedRemaining === 1 ? "" : "es"
        } left, even a perfect record from here lands you near ${Math.round(bestCasePct)}%. Ask the faculty about make-up sessions or a condonation.`,
      };
    }
    if (r.status === "required" || r.status === "caution") {
      return {
        subject: s,
        tone: r.status === "required" ? "required" : "caution",
        headline: `Attend ${mustAttend} of the ~${projectedRemaining} classes left`,
        detail: `You're at ${fmtPct(s.pct)}. Attending ${mustAttend} of the ~${projectedRemaining} remaining classes clears ${THRESHOLD}% by the last teaching day (${term!.weeksRemaining} week${
          term!.weeksRemaining === 1 ? "" : "s"
        } out); miss more and you slip.`,
      };
    }
    return {
      subject: s,
      tone: "safe",
      headline: `You can miss ${r.safeToSkip} more`,
      detail: `At ${fmtPct(s.pct)}. On your current pace you finish the term around ${Math.round(
        bestCasePct,
      )}% even after skipping ${r.safeToSkip}.`,
    };
  }

  // --- Fallback: no calendar, use the rough remaining-fraction heuristic. ---
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
  const term = graph?.derived.termProgress ?? null;
  const advice = subjects.map((s) => adviseSubject(s, term)).filter((a): a is Advice => a !== null);

  if (advice.length === 0) return null;

  const totalSlack = advice
    .filter((a) => a.tone === "safe" || a.tone === "caution")
    .reduce((sum, a) => {
      const r = calculateBunkCapacity(a.subject.conducted!, a.subject.present!, THRESHOLD, 0);
      return sum + r.safeToSkip;
    }, 0);
  const below = advice.filter((a) => a.tone === "required" || a.tone === "unreachable").length;

  const termNote =
    term?.inTerm && term.weeksRemaining > 0
      ? ` About ${term.weeksRemaining} week${term.weeksRemaining === 1 ? "" : "s"} of teaching left.`
      : "";

  return (
    <SectionCard title="Can I skip class?">
      <p className="mb-4 text-sm" style={{ color: "var(--comp-text-secondary)" }}>
        {below > 0
          ? `${below} subject${below === 1 ? " is" : "s are"} below ${THRESHOLD}%. Across the rest you have ${totalSlack} class${totalSlack === 1 ? "" : "es"} of slack.`
          : `You have ${totalSlack} class${totalSlack === 1 ? "" : "es"} of total slack across ${advice.length} subjects.`}
        {graph?.academic.attendance?.asOf ? ` As of ${graph.academic.attendance.asOf}.` : ""}
        {termNote}
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
