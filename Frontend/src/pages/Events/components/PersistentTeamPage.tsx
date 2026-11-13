import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Plus, X } from "lucide-react";
import { ErrorMessage } from "../../../components/competition/ErrorMessage";
import { SkeletonCard } from "../../../components/ui/Skeletons";
import { ToastContainer, useToasts } from "../../../components/ui/Feedback";
import { Input } from "../../../components/input";
import { ConfirmDialog } from "../../../components/dialog";
import {
  cancelPersistentTeamInvitation,
  deletePersistentTeam,
  getMyPersistentTeams,
  inviteToPersistentTeam,
  type PersistentTeam,
  type TeamMember,
} from "../../../lib/events/competitionsApi";
import { getCurrentRegNo } from "../../../lib/core/identity";
import { PageStack } from "./PageStack";

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
      const { getPrototypePersistentTeam, savePrototypePersistentTeam } = await import('../../../lib/events/prototypeEventState');
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
      const { getPrototypePersistentTeam, savePrototypePersistentTeam } = await import('../../../lib/events/prototypeEventState');
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