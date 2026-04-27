import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ErpPageShell, SectionCard, EmptyStateCard } from "../../components/erp/ErpPrimitives";

type RegistrationItem = { eventId?: string; eventTitle?: string; status?: string; createdAt?: string };

function normalizeRegistrations(payload: unknown): RegistrationItem[] {
  if (Array.isArray(payload)) return payload as RegistrationItem[];
  if (payload && typeof payload === "object") {
    const d = payload as Record<string, unknown>;
    if (Array.isArray(d.items)) return d.items as RegistrationItem[];
    if (Array.isArray(d.registrations)) return d.registrations as RegistrationItem[];
    if (Array.isArray(d.data)) return d.data as RegistrationItem[];
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

export default function MyRegistrationsPage() {
  const [registrations, setRegistrations] = useState<RegistrationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError("");
      try {
        const res = await fetch("/api/events/my-registrations", { credentials: "include" });
        const payload = await res.json();
        if (!res.ok) throw new Error(String(payload?.error || `Request failed (${res.status})`));
        if (!cancelled) setRegistrations(normalizeRegistrations(payload));
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load registrations");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, []);

  const STATUS_COLORS: Record<string, string> = {
    registered: "border-[color-mix(in_srgb,var(--success)_30%,transparent)] bg-[color-mix(in_srgb,var(--success)_10%,transparent)] text-[var(--success)]",
    pending: "border-[color-mix(in_srgb,var(--warning)_30%,transparent)] bg-[color-mix(in_srgb,var(--warning)_10%,transparent)] text-[var(--warning)]",
    cancelled: "border-rose-200 bg-rose-50 text-rose-800",
  };

  return (
    <ErpPageShell title="My Event Registrations" source="Internal API" isLoading={loading} loadingMessage="Loading registrations...">
      {error && (
        <div className="rounded-xl border border-[color-mix(in_srgb,var(--warning)_30%,transparent)] bg-[color-mix(in_srgb,var(--warning)_10%,transparent)] px-3 py-2 text-sm font-medium text-[var(--warning)]">{error}</div>
      )}

      <SectionCard title="Registered Events">
        {registrations.length === 0 ? (
          <EmptyStateCard message="No event registrations found. Browse Events Listings to register for upcoming events." />
        ) : (
          <div className="space-y-3">
            {registrations.map((item, index) => {
              const eventId = String(item.eventId || "").trim();
              const status = String(item.status || "registered").toLowerCase();
              return (
                <div key={`${eventId || "reg"}-${index}`}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[var(--border)] bg-white p-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[color-mix(in_srgb,var(--comp-accent)_8%,transparent)]">
                      <span className="text-sm font-bold text-[var(--comp-text-primary)]">
                        {(item.eventTitle || "E")[0].toUpperCase()}
                      </span>
                    </div>
                    <div>
                      <h3 className="text-sm font-semibold text-[var(--comp-text-primary)]">{item.eventTitle || "Event"}</h3>
                      <p className="text-xs text-[var(--text-secondary)]">{formatDate(item.createdAt)}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`rounded-full border px-2.5 py-0.5 text-xs font-bold ${STATUS_COLORS[status] || "border-[var(--comp-border)] bg-[var(--comp-surface-hover)] text-[var(--comp-text-secondary)]"}`}>
                      {status}
                    </span>
                    {eventId && (
                      <Link to={`/events/listings/${encodeURIComponent(eventId)}`}
                        className="rounded-full border border-[color-mix(in_srgb,var(--comp-accent)_20%,transparent)] px-3 py-1.5 text-xs font-semibold text-[var(--comp-text-primary)] transition hover:bg-[var(--comp-accent)] hover:text-white">
                        Open
                      </Link>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </SectionCard>
    </ErpPageShell>
  );
}
