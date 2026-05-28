import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { CalendarDays, CheckCircle2, Eye, Info, UploadCloud } from "lucide-react";
import { CompetitionCard, CompetitionPageShell } from "../../components/competition/CompetitionChrome";
import { ErrorMessage } from "../../components/competition/ErrorMessage";
import { createEvent } from "../../lib/campusApi";
import { track } from "../../lib/analytics";

type WizardStep = 1 | 2 | 3 | 4;

type DraftRound = {
  title: string;
  submissionDeadline: string;
  instructions: string;
  maxResubmissions: number;
};

const stepLabels = ["Details", "Rounds", "Judges", "Review"];

export default function CreateEventPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState<WizardStep>(1);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [basic, setBasic] = useState({
    title: "",
    category: "Academic Research",
    department: "Computer Science",
    description: "",
    startAt: "",
    endAt: "",
    venue: "",
    visibility: "public",
  });
  const [isCompetition, setIsCompetition] = useState(true);
  const [submissionScope, setSubmissionScope] = useState<"individual" | "team">("team");
  const [rounds, setRounds] = useState<DraftRound[]>([
    { title: "Round 1", submissionDeadline: "", instructions: "Upload project files and repository links.", maxResubmissions: 2 },
  ]);
  const [judges, setJudges] = useState("");

  const canPublish = basic.title.trim() && basic.startAt && basic.endAt && basic.description.trim();
  const duration = useMemo(() => {
    if (!basic.startAt || !basic.endAt) return "TBA";
    const days = Math.max(1, Math.ceil((new Date(basic.endAt).getTime() - new Date(basic.startAt).getTime()) / 86_400_000));
    return `${days} Day${days === 1 ? "" : "s"}`;
  }, [basic.endAt, basic.startAt]);

  function updateRound(index: number, patch: Partial<DraftRound>) {
    setRounds((current) => current.map((round, idx) => idx === index ? { ...round, ...patch } : round));
  }

  function addRound() {
    setRounds((current) => [
      ...current,
      { title: `Round ${current.length + 1}`, submissionDeadline: "", instructions: "", maxResubmissions: 1 },
    ]);
  }

  async function publish() {
    if (!canPublish) {
      setError("Title, description, start date, and end date are required.");
      setStep(1);
      return;
    }

    setBusy(true);
    setError("");
    try {
      const payload: Record<string, unknown> = {
        ...basic,
        title: basic.title.trim(),
        description: basic.description.trim(),
        venue: basic.venue.trim(),
        isCompetition,
      };
      if (isCompetition) {
        payload.competitionConfig = {
          isCompetition: true,
          submissionScope,
          rounds: rounds.map((round, index) => ({
            roundId: `round-${index + 1}`,
            title: round.title,
            type: "submission",
            submissionDeadline: round.submissionDeadline || basic.endAt,
            instructions: round.instructions,
            submissionTypes: ["file", "link"],
            maxResubmissions: round.maxResubmissions,
            evaluationCriteria: [
              { label: "Innovation", maxScore: 40 },
              { label: "Execution", maxScore: 35 },
              { label: "Presentation", maxScore: 25 },
            ],
          })),
          judges: judges.split(",").map((value) => value.trim()).filter(Boolean),
        };
      }

      const created = await createEvent(payload);
      const createdEvent = Array.isArray(created) ? created[0] : created;
      track("create_event_completed", { mode: "stitch_wizard", isCompetition });
      navigate(createdEvent?.id ? `/events/${createdEvent.id}/manage` : "/events/my-created");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create event.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <CompetitionPageShell
      title="Create New Event"
      subtitle="Set up a new institutional event, manage participants, and assign curators."
      variant="wide"
    >
      <div className="create-wizard-steps" aria-label="Create event steps">
        {stepLabels.map((label, index) => {
          const current = (index + 1) as WizardStep;
          return (
            <button key={label} className={step === current ? "is-active" : ""} onClick={() => setStep(current)} type="button">
              <span>{index + 1}</span>
              {label}
            </button>
          );
        })}
      </div>

      {error ? <ErrorMessage message={error} onRetry={() => setError("")} preservedInput /> : null}

      <div className="competition-grid two create-wizard-layout">
        <div className="create-wizard-main">
          {step === 1 ? (
            <>
              <CompetitionCard className="create-wizard-card">
                <h2><Info size={20} /> Basic Information</h2>
                <label className="competition-form-label">Event Title</label>
                <input className="competition-form-control" value={basic.title} onChange={(event) => setBasic((prev) => ({ ...prev, title: event.target.value }))} placeholder="e.g. Annual Tech Symposium 2026" aria-label="Event Title" />
                <div className="create-form-grid">
                  <label>
                    <span className="competition-form-label">Category</span>
                    <select className="competition-form-control" value={basic.category} onChange={(event) => setBasic((prev) => ({ ...prev, category: event.target.value }))}>
                      <option>Academic Research</option>
                      <option>Hackathon</option>
                      <option>Cultural</option>
                      <option>Sports</option>
                    </select>
                  </label>
                  <label>
                    <span className="competition-form-label">Department</span>
                    <select className="competition-form-control" value={basic.department} onChange={(event) => setBasic((prev) => ({ ...prev, department: event.target.value }))}>
                      <option>Computer Science</option>
                      <option>Business Management</option>
                      <option>Arts School</option>
                      <option>Student Union</option>
                    </select>
                  </label>
                </div>
                <label className="competition-form-label">Description</label>
                <textarea className="competition-form-control" value={basic.description} onChange={(event) => setBasic((prev) => ({ ...prev, description: event.target.value }))} placeholder="Briefly describe the objective, scope, and target audience of the event..." aria-label="Description" />
                <div className="create-form-grid">
                  <label>
                    <span className="competition-form-label">Start Date & Time <span style={{ color: 'var(--status-live-text)' }}>*</span></span>
                    <input className="competition-form-control" type="datetime-local" value={basic.startAt} onChange={(event) => setBasic((prev) => ({ ...prev, startAt: event.target.value }))} required />
                  </label>
                  <label>
                    <span className="competition-form-label">End Date & Time <span style={{ color: 'var(--status-live-text)' }}>*</span></span>
                    <input className="competition-form-control" type="datetime-local" value={basic.endAt} min={basic.startAt || undefined} onChange={(event) => setBasic((prev) => ({ ...prev, endAt: event.target.value }))} required />
                  </label>
                </div>
                <label className="competition-form-label">Venue / Location</label>
                <input className="competition-form-control" value={basic.venue} onChange={(event) => setBasic((prev) => ({ ...prev, venue: event.target.value }))} placeholder="e.g. APJ Abdul Kalam Auditorium or Online (Zoom)" aria-label="Venue" />
              </CompetitionCard>

              <CompetitionCard className="create-wizard-card">
                <h2><Eye size={20} /> Privacy & Visibility</h2>
                <div className="create-choice-row">
                  {["public", "restricted"].map((value) => (
                    <button key={value} className={basic.visibility === value ? "is-active" : ""} onClick={() => setBasic((prev) => ({ ...prev, visibility: value }))} type="button">
                      <strong>{value === "public" ? "Public Event" : "Restricted Access"}</strong>
                      <span>{value === "public" ? "Visible to all university members." : "Invitation only or department access."}</span>
                    </button>
                  ))}
                </div>
              </CompetitionCard>
            </>
          ) : null}

          {step === 2 ? (
            <CompetitionCard className="create-wizard-card">
              <h2><CalendarDays size={20} /> Rounds & Timeline</h2>
              <label className="create-toggle">
                <input type="checkbox" checked={isCompetition} onChange={(event) => setIsCompetition(event.target.checked)} />
                Configure as competition
              </label>
              <div className="create-choice-row compact">
                {(["individual", "team"] as const).map((value) => (
                  <button key={value} className={submissionScope === value ? "is-active" : ""} onClick={() => setSubmissionScope(value)} type="button">
                    <strong>{value === "individual" ? "Individual" : "Team"}</strong>
                  </button>
                ))}
              </div>
              {rounds.map((round, index) => (
                <div className="create-round-editor" key={`${round.title}-${index}`}>
                  <input className="competition-form-control" value={round.title} onChange={(event) => updateRound(index, { title: event.target.value })} aria-label="Round title" />
                  <input className="competition-form-control" type="datetime-local" value={round.submissionDeadline} onChange={(event) => updateRound(index, { submissionDeadline: event.target.value })} aria-label="Round deadline" />
                  <textarea className="competition-form-control" value={round.instructions} onChange={(event) => updateRound(index, { instructions: event.target.value })} placeholder="Submission instructions" aria-label="Submission instructions" />
                </div>
              ))}
              <button className="comp-btn-ghost" onClick={addRound} type="button">Add Round</button>
            </CompetitionCard>
          ) : null}

          {step === 3 ? (
            <CompetitionCard className="create-wizard-card">
              <h2><CheckCircle2 size={20} /> Judges & Curators</h2>
              <label className="competition-form-label">Judge register numbers</label>
              <textarea className="competition-form-control" value={judges} onChange={(event) => setJudges(event.target.value)} placeholder="AP23110010419, AP22110000001" aria-label="Judge register numbers" />
              <p className="body-text">Add comma-separated registration numbers. Roles can be refined later from Roles & Permissions.</p>
            </CompetitionCard>
          ) : null}

          {step === 4 ? (
            <CompetitionCard className="create-wizard-card">
              <h2><CheckCircle2 size={20} /> Final Review</h2>
              <dl className="create-review-list">
                <dt>Title</dt><dd>{basic.title || "Untitled"}</dd>
                <dt>Category</dt><dd>{basic.category}</dd>
                <dt>Department</dt><dd>{basic.department}</dd>
                <dt>Duration</dt><dd>{duration}</dd>
                <dt>Competition</dt><dd>{isCompetition ? `${rounds.length} round(s), ${submissionScope}` : "Standard event"}</dd>
              </dl>
            </CompetitionCard>
          ) : null}
        </div>

        <aside className="create-wizard-side">
          <CompetitionCard className="create-banner-card">
            <h2>Event Banner</h2>
            <div>
              <UploadCloud size={36} />
              <strong>Drag and drop banner</strong>
              <span>Recommended size: 1200 x 675px</span>
            </div>
          </CompetitionCard>
          <CompetitionCard className="create-schedule-card">
            <h2>Schedule Preview</h2>
            <p><CalendarDays size={20} /> Start Date <strong>{basic.startAt ? new Date(basic.startAt).toLocaleDateString("en-IN") : "TBA"}</strong></p>
            <p><CalendarDays size={20} /> Expected Duration <strong>{duration}</strong></p>
          </CompetitionCard>
          <CompetitionCard className="create-tip-card">
            <h2>Pro Tip</h2>
            <p>Adding a clear banner and detailed description increases participant engagement.</p>
          </CompetitionCard>
        </aside>
      </div>

      <div className="create-wizard-footer">
        <button className="comp-btn-ghost" type="button">Discard Draft</button>
        <div>
          <button className="comp-btn-ghost" disabled={step === 1} onClick={() => setStep((current) => Math.max(1, current - 1) as WizardStep)} type="button">Previous</button>
          {step < 4 ? (
            <button className="comp-btn-primary" onClick={() => setStep((current) => Math.min(4, current + 1) as WizardStep)} type="button">Next</button>
          ) : (
            <button className="comp-btn-primary" disabled={busy} onClick={() => void publish()} type="button">{busy ? "Publishing..." : "Publish Event"}</button>
          )}
        </div>
      </div>
    </CompetitionPageShell>
  );
}
