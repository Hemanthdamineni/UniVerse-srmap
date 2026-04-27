import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { ErpPageShell, SectionCard, StatusBanner } from "../../components/erp/ErpPrimitives";
import { acceptInvitation, declineInvitation, getMyInvitations, type TeamInvitation } from "../../lib/campusApi";

export default function InvitationsPage() {
  const { eventId = "" } = useParams();
  const [items, setItems] = useState<TeamInvitation[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<{ tone: "success" | "warning"; text: string } | null>(null);

  async function load() {
    setLoading(true);
    try {
      const data = await getMyInvitations(eventId);
      setItems(data);
    } catch (error) {
      setMessage({ tone: "warning", text: error instanceof Error ? error.message : "Failed to load invitations." });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, [eventId]);

  return (
    <ErpPageShell title="Team Invitations" source="Internal API" isLoading={loading} loadingMessage="Loading invitations...">
      {message ? <StatusBanner message={{ id: "invite-msg", tone: message.tone, text: message.text }} /> : null}
      <SectionCard title="Pending Invitations">
        <div className="space-y-3">
          {items.length === 0 ? (
            <p className="text-sm text-[var(--text-secondary)]">No pending invitations.</p>
          ) : (
            items.map((item) => (
              <div key={item.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[var(--border)] p-3">
                <div>
                  <p className="text-sm font-semibold">{item.teamName}</p>
                  <p className="text-xs text-[var(--text-secondary)]">Invited by {item.invitedBy}</p>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      void acceptInvitation(eventId, item.id)
                        .then(() => setMessage({ tone: "success", text: "Invitation accepted." }))
                        .then(() => load())
                    }
                    className="rounded-full border border-[color-mix(in_srgb,var(--success)_30%,transparent)] px-3 py-1 text-xs font-semibold text-[var(--success)]"
                  >
                    Accept
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      void declineInvitation(eventId, item.id)
                        .then(() => setMessage({ tone: "success", text: "Invitation declined." }))
                        .then(() => load())
                    }
                    className="rounded-full border border-rose-300 px-3 py-1 text-xs font-semibold text-rose-700"
                  >
                    Decline
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </SectionCard>
    </ErpPageShell>
  );
}
