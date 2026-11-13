import { useState } from "react";
import { Plus, X } from "lucide-react";
import { ErrorMessage } from "../../../components/competition/ErrorMessage";
import { ToastContainer, useToasts } from "../../../components/ui/Feedback";
import { Input } from "../../../components/input";
import { createPersistentTeam } from "../../../lib/events/competitionsApi";
import { PageStack } from "./PageStack";

interface CreatePersistentTeamFormProps {
  onCreated: () => void;
}

export function CreatePersistentTeamForm({ onCreated }: CreatePersistentTeamFormProps) {
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