import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { ShieldAlert } from "lucide-react";
import { GlobalLoadingBoundary, useEvent } from "../../contexts/EventContext";
import type { EventUserState } from "../../lib/events/eventUserState";
import { CompetitionPageShell } from "./CompetitionChrome";

type PermissionKey =
  | "canEdit"
  | "canEvaluate"
  | "canShortlist"
  | "canManageRoles"
  | "canViewAllSubmissions";

export function RequireCompetitionAccess({
  permission,
  children,
}: {
  permission: PermissionKey;
  children: ReactNode;
}) {
  const { loading, error, event, userState, refetch } = useEvent();

  if (loading) return <GlobalLoadingBoundary />;

  if (error || !event) {
    return (
      <CompetitionPageShell title="Unable to Load Event" subtitle={error ?? "The event could not be found."}>
        <div className="competition-access-panel">
          <button className="comp-btn-primary" onClick={() => refetch(true)}>Retry</button>
          <Link className="comp-btn-ghost" to="/events">Back to events</Link>
        </div>
      </CompetitionPageShell>
    );
  }

  const allowed = Boolean((userState as EventUserState | null)?.[permission]);
  if (allowed) return <>{children}</>;

  return (
    <CompetitionPageShell
      eyebrow="Access control"
      title="You do not have access to this workspace"
      subtitle="Organizer and judging tools are limited to event owners, assigned curators, judges, and the platform admin."
    >
      <div className="competition-access-panel" role="alert" aria-live="polite">
        <ShieldAlert size={38} />
        <p>
          Current role: <strong>{userState?.role ?? "visitor"}</strong>
        </p>
        <Link className="comp-btn-primary" to={`/events/${encodeURIComponent(event.id)}`}>
          Return to event
        </Link>
      </div>
    </CompetitionPageShell>
  );
}
