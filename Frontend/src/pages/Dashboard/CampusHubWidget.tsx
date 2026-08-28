import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  AlertCircle,
  ArrowRight,
  Briefcase,
  Calendar,
  Clock,
  RefreshCw,
} from "lucide-react";
import { listEvents, type EventSummary } from "../../lib/campus/campusApi";
import { listOpportunities, listApplications, type CareerOpportunity } from "../../lib/career/careerApi";
import { SegmentedControl } from "../../components/ui";

type HubTab = "events" | "career";

function eventDeadlineLabel(event: EventSummary): { label: string; isUrgent: boolean } {
  const date = event.registrationDeadline || event.startAt;
  if (!date) return { label: "No deadline", isUrgent: false };
  const diff = new Date(date).getTime() - Date.now();
  if (diff <= 0) return { label: "Closed", isUrgent: false };
  const hours = Math.ceil(diff / 3_600_000);
  if (hours < 24) return { label: `${hours}h left`, isUrgent: true };
  const days = Math.ceil(hours / 24);
  return { label: `${days}d left`, isUrgent: days < 3 };
}

const CATEGORY_COLORS: Record<string, string> = {
  Technical: "var(--accent-blue)",
  Cultural: "var(--accent-orange)",
  Sports: "var(--accent-green)",
  Academic: "var(--accent-yellow)",
  Workshop: "var(--accent-blue)",
};

function categoryColor(category?: string): string {
  if (!category) return "var(--comp-text-muted)";
  return CATEGORY_COLORS[category] || "var(--comp-text-muted)";
}

function careerDeadlineLabel(deadline?: string): string {
  if (!deadline) return "No deadline";
  const diff = new Date(deadline).getTime() - Date.now();
  if (diff <= 0) return "Expired";
  const days = Math.ceil(diff / (1000 * 60 * 60 * 24));
  if (days === 1) return "1 day left";
  if (days < 7) return `${days} days left`;
  return `${Math.floor(days / 7)} weeks left`;
}

export default function CampusHubWidget() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<HubTab>("events");

  const [eventsState, setEventsState] = useState<"loading" | "error" | "empty" | "data">("loading");
  const [events, setEvents] = useState<EventSummary[]>([]);
  const [eventsError, setEventsError] = useState<string | null>(null);

  const [careerState, setCareerState] = useState<"loading" | "error" | "empty" | "data">("loading");
  const [opportunities, setOpportunities] = useState<CareerOpportunity[]>([]);
  const [careerError, setCareerError] = useState<string | null>(null);
  const [applicationCount, setApplicationCount] = useState(0);

  const fetchEvents = async () => {
    setEventsState("loading");
    setEventsError(null);
    try {
      const result = await listEvents({ status: "published", type: "upcoming" });
      const sorted = [...result].sort((a, b) => {
        const aDate = a.registrationDeadline || a.startAt || "";
        const bDate = b.registrationDeadline || b.startAt || "";
        return new Date(aDate).getTime() - new Date(bDate).getTime();
      });
      const limited = sorted.slice(0, 3);
      setEvents(limited);
      setEventsState(limited.length === 0 ? "empty" : "data");
    } catch (err) {
      setEventsError(err instanceof Error ? err.message : "Could not load events");
      setEventsState("error");
    }
  };

  const fetchCareer = async () => {
    setCareerState("loading");
    setCareerError(null);
    try {
      const [ops, apps] = await Promise.all([
        listOpportunities({ type: "all", deadlineSoon: "true", limit: "3" }),
        listApplications(),
      ]);
      setOpportunities(ops.items || []);
      setApplicationCount((apps as { items?: { length: number } }).items?.length || 0);
      setCareerState((ops.items || []).length === 0 ? "empty" : "data");
    } catch (err) {
      setCareerError(err instanceof Error ? err.message : "Failed to load");
      setCareerState("error");
    }
  };

  useEffect(() => {
    fetchEvents();
    fetchCareer();
  }, []);

  const eventsBadge =
    eventsState === "data" && events.length > 0
      ? `${events.length}`
      : null;
  const careerBadge =
    applicationCount > 0
      ? `${applicationCount}`
      : careerState === "data" && opportunities.length > 0
        ? `${opportunities.length}`
        : null;

  return (
    <div className="flex h-full flex-col p-4">
      {/* Full-width segmented toggle */}
      <SegmentedControl
        size="sm"
        ariaLabel="Campus hub sections"
        className="mb-2 grid w-full shrink-0 grid-cols-2"
        value={activeTab}
        onChange={setActiveTab}
        options={[
          {
            value: "events",
            label: (
              <>
                <Calendar size={13} aria-hidden="true" />
                Events
              </>
            ),
            badge: eventsBadge,
          },
          {
            value: "career",
            label: (
              <>
                <Briefcase size={13} aria-hidden="true" />
                Career
              </>
            ),
            badge: careerBadge,
          },
        ]}
      />

      {activeTab === "career" && applicationCount > 0 && (
        <div className="mb-2 flex shrink-0 justify-end">
          <span className="inline-flex items-center gap-2 rounded-full border border-[var(--status-success-border)] bg-[var(--status-success-bg)] px-2 py-1 text-xs font-medium text-[var(--status-success-text)]">
            {applicationCount} application{applicationCount !== 1 ? "s" : ""}
          </span>
        </div>
      )}

      {activeTab === "events" ? (
        <div className="min-h-0 flex-1 overflow-y-auto">
          {eventsState === "loading" && (
            <div className="space-y-1.5">
              {[1, 2, 3].map((i) => (
                <div key={i} className="skeleton-shimmer h-16 rounded-lg" />
              ))}
            </div>
          )}

          {eventsState === "error" && (
            <div className="flex h-full flex-col items-center justify-center gap-2 rounded-lg border border-[color-mix(in_srgb,var(--error)_30%,transparent)] bg-[color-mix(in_srgb,var(--error)_10%,transparent)] p-3 text-center">
              <AlertCircle size={20} className="text-[var(--error)]" />
              <p className="text-sm text-[var(--error)]">{eventsError || "Could not load events"}</p>
              <button
                onClick={fetchEvents}
                type="button"
                className="flex items-center gap-2 rounded-md border border-[var(--comp-border)] bg-[var(--comp-surface)] px-3 py-2 text-xs font-medium text-[var(--comp-text-primary)] transition-colors hover:bg-[var(--comp-surface-hover)]"
              >
                <RefreshCw size={12} />
                Retry
              </button>
            </div>
          )}

          {eventsState === "empty" && (
            <div className="flex h-full flex-col items-center justify-center gap-2 py-4 text-center">
              <Calendar size={28} className="text-[var(--comp-text-muted)] opacity-40" />
              <p className="text-sm text-[var(--comp-text-secondary)]">No upcoming events right now.</p>
            </div>
          )}

          {eventsState === "data" && (
            <div className="space-y-1.5">
              {events.map((event) => {
                const dl = eventDeadlineLabel(event);
                const color = categoryColor(event.category);
                return (
                  <div
                    key={event.id}
                    onClick={() => navigate(`/events/${encodeURIComponent(event.id)}`)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        navigate(`/events/${encodeURIComponent(event.id)}`);
                      }
                    }}
                    className="cursor-pointer rounded-lg border border-[var(--comp-border)] bg-[var(--comp-surface)] p-2.5 transition-all hover:bg-[var(--comp-surface-hover)] hover:shadow-sm"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <span
                          className="mb-0.5 inline-block rounded px-2 py-1 text-xs font-semibold uppercase tracking-wide"
                          style={{
                            backgroundColor: `color-mix(in srgb, ${color} 20%, transparent)`,
                            color,
                          }}
                        >
                          {event.category || "Event"}
                        </span>
                        <p className="line-clamp-1 text-sm font-semibold leading-snug text-[var(--comp-text-primary)]">
                          {event.title}
                        </p>
                      </div>
                      <span
                        className="inline-flex shrink-0 items-center gap-2 self-center rounded-full px-2 py-1 text-xs font-medium"
                        style={{
                          backgroundColor: `color-mix(in srgb, ${dl.isUrgent ? "var(--deadline-urgent)" : "var(--deadline-safe)"} 15%, transparent)`,
                          color: dl.isUrgent ? "var(--deadline-urgent)" : "var(--deadline-safe)",
                        }}
                      >
                        <Clock size={12} aria-hidden="true" />
                        {dl.label}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ) : (
        <div className="min-h-0 flex-1 overflow-y-auto">
          {careerState === "loading" && (
            <div className="space-y-1.5">
              <div className="skeleton-shimmer h-16 rounded-lg" />
              <div className="skeleton-shimmer h-16 rounded-lg" />
            </div>
          )}

          {careerState === "error" && (
            <div className="flex h-full flex-col items-center justify-center gap-2 rounded-lg border border-[color-mix(in_srgb,var(--error)_30%,transparent)] bg-[color-mix(in_srgb,var(--error)_10%,transparent)] p-3 text-center">
              <AlertCircle size={20} className="text-[var(--error)]" />
              <p className="text-sm text-[var(--comp-text-secondary)]">{careerError}</p>
              <button
                onClick={fetchCareer}
                type="button"
                className="flex items-center gap-2 rounded-md border border-[var(--comp-border)] bg-[var(--comp-surface)] px-3 py-2 text-xs font-medium text-[var(--comp-text-primary)] transition-colors hover:bg-[var(--comp-surface-hover)]"
              >
                <RefreshCw size={12} />
                Retry
              </button>
            </div>
          )}

          {careerState === "empty" && (
            <div className="flex h-full flex-col items-center justify-center gap-2 py-4 text-center">
              <Briefcase size={28} className="text-[var(--comp-text-muted)] opacity-40" />
              <p className="text-sm text-[var(--comp-text-secondary)]">No urgent opportunities</p>
            </div>
          )}

          {careerState === "data" && (
            <div className="space-y-1.5">
              {opportunities.slice(0, 3).map((op) => (
                <div
                  key={op.id}
                  onClick={() => navigate(`/career/opportunities/${op.id}`)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      navigate(`/career/opportunities/${op.id}`);
                    }
                  }}
                  className="cursor-pointer rounded-lg border border-[var(--comp-border)] bg-[var(--comp-surface)] p-2.5 transition-all hover:bg-[var(--comp-surface-hover)] hover:shadow-sm"
                >
                  <p className="truncate text-sm font-semibold text-[var(--comp-text-primary)]">{op.title}</p>
                  <p className="truncate text-xs text-[var(--comp-text-secondary)]">
                    {op.company || op.organizer || "Unknown company"}
                  </p>
                  <div className="mt-1.5 flex items-center justify-between">
                    <span
                      className="inline-flex items-center gap-2 rounded-full px-2 py-1 text-xs font-medium"
                      style={{
                        backgroundColor: `color-mix(in srgb, var(--deadline-urgent) 15%, transparent)`,
                        color: "var(--deadline-urgent)",
                      }}
                    >
                      <Clock size={12} />
                      {careerDeadlineLabel(op.deadline)}
                    </span>
                    <span className="text-xs font-semibold uppercase text-[var(--comp-text-muted)]">
                      {op.type}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <button
        onClick={() => navigate(activeTab === "events" ? "/events" : "/career")}
        type="button"
        className="mt-2 flex w-full shrink-0 items-center justify-center gap-1 rounded-lg bg-[var(--comp-accent)] px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90"
      >
        {activeTab === "events" ? "Browse all events" : "Go to Career Portal"}
        <ArrowRight size={15} aria-hidden="true" />
      </button>
    </div>
  );
}
