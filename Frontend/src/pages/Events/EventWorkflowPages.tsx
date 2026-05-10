import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ErrorMessage } from "../../components/competition/ErrorMessage";
import { EmptyState } from "../../components/competition/EmptyState";
import { FileUploadZone } from "../../components/competition/FileUploadZone";
import { SkeletonCard, SkeletonTable } from "../../components/competition/Skeletons";
import { CompetitionPageShell } from "../../components/competition/CompetitionChrome";
import { useEvent } from "../../contexts/EventContext";
import { track } from "../../lib/analytics";
import {
  acceptInvite,
  assignRole,
  createTeam,
  downloadMyCertificate,
  getCertificateTemplate,
  getEventRoles,
  getEventTeams,
  getMyRegisteredEvents,
  getMyTeam,
  inviteMember,
  registerForEvent,
  removeRole,
  saveCertificateTemplate,
  uploadCertificateTemplateImage,
  type CertificateField,
  type CertificateTemplate,
  type EventRoleAssignment,
  type EventSummary,
  type Team,
} from "../../lib/competitionsApi";
import { getCurrentRegNo } from "../../lib/identity";
import { Input } from "../../components/input";
import { Select } from "../../components/select";

function PageStack({ children }: { children: React.ReactNode }) {
  return (
    <CompetitionPageShell variant="wide">
      <div className="space-y-5">
        {children}
      </div>
    </CompetitionPageShell>
  );
}

function StepPill({ active, label }: { active: boolean; label: string }) {
  return (
    <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${active ? "bg-[var(--comp-accent)] text-white" : "bg-[var(--dash-subcard-bg)] text-[var(--text-secondary)]"}`}>
      {label}
    </span>
  );
}

export function RegistrationFlowPage() {
  const { event, config, userState, refetch } = useEvent();
  const currentRegNo = getCurrentRegNo();
  const teamEvent = Boolean(config?.isCompetition && config.submissionScope === "team");
  const [step, setStep] = useState(1);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [teamName, setTeamName] = useState("");
  const [inviteRegNo, setInviteRegNo] = useState("");
  const [team, setTeam] = useState<Team | null>(null);

  const isClosed =
    !event ||
    event.status === "archived" ||
    event.status === "completed" ||
    event.status === "closed" ||
    event.status === "registration-closed";
  const isFull = Boolean(event?.maxCapacity && Number(event.registrationCount ?? 0) >= event.maxCapacity);

  async function createTeamAndInvite() {
    if (!event || !teamName.trim()) return;
    setBusy(true);
    setError("");
    try {
      const created = await createTeam(event.id, teamName.trim());
      setTeam(created);
      track("team_created", { eventId: event.id, teamId: created.id });
      if (inviteRegNo.trim()) {
        await inviteMember(event.id, created.id, inviteRegNo.trim().toUpperCase());
        track("team_invite_sent", { eventId: event.id, teamId: created.id });
      }
      setStep(3);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create team.");
    } finally {
      setBusy(false);
    }
  }

  async function confirmRegistration() {
    if (!event) return;
    setBusy(true);
    setError("");
    try {
      await registerForEvent(event.id);
      refetch();
      setSuccess(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Registration failed.");
    } finally {
      setBusy(false);
    }
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
        <div className="dashboard-card rounded-xl p-5">
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
      <div className="flex flex-wrap gap-2">
        <StepPill active={step === 1} label="1 Details" />
        {teamEvent ? <StepPill active={step === 2} label="2 Team" /> : null}
        <StepPill active={step === 3 || (!teamEvent && step === 2)} label={teamEvent ? "3 Review" : "2 Review"} />
      </div>

      {error ? <ErrorMessage message={error} onRetry={() => setError("")} preservedInput /> : null}

      {step === 1 ? (
        <div className="dashboard-card rounded-xl p-5">
          <p className="comp-heading-lg mt-0">{event.title ?? "Event registration"}</p>
          <p className="comp-body">{event.description ?? "Confirm your details to register."}</p>
          <label className="comp-label" htmlFor="reg-no">Registration number</label>
          <Input id="reg-no" readOnly value={currentRegNo ?? ""} />
          <p className="comp-body">By continuing, you confirm that you meet the event eligibility rules.</p>
          <button className="comp-btn-primary" onClick={() => setStep(teamEvent ? 2 : 3)}>Continue</button>
        </div>
      ) : null}

      {step === 2 && teamEvent ? (
        <div className="dashboard-card rounded-xl p-5">
          <p className="comp-heading-lg mt-0">Team setup</p>
          <div className="grid gap-4">
            <div>
              <label className="comp-label" htmlFor="team-name">Team name</label>
              <Input id="team-name" value={teamName} onChange={(e) => setTeamName(e.target.value)} />
            </div>
            <div>
              <label className="comp-label" htmlFor="invite-reg-no">Invite member by reg no</label>
              <Input id="invite-reg-no" value={inviteRegNo} onChange={(e) => setInviteRegNo(e.target.value)} placeholder="AP21110010" />
            </div>
            <button className="comp-btn-primary" disabled={busy || !teamName.trim()} onClick={() => void createTeamAndInvite()}>
              {busy ? "Creating..." : "Create team"}
            </button>
          </div>
        </div>
      ) : null}

      {step === 3 ? (
        <div className="dashboard-card rounded-xl p-5">
          <p className="comp-heading-lg mt-0">Review and confirm</p>
          <dl className="grid grid-cols-[160px_1fr] gap-x-4 gap-y-2">
            <dt className="comp-label">Reg no</dt><dd className="m-0">{currentRegNo ?? "Unavailable"}</dd>
            <dt className="comp-label">Event</dt><dd className="m-0">{event.title ?? "Untitled event"}</dd>
            {teamEvent ? <><dt className="comp-label">Team</dt><dd className="m-0">{team?.name ?? (teamName || "Not created")}</dd></> : null}
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
  const { event, refetch } = useEvent();
  const [teamName, setTeamName] = useState("");
  const [inviteRegNo, setInviteRegNo] = useState("");
  const [team, setTeam] = useState<Team | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function onCreate() {
    if (!event || !teamName.trim()) return;
    setBusy(true);
    setError("");
    try {
      const created = await createTeam(event.id, teamName.trim());
      setTeam(created);
      track("team_created", { eventId: event.id, teamId: created.id });
      refetch();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create team.");
    } finally {
      setBusy(false);
    }
  }

  async function onInvite() {
    if (!event || !team || !inviteRegNo.trim()) return;
    setBusy(true);
    setError("");
    try {
      await inviteMember(event.id, team.id, inviteRegNo.trim().toUpperCase());
      setTeam({
        ...team,
        members: [
          ...team.members,
          { regNo: inviteRegNo.trim().toUpperCase(), name: inviteRegNo.trim().toUpperCase(), joinedAt: new Date().toISOString(), status: "pending" },
        ],
      });
      track("team_invite_sent", { eventId: event.id, teamId: team.id });
      setInviteRegNo("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to invite member.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <PageStack>
      <div className="dashboard-card rounded-xl p-5">
        <p className="comp-heading-lg mt-0">Create a team</p>
        {error ? <ErrorMessage message={error} preservedInput /> : null}
        <label className="comp-label" htmlFor="team-name-create">Team name</label>
        <Input id="team-name-create" value={teamName} onChange={(e) => setTeamName(e.target.value)} />
        <button className="comp-btn-primary" disabled={busy || !teamName.trim()} onClick={() => void onCreate()}>
          {busy ? "Saving..." : "Create team"}
        </button>
      </div>
      {team ? (
        <div className="dashboard-card rounded-xl p-5">
          <p className="comp-heading-md mt-0">{team.name}</p>
          <p className="comp-body">Team code: {team.id}</p>
          <label className="comp-label" htmlFor="team-invite">Invite by reg no</label>
          <div className="flex flex-wrap gap-2">
            <Input id="team-invite" className="min-w-[220px] flex-1" value={inviteRegNo} onChange={(e) => setInviteRegNo(e.target.value)} placeholder="AP21110010" />
            <button className="comp-btn-ghost" disabled={busy || !inviteRegNo.trim()} onClick={() => void onInvite()}>Send invite</button>
          </div>
          <div className="mt-4 flex flex-wrap gap-1.5">
            {team.members.map((member) => (
              <span key={member.regNo} className="rounded-full border border-[var(--comp-border)] px-2.5 py-1 text-xs text-[var(--text-secondary)]">
                {member.regNo} - {member.status}
              </span>
            ))}
          </div>
        </div>
      ) : null}
    </PageStack>
  );
}

export function TeamDetailPage() {
  const { teamId = "" } = useParams();
  const { event } = useEvent();
  const currentRegNo = getCurrentRegNo();
  const [team, setTeam] = useState<Team | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!event) return;
    setLoading(true);
    getEventTeams(event.id)
      .then((teams) => setTeam(teams.find((item) => item.id === teamId) ?? null))
      .catch((err: unknown) => setError(err instanceof Error ? err.message : "Failed to load team."))
      .finally(() => setLoading(false));
  }, [event, teamId]);

  const isLeader = team?.leaderRegNo === currentRegNo;

  if (loading) return <PageStack><SkeletonCard /></PageStack>;
  if (error) return <PageStack><ErrorMessage message={error} /></PageStack>;
  if (!team) return <PageStack><EmptyState title="Team not found" action={{ label: "Back to event", onClick: () => history.back() }} /></PageStack>;

  return (
    <PageStack>
      <div className="dashboard-card rounded-xl p-5">
        <p className="comp-heading-lg mt-0">{team.name}</p>
        <p className="comp-body">Leader: {team.leaderRegNo}{isLeader ? " (you)" : ""}</p>
        <div className="grid gap-2">
          {team.members.map((member) => (
            <div key={member.regNo} className="flex justify-between gap-2 rounded-xl border border-[var(--border)] bg-[var(--dash-subcard-bg)] p-4">
              <span>{member.name || member.regNo}</span>
              <span className="comp-label">{member.status}</span>
            </div>
          ))}
        </div>
        {isLeader ? <p className="comp-body">Leadership transfer and invite removal require backend support and are intentionally not simulated client-side.</p> : null}
      </div>
    </PageStack>
  );
}

export function MyTeamsPage() {
  const [items, setItems] = useState<Array<{ event: EventSummary; team: Team }>>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const currentRegNo = getCurrentRegNo();

  useEffect(() => {
    let active = true;
    getMyRegisteredEvents()
      .then(async (events) => {
        const pairs = await Promise.all(
          events.map(async (event) => {
            const team = await getMyTeam(event.id);
            return team ? { event, team } : null;
          })
        );
        if (active) setItems(pairs.filter(Boolean) as Array<{ event: EventSummary; team: Team }>);
      })
      .catch((err: unknown) => setError(err instanceof Error ? err.message : "Failed to load teams."))
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, []);

  return (
    <PageStack>
      <p className="comp-heading-xl m-0">My Teams</p>
      {error ? <ErrorMessage message={error} /> : null}
      {loading ? <SkeletonCard /> : items.length === 0 ? (
        <EmptyState title="No teams yet" description="Team events you join or create will appear here." />
      ) : (
        <div className="grid gap-4">
          {items.map(({ event, team }) => (
            <Link key={team.id} to={`/events/${encodeURIComponent(event.id)}/teams/${encodeURIComponent(team.id)}`} className="dashboard-card rounded-xl p-5 no-underline text-inherit">
              <p className="comp-heading-md mt-0">{team.name}</p>
              <p className="comp-body">{event.title ?? "Untitled event"} - {team.members.length} member(s)</p>
              <span className="comp-label">{team.leaderRegNo === currentRegNo ? "Leader" : "Member"}</span>
            </Link>
          ))}
        </div>
      )}
    </PageStack>
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
    setProcessing(true);
    setError("");
    try {
      const blob = await downloadMyCertificate(event.id, roundId);
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `${event.title ?? "certificate"}-${roundId}.pdf`;
      anchor.click();
      URL.revokeObjectURL(url);
      track("certificate_downloaded", { eventId: event.id, roundId });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Certificate download failed.");
    } finally {
      setProcessing(false);
    }
  }

  return (
    <PageStack>
      <div className="dashboard-card rounded-xl p-5">
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
      setError(err instanceof Error ? err.message : "Failed to assign role.");
    }
  }

  async function onRemove(targetRegNo: string) {
    if (!event || !window.confirm(`Remove role for ${targetRegNo}?`)) return;
    try {
      await removeRole(event.id, targetRegNo);
      loadRoles();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to remove role.");
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
      <div className="dashboard-card rounded-xl p-5">
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
        <div className="dashboard-card rounded-xl p-5">
          <table style={{ width: "100%", borderCollapse: "collapse" }} aria-label="Event roles">
            <thead><tr><th scope="col">Reg No.</th><th scope="col">Name</th><th scope="col">Role</th><th scope="col">Added By</th><th scope="col">Actions</th></tr></thead>
            <tbody>
              <tr>
                <td>{event?.createdBy ?? currentRegNo ?? "Owner"}</td><td>Owner</td><td>owner</td><td>-</td><td>Cannot remove</td>
              </tr>
              {roles.map((item) => (
                <tr key={`${item.regNo}-${item.role}`}>
                  <td>{item.regNo}</td><td>{item.name}</td><td>{item.role}</td><td>{item.assignedBy}</td>
                  <td><button className="comp-btn-ghost" onClick={() => void onRemove(item.regNo)}>Remove</button></td>
                </tr>
              ))}
            </tbody>
          </table>
          {roles.length === 0 ? <EmptyState title="No team members yet" description="Add co-organizers, managers, or judges by registration number." /> : null}
        </div>
      )}
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
    setBusy(true);
    setError("");
    try {
      const result = await uploadCertificateTemplateImage(event.id, file);
      setImagePath(result.path);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to upload template image.");
    } finally {
      setBusy(false);
    }
  }

  async function saveTemplate() {
    if (!event || !imagePath) return;
    setBusy(true);
    setError("");
    try {
      const saved = await saveCertificateTemplate(event.id, {
        id: template?.id,
        eventId: event.id,
        templateImagePath: imagePath,
        fields,
      });
      setTemplate(saved);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save template.");
    } finally {
      setBusy(false);
    }
  }

  const selected = fields.find((item) => item.key === selectedKey) ?? null;

  return (
    <PageStack>
      <Link to={`/events/${encodeURIComponent(event?.id ?? "")}/manage`} className="comp-btn-ghost w-fit">Back to dashboard</Link>
      <p className="comp-heading-xl m-0">Certificate Template - {event?.title ?? "Event"}</p>
      {error ? <ErrorMessage message={error} preservedInput /> : null}
      <div className="grid items-start gap-5 xl:grid-cols-[1fr_320px]">
        <div className="dashboard-card rounded-xl p-5">
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
        <aside className="dashboard-card flex flex-col gap-4 rounded-xl p-5">
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
