import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ErpPageShell, SectionCard, EmptyStateCard } from "../../components/erp/ErpPrimitives";

type EventItem = { id: string; title?: string; status?: string; startAt?: string; category?: string };

function normalizeEvents(payload: unknown): EventItem[] {
  if (Array.isArray(payload)) return payload as EventItem[];
  if (payload && typeof payload === "object") {
    const d = payload as Record<string, unknown>;
    if (Array.isArray(d.items)) return d.items as EventItem[];
    if (Array.isArray(d.events)) return d.events as EventItem[];
    if (Array.isArray(d.data)) return d.data as EventItem[];
  }
  return [];
}

function formatDate(value?: string): string {
  if (!value) return "";
  try {
    const d = new Date(value);
    if (isNaN(d.getTime())) return value;
    return d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
  } catch { return value; }
}

export default function MyEventsPage() {
  const [events, setEvents] = useState<EventItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError("");
      try {
        const res = await fetch("/api/events/my-created", { credentials: "include" });
        const payload = await res.json();
        if (!res.ok) throw new Error(String(payload?.error || `Request failed (${res.status})`));
        if (!cancelled) setEvents(normalizeEvents(payload));
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load your events");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, []);

  return (
    <ErpPageShell title="My Events" source="Internal API" isLoading={loading} loadingMessage="Loading your events...">
      {error && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-medium text-amber-800">{error}</div>
      )}

      <SectionCard title="Events You Created">
        {events.length === 0 ? (
          <EmptyStateCard message="You haven't created any events yet. Go to Events Listings to propose a new event." />
        ) : (
          <div className="space-y-3">
            {events.map((event) => (
              <div key={event.id} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[var(--border)] bg-white p-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#0A3035]/8">
                    <span className="text-sm font-bold text-[#0A3035]">
                      {(event.title || "E")[0].toUpperCase()}
                    </span>
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-[#0A3035]">{event.title || "Untitled Event"}</h3>
                    <p className="text-xs text-[var(--text-secondary)]">{formatDate(event.startAt)}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`rounded-full border px-2.5 py-0.5 text-xs font-bold ${
                    event.status === "upcoming" ? "border-blue-200 bg-blue-50 text-blue-800"
                      : event.status === "ongoing" ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                      : "border-slate-200 bg-slate-50 text-slate-700"
                  }`}>{event.status || "unknown"}</span>
                  <Link to={`/events/listings/${encodeURIComponent(event.id)}`}
                    className="rounded-full border border-[#0A3035]/20 px-3 py-1.5 text-xs font-semibold text-[#0A3035] transition hover:bg-[#0A3035] hover:text-white">
                    Open
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </SectionCard>
    </ErpPageShell>
  );
}
