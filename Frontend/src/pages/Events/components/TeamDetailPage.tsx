import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { X } from "lucide-react";
import { ErrorMessage } from "../../../components/competition/ErrorMessage";
import { EmptyState } from "../../../components/competition/CompetitionEmptyState";
import { SkeletonCard } from "../../../components/ui/Skeletons";
import { ToastContainer, useToasts } from "../../../components/ui/Feedback";
import { Input } from "../../../components/input";
import { Select } from "../../../components/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  ConfirmDialog,
} from "../../../components/dialog";
import {
  cancelInvitation,
  deleteTeam,
  getEventTeams,
  inviteMember,
  leaveTeam,
  transferLeadership,
  type Team,
  type TeamMember,
} from "../../../lib/events/competitionsApi";
import { track } from "../../../lib/core/analytics";
import { getCurrentRegNo } from "../../../lib/core/identity";
import { useEvent } from "../../../contexts/EventContext";
import { PageStack } from "./PageStack";

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