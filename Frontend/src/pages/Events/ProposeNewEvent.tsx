import { useMemo, useState } from "react";
import { ErpPageShell, SectionCard, StatusBanner } from "../../components/erp/ErpPrimitives";
import { createEvent } from "../../lib/campusApi";

const CATEGORIES = ["Technical", "Cultural", "Sports", "Workshop", "Seminar", "Club", "Social", "Other"] as const;
const DEPARTMENTS = ["Computer Science", "Electronics", "Mechanical", "Civil", "Biotechnology", "General"] as const;

type FormState = {
  title: string;
  description: string;
  startAt: string;
  endAt: string;
  department: string;
  category: string;
  location: string;
  isCompetition: boolean;
  prizes: string;
  rules: string;
  eligibility: string;
  faq: string;
  coOrganizers: string;
};

type RoundDraft = {
  roundId: string;
  title: string;
  startTime: string;
  submissionDeadline: string;
  instructions: string;
  allowFile: boolean;
  allowLink: boolean;
  maxResubmissions: number;
  requiresShortlistFromRound: string;
  criteria1Label: string;
  criteria1Max: number;
  criteria2Label: string;
  criteria2Max: number;
  criteria3Label: string;
  criteria3Max: number;
};

function createDefaultRound(roundNumber: number): RoundDraft {
  return {
    roundId: `r${roundNumber}`,
    title: `Round ${roundNumber}`,
    startTime: "",
    submissionDeadline: "",
    instructions: "",
    allowFile: true,
    allowLink: true,
    maxResubmissions: 5,
    requiresShortlistFromRound: roundNumber > 1 ? `r${roundNumber - 1}` : "",
    criteria1Label: "Innovation",
    criteria1Max: 10,
    criteria2Label: "Implementation",
    criteria2Max: 10,
    criteria3Label: "Presentation",
    criteria3Max: 10,
  };
}

const EMPTY: FormState = {
  title: "",
  description: "",
  startAt: "",
  endAt: "",
  department: String(DEPARTMENTS[0]),
  category: String(CATEGORIES[0]),
  location: "",
  isCompetition: false,
  prizes: "",
  rules: "",
  eligibility: "",
  faq: "",
  coOrganizers: "",
};

export default function ProposeNewEvent() {
  const [form, setForm] = useState<FormState>(EMPTY);
  const [rounds, setRounds] = useState<RoundDraft[]>([createDefaultRound(1)]);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState("");
  const [tone, setTone] = useState<"success" | "warning">("success");
  const availableRoundOptions = useMemo(
    () => rounds.map((round) => ({ id: round.roundId, title: round.title || round.roundId })),
    [rounds]
  );

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setMessage("");
    try {
      await createEvent({
        title: form.title,
        description: form.description,
        startAt: form.startAt,
        endAt: form.endAt,
        department: form.department,
        category: form.category,
        visibility: form.isCompetition ? "creator-only" : "public",
        status: form.isCompetition ? "draft" : "published",
        location: { physical: form.location },
        organizer: "Student Event Proposal",
        prizes: form.prizes,
        rules: form.rules,
        eligibility: form.eligibility,
        faq: form.faq
          .split("\n")
          .map((item) => item.trim())
          .filter(Boolean),
        coOrganizers: form.coOrganizers
          .split(",")
          .map((item) => item.trim())
          .filter(Boolean),
        competitionConfig: form.isCompetition
          ? JSON.stringify({
              isCompetition: true,
              submissionScope: "individual",
              rounds: rounds.map((round, index) => ({
                roundId: round.roundId.trim() || `r${index + 1}`,
                title: round.title.trim() || `Round ${index + 1}`,
                type: "submission",
                startTime: new Date(round.startTime || form.startAt).toISOString(),
                submissionDeadline: new Date(
                  round.submissionDeadline || form.endAt || form.startAt
                ).toISOString(),
                instructions: round.instructions.trim(),
                submissionTypes: [
                  ...(round.allowFile ? ["file"] : []),
                  ...(round.allowLink ? ["link"] : []),
                ],
                maxFileSizeMb: 25,
                maxResubmissions: Math.max(1, Number(round.maxResubmissions || 5)),
                evaluationCriteria: [
                  { label: round.criteria1Label.trim() || "Criteria 1", maxScore: Number(round.criteria1Max || 10) },
                  { label: round.criteria2Label.trim() || "Criteria 2", maxScore: Number(round.criteria2Max || 10) },
                  { label: round.criteria3Label.trim() || "Criteria 3", maxScore: Number(round.criteria3Max || 10) },
                ],
                shortlistCount: null,
                shortlistThreshold: null,
                requiresShortlistFromRound:
                  index === 0 ? null : (round.requiresShortlistFromRound || `r${index}`),
                resultsPublished: false,
              })),
            })
          : null,
      });
      setTone("success");
      setMessage(
        form.isCompetition
          ? "Competition draft created. Open event details and promote when ready."
          : "Event proposal submitted successfully and is now awaiting review."
      );
      setForm(EMPTY);
      setRounds([createDefaultRound(1)]);
    } catch (err) {
      setTone("warning");
      setMessage(err instanceof Error ? err.message : "Failed to submit event proposal.");
    } finally { setSubmitting(false); }
  };

  const up = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((p) => ({ ...p, [key]: value }));
  const updateRound = <K extends keyof RoundDraft>(
    index: number,
    key: K,
    value: RoundDraft[K]
  ) => {
    setRounds((prev) => prev.map((round, idx) => (idx === index ? { ...round, [key]: value } : round)));
  };
  const addRound = () => {
    setRounds((prev) => [...prev, createDefaultRound(prev.length + 1)]);
  };
  const removeRound = (index: number) => {
    setRounds((prev) => {
      if (prev.length <= 1) return prev;
      return prev.filter((_, idx) => idx !== index).map((round, idx) => ({
        ...round,
        roundId: `r${idx + 1}`,
        requiresShortlistFromRound: idx === 0 ? "" : (round.requiresShortlistFromRound || `r${idx}`),
      }));
    });
  };

  return (
    <ErpPageShell title="Propose New Event" source="Internal API">
      {message && <StatusBanner message={{ id: "propose-msg", tone, text: message }} />}

      <SectionCard title="Event Proposal Form">
        <form onSubmit={submit} className="grid gap-4 md:grid-cols-2">
          <div className="md:col-span-2">
            <label htmlFor="prop-title" className="mb-1 block text-sm font-medium text-[var(--text-primary)]">Title</label>
            <input id="prop-title" value={form.title} onChange={(e) => up("title", e.target.value)} required
              className="w-full rounded-xl border border-[var(--border)] bg-[var(--background)] px-4 py-3 text-sm outline-none focus:border-[var(--comp-accent)]" />
          </div>
          <div className="md:col-span-2">
            <label htmlFor="prop-desc" className="mb-1 block text-sm font-medium text-[var(--text-primary)]">Description</label>
            <textarea id="prop-desc" value={form.description} onChange={(e) => up("description", e.target.value)} rows={4} required
              className="w-full rounded-xl border border-[var(--border)] bg-[var(--background)] px-4 py-3 text-sm outline-none focus:border-[var(--comp-accent)]" />
          </div>
          <div>
            <label htmlFor="prop-start" className="mb-1 block text-sm font-medium text-[var(--text-primary)]">Start Time</label>
            <input id="prop-start" type="datetime-local" value={form.startAt} onChange={(e) => up("startAt", e.target.value)} required
              className="w-full rounded-xl border border-[var(--border)] bg-[var(--background)] px-4 py-3 text-sm outline-none focus:border-[var(--comp-accent)]" />
          </div>
          <div>
            <label htmlFor="prop-end" className="mb-1 block text-sm font-medium text-[var(--text-primary)]">End Time</label>
            <input id="prop-end" type="datetime-local" value={form.endAt} onChange={(e) => up("endAt", e.target.value)} required
              className="w-full rounded-xl border border-[var(--border)] bg-[var(--background)] px-4 py-3 text-sm outline-none focus:border-[var(--comp-accent)]" />
          </div>
          <div>
            <label htmlFor="prop-dept" className="mb-1 block text-sm font-medium text-[var(--text-primary)]">Department</label>
            <select id="prop-dept" value={form.department} onChange={(e) => up("department", e.target.value)}
              className="w-full rounded-xl border border-[var(--border)] bg-[var(--background)] px-4 py-3 text-sm outline-none focus:border-[var(--comp-accent)]">
              {DEPARTMENTS.map((d) => <option key={d} value={d}>{d}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor="prop-cat" className="mb-1 block text-sm font-medium text-[var(--text-primary)]">Category</label>
            <select id="prop-cat" value={form.category} onChange={(e) => up("category", e.target.value)}
              className="w-full rounded-xl border border-[var(--border)] bg-[var(--background)] px-4 py-3 text-sm outline-none focus:border-[var(--comp-accent)]">
              {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div className="md:col-span-2">
            <label htmlFor="prop-loc" className="mb-1 block text-sm font-medium text-[var(--text-primary)]">Location / Venue</label>
            <input id="prop-loc" value={form.location} onChange={(e) => up("location", e.target.value)} required
              className="w-full rounded-xl border border-[var(--border)] bg-[var(--background)] px-4 py-3 text-sm outline-none focus:border-[var(--comp-accent)]" />
          </div>
          <div className="md:col-span-2">
            <label className="mb-1 block text-sm font-medium text-[var(--text-primary)]">Prizes</label>
            <textarea value={form.prizes} onChange={(e) => up("prizes", e.target.value)} rows={2}
              className="w-full rounded-xl border border-[var(--border)] bg-[var(--background)] px-4 py-3 text-sm outline-none focus:border-[var(--comp-accent)]" />
          </div>
          <div className="md:col-span-2">
            <label className="mb-1 block text-sm font-medium text-[var(--text-primary)]">Rules</label>
            <textarea value={form.rules} onChange={(e) => up("rules", e.target.value)} rows={3}
              className="w-full rounded-xl border border-[var(--border)] bg-[var(--background)] px-4 py-3 text-sm outline-none focus:border-[var(--comp-accent)]" />
          </div>
          <div className="md:col-span-2">
            <label className="mb-1 block text-sm font-medium text-[var(--text-primary)]">Eligibility</label>
            <textarea value={form.eligibility} onChange={(e) => up("eligibility", e.target.value)} rows={2}
              className="w-full rounded-xl border border-[var(--border)] bg-[var(--background)] px-4 py-3 text-sm outline-none focus:border-[var(--comp-accent)]" />
          </div>
          <div className="md:col-span-2">
            <label className="mb-1 block text-sm font-medium text-[var(--text-primary)]">FAQ (one line per item)</label>
            <textarea value={form.faq} onChange={(e) => up("faq", e.target.value)} rows={3}
              className="w-full rounded-xl border border-[var(--border)] bg-[var(--background)] px-4 py-3 text-sm outline-none focus:border-[var(--comp-accent)]" />
          </div>
          <div className="md:col-span-2">
            <label className="mb-1 block text-sm font-medium text-[var(--text-primary)]">Co-organizers</label>
            <input
              value={form.coOrganizers}
              onChange={(e) => up("coOrganizers", e.target.value)}
              placeholder="Comma-separated register numbers"
              className="w-full rounded-xl border border-[var(--border)] bg-[var(--background)] px-4 py-3 text-sm outline-none focus:border-[var(--comp-accent)]"
            />
          </div>
          <div className="md:col-span-2">
            <label className="mb-2 inline-flex items-center gap-2 text-sm font-medium text-[var(--text-primary)]">
              <input
                type="checkbox"
                checked={form.isCompetition}
                onChange={(e) => up("isCompetition", e.target.checked)}
                className="h-4 w-4"
              />
              Configure as competition
            </label>
            <p className="text-xs text-[var(--text-secondary)]">
              Competition events are created as creator-only drafts with round configuration.
            </p>
          </div>
          {form.isCompetition ? (
            <>
              <div className="md:col-span-2 flex items-center justify-between">
                <h3 className="text-sm font-semibold text-[var(--comp-text-primary)]">Rounds Configuration</h3>
                <button type="button" onClick={addRound} className="rounded-full border border-[var(--border)] px-4 py-1.5 text-xs font-semibold">
                  Add Round
                </button>
              </div>
              {rounds.map((round, index) => (
                <div key={`${round.roundId}-${index}`} className="md:col-span-2 rounded-xl border border-[var(--border)] p-4">
                  <div className="mb-3 flex items-center justify-between">
                    <p className="text-sm font-semibold text-[var(--comp-text-primary)]">Round {index + 1}</p>
                    <button type="button" onClick={() => removeRound(index)} className="text-xs text-rose-700 disabled:opacity-50" disabled={rounds.length === 1}>
                      Remove
                    </button>
                  </div>
                  <div className="grid gap-3 md:grid-cols-2">
                    <input value={round.roundId} onChange={(e) => updateRound(index, "roundId", e.target.value)} placeholder="round id (e.g., r1)" className="rounded-xl border border-[var(--border)] px-4 py-3 text-sm" />
                    <input value={round.title} onChange={(e) => updateRound(index, "title", e.target.value)} placeholder="Round title" className="rounded-xl border border-[var(--border)] px-4 py-3 text-sm" />
                    <input type="datetime-local" value={round.startTime} onChange={(e) => updateRound(index, "startTime", e.target.value)} className="rounded-xl border border-[var(--border)] px-4 py-3 text-sm" />
                    <input type="datetime-local" value={round.submissionDeadline} onChange={(e) => updateRound(index, "submissionDeadline", e.target.value)} required={form.isCompetition} className="rounded-xl border border-[var(--border)] px-4 py-3 text-sm" />
                    <input type="number" min={1} value={round.maxResubmissions} onChange={(e) => updateRound(index, "maxResubmissions", Number(e.target.value || 1))} className="rounded-xl border border-[var(--border)] px-4 py-3 text-sm" />
                    <select value={round.requiresShortlistFromRound} onChange={(e) => updateRound(index, "requiresShortlistFromRound", e.target.value)} className="rounded-xl border border-[var(--border)] px-4 py-3 text-sm" disabled={index === 0}>
                      <option value="">{index === 0 ? "No prerequisite round" : "Select prerequisite round"}</option>
                      {availableRoundOptions.filter((item) => item.id !== round.roundId).map((item) => (
                        <option key={item.id} value={item.id}>{item.title}</option>
                      ))}
                    </select>
                    <textarea value={round.instructions} onChange={(e) => updateRound(index, "instructions", e.target.value)} rows={2} placeholder="Round instructions" className="md:col-span-2 rounded-xl border border-[var(--border)] px-4 py-3 text-sm" />
                    <div className="md:col-span-2 flex gap-4">
                      <label className="inline-flex items-center gap-2 text-sm">
                        <input type="checkbox" checked={round.allowFile} onChange={(e) => updateRound(index, "allowFile", e.target.checked)} />
                        Allow file uploads
                      </label>
                      <label className="inline-flex items-center gap-2 text-sm">
                        <input type="checkbox" checked={round.allowLink} onChange={(e) => updateRound(index, "allowLink", e.target.checked)} />
                        Allow link submissions
                      </label>
                    </div>
                    <input value={round.criteria1Label} onChange={(e) => updateRound(index, "criteria1Label", e.target.value)} className="rounded-xl border border-[var(--border)] px-4 py-3 text-sm" placeholder="Criteria 1 label" />
                    <input type="number" min={1} value={round.criteria1Max} onChange={(e) => updateRound(index, "criteria1Max", Number(e.target.value || 1))} className="rounded-xl border border-[var(--border)] px-4 py-3 text-sm" />
                    <input value={round.criteria2Label} onChange={(e) => updateRound(index, "criteria2Label", e.target.value)} className="rounded-xl border border-[var(--border)] px-4 py-3 text-sm" placeholder="Criteria 2 label" />
                    <input type="number" min={1} value={round.criteria2Max} onChange={(e) => updateRound(index, "criteria2Max", Number(e.target.value || 1))} className="rounded-xl border border-[var(--border)] px-4 py-3 text-sm" />
                    <input value={round.criteria3Label} onChange={(e) => updateRound(index, "criteria3Label", e.target.value)} className="rounded-xl border border-[var(--border)] px-4 py-3 text-sm" placeholder="Criteria 3 label" />
                    <input type="number" min={1} value={round.criteria3Max} onChange={(e) => updateRound(index, "criteria3Max", Number(e.target.value || 1))} className="rounded-xl border border-[var(--border)] px-4 py-3 text-sm" />
                  </div>
                </div>
              ))}
            </>
          ) : null}
          <div className="md:col-span-2">
            <button type="submit" disabled={submitting}
              className="rounded-full bg-[var(--comp-accent)] px-6 py-2.5 text-sm font-semibold text-white transition hover:bg-[var(--comp-accent-hover)] disabled:opacity-50">
              {submitting ? "Submitting..." : "Submit Proposal"}
            </button>
          </div>
        </form>
      </SectionCard>
    </ErpPageShell>
  );
}
