import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ErrorMessage } from "../../../components/competition/ErrorMessage";
import { EmptyState } from "../../../components/competition/CompetitionEmptyState";
import { SkeletonTable } from "../../../components/ui/Skeletons";
import { Input } from "../../../components/input";
import { Select } from "../../../components/select";
import { ConfirmDialog } from "../../../components/dialog";
import {
  assignRole,
  getEventRoles,
  removeRole,
  type EventRoleAssignment,
} from "../../../lib/events/competitionsApi";
import { getCurrentRegNo } from "../../../lib/core/identity";
import { useEvent } from "../../../contexts/EventContext";
import { PageStack } from "./PageStack";

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