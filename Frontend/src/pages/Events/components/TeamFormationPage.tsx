import { useEffect, useState } from "react";
import { Search, Users, X } from "lucide-react";
import { ErrorMessage } from "../../../components/competition/ErrorMessage";
import { Input } from "../../../components/input";
import { useEvent } from "../../../contexts/EventContext";
import { track } from "../../../lib/core/analytics";
import {
  createTeam,
  getMyTeam,
  getTeamMatches,
  getTeamRecruitmentBoard,
  inviteMember,
  upsertTeamRecruitmentPost,
  type Team,
  type TeamMatchCandidate,
  type TeamRecruitmentPost,
} from "../../../lib/events/competitionsApi";
import { PageStack, runStep } from "./PageStack";

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