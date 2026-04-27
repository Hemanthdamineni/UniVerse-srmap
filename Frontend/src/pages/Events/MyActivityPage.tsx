// My Activity: ui Tabs, SkeletonCard loading, ui EmptyState + InlineError; listEvents unchanged.
import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { ErpPageShell } from "../../components/erp/ErpPrimitives";
import { listEvents } from "../../lib/campusApi";
import { Tabs } from "../../components/ui/Tabs";
import { EmptyState } from "../../components/ui/EmptyState";
import { SkeletonCard } from "../../components/ui/SkeletonCard";
import { InlineError } from "../../components/ui/InlineError";
import type { EventSummary } from "../../lib/campusApi";

const TAB_DEFS = [
  { id: "registered", label: "Registered Events" },
  { id: "submissions", label: "My Submissions" },
  { id: "results", label: "My Results" },
] as const;

type TabKey = (typeof TAB_DEFS)[number]["id"];

export default function MyActivityPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const rawTab = searchParams.get("tab") ?? "registered";
  const activeTab = TAB_DEFS.some((t) => t.id === rawTab) ? (rawTab as TabKey) : "registered";

  const [events, setEvents] = useState<EventSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    listEvents({ myRegistrations: "true" })
      .then(setEvents)
      .catch((e: unknown) => setError(e instanceof Error ? e.message : "Failed to load events."))
      .finally(() => setLoading(false));
  }, []);

  function setTab(tab: TabKey) {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.set("tab", tab);
      return next;
    });
  }

  return (
    <ErpPageShell title="My Activity" source="Internal API" isLoading={false}>
      <div className="flex flex-col gap-6">
        <Tabs tabs={[...TAB_DEFS]} activeTab={activeTab} onChange={(id) => setTab(id as TabKey)} />

        {error ? (
          <InlineError
            message={error}
            onRetry={() => {
              setLoading(true);
              setError(null);
              listEvents({ myRegistrations: "true" })
                .then(setEvents)
                .catch((e: unknown) => setError(e instanceof Error ? e.message : "Failed to load events."))
                .finally(() => setLoading(false));
            }}
          />
        ) : null}

        {loading ? (
          <div className="grid gap-3">
            {[1, 2, 3].map((i) => (
              <SkeletonCard key={i} className="h-28" />
            ))}
          </div>
        ) : activeTab === "registered" ? (
          events.length === 0 ? (
            <EmptyState
              title="No registered events"
              description="You haven't registered for any events yet."
              action={
                <Link to="/events" className="btn-primary inline-flex rounded-lg px-4 py-2 text-sm no-underline">
                  Explore events
                </Link>
              }
            />
          ) : (
            <div className="flex flex-col gap-3">
              {events.map((event) => (
                <div
                  key={event.id}
                  className="interactive-card flex flex-wrap items-center justify-between gap-3 p-4"
                >
                  <div>
                    <p className="card-title mb-0">{event.title ?? "Untitled Event"}</p>
                    <p className="body-text mb-0 text-sm">
                      {event.department ?? ""} · {event.category ?? "General"}
                    </p>
                  </div>
                  <Link
                    to={`/events/${encodeURIComponent(event.id)}`}
                    className="btn-secondary shrink-0 rounded-lg px-3 py-2 text-sm no-underline"
                  >
                    Open
                  </Link>
                </div>
              ))}
            </div>
          )
        ) : activeTab === "submissions" ? (
          <EmptyState
            title="Submissions appear here"
            description="Once you submit work in a competition round, it will be listed here."
          />
        ) : (
          <EmptyState
            title="Results appear here"
            description="Published results from your competition rounds will be shown here."
          />
        )}
      </div>
    </ErpPageShell>
  );
}
