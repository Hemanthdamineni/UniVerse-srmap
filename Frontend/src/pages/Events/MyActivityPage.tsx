import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Award, CalendarClock, FileCheck2, Trophy } from "lucide-react";
import { CompetitionCard, CompetitionEmptyPanel, CompetitionPageShell } from "../../components/competition/CompetitionChrome";
import { ErrorMessage } from "../../components/competition/ErrorMessage";
import { SkeletonCard } from "../../components/ui/Skeletons";
import { listEvents, type EventSummary } from "../../lib/campus/campusApi";

const tabs = [
  { id: "registered", label: "Registered Events" },
  { id: "submissions", label: "My Submissions" },
  { id: "results", label: "My Results" },
] as const;

type TabId = (typeof tabs)[number]["id"];

function formatDate(date?: string) {
  return date ? new Date(date).toLocaleDateString("en-IN", { month: "short", day: "numeric" }) : "TBA";
}

function ActivityEventRow({ event }: { event: EventSummary }) {
  const round = event.competitionConfig?.rounds?.[0];
  return (
    <CompetitionCard className="activity-event-row">
      <span className="activity-event-icon"><Trophy size={22} /></span>
      <div>
        <h2>{event.title}</h2>
        <p>{event.category || "Competition"} · {formatDate(event.startAt || event.startDate)}</p>
      </div>
      <span className="competition-pill">{event.status || "Active"}</span>
      <div className="activity-event-actions">
        <Link className="comp-btn-ghost" to={`/events/${event.id}`}>View</Link>
        {round ? <Link className="comp-btn-primary" to={`/events/${event.id}/submit/${round.roundId}`}>Submit</Link> : null}
      </div>
    </CompetitionCard>
  );
}

export default function MyActivityPage() {
  const [params, setParams] = useSearchParams();
  const selectedTab = (params.get("tab") || "registered") as TabId;
  const activeTab = tabs.some((tab) => tab.id === selectedTab) ? selectedTab : "registered";
  const [events, setEvents] = useState<EventSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadEvents = useCallback(() => {
    setLoading(true);
    setError("");
    listEvents({ registered: "true" })
      .then(setEvents)
      .catch((err: unknown) => setError(err instanceof Error ? err.message : "Failed to load activity."))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    loadEvents();
  }, [loadEvents]);

  const activeEvents = useMemo(
    () => events.filter((event) => !["completed", "archived"].includes(event.status)),
    [events],
  );
  const completedEvents = useMemo(
    () => events.filter((event) => ["completed", "results-published"].includes(event.status)),
    [events],
  );
  const deadlines = activeEvents.filter((event) => event.startAt || event.startDate).slice(0, 3);

  function setTab(tab: TabId) {
    setParams((prev) => {
      const next = new URLSearchParams(prev);
      next.set("tab", tab);
      return next;
    });
  }

  return (
    <CompetitionPageShell
      eyebrow="Student Workspace"
      title="My Activity"
      subtitle="Track registrations, submissions, results, and certificate-ready competitions."
      variant="wide"
    >
      <div className="activity-dashboard-grid">
        <div className="activity-main-column">
          <div className="activity-tabs" role="tablist" aria-label="Activity sections">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                className={activeTab === tab.id ? "is-active" : ""}
                onClick={() => setTab(tab.id)}
                type="button"
              >
                {tab.label}
              </button>
            ))}
          </div>

          {error ? <ErrorMessage message={error} onRetry={loadEvents} /> : null}

          {loading ? (
            <div className="activity-list">
              {[1, 2, 3].map((item) => <SkeletonCard key={item} />)}
            </div>
          ) : activeTab === "registered" ? (
            activeEvents.length ? (
              <div className="activity-list">
                {activeEvents.map((event) => <ActivityEventRow key={event.id} event={event} />)}
              </div>
            ) : (
              <CompetitionEmptyPanel
                title="No active registrations"
                description="Explore events and register for competitions you want to track here."
                action={<Link className="comp-btn-primary" to="/events">Discover</Link>}
              />
            )
          ) : activeTab === "submissions" ? (
            activeEvents.length ? (
              <div className="activity-list">
                {activeEvents.map((event) => <ActivityEventRow key={event.id} event={event} />)}
              </div>
            ) : (
              <CompetitionEmptyPanel title="No submissions yet" description="Submission links appear once you register for competition rounds." />
            )
          ) : completedEvents.length ? (
            <div className="activity-list">
              {completedEvents.map((event) => <ActivityEventRow key={event.id} event={event} />)}
            </div>
          ) : (
            <CompetitionEmptyPanel title="No results published" description="Your evaluated rounds will appear here after organizers publish results." />
          )}
        </div>

        <aside className="activity-side-column">
          <CompetitionCard className="activity-score-card">
            <Award size={28} />
            <h2>Competition Score</h2>
            <p className="summary-stat"><strong>{Math.min(100, 70 + activeEvents.length * 7)}</strong> <span>/ 100</span></p>
            <p>Based on participation, submission progress, and recent activity.</p>
          </CompetitionCard>
          <CompetitionCard className="activity-deadline-card">
            <h2>Upcoming Deadlines</h2>
            {deadlines.length ? deadlines.map((event) => (
              <Link key={event.id} to={`/events/${event.id}`}>
                <CalendarClock size={20} />
                <span>
                  <strong>{event.title}</strong>
                  <small>{formatDate(event.startAt || event.startDate)}</small>
                </span>
              </Link>
            )) : <p>No upcoming deadlines.</p>}
          </CompetitionCard>
        </aside>
      </div>
    </CompetitionPageShell>
  );
}
