import { useState } from "react";
import { Link } from "react-router-dom";
import { X } from "lucide-react";
import { ErrorMessage } from "../../../components/competition/ErrorMessage";
import { Stepper } from "../../../components/competition/Stepper";
import { SkeletonCard } from "../../../components/ui/Skeletons";
import { Input } from "../../../components/input";
import { LazyMarkdown as Markdown } from "../../../components/markdown";
import { useEvent } from "../../../contexts/EventContext";
import { track } from "../../../lib/core/analytics";
import {
  createTeam,
  inviteMember,
  registerForEvent,
  type Team,
} from "../../../lib/events/competitionsApi";
import { getCurrentRegNo } from "../../../lib/core/identity";
import { PageStack, runStep } from "./PageStack";

export function RegistrationFlowPage() {
  const { event, config, userState, refetch } = useEvent();
  const currentRegNo = getCurrentRegNo();
  const teamEvent = Boolean(config?.isCompetition && config.submissionScope === "team");
  const maxTeamSize = config?.maxTeamSize || 4;
  const [step, setStep] = useState(1);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [teamName, setTeamName] = useState("");
  const [inviteRegNos, setInviteRegNos] = useState<string[]>([""]);
  const [team, setTeam] = useState<Team | null>(null);

  const isClosed =
    !event ||
    event.status === "archived" ||
    event.status === "completed" ||
    event.status === "closed" ||
    event.status === "registration-closed";
  const isFull = Boolean(event?.maxCapacity && Number(event.registrationCount ?? 0) >= event.maxCapacity);

  const validInvites = inviteRegNos.filter((r) => r.trim().length > 0);
  const canAddMoreInvites = validInvites.length < maxTeamSize - 1; // -1 for leader

  function addInviteField() {
    if (canAddMoreInvites) {
      setInviteRegNos((prev) => [...prev, ""]);
    }
  }

  function removeInviteField(index: number) {
    setInviteRegNos((prev) => prev.filter((_, i) => i !== index));
  }

  function updateInviteField(index: number, value: string) {
    setInviteRegNos((prev) => prev.map((v, i) => (i === index ? value.toUpperCase() : v)));
  }

  async function createTeamAndInvite() {
    if (!event || !teamName.trim()) return;
    await runStep(setBusy, setError, async () => {
      const created = await createTeam(event.id, teamName.trim());
      setTeam(created);
      track("team_created", { eventId: event.id, teamId: created.id });

      // Send all invites
      for (const regNo of validInvites) {
        try {
          await inviteMember(event.id, created.id, regNo.trim().toUpperCase());
          track("team_invite_sent", { eventId: event.id, teamId: created.id, invitee: regNo });
        } catch (err) {
          // Continue with other invites even if one fails
          console.warn(`Failed to invite ${regNo}:`, err);
        }
      }
      setStep(3);
    }, "Couldn't create the team. Please try again.");
  }

  async function confirmRegistration() {
    if (!event) return;
    await runStep(setBusy, setError, async () => {
      await registerForEvent(event.id);
      refetch();
      setSuccess(true);
    }, "Couldn't complete your registration. Please try again.");
  }

  if (!event) {
    return <PageStack><SkeletonCard /></PageStack>;
  }

  if (isClosed) {
    return (
      <PageStack>
        <ErrorMessage title="Registration closed" message="This event is not accepting new registrations." />
        <Link className="comp-btn-ghost" to={`/events/${encodeURIComponent(event.id)}`}>Back to event</Link>
      </PageStack>
    );
  }

  if (isFull) {
    return (
      <PageStack>
        <ErrorMessage title="Waitlist unavailable" message="This event has reached capacity. Please check back if seats reopen." />
        <Link className="comp-btn-ghost" to={`/events/${encodeURIComponent(event.id)}`}>Back to event</Link>
      </PageStack>
    );
  }

  if (success) {
    return (
      <PageStack>
        <div className="dashboard-card rounded-xl p-4">
          <p className="comp-heading-lg m-0">Registration confirmed</p>
          <p className="comp-body">Registered as {currentRegNo ?? "your current profile"} for {event.title ?? "this event"}.</p>
          {team ? <p className="comp-body">Team: {team.name}</p> : null}
          <Link className="comp-btn-primary" to={`/events/${encodeURIComponent(event.id)}`}>View event</Link>
        </div>
      </PageStack>
    );
  }

  return (
    <PageStack>
      <Stepper
        steps={teamEvent ? ["Details", "Team", "Review"] : ["Details", "Review"]}
        activeIndex={step === 1 ? 0 : teamEvent ? (step === 2 ? 1 : 2) : 1}
        ariaLabel="Registration steps"
      />

      {error ? <ErrorMessage message={error} onRetry={() => setError("")} preservedInput /> : null}

      {step === 1 ? (
        <div className="dashboard-card rounded-xl p-4">
          <p className="comp-heading-lg mt-0">{event.title ?? "Event registration"}</p>
          <div className="comp-body">
            <Markdown>{event.description ?? "Confirm your details to register."}</Markdown>
          </div>
          <label className="comp-label" htmlFor="reg-no">Registration number</label>
          <Input id="reg-no" readOnly value={currentRegNo ?? ""} />
          <p className="comp-body">By continuing, you confirm that you meet the event eligibility rules.</p>
          <button className="comp-btn-primary" onClick={() => setStep(teamEvent ? 2 : 3)}>Continue</button>
        </div>
      ) : null}

      {step === 2 && teamEvent ? (
        <div className="dashboard-card rounded-xl p-4">
          <p className="comp-heading-lg mt-0">Team setup</p>
          <div className="grid gap-4">
            <div>
              <label className="comp-label" htmlFor="team-name">Team name</label>
              <Input id="team-name" value={teamName} onChange={(e) => setTeamName(e.target.value)} />
            </div>
            <div>
              <div className="flex justify-between items-center mb-2">
                <label className="comp-label">Invite members (up to {maxTeamSize - 1} members)</label>
                {canAddMoreInvites && (
                  <button
                    type="button"
                    className="comp-btn-ghost text-sm"
                    onClick={addInviteField}
                    disabled={busy}
                  >
                    + Add member
                  </button>
                )}
              </div>
              <div className="space-y-2">
                {inviteRegNos.map((regNo, index) => (
                  <div key={index} className="flex gap-2">
                    <Input
                      id={`invite-reg-no-${index}`}
                      value={regNo}
                      onChange={(e) => updateInviteField(index, e.target.value)}
                      placeholder={`Member ${index + 1} reg no (e.g., AP21110010)`}
                      disabled={busy}
                      className="flex-1"
                    />
                    {inviteRegNos.length > 1 && (
                      <button
                        type="button"
                        className="comp-btn-ghost text-[var(--error)]"
                        onClick={() => removeInviteField(index)}
                        disabled={busy}
                        aria-label="Remove member"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
              <p className="comp-caption text-[var(--comp-text-muted)]">
                {validInvites.length}/{maxTeamSize - 1} invite slots filled
              </p>
            </div>
            <button className="comp-btn-primary" disabled={busy || !teamName.trim()} onClick={() => void createTeamAndInvite()}>
              {busy ? "Creating..." : "Create team"}
            </button>
          </div>
        </div>
      ) : null}

      {step === 3 ? (
        <div className="dashboard-card rounded-xl p-4">
          <p className="comp-heading-lg mt-0">Review and confirm</p>
          <dl className="grid grid-cols-[160px_1fr] gap-x-4 gap-y-2">
            <dt className="comp-label">Reg no</dt><dd className="m-0">{currentRegNo ?? "Unavailable"}</dd>
            <dt className="comp-label">Event</dt><dd className="m-0">{event.title ?? "Untitled event"}</dd>
            {teamEvent ? (
              <>
                <dt className="comp-label">Team</dt>
                <dd className="m-0">
                  {team?.name ?? (teamName || "Not created")}
                  {validInvites.length > 0 && (
                    <ul className="mt-2 space-y-1 ml-2 list-disc">
                      {validInvites.map((regNo, idx) => (
                        <li key={idx} className="comp-body text-sm">{regNo} (invite will be sent)</li>
                      ))}
                    </ul>
                  )}
                </dd>
              </>
            ) : null}
            <dt className="comp-label">Role</dt><dd className="m-0">{userState?.role ?? "visitor"}</dd>
          </dl>
          <div className="mt-4 flex gap-2">
            <button className="comp-btn-primary" disabled={busy} onClick={() => void confirmRegistration()}>
              {busy ? "Registering..." : "Confirm registration"}
            </button>
            <button className="comp-btn-ghost" onClick={() => setStep(teamEvent ? 2 : 1)}>Back</button>
          </div>
        </div>
      ) : null}
    </PageStack>
  );
}