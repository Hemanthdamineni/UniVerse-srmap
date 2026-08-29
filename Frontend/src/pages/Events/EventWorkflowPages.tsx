import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { ErrorMessage } from "../../components/competition/ErrorMessage";
import { EmptyState } from "../../components/competition/CompetitionEmptyState";
import { FileUploadZone } from "../../components/competition/FileUploadZone";
import { Stepper } from "../../components/competition/Stepper";
import { SkeletonTable, SkeletonCard } from "../../components/ui/Skeletons";
import { ToastContainer, useToasts } from "../../components/ui/Feedback";
import { StatusBadge } from "../../components/ui/Badges";
import { CompetitionPageShell, CompetitionCard, CompetitionEmptyPanel } from "../../components/competition/CompetitionChrome";
import { useEvent } from "../../contexts/EventContext";
import { Markdown } from "../../components/markdown";
import { track } from "../../lib/core/analytics";
import { Users, Search, CalendarClock, Award, Plus, X } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  ConfirmDialog,
} from "../../components/dialog";
import {
  assignRole,
  cancelInvitation,
  cancelPersistentTeamInvitation,
  createPersistentTeam,
  createTeam,
  deletePersistentTeam,
  deleteTeam,
  downloadMyCertificate,
  getCertificateTemplate,
  getEventRoles,
  getEventTeams,
  getMyInvitations,
  getMyPersistentTeams,
  getMyPersistentTeamInvitations,
  getMyRegisteredEvents,
  getMyTeam,
  getTeamMatches,
  getTeamRecruitmentBoard,
  inviteMember,
  inviteToPersistentTeam,
  leaveTeam,
  registerForEvent,
  removeRole,
  respondToPersistentTeamInvitation,
  saveCertificateTemplate,
  transferLeadership,
  upsertTeamRecruitmentPost,
  uploadCertificateTemplateImage,
  type CertificateField,
  type CertificateTemplate,
  type EventRoleAssignment,
  type EventSummary,
  type PersistentTeam,
  type PersistentTeamInvitation,
  type Team,
  type TeamInvitation,
  type TeamMatchCandidate,
  type TeamMember,
  type TeamRecruitmentPost,
} from "../../lib/events/competitionsApi";
import { listEvents, type EventSummary as CampusEventSummary } from "../../lib/campus/campusApi";
import { getCurrentRegNo } from "../../lib/core/identity";
import { Input } from "../../components/input";
import { Select } from "../../components/select";
import { computeTeamScore } from "../../lib/events/scoring";
import { getMyScores, type ScoreBreakdown } from "../../lib/events/competitionsApi";
import ScoreCard from "../../components/competition/ScoreCard";

function PageStack({ children }: { children: React.ReactNode }) {
  return (
    <CompetitionPageShell variant="wide">
      <div className="space-y-6">
        {children}
      </div>
    </CompetitionPageShell>
  );
}

async function runStep(
  setBusy: (v: boolean) => void,
  setError: (v: string) => void,
  action: () => Promise<void>,
  errorMsg: string
) {
  setBusy(true);
  setError("");
  try {
    await action();
  } catch (err) {
    setError(err instanceof Error ? err.message : errorMsg);
  } finally {
    setBusy(false);
  }
}

// ─── PersistentTeamPage ────────────────────────────────────────────────────────

export function PersistentTeamPage() {
  const { teamId } = useParams<{ teamId: string }>();
  const navigate = useNavigate();
  const [team, setTeam] = useState<PersistentTeam | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [inviteRegNos, setInviteRegNos] = useState<string[]>([""]);
  const [busy, setBusy] = useState(false);
  const { toasts, showToast, dismissToast } = useToasts();
  const [pendingConfirm, setPendingConfirm] = useState<{ type: "cancel-invite" | "remove-member" | "leave" | "delete"; regNo?: string } | null>(null);
  const currentRegNo = getCurrentRegNo();
  const isLeader = team?.leaderRegNo === currentRegNo;

  const confirmCopy = (() => {
    switch (pendingConfirm?.type) {
      case "cancel-invite":
        return {
          title: "Cancel invitation?",
          description: `${pendingConfirm.regNo} will no longer be able to join ${team?.name ?? "this team"}. You can send a new invitation anytime.`,
          dismissLabel: "Keep invite",
          confirmLabel: "Cancel invitation",
          danger: false,
        };
      case "remove-member":
        return {
          title: "Remove member?",
          description: `${pendingConfirm.regNo} will be removed from "${team?.name ?? "this team"}" and would need a new invitation to rejoin.`,
          dismissLabel: "Keep member",
          confirmLabel: "Remove member",
          danger: true,
        };
      case "leave":
        return {
          title: "Leave this team?",
          description: `You will stop being a member of "${team?.name ?? "this team"}" and will need a new invitation to rejoin.`,
          dismissLabel: "Stay",
          confirmLabel: "Leave team",
          danger: false,
        };
      case "delete":
        return {
          title: "Delete this team?",
          description: `"${team?.name ?? "This team"}" and all of its pending invitations will be permanently deleted. This cannot be undone.`,
          dismissLabel: "Keep team",
          confirmLabel: "Delete team",
          danger: true,
        };
      default:
        return null;
    }
  })();

  const runConfirmedAction = () => {
    if (!pendingConfirm || !team) return;
    const member = pendingConfirm.regNo
      ? team.members.find((m) => m.regNo === pendingConfirm.regNo)
      : undefined;
    if (pendingConfirm.type === "cancel-invite" && member) void handleCancelInvite(member);
    else if (pendingConfirm.type === "remove-member" && member) void handleRemoveMember(member);
    else if (pendingConfirm.type === "leave") void handleLeaveTeam();
    else if (pendingConfirm.type === "delete") void handleDeleteTeam();
    setPendingConfirm(null);
  };

  useEffect(() => {
    if (!teamId) return;
    setLoading(true);
    getMyPersistentTeams()
      .then(teams => {
        const found = teams.find(t => t.id === teamId);
        if (found) setTeam(found);
        else setError("Team not found");
      })
      .catch((err: unknown) => setError(err instanceof Error ? err.message : "Failed to load team."))
      .finally(() => setLoading(false));
  }, [teamId]);

  async function handleAddInvite() {
    setInviteRegNos(prev => [...prev, ""]);
  }

  async function handleRemoveInvite(index: number) {
    setInviteRegNos(prev => prev.filter((_, i) => i !== index));
  }

  async function handleInviteChange(index: number, value: string) {
    setInviteRegNos(prev => prev.map((v, i) => i === index ? value.toUpperCase() : v));
  }

  async function handleSendInvites() {
    const validInvites = inviteRegNos.filter(v => v.trim() && v !== currentRegNo);
    if (validInvites.length === 0) return;
    setBusy(true);
    try {
      await inviteToPersistentTeam(teamId!, validInvites);
      showToast(`Sent ${validInvites.length} invitation${validInvites.length > 1 ? 's' : ''}`, 'success');
      // Refresh team
      const teams = await getMyPersistentTeams();
      const updated = teams.find(t => t.id === teamId);
      if (updated) setTeam(updated);
      // Reset invite fields
      setInviteRegNos([""]);
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : "Couldn't send the invitations. Please try again.", 'error');
    } finally {
      setBusy(false);
    }
  }

  async function handleCancelInvite(member: TeamMember) {
    setBusy(true);
    try {
      await cancelPersistentTeamInvitation(teamId!, member.regNo);
      showToast("Invitation cancelled", 'success');
      const teams = await getMyPersistentTeams();
      const updated = teams.find(t => t.id === teamId);
      if (updated) setTeam(updated);
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : "Couldn't cancel the invitation. Please try again.", 'error');
    } finally {
      setBusy(false);
    }
  }

  async function handleRemoveMember(member: TeamMember) {
    setBusy(true);
    try {
      // For prototype, we need to manually remove member
      const { getPrototypePersistentTeam, savePrototypePersistentTeam } = await import('../../lib/events/prototypeEventState');
      const currentTeam = getPrototypePersistentTeam(teamId!);
      if (currentTeam) {
        currentTeam.members = currentTeam.members.filter(m => m.regNo !== member.regNo);
        savePrototypePersistentTeam(currentTeam);
        setTeam(currentTeam);
      }
      showToast("Member removed", 'success');
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : "Couldn't remove the member. Please try again.", 'error');
    } finally {
      setBusy(false);
    }
  }

  async function handleLeaveTeam() {
    setBusy(true);
    try {
      const { getPrototypePersistentTeam, savePrototypePersistentTeam } = await import('../../lib/events/prototypeEventState');
      const currentTeam = getPrototypePersistentTeam(teamId!);
      if (currentTeam) {
        currentTeam.members = currentTeam.members.filter(m => m.regNo !== currentRegNo);
        savePrototypePersistentTeam(currentTeam);
      }
      showToast("You left the team", 'success');
      navigate("/events/my-teams?tab=my-teams");
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : "Couldn't leave the team. Please try again.", 'error');
    } finally {
      setBusy(false);
    }
  }

  async function handleDeleteTeam() {
    setBusy(true);
    try {
      await deletePersistentTeam(teamId!);
      showToast("Team deleted", 'success');
      navigate("/events/my-teams?tab=my-teams");
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : "Couldn't delete the team. Please try again.", 'error');
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <PageStack><SkeletonCard /></PageStack>;
  if (error) return <PageStack><ErrorMessage message={error} onRetry={() => navigate("/events/my-teams")} /></PageStack>;
  if (!team) return <PageStack><ErrorMessage message="Team not found" /></PageStack>;

  return (
    <PageStack>
      <div className="dashboard-card rounded-xl p-4">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h2 className="comp-heading-xl mt-0">{team.name}</h2>
            <p className="comp-body text-[var(--comp-text-secondary)]">
              {team.members.length} member{team.members.length !== 1 ? 's' : ''} · Created {new Date(team.createdAt).toLocaleDateString()}
            </p>
          </div>
          <div className="flex gap-2">
            {isLeader ? (
              <>
                <button className="comp-btn-ghost" onClick={() => setPendingConfirm({ type: "delete" })} disabled={busy}>
                  {busy ? "Deleting..." : "Delete Team"}
                </button>
              </>
            ) : (
              <button className="comp-btn-ghost" onClick={() => setPendingConfirm({ type: "leave" })} disabled={busy}>
                {busy ? "Leaving..." : "Leave Team"}
              </button>
            )}
          </div>
        </div>
      </div>

      {isLeader && (
        <div className="dashboard-card rounded-xl p-4">
          <h3 className="comp-heading-lg mt-0 mb-4">Invite Members</h3>
          <p className="comp-body text-[var(--comp-text-secondary)] mb-4">
            Add members by registration number. They'll receive a private invitation to join your team.
          </p>
          <div className="space-y-3 mb-4">
            {inviteRegNos.map((regNo, index) => (
              <div key={index} className="flex gap-2">
                <Input
                  placeholder="AP21110010"
                  value={regNo}
                  onChange={(e) => handleInviteChange(index, e.target.value)}
                  maxLength={12}
                />
                {inviteRegNos.length > 1 && (
                  <button type="button" className="comp-btn-ghost" onClick={() => handleRemoveInvite(index)} aria-label="Remove invite field">
                    <X size={18} />
                  </button>
                )}
              </div>
            ))}
          </div>
          <div className="flex gap-2">
            <button className="comp-btn-primary" onClick={handleSendInvites} disabled={busy || inviteRegNos.every(v => !v.trim())}>
              {busy ? "Sending..." : `Send ${inviteRegNos.filter(v => v.trim()).length} Invitation${inviteRegNos.filter(v => v.trim()).length !== 1 ? 's' : ''}`}
            </button>
            <button className="comp-btn-ghost" onClick={handleAddInvite} disabled={busy}>
              <Plus size={18} className="mr-1" /> Add Another
            </button>
          </div>
        </div>
      )}

      <div className="dashboard-card rounded-xl p-4">
        <h3 className="comp-heading-lg mt-0 mb-4">Team Members</h3>
        {team.members.length === 0 ? (
          <p className="comp-body text-[var(--comp-text-secondary)]">No members yet.</p>
        ) : (
          <div className="space-y-3">
            {team.members.map((member, index) => (
              <div key={index} className="flex flex-col md:flex-row md:items-center md:justify-between gap-2 p-2 bg-[var(--comp-surface)] rounded-lg">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-[var(--comp-accent)] flex items-center justify-center text-[var(--comp-accent-fg)] font-semibold">
                    {member.regNo.charAt(0)}
                  </div>
                  <div>
                    <p className="comp-heading-sm mt-0">{member.regNo}</p>
                    <p className="comp-body text-[var(--comp-text-secondary)]">
                      {member.status === 'pending' ? 'Pending invitation' : 'Active member'}
                      {member.regNo === currentRegNo ? ' (You)' : ''}
                    </p>
                  </div>
                </div>
                <div className="flex gap-2">
                  {member.status === 'pending' && isLeader && (
                    <button className="comp-btn-ghost" onClick={() => setPendingConfirm({ type: "cancel-invite", regNo: member.regNo })} disabled={busy}>
                      Cancel Invite
                    </button>
                  )}
                  {member.status === 'accepted' && isLeader && member.regNo !== currentRegNo && (
                    <button className="comp-btn-ghost" onClick={() => setPendingConfirm({ type: "remove-member", regNo: member.regNo })} disabled={busy}>
                      Remove
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <ConfirmDialog
        open={confirmCopy !== null}
        onOpenChange={(open) => { if (!open) setPendingConfirm(null); }}
        title={confirmCopy?.title ?? ""}
        description={confirmCopy?.description ?? ""}
        confirmLabel={confirmCopy?.confirmLabel ?? "Confirm"}
        cancelLabel={confirmCopy?.dismissLabel ?? "Cancel"}
        danger={confirmCopy?.danger}
        busy={busy}
        onConfirm={runConfirmedAction}
      />

      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
    </PageStack>
  );
}

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

export function TeamFormationPage() {
  const { event, config, refetch } = useEvent();
  const [teamName, setTeamName] = useState("");
  const [inviteRegNos, setInviteRegNos] = useState<string[]>([""]);
  const [neededSkills, setNeededSkills] = useState("");
  const [recruitmentNote, setRecruitmentNote] = useState("");
  const [team, setTeam] = useState<Team | null>(null);
  const [board, setBoard] = useState<TeamRecruitmentPost[]>([]);
  const [matches, setMatches] = useState<TeamMatchCandidate[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const maxTeamSize = config?.maxTeamSize || 4;
  const validInvites = inviteRegNos.filter((r) => r.trim().length > 0);
  const canAddMoreInvites = validInvites.length < maxTeamSize - 1;

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

  useEffect(() => {
    if (!event) return;
    let active = true;
    setLoading(true);
    Promise.all([
      getMyTeam(event.id),
      getTeamRecruitmentBoard(event.id).catch(() => []),
      getTeamMatches(event.id).catch(() => []),
    ])
      .then(([currentTeam, boardItems, matchItems]) => {
        if (!active) return;
        setTeam(currentTeam);
        setBoard(boardItems);
        setMatches(matchItems);
      })
      .catch((err: unknown) => {
        if (active) setError(err instanceof Error ? err.message : "Failed to load team discovery.");
      })
      .finally(() => { if (active) setLoading(false); });
    return () => {
      active = false;
    };
  }, [event]);

  async function onSubmitSkills() {
    if (!event || !team || !neededSkills.trim()) return;
    await runStep(setBusy, setError, async () => {
      await upsertTeamRecruitmentPost(event.id, {
        neededSkills: neededSkills.split(",").map((s) => s.trim()).filter(Boolean),
        description: recruitmentNote,
        openSlots: Math.max(1, 4 - team.members.filter((m) => m.status === "accepted").length),
        status: "open",
      });
      const [boardItems, matchItems] = await Promise.all([
        getTeamRecruitmentBoard(event.id).catch(() => []),
        getTeamMatches(event.id).catch(() => []),
      ]);
      setBoard(boardItems);
      setMatches(matchItems);
      track("resume_skills_synced", { eventId: event.id, teamId: team.id });
    }, "Failed to submit skills.");
  }

  async function onCreate() {
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
          console.warn(`Failed to invite ${regNo}:`, err);
        }
      }
      refetch();
    }, "Couldn't create the team. Please try again.");
  }

  async function onInvite(regNoOverride?: string) {
    const targetRegNo = (regNoOverride || inviteRegNos[0]).trim().toUpperCase();
    if (!event || !team || !targetRegNo) return;
    await runStep(setBusy, setError, async () => {
      await inviteMember(event.id, team.id, targetRegNo);
      setTeam({
        ...team,
        members: [
          ...team.members,
          { regNo: targetRegNo, name: targetRegNo, joinedAt: new Date().toISOString(), status: "pending" },
        ],
      });
      track("team_invite_sent", { eventId: event.id, teamId: team.id });
      setInviteRegNos((prev) => prev.map((v, i) => (i === 0 ? "" : v)));
    }, "Failed to invite member.");
  }

  async function onPublishRecruitment() {
    if (!event || !team) return;
    const skills = neededSkills.split(",").map((item) => item.trim()).filter(Boolean);
    const maxTeamSize = Math.max(1, Number(config?.maxTeamSize || 4));
    await runStep(setBusy, setError, async () => {
      await upsertTeamRecruitmentPost(event.id, {
        neededSkills: skills,
        description: recruitmentNote,
        openSlots: Math.max(1, maxTeamSize - team.members.filter((member) => member.status === "accepted").length),
        status: "open",
      });
      const [boardItems, matchItems] = await Promise.all([
        getTeamRecruitmentBoard(event.id).catch(() => []),
        getTeamMatches(event.id).catch(() => []),
      ]);
      setBoard(boardItems);
      setMatches(matchItems);
      track("team_recruitment_posted", { eventId: event.id, teamId: team.id });
    }, "Failed to publish recruitment needs.");
  }

  return (
    <PageStack>
      {error ? <ErrorMessage message={error} preservedInput /> : null}

      {!team ? (
        <div className="dashboard-card rounded-xl p-6 text-center">
          <Users className="mx-auto h-10 w-10 text-[var(--comp-text-muted)]" />
          <p className="comp-heading-md mt-3">No team yet</p>
          <p className="comp-body mt-1">Form a team to collaborate, find complementary skills, and submit together.</p>
          <div className="mt-4 inline-flex flex-col items-start gap-2 w-full max-w-md">
            <label className="comp-label" htmlFor="team-name-create">Team name</label>
            <Input id="team-name-create" value={teamName} onChange={(e) => setTeamName(e.target.value)} placeholder="My awesome team" />
            <div className="w-full">
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
            <button className="comp-btn-primary" disabled={busy || !teamName.trim()} onClick={() => void onCreate()}>
              {busy ? "Saving..." : "Create team"}
            </button>
          </div>
        </div>
      ) : (
        <>
          <div className="dashboard-card rounded-xl p-4">
            <p className="comp-heading-md mt-0">{team.name}</p>
            <p className="comp-body">Team code: {team.id}</p>
            <label className="comp-label" htmlFor="team-invite">Invite by reg no</label>
            <div className="space-y-2">
              <div className="flex justify-between items-center mb-2">
                <span className="comp-caption text-[var(--comp-text-muted)]">
                  Add more members (up to {maxTeamSize - 1} total)
                </span>
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
                      id={`team-invite-${index}`}
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
                {validInvites.length}/{maxTeamSize - 1} invite slots available
              </p>
            </div>
            <div className="mt-4">
              <button className="comp-btn-ghost" disabled={busy || validInvites.length === 0} onClick={() => validInvites.forEach((regNo) => void onInvite(regNo))}>
                {busy ? "Sending..." : `Send ${validInvites.length} invite${validInvites.length > 1 ? "s" : ""}`}
              </button>
            </div>
            <div className="mt-4 flex flex-wrap gap-1">
              {team.members.map((member) => (
                <span key={member.regNo} className="rounded-full border border-[var(--comp-border)] px-2 py-1 text-xs text-[var(--text-secondary)]">
                  {member.regNo} - {member.status}
                </span>
              ))}
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="dashboard-card rounded-xl p-4">
              <p className="comp-heading-md mt-0">Share your skills</p>
              <p className="comp-body">Tell the system what you know so it can find teammates with complementary strengths.</p>
              <label className="comp-label" htmlFor="skills">Skills (comma-separated)</label>
              <Input id="skills" value={neededSkills} onChange={(e) => setNeededSkills(e.target.value)} placeholder="React, Python, ML" />
              <button className="comp-btn-ghost mt-2" disabled={busy} onClick={() => void onSubmitSkills()}>
                {busy ? "Saving..." : "Submit skills"}
              </button>
            </div>

            <div className="dashboard-card rounded-xl p-4">
              <p className="comp-heading-md mt-0">Matched candidates</p>
              {matches.length === 0 ? (
                <div className="text-center py-6">
                  <Search className="mx-auto h-8 w-8 text-[var(--comp-text-muted)]" />
                  <p className="comp-body mt-2">Matched candidates appear after registered students share relevant skills in their forms.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {matches.slice(0, 4).map((candidate) => (
                    <div key={candidate.userId} className="rounded-xl border border-[var(--comp-border)] bg-[var(--dash-subcard-bg)] p-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="m-0 font-semibold">{candidate.name || candidate.userId}</p>
                        <span className="comp-label">{candidate.matchScore}% fit</span>
                      </div>
                      <p className="comp-body m-0">{candidate.department || "Department unavailable"}</p>
                      {candidate.matchedSkills.length ? (
                        <p className="comp-body m-0">Matches: {candidate.matchedSkills.join(", ")}</p>
                      ) : null}
                      <button className="comp-btn-ghost mt-2" disabled={busy} onClick={() => { void onInvite(candidate.userId); }}>Invite</button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </>
      )}

      <div className="dashboard-card rounded-xl p-4">
        <p className="comp-heading-md mt-0">Teams looking for members</p>
        {board.length === 0 ? (
          <div className="text-center py-6">
            <Search className="mx-auto h-8 w-8 text-[var(--comp-text-muted)]" />
            <p className="comp-body mt-2">No teams have posted open needs yet.</p>
          </div>
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {board.map((post) => (
              <div key={post.id} className="rounded-xl border border-[var(--comp-border)] bg-[var(--dash-subcard-bg)] p-3">
                <p className="m-0 font-semibold">{post.team.name}</p>
                <p className="comp-body m-0">{post.description || "Open to complementary teammates."}</p>
                <p className="comp-body m-0">Needs: {post.neededSkills.join(", ") || "Any committed teammate"}</p>
                <span className="comp-label">{post.openSlots} open slot{post.openSlots === 1 ? "" : "s"}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </PageStack>
  );
}

export function TeamDetailPage() {
  const { teamId = "" } = useParams();
  const { event } = useEvent();
  const navigate = useNavigate();
  const currentRegNo = getCurrentRegNo();
  const [team, setTeam] = useState<Team | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [inviteRegNo, setInviteRegNo] = useState("");
  const [inviteBusy, setInviteBusy] = useState(false);
  const [inviteError, setInviteError] = useState("");
  // Dialog states
  const [leaveDialogOpen, setLeaveDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [transferDialogOpen, setTransferDialogOpen] = useState(false);
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [selectedMemberForCancel, setSelectedMemberForCancel] = useState<TeamMember | null>(null);
  const [selectedMemberForTransfer, setSelectedMemberForTransfer] = useState<string>("");
  const [busyAction, setBusyAction] = useState<null | 'leave' | 'delete' | 'transfer' | 'cancel'>(null);
  const { toasts, showToast, dismissToast } = useToasts();

  useEffect(() => {
    if (!event) return;
    setLoading(true);
    getEventTeams(event.id)
      .then((teams) => setTeam(teams.find((item) => item.id === teamId) ?? null))
      .catch((err: unknown) => setError(err instanceof Error ? err.message : "Failed to load team."))
      .finally(() => setLoading(false));
  }, [event, teamId]);

  const isLeader = team?.leaderRegNo === currentRegNo;
  const isAcceptedMember = team?.members.some((m) => m.regNo === currentRegNo && m.status === "accepted") ?? false;
  const canInvite = isAcceptedMember;
  const pendingMembers = team?.members.filter((m) => m.status === "pending") ?? [];
  const acceptedMembers = team?.members.filter((m) => m.status === "accepted" && m.regNo !== currentRegNo) ?? [];

  const refreshTeam = async () => {
    if (!event) return;
    const updatedTeams = await getEventTeams(event.id);
    setTeam(updatedTeams.find((item) => item.id === teamId) ?? null);
  };

  async function handleInvite() {
    if (!event || !team || !inviteRegNo.trim() || inviteBusy) return;
    setInviteBusy(true);
    setInviteError("");
    try {
      await inviteMember(event.id, team.id, inviteRegNo.trim().toUpperCase());
      track("team_invite_sent", { eventId: event.id, teamId: team.id, inviter: currentRegNo });
      setInviteRegNo("");
      await refreshTeam();
      showToast("Invitation sent successfully", 'success');
    } catch (err: unknown) {
      setInviteError(err instanceof Error ? err.message : "Couldn't send the invitation. Please try again.");
      showToast(err instanceof Error ? err.message : "Couldn't send the invitation. Please try again.", 'error');
    } finally {
      setInviteBusy(false);
    }
  }

  async function handleLeave() {
    if (!event || !team) return;
    setBusyAction('leave');
    try {
      await leaveTeam(event.id, team.id);
      showToast("You have left the team", 'success');
      navigate("/events/my-teams");
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : "Couldn't leave the team. Please try again.", 'error');
    } finally {
      setBusyAction(null);
      setLeaveDialogOpen(false);
    }
  }

  async function handleDelete() {
    if (!event || !team) return;
    setBusyAction('delete');
    try {
      await deleteTeam(event.id, team.id);
      showToast("Team deleted successfully", 'success');
      navigate("/events/my-teams");
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : "Couldn't delete the team. Please try again.", 'error');
    } finally {
      setBusyAction(null);
      setDeleteDialogOpen(false);
    }
  }

  async function handleTransfer() {
    if (!event || !team || !selectedMemberForTransfer) return;
    setBusyAction('transfer');
    try {
      await transferLeadership(event.id, team.id, selectedMemberForTransfer);
      showToast("Leadership transferred successfully", 'success');
      await refreshTeam();
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : "Couldn't transfer leadership. Please try again.", 'error');
    } finally {
      setBusyAction(null);
      setTransferDialogOpen(false);
      setSelectedMemberForTransfer("");
    }
  }

  async function handleCancel() {
    if (!event || !team || !selectedMemberForCancel) return;
    setBusyAction('cancel');
    try {
      await cancelInvitation(event.id, team.id, selectedMemberForCancel.regNo);
      showToast("Invitation cancelled", 'success');
      await refreshTeam();
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : "Couldn't cancel the invitation. Please try again.", 'error');
    } finally {
      setBusyAction(null);
      setCancelDialogOpen(false);
      setSelectedMemberForCancel(null);
    }
  }

  if (loading) return <PageStack><SkeletonCard /></PageStack>;
  if (error) return <PageStack><ErrorMessage message={error} /></PageStack>;
  if (!team) return <PageStack><EmptyState title="Team not found" action={{ label: "Back to event", onClick: () => navigate("/events/my-teams") }} /></PageStack>;

  return (
    <PageStack>
      <div className="dashboard-card rounded-xl p-4">
        <p className="comp-heading-lg mt-0">{team.name}</p>
        <p className="comp-body">Leader: {team.leaderRegNo}{isLeader ? " (you)" : ""}</p>

        <div className="grid gap-2 my-4">
          {team.members.map((member) => (
            <div key={member.regNo} className="flex justify-between gap-2 rounded-xl border border-[var(--border)] bg-[var(--dash-subcard-bg)] p-4">
              <span>{member.name || member.regNo}</span>
              <span className="comp-label">{member.status}</span>
              {isLeader && member.status === "pending" && (
                <button
                  className="comp-btn-ghost text-[var(--error)] hover:bg-[color-mix(in_srgb,var(--error)_10%,transparent)]"
                  onClick={() => { setSelectedMemberForCancel(member); setCancelDialogOpen(true); }}
                  disabled={busyAction === 'cancel'}
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          ))}
        </div>

        {canInvite ? (
          <div className="dashboard-card rounded-xl p-4 mt-4" style={{ background: "color-mix(in srgb, var(--background) 90%, var(--surface) 10%)" }}>
            <p className="comp-heading-sm mt-0 mb-3">Invite Member</p>
            <div className="flex gap-2 flex-wrap">
              <Input
                placeholder="Registration Number (e.g., RA2311001000001)"
                value={inviteRegNo}
                onChange={(e) => setInviteRegNo(e.target.value.toUpperCase())}
                disabled={inviteBusy}
                className="flex-1 min-w-[200px]"
              />
              <button
                className="comp-btn-primary"
                disabled={inviteBusy || !inviteRegNo.trim()}
                onClick={handleInvite}
              >
                {inviteBusy ? "Inviting..." : "Send Invite"}
              </button>
              {inviteError && <span className="comp-error self-center">{inviteError}</span>}
            </div>
            <p className="comp-caption mt-2">Any accepted team member can invite others to join the team.</p>
          </div>
        ) : (
          <p className="comp-body text-[var(--comp-text-muted)]">
            {isLeader ? "Only accepted team members can invite others." : "You need to accept your invitation first before inviting others."}
          </p>
        )}

        {isLeader && acceptedMembers.length > 0 && (
          <div className="dashboard-card rounded-xl p-4 mt-4" style={{ background: "color-mix(in srgb, var(--background) 90%, var(--surface) 10%)" }}>
            <p className="comp-heading-sm mt-0 mb-3">Transfer Leadership</p>
            <div className="flex gap-2 flex-wrap items-end">
              <Select
                value={selectedMemberForTransfer}
                onChange={(e) => setSelectedMemberForTransfer(e.target.value)}
                className="flex-1 min-w-[200px]"
                disabled={busyAction === 'transfer'}
              >
                <option value="">Select member</option>
                {acceptedMembers.map((member) => (
                  <option key={member.regNo} value={member.regNo}>{member.name || member.regNo}</option>
                ))}
              </Select>
              <button
                className="comp-btn-primary"
                disabled={busyAction === 'transfer' || !selectedMemberForTransfer}
                onClick={() => setTransferDialogOpen(true)}
              >
                {busyAction === 'transfer' ? "Transferring..." : "Transfer"}
              </button>
            </div>
            <p className="comp-caption mt-2">Only accepted members can receive leadership.</p>
          </div>
        )}

        {!isLeader && isAcceptedMember && (
          <div className="dashboard-card rounded-xl p-4 mt-4" style={{ background: "color-mix(in srgb, var(--background) 90%, var(--surface) 10%)" }}>
            <p className="comp-heading-sm mt-0 mb-3">Leave Team</p>
            <button
              className="comp-btn-ghost text-[var(--error)] hover:bg-[color-mix(in_srgb,var(--error)_10%,transparent)]"
              onClick={() => setLeaveDialogOpen(true)}
              disabled={busyAction === 'leave'}
            >
              {busyAction === 'leave' ? "Leaving..." : "Leave Team"}
            </button>
            <p className="comp-caption mt-2">You cannot leave if you are the team leader.</p>
          </div>
        )}

        {isLeader && (
          <div className="dashboard-card rounded-xl p-4 mt-4" style={{ background: "color-mix(in srgb, var(--background) 90%, var(--surface) 10%)" }}>
            <p className="comp-heading-sm mt-0 mb-3">Delete Team</p>
            <button
              className="comp-btn-ghost text-[var(--error)] hover:bg-[color-mix(in_srgb,var(--error)_10%,transparent)]"
              onClick={() => setDeleteDialogOpen(true)}
              disabled={busyAction === 'delete'}
            >
              {busyAction === 'delete' ? "Deleting..." : "Delete Team"}
            </button>
            <p className="comp-caption mt-2">Cannot delete if submissions exist. All invitations will be cancelled.</p>
          </div>
        )}

        {/* Leave Team Dialog */}
        <ConfirmDialog
          open={leaveDialogOpen}
          onOpenChange={setLeaveDialogOpen}
          title="Leave Team"
          description={`Leave "${team.name}"? You will no longer be a member of this team.`}
          confirmLabel="Leave Team"
          busy={busyAction === 'leave'}
          busyLabel="Leaving..."
          onConfirm={handleLeave}
        />

        {/* Delete Team Dialog */}
        <ConfirmDialog
          open={deleteDialogOpen}
          onOpenChange={setDeleteDialogOpen}
          title="Delete Team"
          description={`This will permanently delete "${team.name}" and cancel all pending invitations. This action cannot be undone.`}
          confirmLabel="Delete Team"
          danger
          busy={busyAction === 'delete'}
          busyLabel="Deleting..."
          onConfirm={handleDelete}
        />

        {/* Transfer Leadership Dialog */}
        <Dialog open={transferDialogOpen} onOpenChange={setTransferDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Transfer Leadership</DialogTitle>
              <DialogDescription>
                Transfer leadership of "{team.name}" to the selected member. You will become a regular member.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <button className="comp-btn-ghost" onClick={() => setTransferDialogOpen(false)}>Cancel</button>
              <button className="comp-btn-primary" onClick={handleTransfer} disabled={busyAction === 'transfer'}>
                {busyAction === 'transfer' ? "Transferring..." : "Transfer Leadership"}
              </button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Cancel Invitation Dialog */}
        <Dialog open={cancelDialogOpen} onOpenChange={setCancelDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Cancel Invitation</DialogTitle>
              <DialogDescription>
                Cancel the pending invitation for {selectedMemberForCancel?.name || selectedMemberForCancel?.regNo}?
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <button className="comp-btn-ghost" onClick={() => { setCancelDialogOpen(false); setSelectedMemberForCancel(null); }}>Cancel</button>
              <button className="comp-btn-primary text-[var(--error)]" onClick={handleCancel} disabled={busyAction === 'cancel'}>
                {busyAction === 'cancel' ? "Cancelling..." : "Cancel Invitation"}
              </button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <ToastContainer toasts={toasts} onDismiss={dismissToast} />
      </div>
    </PageStack>
  );
}

// ─── CreatePersistentTeamForm ──────────────────────────────────────────────────

interface CreatePersistentTeamFormProps {
  onCreated: () => void;
}

function CreatePersistentTeamForm({ onCreated }: CreatePersistentTeamFormProps) {
  const [teamName, setTeamName] = useState("");
  const [inviteRegNos, setInviteRegNos] = useState<string[]>([""]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const { toasts, showToast, dismissToast } = useToasts();

  async function handleAddInvite() {
    setInviteRegNos(prev => [...prev, ""]);
  }

  async function handleRemoveInvite(index: number) {
    setInviteRegNos(prev => prev.filter((_, i) => i !== index));
  }

  async function handleInviteChange(index: number, value: string) {
    setInviteRegNos(prev => prev.map((v, i) => i === index ? value.toUpperCase() : v));
  }

  async function handleCreate() {
    if (!teamName.trim()) {
      setError("Please enter a team name");
      return;
    }
    const validInvites = inviteRegNos.filter(v => v.trim());
    setBusy(true);
    setError("");
    try {
      await createPersistentTeam(teamName.trim(), validInvites);
      showToast("Team created successfully!", 'success');
      onCreated();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Couldn't create the team. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <PageStack>
      <div className="dashboard-card rounded-xl p-4">
        <h2 className="comp-heading-xl mt-0">Create Persistent Team</h2>
        <p className="comp-body text-[var(--comp-text-secondary)] mb-4">
          Create a team that persists across events. When you find an event, invite the whole team to register together.
        </p>

        {error ? <ErrorMessage message={error} onRetry={() => setError("")} preservedInput /> : null}

        <div className="space-y-4">
          <div>
            <label className="comp-label" htmlFor="persistent-team-name">Team Name</label>
            <Input
              id="persistent-team-name"
              value={teamName}
              onChange={(e) => setTeamName(e.target.value)}
              placeholder="e.g., The Innovators"
              maxLength={50}
            />
          </div>

          <div>
            <label className="comp-label">Invite Members (Optional)</label>
            <p className="comp-body text-[var(--comp-text-secondary)] text-sm mb-2">
              Add members by registration number. They'll receive an invitation to join your team.
            </p>
            <div className="space-y-3">
              {inviteRegNos.map((regNo, index) => (
                <div key={index} className="flex gap-2">
                  <Input
                    placeholder="AP21110010"
                    value={regNo}
                    onChange={(e) => handleInviteChange(index, e.target.value)}
                    maxLength={12}
                  />
                  {inviteRegNos.length > 1 && (
                    <button type="button" className="comp-btn-ghost" onClick={() => handleRemoveInvite(index)} aria-label="Remove invite field">
                      <X size={18} />
                    </button>
                  )}
                </div>
              ))}
            </div>
            <button className="comp-btn-ghost mt-2" onClick={handleAddInvite} disabled={busy}>
              <Plus size={18} className="mr-1" /> Add Another
            </button>
          </div>

          <div className="flex gap-2 pt-4">
            <button className="comp-btn-primary" onClick={handleCreate} disabled={busy || !teamName.trim()}>
              {busy ? "Creating..." : "Create Team"}
            </button>
            <button className="comp-btn-ghost" onClick={() => onCreated()} disabled={busy}>
              Cancel
            </button>
          </div>
        </div>
      </div>

      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
    </PageStack>
  );
}

export function MyTeamsPage() {
  const [params, setParams] = useSearchParams();
  const [items, setItems] = useState<Array<{ event: EventSummary; team: Team }>>([]);
  const [availableEvents, setAvailableEvents] = useState<EventSummary[]>([]);
  const [invitations, setInvitations] = useState<Array<{ event: EventSummary; invitation: TeamInvitation }>>([]);
  const [persistentTeams, setPersistentTeams] = useState<PersistentTeam[]>([]);
  const [persistentInvitations, setPersistentInvitations] = useState<PersistentTeamInvitation[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingAvailable, setLoadingAvailable] = useState(true);
  const [loadingInvitations, setLoadingInvitations] = useState(true);
  const [scoreBreakdown, setScoreBreakdown] = useState<ScoreBreakdown | null>(null);
  const [scoreError, setScoreError] = useState("");
  const [loadingPersistentTeams, setLoadingPersistentTeams] = useState(true);
  const [loadingPersistentInvitations, setLoadingPersistentInvitations] = useState(true);
  const [error, setError] = useState("");
  const currentRegNo = getCurrentRegNo();

  const tabs = [
    { id: "active", label: "Active Teams" },
    { id: "completed", label: "Completed Teams" },
    { id: "invitations", label: "Invitations" },
    { id: "my-teams", label: "My Teams" },
    { id: "persistent-invites", label: "Team Invites" },
    { id: "create", label: "Create Team" },
  ] as const;

  type TabId = (typeof tabs)[number]["id"];
  const selectedTab = (params.get("tab") || "active") as TabId;
  const activeTab = tabs.some((tab) => tab.id === selectedTab) ? selectedTab : "active";

  // Teams and invitations both key off the registered-events list; fetching
  // that list once (instead of once per loader) halves the fan-out on mount.
  const loadTeamsAndInvitations = useCallback(() => {
    setLoading(true);
    setLoadingInvitations(true);
    setError("");
    getMyRegisteredEvents()
      .then(async (events) => {
        const [pairs, allInvitations] = await Promise.all([
          Promise.all(
            events.map(async (event) => {
              const team = await getMyTeam(event.id);
              return team ? { event, team } : null;
            })
          ).then((loaded) => loaded.filter(Boolean) as Array<{ event: EventSummary; team: Team }>),
          Promise.all(
            events.map(async (event) => {
              try {
                const invs = await getMyInvitations(event.id);
                return invs.map((invitation) => ({ event, invitation }));
              } catch {
                return [];
              }
            })
          ).then((groups) => groups.flat()),
        ]);
        return { pairs, allInvitations };
      })
      .then(({ pairs, allInvitations }) => {
        setItems(pairs);
        setInvitations(allInvitations);
      })
      .catch((err: unknown) => setError(err instanceof Error ? err.message : "Failed to load teams."))
      .finally(() => {
        setLoading(false);
        setLoadingInvitations(false);
      });
  }, []);

  const loadAvailableEvents = useCallback(() => {
    setLoadingAvailable(true);
    listEvents()
      .then((events: CampusEventSummary[]) => {
        // Filter events that are team competitions and open for registration
        const teamEvents = events.filter(
          (e: CampusEventSummary) => e.competitionConfig?.isCompetition && e.competitionConfig?.submissionScope === "team" &&
                 !["archived", "completed", "closed", "registration-closed"].includes(e.status || "")
        );
        setAvailableEvents(teamEvents as EventSummary[]);
      })
      .catch((err: unknown) => setError(err instanceof Error ? err.message : "Failed to load events."))
      .finally(() => setLoadingAvailable(false));
  }, []);

  const loadPersistentTeams = useCallback(() => {
    setLoadingPersistentTeams(true);
    getMyPersistentTeams()
      .then(setPersistentTeams)
      .catch((err: unknown) => setError(err instanceof Error ? err.message : "Failed to load persistent teams."))
      .finally(() => setLoadingPersistentTeams(false));
  }, []);

  const loadPersistentInvitations = useCallback(() => {
    setLoadingPersistentInvitations(true);
    getMyPersistentTeamInvitations()
      .then(setPersistentInvitations)
      .catch((err: unknown) => setError(err instanceof Error ? err.message : "Failed to load persistent team invitations."))
      .finally(() => setLoadingPersistentInvitations(false));
  }, []);

  useEffect(() => {
    loadTeamsAndInvitations();
    loadAvailableEvents();
    loadPersistentTeams();
    loadPersistentInvitations();
    getMyScores()
      .then((data) => setScoreBreakdown(data.team))
      .catch((err: unknown) =>
        setScoreError(err instanceof Error ? err.message : "Failed to load team score.")
      );
  }, [loadTeamsAndInvitations, loadAvailableEvents, loadPersistentTeams, loadPersistentInvitations]);

  const activeTeams = useMemo(
    () => items.filter(({ event }) => !["completed", "archived"].includes(event.status)),
    [items],
  );
  const completedTeams = useMemo(
    () => items.filter(({ event }) => ["completed", "results-published"].includes(event.status)),
    [items],
  );
  const upcomingDeadlines = activeTeams.filter(({ event }) => event.startAt || event.startDate).slice(0, 3);
  const fallbackTeamScore = useMemo(
    () => computeTeamScore({ activeTeams, persistentTeams, currentRegNo }),
    [activeTeams, persistentTeams, currentRegNo],
  );
  const teamBreakdown: ScoreBreakdown = scoreBreakdown ?? {
    ...fallbackTeamScore,
    headlineBand: scoreError ? "Live score unavailable" : "Updating…",
  };

  function setTab(tab: TabId) {
    setParams((prev) => {
      const next = new URLSearchParams(prev);
      next.set("tab", tab);
      return next;
    });
  }

  function formatDate(date?: string) {
    return date ? new Date(date).toLocaleDateString("en-IN", { month: "short", day: "numeric" }) : "TBA";
  }

  function TeamRow({ event, team }: { event: EventSummary; team: Team }) {
    const isLeader = team.leaderRegNo === currentRegNo;
    const teamUrl = `/events/${encodeURIComponent(event.id)}/teams/${encodeURIComponent(team.id)}`;
    return (
      <CompetitionCard className="activity-event-row">
        <span className="activity-event-icon"><Users size={22} /></span>
        <div>
          <h2>{team.name}</h2>
          <p>{event.title ?? "Untitled event"} · {formatDate(event.startAt || event.startDate)}</p>
        </div>
        <span className="competition-pill">{isLeader ? "Leader" : "Member"}</span>
        <div className="activity-event-actions">
          <Link className="comp-btn-ghost" to={teamUrl}>View</Link>
          <Link className="comp-btn-primary" to={`/events/${encodeURIComponent(event.id)}`}>Event</Link>
        </div>
      </CompetitionCard>
    );
  }

  function AvailableEventCard({ event }: { event: EventSummary }) {
    const alreadyHasTeam = items.some(({ event: e }) => e.id === event.id);
    const maxTeamSize = event.competitionConfig?.maxTeamSize || 4;
    return (
      <CompetitionCard className={alreadyHasTeam ? "activity-event-row activity-event-row-muted" : "activity-event-row"}>
        <span className="activity-event-icon"><Plus size={22} /></span>
        <div>
          <h2>{event.title}</h2>
          <p>Team competition · Up to {maxTeamSize} members · {formatDate(event.startAt || event.startDate)}</p>
        </div>
        <StatusBadge status={event.status || "Active"} dot />
        <div className="activity-event-actions">
          <Link className="comp-btn-ghost" to={`/events/${encodeURIComponent(event.id)}`}>Details</Link>
          {alreadyHasTeam ? (
            <Link className="comp-btn-ghost" to={`/events/${encodeURIComponent(event.id)}/teams/${encodeURIComponent(items.find(({ event: e }) => e.id === event.id)?.team.id ?? "")}`}>View Team</Link>
          ) : (
            <Link className="comp-btn-primary" to={`/events/${encodeURIComponent(event.id)}/teams/create`}>Create Team</Link>
          )}
        </div>
      </CompetitionCard>
    );
  }

  return (
    <CompetitionPageShell
      eyebrow="Student Workspace"
      title="My Teams"
      subtitle="Track team formations, create new teams, and invite members across competitions."
      variant="wide"
    >
      <div className="activity-dashboard-grid">
        <div className="activity-main-column">
          <div className="activity-tabs" role="tablist" aria-label="Team sections">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                role="tab"
                id={`team-tab-${tab.id}`}
                aria-selected={activeTab === tab.id}
                aria-controls="team-tabpanel"
                className={activeTab === tab.id ? "is-active" : ""}
                onClick={() => setTab(tab.id)}
                type="button"
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div id="team-tabpanel" role="tabpanel" aria-labelledby={`team-tab-${activeTab}`}>
          {error ? <ErrorMessage message={error} onRetry={loadTeamsAndInvitations} /> : null}

          {loading ? (
            <div className="activity-list">
              {[1, 2, 3].map((item) => <SkeletonCard key={item} />)}
            </div>
          ) : activeTab === "active" ? (
            activeTeams.length ? (
              <div className="activity-list">
                {activeTeams.map(({ event, team }) => <TeamRow key={team.id} event={event} team={team} />)}
              </div>
            ) : (
              <CompetitionEmptyPanel
                title="No active teams"
                description="Join or create teams for upcoming competitions to track them here."
                action={<Link className="comp-btn-primary" to="/events">Discover Events</Link>}
              />
            )
          ) : activeTab === "completed" ? (
            completedTeams.length ? (
              <div className="activity-list">
                {completedTeams.map(({ event, team }) => <TeamRow key={team.id} event={event} team={team} />)}
              </div>
            ) : (
              <CompetitionEmptyPanel title="No completed teams" description="Completed team competitions will appear here after results are published." />
            )
          ) : activeTab === "invitations" ? (
            loadingInvitations ? (
              <div className="activity-list">
                {[1, 2, 3].map((item) => <SkeletonCard key={item} />)}
              </div>
            ) : invitations.length ? (
              <div className="activity-list">
                {invitations.map(({ event, invitation }) => (
                  <CompetitionCard key={invitation.id} className="activity-event-row">
                    <span className="activity-event-icon"><Users size={22} /></span>
                    <div>
                      <h2>{invitation.teamName}</h2>
                      <p>{event.title ?? "Untitled event"} · Invited by {invitation.inviterRegisterNumber}</p>
                    </div>
                    <StatusBadge status="Pending" />
                    <div className="activity-event-actions">
                      <Link className="comp-btn-primary" to={`/events/${encodeURIComponent(event.id)}/invitations`}>View</Link>
                    </div>
                  </CompetitionCard>
                ))}
              </div>
            ) : (
              <CompetitionEmptyPanel
                title="No pending invitations"
                description="Team invitations will appear here when someone invites you."
              />
            )
          ) : activeTab === "my-teams" ? (
            loadingPersistentTeams ? (
              <div className="activity-list">
                {[1, 2, 3].map((item) => <SkeletonCard key={item} />)}
              </div>
            ) : persistentTeams.length ? (
              <div className="activity-list">
                {persistentTeams.map((team) => (
                  <CompetitionCard key={team.id} className="activity-event-row">
                    <span className="activity-event-icon"><Users size={22} /></span>
                    <div>
                      <h2>{team.name}</h2>
                      <p>{team.members.length} member{team.members.length > 1 ? 's' : ''} · {team.leaderRegNo === currentRegNo ? 'You are the leader' : 'Member'}</p>
                    </div>
                    <span className="competition-pill">{team.leaderRegNo === currentRegNo ? 'Leader' : 'Member'}</span>
                    <div className="activity-event-actions">
                      <Link className="comp-btn-primary" to={`/teams/persistent/${encodeURIComponent(team.id)}`}>Manage</Link>
                    </div>
                  </CompetitionCard>
                ))}
              </div>
            ) : (
              <CompetitionEmptyPanel
                title="No persistent teams"
                description="Create a persistent team to group up with friends. When you find an event, invite the whole team to register together."
                action={<Link className="comp-btn-primary" to="/events/my-teams?tab=create">Create Team</Link>}
              />
            )
          ) : activeTab === "persistent-invites" ? (
            loadingPersistentInvitations ? (
              <div className="activity-list">
                {[1, 2, 3].map((item) => <SkeletonCard key={item} />)}
              </div>
            ) : persistentInvitations.length ? (
              <div className="activity-list">
                {persistentInvitations.map((invitation) => (
                  <CompetitionCard key={invitation.id} className="activity-event-row">
                    <span className="activity-event-icon"><Users size={22} /></span>
                    <div>
                      <h2>{invitation.teamName}</h2>
                      <p>Invited by {invitation.inviterRegisterNumber} · {new Date(invitation.createdAt).toLocaleDateString()}</p>
                    </div>
                    <StatusBadge status="Pending" />
                    <div className="activity-event-actions">
                      <Link className="comp-btn-primary" to={`/teams/persistent/${encodeURIComponent(invitation.teamId)}`}>Manage</Link>
                    </div>
                  </CompetitionCard>
                ))}
              </div>
            ) : (
              <CompetitionEmptyPanel
                title="No persistent team invitations"
                description="When someone invites you to a persistent team, it will appear here."
              />
            )
          ) : activeTab === "create" ? (
            <CreatePersistentTeamForm onCreated={() => { loadPersistentTeams(); setTab("my-teams"); }} />
          ) : loadingAvailable ? (
            <div className="activity-list">
              {[1, 2, 3].map((item) => <SkeletonCard key={item} />)}
            </div>
          ) : availableEvents.length ? (
            <div className="activity-list">
              {availableEvents.map((event) => <AvailableEventCard key={event.id} event={event} />)}
            </div>
          ) : (
            <CompetitionEmptyPanel
              title="No team events available"
              description="Register for team competitions to create or join teams."
              action={<Link className="comp-btn-primary" to="/events">Discover Events</Link>}
            />
          )}
          </div>
        </div>

        <aside className="activity-side-column">
          <ScoreCard
            title="Team Score"
            icon={<Award size={28} />}
            breakdown={teamBreakdown}
            blurb={
              scoreError
                ? "Live score unavailable — showing estimate from this page's data."
                : "Based on leadership roles, roster health, and engagement across event and persistent teams."
            }
          />
          <CompetitionCard className="activity-deadline-card">
            <h2>Upcoming Deadlines</h2>
            {upcomingDeadlines.length ? upcomingDeadlines.map(({ event, team }) => (
              <Link key={team.id} to={`/events/${encodeURIComponent(event.id)}/teams/${encodeURIComponent(team.id)}`}>
                <CalendarClock size={20} />
                <span>
                  <strong>{team.name}</strong>
                  <small>{event.title ?? "Untitled event"} · {formatDate(event.startAt || event.startDate)}</small>
                </span>
              </Link>
            )) : <p>No upcoming deadlines.</p>}
          </CompetitionCard>
        </aside>
      </div>
    </CompetitionPageShell>
  );
}

export function CertificateClaimPage() {
  const { roundId = "" } = useParams();
  const { event, config } = useEvent();
  const [template, setTemplate] = useState<CertificateTemplate | null>(null);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState("");
  const currentRegNo = getCurrentRegNo();
  const round = config?.rounds.find((item) => item.roundId === roundId);

  useEffect(() => {
    if (!event) return;
    setLoading(true);
    getCertificateTemplate(event.id, roundId)
      .then(setTemplate)
      .catch((err: unknown) => setError(err instanceof Error ? err.message : "Failed to load certificate."))
      .finally(() => setLoading(false));
  }, [event, roundId]);

  async function onDownload() {
    if (!event) return;
    await runStep(setProcessing, setError, async () => {
      const blob = await downloadMyCertificate(event.id, roundId);
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `${event.title ?? "certificate"}-${roundId}.pdf`;
      anchor.click();
      URL.revokeObjectURL(url);
      track("certificate_downloaded", { eventId: event.id, roundId });
    }, "Certificate download failed.");
  }

  return (
    <PageStack>
      <div className="dashboard-card rounded-xl p-4">
        <p className="comp-heading-lg mt-0">Your Certificate is Ready</p>
        <p className="comp-body">{event?.title ?? "Event"} - {round?.title ?? "Round"}</p>
        {error ? <ErrorMessage message={error} onRetry={() => setError("")} preservedInput /> : null}
        {loading ? <SkeletonCard /> : (
          <div style={{ position: "relative", minHeight: 260, border: "1px solid var(--comp-border)", borderRadius: 10, overflow: "hidden", background: "var(--comp-surface-hover)" }}>
            {template?.templateImagePath ? <img src={template.templateImagePath} alt="Certificate template" style={{ width: "100%", display: "block" }} /> : null}
            {(template?.fields ?? []).map((field) => (
              <span key={field.key} style={{ position: "absolute", left: `${field.x}%`, top: `${field.y}%`, transform: field.align === "center" ? "translateX(-50%)" : field.align === "right" ? "translateX(-100%)" : undefined, fontSize: field.fontSize, fontWeight: field.fontWeight, color: field.color }}>
                {field.key === "participantName" ? currentRegNo : field.key === "eventName" ? event?.title : field.label}
              </span>
            ))}
            {!template ? <EmptyState title="No template configured" description="The organizer has not configured a certificate template yet." /> : null}
          </div>
        )}
        <button className="comp-btn-primary mt-4" disabled={processing || !template} onClick={() => void onDownload()}>
          {processing ? "Generating..." : "Download Certificate"}
        </button>
      </div>
    </PageStack>
  );
}

export function RolesPage() {
  const { event, userState } = useEvent();
  const currentRegNo = getCurrentRegNo();
  const [roles, setRoles] = useState<EventRoleAssignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [regNo, setRegNo] = useState("");
  const [role, setRole] = useState<EventRoleAssignment["role"]>("judge");
  const [pendingRemoveRegNo, setPendingRemoveRegNo] = useState<string | null>(null);

  const canManage = Boolean(userState?.canManageRoles);

  const loadRoles = () => {
    if (!event) return;
    setLoading(true);
    setError("");
    getEventRoles(event.id)
      .then(setRoles)
      .catch((err: unknown) => setError(err instanceof Error ? err.message : "Failed to load roles."))
      .finally(() => setLoading(false));
  };

  useEffect(loadRoles, [event?.id]);

  async function onAssign() {
    if (!event) return;
    const normalized = regNo.trim().toUpperCase();
    if (!/^[A-Z]{2,}\d{4,}$/.test(normalized)) {
      setError("Reg no must match an enrolled student format, for example AP21110010.");
      return;
    }
    try {
      await assignRole(event.id, normalized, role);
      setRegNo("");
      loadRoles();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't assign the role. Please try again.");
    }
  }

  async function onRemove(targetRegNo: string) {
    if (!event) return;
    setPendingRemoveRegNo(null);
    try {
      await removeRole(event.id, targetRegNo);
      loadRoles();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't remove the role. Please try again.");
    }
  }

  if (!canManage) {
    return (
      <PageStack>
        <ErrorMessage title="Access restricted" message="Only users with role-management permission can manage this event team." />
      </PageStack>
    );
  }

  return (
    <PageStack>
      <Link to={`/events/${encodeURIComponent(event?.id ?? "")}/manage`} className="comp-btn-ghost w-fit">Back to dashboard</Link>
      <p className="comp-heading-xl m-0">Manage Roles - {event?.title ?? "Event"}</p>
      {error ? <ErrorMessage message={error} preservedInput /> : null}
      <div className="dashboard-card rounded-xl p-4">
        <div className="grid gap-2 md:grid-cols-[1fr_180px_auto]">
          <Input value={regNo} onChange={(e) => setRegNo(e.target.value)} placeholder="AP21110010" aria-label="Registration number" />
          <Select value={role} onChange={(e) => setRole(e.target.value as EventRoleAssignment["role"])} aria-label="Role">
            <option value="co-organizer">Co-Organizer</option>
            <option value="manager">Manager</option>
            <option value="judge">Judge</option>
          </Select>
          <button className="comp-btn-primary" onClick={() => void onAssign()}>Add</button>
        </div>
      </div>
      {loading ? <SkeletonTable rows={4} /> : (
        <div className="dashboard-card rounded-xl p-4">
          <div className="overflow-x-auto" role="region" aria-label="Event roles table" tabIndex={0}>
            <table style={{ width: "100%", minWidth: 480, borderCollapse: "collapse" }} aria-label="Event roles">
            <thead><tr><th scope="col">Reg No.</th><th scope="col">Name</th><th scope="col">Role</th><th scope="col">Added By</th><th scope="col">Actions</th></tr></thead>
            <tbody>
              <tr>
                <td>{event?.createdBy ?? currentRegNo ?? "Owner"}</td><td>Owner</td><td>owner</td><td>-</td><td>Cannot remove</td>
              </tr>
              {roles.map((item) => (
                <tr key={`${item.regNo}-${item.role}`}>
                  <td>{item.regNo}</td><td>{item.name}</td><td>{item.role}</td><td>{item.assignedBy}</td>
                  <td><button className="comp-btn-ghost" onClick={() => setPendingRemoveRegNo(item.regNo)}>Remove</button></td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
          {roles.length === 0 ? <EmptyState title="No team members yet" description="Add co-organizers, managers, or judges by registration number." /> : null}
        </div>
      )}

      <ConfirmDialog
        open={pendingRemoveRegNo !== null}
        onOpenChange={(open) => { if (!open) setPendingRemoveRegNo(null); }}
        title="Remove this role?"
        description={`${pendingRemoveRegNo ?? "This member"} will lose the permissions that come with their role on ${event?.title ?? "this event"}.`}
        confirmLabel="Remove role"
        danger
        onConfirm={() => { if (pendingRemoveRegNo) void onRemove(pendingRemoveRegNo); }}
      />
    </PageStack>
  );
}

const availableCertificateFields = [
  ["participantName", "Participant Name"],
  ["eventName", "Event Name"],
  ["round", "Round/Category"],
  ["rank", "Rank/Position"],
  ["date", "Date"],
  ["custom", "Custom Text"],
] as const;

export function CertificateTemplatePage() {
  const { event } = useEvent();
  const [template, setTemplate] = useState<CertificateTemplate | null>(null);
  const [imagePath, setImagePath] = useState("");
  const [fields, setFields] = useState<CertificateField[]>([]);
  const [selectedKey, setSelectedKey] = useState("");
  const [dragKey, setDragKey] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const canvasRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!event) return;
    getCertificateTemplate(event.id)
      .then((data) => {
        setTemplate(data);
        setImagePath(data?.templateImagePath ?? "");
        setFields(data?.fields ?? []);
      })
      .catch(() => undefined);
  }, [event]);

  function addField(key: string, label: string) {
    const id = key === "custom" ? `custom-${Date.now()}` : key;
    if (key !== "custom" && fields.some((item) => item.key === key)) return;
    const field: CertificateField = {
      key: id,
      label,
      x: 50,
      y: 50,
      fontSize: 24,
      fontWeight: "bold",
      color: "#0a272b",
      align: "center",
    };
    setFields((prev) => [...prev, field]);
    setSelectedKey(field.key);
  }

  function updateField(key: string, patch: Partial<CertificateField>) {
    setFields((prev) => prev.map((item) => item.key === key ? { ...item, ...patch } : item));
  }

  function handleMove(clientX: number, clientY: number) {
    if (!dragKey || !canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const x = Math.min(100, Math.max(0, ((clientX - rect.left) / rect.width) * 100));
    const y = Math.min(100, Math.max(0, ((clientY - rect.top) / rect.height) * 100));
    updateField(dragKey, { x, y });
  }

  async function uploadImage() {
    if (!event || !file) return;
    await runStep(setBusy, setError, async () => {
      const result = await uploadCertificateTemplateImage(event.id, file);
      setImagePath(result.path);
    }, "Failed to upload template image.");
  }

  async function saveTemplate() {
    if (!event || !imagePath) return;
    await runStep(setBusy, setError, async () => {
      const saved = await saveCertificateTemplate(event.id, {
        id: template?.id,
        eventId: event.id,
        templateImagePath: imagePath,
        fields,
      });
      setTemplate(saved);
    }, "Failed to save template.");
  }

  const selected = fields.find((item) => item.key === selectedKey) ?? null;

  return (
    <PageStack>
      <Link to={`/events/${encodeURIComponent(event?.id ?? "")}/manage`} className="comp-btn-ghost w-fit">Back to dashboard</Link>
      <p className="comp-heading-xl m-0">Certificate Template - {event?.title ?? "Event"}</p>
      {error ? <ErrorMessage message={error} preservedInput /> : null}
      <div className="grid items-start gap-4 xl:grid-cols-[1fr_320px]">
        <div className="dashboard-card rounded-xl p-4">
          <p className="comp-heading-md mt-0">Upload template</p>
          <FileUploadZone
            onFile={setFile}
            accept={[".png", ".jpg", ".jpeg"]}
            maxSizeMb={10}
            currentFile={file ? { name: file.name, size: file.size, uploadedAt: new Date().toISOString() } : undefined}
          />
          <button className="comp-btn-ghost mt-2" disabled={busy || !file} onClick={() => void uploadImage()}>Upload image</button>
          <div
            ref={canvasRef}
            onMouseMove={(event) => handleMove(event.clientX, event.clientY)}
            onMouseUp={() => setDragKey("")}
            onMouseLeave={() => setDragKey("")}
            style={{ position: "relative", minHeight: 420, marginTop: "var(--space-md)", border: "1px solid var(--comp-border)", borderRadius: 10, overflow: "hidden", background: "var(--comp-surface-hover)" }}
          >
            {imagePath ? <img src={imagePath} alt="Certificate template" style={{ width: "100%", display: "block" }} /> : <EmptyState title="Upload a PNG or JPG template" />}
            {fields.map((field) => (
              <button
                key={field.key}
                type="button"
                onMouseDown={() => { setDragKey(field.key); setSelectedKey(field.key); }}
                style={{
                  position: "absolute",
                  left: `${field.x}%`,
                  top: `${field.y}%`,
                  transform: field.align === "center" ? "translateX(-50%)" : field.align === "right" ? "translateX(-100%)" : undefined,
                  border: selectedKey === field.key ? "1px dashed var(--comp-accent)" : "1px dashed transparent",
                  background: "transparent",
                  color: field.color,
                  fontSize: field.fontSize,
                  fontWeight: field.fontWeight,
                  cursor: "move",
                  padding: 2,
                }}
              >
                {field.label}
              </button>
            ))}
          </div>
        </div>
        <aside className="dashboard-card flex flex-col gap-4 rounded-xl p-4">
          <p className="comp-heading-md m-0">Fields</p>
          {availableCertificateFields.map(([key, label]) => (
            <button key={key} className="comp-btn-ghost" onClick={() => addField(key, label)}>+ {label}</button>
          ))}
          {selected ? (
            <div className="grid gap-2">
              <label className="comp-label" htmlFor="field-label">Label</label>
              <Input id="field-label" value={selected.label} onChange={(e) => updateField(selected.key, { label: e.target.value })} />
              <label className="comp-label" htmlFor="field-size">Font size</label>
              <Input id="field-size" type="number" value={selected.fontSize} onChange={(e) => updateField(selected.key, { fontSize: Number(e.target.value) })} />
              <label><input type="checkbox" checked={selected.fontWeight === "bold"} onChange={(e) => updateField(selected.key, { fontWeight: e.target.checked ? "bold" : "normal" })} /> Bold</label>
              <input type="color" value={selected.color} onChange={(e) => updateField(selected.key, { color: e.target.value })} aria-label="Field color" />
              <Select value={selected.align} onChange={(e) => updateField(selected.key, { align: e.target.value as CertificateField["align"] })} aria-label="Field alignment">
                <option value="left">Left</option>
                <option value="center">Center</option>
                <option value="right">Right</option>
              </Select>
              <button className="comp-btn-ghost" onClick={() => setFields((prev) => prev.filter((item) => item.key !== selected.key))}>Remove field</button>
            </div>
          ) : null}
          <button className="comp-btn-primary" disabled={busy || !imagePath} onClick={() => void saveTemplate()}>
            {busy ? "Saving..." : "Save Template"}
          </button>
        </aside>
      </div>
    </PageStack>
  );
}

export function InvitationsPage() {
  const { event } = useEvent();
  const [eventInvitations, setEventInvitations] = useState<TeamInvitation[]>([]);
  const [persistentInvitations, setPersistentInvitations] = useState<PersistentTeamInvitation[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingPersistent, setLoadingPersistent] = useState(true);
  const [error, setError] = useState("");
  const [busyIds, setBusyIds] = useState<Set<string>>(new Set());
  const { toasts, showToast, dismissToast } = useToasts();
  const [activeTab, setActiveTab] = useState<'event' | 'persistent'>('event');

  useEffect(() => {
    if (!event) return;
    setLoading(true);
    getMyInvitations(event.id)
      .then(setEventInvitations)
      .catch((err: unknown) => setError(err instanceof Error ? err.message : "Failed to load invitations."))
      .finally(() => setLoading(false));
  }, [event]);

  useEffect(() => {
    setLoadingPersistent(true);
    getMyPersistentTeamInvitations()
      .then(setPersistentInvitations)
      .catch((err: unknown) => setError(err instanceof Error ? err.message : "Failed to load persistent team invitations."))
      .finally(() => setLoadingPersistent(false));
  }, []);

  async function handleAccept(invitation: TeamInvitation) {
    if (!event) return;
    setBusyIds((prev) => new Set(prev).add(invitation.id));
    try {
      const { acceptInvite } = await import('../../lib/events/competitionsApi');
      await acceptInvite(event.id, invitation.id);
      showToast(`Accepted invitation to ${invitation.teamName}`, 'success');
      setEventInvitations((prev) => prev.filter((i) => i.id !== invitation.id));
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : "Couldn't accept the invitation. Please try again.", 'error');
    } finally {
      setBusyIds((prev) => {
        const next = new Set(prev);
        next.delete(invitation.id);
        return next;
      });
    }
  }

  async function handleDecline(invitation: TeamInvitation) {
    if (!event) return;
    setBusyIds((prev) => new Set(prev).add(invitation.id));
    try {
      const { declineInvitation } = await import('../../lib/events/competitionsApi');
      await declineInvitation(event.id, invitation.id);
      showToast(`Declined invitation to ${invitation.teamName}`, 'success');
      setEventInvitations((prev) => prev.filter((i) => i.id !== invitation.id));
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : "Couldn't decline the invitation. Please try again.", 'error');
    } finally {
      setBusyIds((prev) => {
        const next = new Set(prev);
        next.delete(invitation.id);
        return next;
      });
    }
  }

  async function handleAcceptPersistent(invitation: PersistentTeamInvitation) {
    setBusyIds((prev) => new Set(prev).add(invitation.id));
    try {
      await respondToPersistentTeamInvitation(invitation.id, true);
      showToast(`Accepted invitation to ${invitation.teamName}`, 'success');
      setPersistentInvitations((prev) => prev.filter((i) => i.id !== invitation.id));
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : "Couldn't accept the invitation. Please try again.", 'error');
    } finally {
      setBusyIds((prev) => {
        const next = new Set(prev);
        next.delete(invitation.id);
        return next;
      });
    }
  }

  async function handleDeclinePersistent(invitation: PersistentTeamInvitation) {
    setBusyIds((prev) => new Set(prev).add(invitation.id));
    try {
      await respondToPersistentTeamInvitation(invitation.id, false);
      showToast(`Declined invitation to ${invitation.teamName}`, 'success');
      setPersistentInvitations((prev) => prev.filter((i) => i.id !== invitation.id));
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : "Couldn't decline the invitation. Please try again.", 'error');
    } finally {
      setBusyIds((prev) => {
        const next = new Set(prev);
        next.delete(invitation.id);
        return next;
      });
    }
  }

  const isLoading = activeTab === 'event' ? loading : loadingPersistent;
  const currentInvitations = activeTab === 'event' ? eventInvitations : persistentInvitations;

  if (isLoading) return <PageStack><SkeletonCard /></PageStack>;
  if (error) return <PageStack><ErrorMessage message={error} /></PageStack>;

  return (
    <PageStack>
      <div className="dashboard-card rounded-xl p-4">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <p className="comp-heading-xl mt-0">Invitations</p>
            <p className="comp-body mt-1">
              {activeTab === 'event'
                ? 'Pending team invitations for this event.'
                : 'Pending persistent team invitations.'}
            </p>
          </div>
          <div className="flex gap-2" role="tablist">
            <button
              role="tab"
              aria-selected={activeTab === 'event'}
              className={`comp-btn-ghost px-3 py-1 ${activeTab === 'event' ? 'bg-[var(--comp-accent)] text-[var(--comp-accent-fg)]' : ''}`}
              onClick={() => setActiveTab('event')}
            >
              Event Teams
            </button>
            <button
              role="tab"
              aria-selected={activeTab === 'persistent'}
              className={`comp-btn-ghost px-3 py-1 ${activeTab === 'persistent' ? 'bg-[var(--comp-accent)] text-[var(--comp-accent-fg)]' : ''}`}
              onClick={() => setActiveTab('persistent')}
            >
              Persistent Teams
            </button>
          </div>
        </div>
      </div>

      {currentInvitations.length === 0 ? (
        <EmptyState
          title="No pending invitations"
          description={
            activeTab === 'event'
              ? "When someone invites you to an event team, it will appear here."
              : "When someone invites you to a persistent team, it will appear here."
          }
          icon={<Users className="h-12 w-12 text-[var(--comp-text-muted)]" />}
        />
      ) : (
        <div className="space-y-3">
          {currentInvitations.map((invitation) => (
            <div key={invitation.id} className="dashboard-card rounded-xl p-4 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div>
                <p className="comp-heading-md mt-0">{invitation.teamName}</p>
                <p className="comp-body">Invited by {invitation.inviterRegisterNumber}</p>
                <StatusBadge status="Pending" />
              </div>
              <div className="flex gap-2">
                <button
                  className="comp-btn-primary"
                  disabled={busyIds.has(invitation.id)}
                  onClick={() =>
                    activeTab === 'event'
                      ? handleAccept(invitation as TeamInvitation)
                      : handleAcceptPersistent(invitation as PersistentTeamInvitation)
                  }
                >
                  {busyIds.has(invitation.id) ? "Accepting..." : "Accept"}
                </button>
                <button
                  className="comp-btn-ghost"
                  disabled={busyIds.has(invitation.id)}
                  onClick={() =>
                    activeTab === 'event'
                      ? handleDecline(invitation as TeamInvitation)
                      : handleDeclinePersistent(invitation as PersistentTeamInvitation)
                  }
                >
                  {busyIds.has(invitation.id) ? "Declining..." : "Decline"}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
    </PageStack>
  );
}
