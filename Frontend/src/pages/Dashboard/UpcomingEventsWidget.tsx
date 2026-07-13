import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AlertCircle, ArrowRight, Calendar, Clock, RefreshCw } from "lucide-react";
import { listEvents, type EventSummary } from "../../lib/campus/campusApi";

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

type DeadlineInfo = { label: string; isUrgent: boolean };

function deadlineLabel(event: EventSummary): DeadlineInfo {
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

/* ------------------------------------------------------------------ */
/*  Skeleton                                                           */
/* ------------------------------------------------------------------ */

function SkeletonBar({ className }: { className?: string }) {
  return <div className={`skeleton-shimmer rounded ${className ?? ""}`} />;
}

function LoadingSkeleton() {
  return (
    <div className="space-y-3">
      {[1, 2, 3].map((i) => (
        <div
          key={i}
          className="rounded-lg border border-[var(--comp-border)] bg-[var(--comp-surface)] p-3"
        >
          <SkeletonBar className="mb-2 h-3 w-16" />
          <SkeletonBar className="mb-2 h-4 w-full" />
          <SkeletonBar className="h-3 w-24" />
        </div>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  State                                                              */
/* ------------------------------------------------------------------ */

type WidgetState = "loading" | "error" | "empty" | "data";

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export default function UpcomingEventsWidget() {
  const navigate = useNavigate();
  const [state, setState] = useState<WidgetState>("loading");
  const [events, setEvents] = useState<EventSummary[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const fetchEvents = async () => {
    setState("loading");
    setErrorMessage(null);
    try {
      const result = await listEvents({ status: "published", type: "upcoming" });
      const sorted = [...result].sort((a, b) => {
        const aDate = a.registrationDeadline || a.startAt || "";
        const bDate = b.registrationDeadline || b.startAt || "";
        return new Date(aDate).getTime() - new Date(bDate).getTime();
      });
      const limited = sorted.slice(0, 3);
      setEvents(limited);
      setState(limited.length === 0 ? "empty" : "data");
    } catch (err) {
      setErrorMessage(
        err instanceof Error ? err.message : "Could not load events",
      );
      setState("error");
    }
  };

  useEffect(() => {
    fetchEvents();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* -- Loading state -- */
  if (state === "loading") {
    return (
      <div className="flex h-full flex-col p-4">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="card-title font-bold">Upcoming Events</h2>
        </div>
        <LoadingSkeleton />
      </div>
    );
  }

  /* -- Error state -- */
  if (state === "error") {
    return (
      <div className="flex h-full flex-col p-4">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="card-title font-bold">Upcoming Events</h2>
        </div>
        <div className="flex flex-1 flex-col items-center justify-center gap-3 rounded-lg border border-[color-mix(in_srgb,var(--error)_30%,transparent)] bg-[color-mix(in_srgb,var(--error)_10%,transparent)] p-4 text-center">
          <AlertCircle size={24} className="text-[var(--error)]" />
          <p className="text-sm text-[var(--error)]">
            {errorMessage || "Could not load events"}
          </p>
          <button
            onClick={fetchEvents}
            type="button"
            className="flex items-center gap-1.5 rounded-md border border-[var(--comp-border)] bg-[var(--comp-surface)] px-3 py-1.5 text-xs font-medium text-[var(--comp-text-primary)] transition-colors hover:bg-[var(--comp-surface-hover)]"
          >
            <RefreshCw size={14} />
            Retry
          </button>
        </div>
      </div>
    );
  }

  /* -- Empty state -- */
  if (state === "empty") {
    return (
      <div className="flex h-full flex-col p-4">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="card-title font-bold">Upcoming Events</h2>
        </div>
        <div className="flex flex-1 flex-col items-center justify-center gap-3 py-6 text-center">
          <Calendar size={40} className="text-[var(--comp-text-muted)] opacity-40" />
          <div>
            <p className="text-sm text-[var(--comp-text-secondary)]">
              No upcoming events right now.
            </p>
            <p className="text-sm text-[var(--comp-text-secondary)]">
              Check back soon.
            </p>
          </div>
        </div>
        <button
          onClick={() => navigate("/events")}
          type="button"
          className="mt-3 w-full rounded-lg bg-[var(--comp-accent)] px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90"
        >
          Browse events
        </button>
      </div>
    );
  }

  /* -- Data state -- */
  return (
    <div className="flex h-full flex-col p-4">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="card-title font-bold">Upcoming Events</h2>
      </div>

      <div className="flex-1 space-y-2">
        {events.map((event) => {
          const dl = deadlineLabel(event);
          const color = categoryColor(event.category);
          return (
            <div
              key={event.id}
              onClick={() =>
                navigate(`/events/${encodeURIComponent(event.id)}`)
              }
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  navigate(`/events/${encodeURIComponent(event.id)}`);
                }
              }}
              className="cursor-pointer rounded-lg border border-[var(--comp-border)] bg-[var(--comp-surface)] p-3 transition-all hover:bg-[var(--comp-surface-hover)] hover:shadow-sm"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <span
                    className="mb-1.5 inline-block rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide"
                    style={{
                      backgroundColor: `color-mix(in srgb, ${color} 20%, transparent)`,
                      color,
                    }}
                  >
                    {event.category || "Event"}
                  </span>
                  <p className="line-clamp-2 text-sm font-semibold leading-snug text-[var(--comp-text-primary)]">
                    {event.title}
                  </p>
                </div>
              </div>

              <div className="mt-2 flex items-center justify-between">
                <span
                  className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium"
                  style={{
                    backgroundColor: `color-mix(in srgb, ${dl.isUrgent ? "var(--deadline-urgent)" : "var(--deadline-safe)"} 15%, transparent)`,
                    color: dl.isUrgent
                      ? "var(--deadline-urgent)"
                      : "var(--deadline-safe)",
                  }}
                >
                  <Clock size={12} aria-hidden="true" />
                  {dl.label}
                </span>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    navigate(`/events/${encodeURIComponent(event.id)}`);
                  }}
                  type="button"
                  className="rounded-md border border-[var(--comp-accent)] px-2.5 py-1 text-xs font-medium text-[var(--comp-accent)] transition-colors hover:bg-[var(--comp-accent)] hover:text-white"
                >
                  View
                </button>
              </div>
            </div>
          );
        })}
      </div>

      <button
        onClick={() => navigate("/events")}
        type="button"
        className="mt-3 flex w-full items-center justify-center gap-1 rounded-lg bg-[var(--comp-accent)] px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90"
      >
        View all events
        <ArrowRight size={16} aria-hidden="true" />
      </button>
    </div>
  );
}
