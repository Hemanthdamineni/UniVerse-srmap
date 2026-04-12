import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ErpPageShell, SectionCard, StatusBanner } from "../../components/erp/ErpPrimitives";
import {
  cancelTeamInvitation,
  createTeam,
  deleteTeam,
  getMyTeam,
  inviteTeamMember,
  leaveTeam,
  transferTeamLeadership,
  type Team,
} from "../../lib/campusApi";

export default function TeamManagementPage() {
  const { eventId = "" } = useParams();
  const [team, setTeam] = useState<Team | null>(null);
  const [name, setName] = useState("");
  const [invitee, setInvitee] = useState("");
  const [newLeader, setNewLeader] = useState("");
  const [outgoingInvites, setOutgoingInvites] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<{ tone: "success" | "warning"; text: string } | null>(null);

  async function load() {
    setLoading(true);
    try {
      const current = await getMyTeam(eventId);
      setTeam(current);
    } catch (error) {
      setMessage({ tone: "warning", text: error instanceof Error ? error.message : "Failed to load team." });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, [eventId]);

  async function onCreateTeam() {
    try {
      await createTeam(eventId, { name });
      setMessage({ tone: "success", text: "Team created." });
      setName("");
      await load();
    } catch (error) {
      setMessage({ tone: "warning", text: error instanceof Error ? error.message : "Failed to create team." });
    }
  }

  async function onInvite() {
    if (!team) return;
    try {
      await inviteTeamMember(eventId, team.id, { inviteeRegisterNumber: invitee });
      setOutgoingInvites((prev) => [...new Set([...prev, invitee])]);
      setInvitee("");
      setMessage({ tone: "success", text: "Invitation sent." });
    } catch (error) {
      setMessage({ tone: "warning", text: error instanceof Error ? error.message : "Failed to invite." });
    }
  }

  async function onCancelInvite(value: string) {
    if (!team) return;
    try {
      await cancelTeamInvitation(eventId, team.id, value);
      setOutgoingInvites((prev) => prev.filter((item) => item !== value));
      setMessage({ tone: "success", text: "Invitation cancelled." });
    } catch (error) {
      setMessage({ tone: "warning", text: error instanceof Error ? error.message : "Failed to cancel invitation." });
    }
  }

  return (
    <ErpPageShell title="My Team" source="Internal API" isLoading={loading} loadingMessage="Loading team...">
      {message ? <StatusBanner message={{ id: "team-msg", tone: message.tone, text: message.text }} /> : null}
      {!team ? (
        <SectionCard title="Create Team">
          <div className="space-y-3">
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Team name" className="w-full rounded-xl border border-[var(--border)] px-4 py-3 text-sm" />
            <button type="button" onClick={() => void onCreateTeam()} className="rounded-full bg-[#0A3035] px-4 py-2 text-sm font-semibold text-white">
              Create Team
            </button>
            <Link to={`/events/${encodeURIComponent(eventId)}/invitations`} className="inline-block text-xs text-[#0A3035] underline">
              View my invitations
            </Link>
          </div>
        </SectionCard>
      ) : (
        <>
          <SectionCard title={team.name}>
            <div className="space-y-2 text-sm">
              <p>Leader: {team.leaderId}</p>
              <p>Members: {team.members.join(", ")}</p>
            </div>
          </SectionCard>
          <SectionCard title="Invite Member">
            <div className="space-y-3">
              <input value={invitee} onChange={(e) => setInvitee(e.target.value)} placeholder="Invitee register number" className="w-full rounded-xl border border-[var(--border)] px-4 py-3 text-sm" />
              <button type="button" onClick={() => void onInvite()} className="rounded-full border border-[var(--border)] px-4 py-2 text-sm">
                Send Invitation
              </button>
              {outgoingInvites.map((item) => (
                <div key={item} className="flex items-center justify-between rounded-xl border border-[var(--border)] px-3 py-2 text-xs">
                  <span>{item}</span>
                  <button type="button" onClick={() => void onCancelInvite(item)} className="text-rose-700">
                    Cancel
                  </button>
                </div>
              ))}
            </div>
          </SectionCard>
          <SectionCard title="Team Actions">
            <div className="space-y-3">
              <input value={newLeader} onChange={(e) => setNewLeader(e.target.value)} placeholder="Transfer leadership to member" className="w-full rounded-xl border border-[var(--border)] px-4 py-3 text-sm" />
              <button
                type="button"
                onClick={() =>
                  void transferTeamLeadership(eventId, team.id, { newLeaderId: newLeader })
                    .then(() => load())
                    .catch((error) =>
                      setMessage({ tone: "warning", text: error instanceof Error ? error.message : "Transfer failed." })
                    )
                }
                className="rounded-full border border-[var(--border)] px-4 py-2 text-sm"
              >
                Transfer Leadership
              </button>
              <button type="button" onClick={() => void leaveTeam(eventId, team.id).then(() => load())} className="rounded-full border border-amber-300 px-4 py-2 text-sm text-amber-700">
                Leave Team
              </button>
              <button type="button" onClick={() => void deleteTeam(eventId, team.id).then(() => load())} className="rounded-full border border-rose-300 px-4 py-2 text-sm text-rose-700">
                Delete Team
              </button>
            </div>
          </SectionCard>
        </>
      )}
    </ErpPageShell>
  );
}
