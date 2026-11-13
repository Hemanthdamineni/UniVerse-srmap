import { useEffect, useState } from "react";
import { Users } from "lucide-react";
import { ErrorMessage } from "../../../components/competition/ErrorMessage";
import { EmptyState } from "../../../components/competition/CompetitionEmptyState";
import { SkeletonCard } from "../../../components/ui/Skeletons";
import { ToastContainer, useToasts } from "../../../components/ui/Feedback";
import { StatusBadge } from "../../../components/ui/Badges";
import { useEvent } from "../../../contexts/EventContext";
import {
  getMyInvitations,
  getMyPersistentTeamInvitations,
  respondToPersistentTeamInvitation,
  type PersistentTeamInvitation,
  type TeamInvitation,
} from "../../../lib/events/competitionsApi";
import { PageStack } from "./PageStack";

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
      const { acceptInvite } = await import('../../../lib/events/competitionsApi');
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
      const { declineInvitation } = await import('../../../lib/events/competitionsApi');
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