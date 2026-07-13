import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { MoreVertical, Plus, Users } from "lucide-react";
import { CompetitionCard, CompetitionEmptyPanel, CompetitionPageShell } from "../../components/competition/CompetitionChrome";
import { ErrorMessage } from "../../components/competition/ErrorMessage";
import { SkeletonCard } from "../../components/ui/Skeletons";
import { listEvents, type EventSummary } from "../../lib/campus/campusApi";
import { getCurrentRegNo, isPlatformAdmin } from "../../lib/core/identity";

const MAX_ACTIVE_EVENTS = 5;

function formatRange(event: EventSummary) {
  const start = event.startAt || event.startDate;
  const end = event.endAt || event.endDate;
  const fmt = (value?: string) => value ? new Date(value).toLocaleDateString("en-IN", { month: "short", day: "numeric" }) : "TBA";
  return `${fmt(start)} - ${fmt(end)}`;
}

export default function MyCreatedEventsPage() {
  const regNo = getCurrentRegNo();
  const admin = isPlatformAdmin(regNo);
  const [events, setEvents] = useState<EventSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadEvents = useCallback(() => {
    setLoading(true);
    setError("");
    listEvents(admin ? undefined : { createdBy: regNo })
      .then(setEvents)
      .catch((err: unknown) => setError(err instanceof Error ? err.message : "Failed to load created events."))
      .finally(() => setLoading(false));
  }, [admin, regNo]);

  useEffect(() => {
    loadEvents();
  }, [loadEvents]);

  const activeEvents = useMemo(
    () => events.filter((event) => ["draft", "published", "public", "ongoing", "upcoming"].includes(event.status)),
    [events],
  );
  const atLimit = activeEvents.length >= MAX_ACTIVE_EVENTS && !admin;

  return (
    <CompetitionPageShell
      title={admin ? "Managed Events" : "My Created Events"}
      subtitle={admin ? "Platform admin view for all event workspaces." : "Manage the competitions and events you created or co-organize."}
      actions={
        <Link className={atLimit ? "comp-btn-ghost" : "comp-btn-primary"} to="/events/create" aria-disabled={atLimit}>
          <Plus size={18} />
          Create New Event
        </Link>
      }
      variant="wide"
    >
      <div className="created-events-summary">
        <CompetitionCard>
          <p className="summary-stat"><strong>{events.length}</strong> <span>events total</span></p>
          <small>{admin ? "Admin scope" : `Owned by ${regNo || "current user"}`}</small>
        </CompetitionCard>
        <CompetitionCard>
          <p className="summary-stat"><strong>{activeEvents.length}/{MAX_ACTIVE_EVENTS}</strong> <span>active slots</span></p>
          <small>{atLimit ? "Archive one event to create another" : "Ready for more activity"}</small>
        </CompetitionCard>
        <CompetitionCard>
          <p className="summary-stat"><strong>{events.reduce((sum, event) => sum + Number(event.registeredCount ?? event.registrationCount ?? 0), 0)}</strong> <span>registrations</span></p>
          <small>Across visible events</small>
        </CompetitionCard>
      </div>

      {error ? <ErrorMessage message={error} onRetry={loadEvents} /> : null}

      {loading ? (
        <div className="created-events-list">
          {[1, 2, 3].map((item) => <SkeletonCard key={item} />)}
        </div>
      ) : events.length ? (
        <div className="created-events-list">
          {events.map((event) => (
            <CompetitionCard key={event.id} className="created-event-row">
              <div className="created-event-poster">
                <span>{event.category?.slice(0, 4).toUpperCase() || "EVNT"}</span>
              </div>
              <div>
                <h2>{event.title}</h2>
                <p>{formatRange(event)} · {typeof event.location === "string" ? event.location : event.venue || "Campus venue"}</p>
                <span><Users size={15} /> {event.registeredCount ?? event.registrationCount ?? 0} Registered</span>
              </div>
              <span className="competition-pill">{event.status || "Draft"}</span>
              <Link className="comp-btn-ghost" to={`/events/${event.id}`}>View</Link>
              <Link className="comp-btn-primary" to={`/events/${event.id}/manage`}>Manage</Link>
              <button className="competition-icon-button" aria-label={`More actions for ${event.title}`}>
                <MoreVertical size={18} />
              </button>
            </CompetitionCard>
          ))}
        </div>
      ) : (
        <CompetitionEmptyPanel
          title="No events created yet"
          description="Use the create flow to publish your first competition workspace."
          action={<Link className="comp-btn-primary" to="/events/create">Create Event</Link>}
        />
      )}
    </CompetitionPageShell>
  );
}
