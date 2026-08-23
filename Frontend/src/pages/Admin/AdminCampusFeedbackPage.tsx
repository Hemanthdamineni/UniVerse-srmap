import { useEffect, useState, useMemo } from "react";
import { ErpPageShell, SectionCard, KpiGrid, EmptyStateCard } from "../../components/erp/ErpPrimitives";
import { StarRating } from "../../components/ui/Progress";
import { FeedbackStatusPill } from "../../components/ui/Feedback";
import { Pagination } from "../../components/ui/Pagination";
import { useAdminAccess } from "../../hooks/useAdminAccess";
import {
  getAdminCampusFeedback,
  moderateCampusFeedback,
  type CampusFeedbackEntry,
  type CampusFeedbackStatus,
  type CampusFeedbackType,
} from "../../lib/campus/campusApi";

const TYPE_OPTIONS: Array<{ value: "" | CampusFeedbackType; label: string }> = [
  { value: "", label: "All types" },
  { value: "events", label: "Events" },
  { value: "hostel_mess", label: "Hostel & Mess" },
  { value: "transport", label: "Transport" },
];

const STATUS_OPTIONS: Array<{ value: "" | CampusFeedbackStatus; label: string }> = [
  { value: "pending", label: "Pending" },
  { value: "", label: "All statuses" },
  { value: "approved", label: "Approved" },
  { value: "rejected", label: "Rejected" },
];

const PAGE_SIZE = 25;

function formatDate(value: string) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
}

export default function AdminCampusFeedbackPage() {
  const admin = useAdminAccess();
  const [type, setType] = useState<"" | CampusFeedbackType>("");
  const [status, setStatus] = useState<"" | CampusFeedbackStatus>("pending");
  const [entries, setEntries] = useState<CampusFeedbackEntry[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [pagination, setPagination] = useState({ limit: PAGE_SIZE, offset: 0, total: 0 });
  const [reasonById, setReasonById] = useState<Record<string, string>>({});
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState("");

  // KPI data for overview section
  const kpis = useMemo(() => [
    { label: "Total Submissions", value: String(counts.total || 0) },
    { label: "Pending Moderation", value: String(counts.pending || 0) },
    { label: "Approved", value: String(counts.approved || 0) },
    { label: "Rejected", value: String(counts.rejected || 0) },
  ], [counts]);

  async function loadQueue() {
    setLoading(true);
    setError("");
    try {
      const data = await getAdminCampusFeedback(
        { type, status, limit: PAGE_SIZE, offset: pagination.offset },
        admin.adminHeaders
      );
      setEntries(data.items);
      setCounts(data.counts || {});
      setPagination(data.pagination || { limit: PAGE_SIZE, offset: pagination.offset, total: data.items.length });
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Unable to load campus feedback queue.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadQueue();
  }, [type, status, pagination.offset]);

  async function decide(entry: CampusFeedbackEntry, nextStatus: Exclude<CampusFeedbackStatus, "pending">) {
    const reason = (reasonById[entry.id] || "").trim();
    if (!reason) {
      setError("Enter a moderation reason before deciding.");
      return;
    }

    setBusyId(entry.id);
    setError("");
    try {
      await moderateCampusFeedback(entry.id, { status: nextStatus, reason }, admin.adminHeaders);
      setReasonById((current) => ({ ...current, [entry.id]: "" }));
      setMessage(`Feedback ${nextStatus}.`);
      window.setTimeout(() => setMessage(""), 3000);
      await loadQueue();
    } catch (decisionError) {
      setError(decisionError instanceof Error ? decisionError.message : "Unable to moderate feedback.");
    } finally {
      setBusyId("");
    }
  }

  return (
    <ErpPageShell
      title="Campus Feedback Moderation"
      source="Internal API"
      isLoading={loading}
      loadingMessage="Loading campus feedback queue..."
      onRefresh={loadQueue}
    >
      {message ? (
        <div className="rounded-xl border border-[color-mix(in_srgb,var(--success)_30%,transparent)] bg-[color-mix(in_srgb,var(--success)_10%,transparent)] px-3 py-2 text-sm font-medium text-[var(--success)]">
          {message}
        </div>
      ) : null}
      {error ? (
        <div className="rounded-xl border border-[color-mix(in_srgb,var(--error)_30%,transparent)] bg-[color-mix(in_srgb,var(--error)_10%,transparent)] px-3 py-2 text-sm font-medium text-[var(--error)]">
          {error}
        </div>
      ) : null}

      <KpiGrid items={kpis} />

      <SectionCard title="Queue Controls">
        <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]">
          <label className="text-sm font-medium text-[var(--text-primary)]">
            Type
            <select
              value={type}
              onChange={(event) => {
                setType(event.target.value as "" | CampusFeedbackType);
                setPagination((current) => ({ ...current, offset: 0 }));
              }}
              className="mt-2 min-h-11 w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm outline-none focus:border-[var(--comp-accent)]"
            >
              {TYPE_OPTIONS.map((option) => (
                <option key={option.label} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm font-medium text-[var(--text-primary)]">
            Status
            <select
              value={status}
              onChange={(event) => {
                setStatus(event.target.value as "" | CampusFeedbackStatus);
                setPagination((current) => ({ ...current, offset: 0 }));
              }}
              className="mt-2 min-h-11 w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm outline-none focus:border-[var(--comp-accent)]"
            >
              {STATUS_OPTIONS.map((option) => (
                <option key={option.label} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <div className="grid grid-cols-3 gap-2 self-end text-center text-xs text-[var(--text-secondary)]">
            <div className="rounded-lg border border-[var(--border)] px-3 py-2">
              <div className="text-base font-semibold text-[var(--comp-text-primary)]">{counts.pending || 0}</div>
              Pending
            </div>
            <div className="rounded-lg border border-[var(--border)] px-3 py-2">
              <div className="text-base font-semibold text-[var(--comp-text-primary)]">{counts.approved || 0}</div>
              Approved
            </div>
            <div className="rounded-lg border border-[var(--border)] px-3 py-2">
              <div className="text-base font-semibold text-[var(--comp-text-primary)]">{counts.rejected || 0}</div>
              Rejected
            </div>
          </div>
        </div>
      </SectionCard>

      <SectionCard title="Moderation Queue">
        <Pagination
          className="mb-3"
          currentPage={Math.floor(pagination.offset / pagination.limit) + 1}
          totalPages={Math.max(1, Math.ceil(pagination.total / pagination.limit))}
          onPageChange={(page) =>
            setPagination((current) => ({ ...current, offset: (page - 1) * current.limit }))
          }
        />
        {entries.length === 0 ? (
          <EmptyStateCard message="No campus feedback matches the selected queue." />
        ) : (
          <div className="divide-y divide-[var(--border)]">
            {entries.map((entry) => (
              <article key={entry.id} className="grid gap-3 py-4 first:pt-0 last:pb-0 lg:grid-cols-[minmax(0,1fr)_280px]">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-sm font-semibold text-[var(--comp-text-primary)]">{entry.targetLabel}</h3>
                    <FeedbackStatusPill status={entry.status} />
                    <span className="rounded-full border border-[var(--border)] px-2.5 py-0.5 text-xs font-semibold text-[var(--text-secondary)]">
                      {entry.typeLabel}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-[var(--text-secondary)]">
                    Submitted by {entry.createdBy?.displayName || "Student"} ({entry.createdBy?.userId || "unknown"}) on{" "}
                    {formatDate(entry.createdAt)}
                  </p>
                  <div className="mt-2 grid gap-1 text-xs text-[var(--text-secondary)] sm:grid-cols-2">
                    {Object.entries(entry.ratings).map(([category, value]) => (
                      <div key={category} className="flex items-center gap-1">
                        <span>{category}:</span>
                        <StarRating value={value} size="sm" />
                      </div>
                    ))}
                  </div>
                  {entry.comment ? (
                    <p className="mt-2 max-w-[72ch] text-sm leading-6 text-[var(--text-secondary)]">{entry.comment}</p>
                  ) : null}
                  {entry.audit && entry.audit.length > 0 ? (
                    <p className="mt-2 text-xs text-[var(--text-secondary)]">
                      Latest audit: {entry.audit[0].action} by {entry.audit[0].actorName} on{" "}
                      {formatDate(entry.audit[0].createdAt)}
                    </p>
                  ) : null}
                </div>

                <div className="space-y-2">
                  <textarea
                    value={reasonById[entry.id] || ""}
                    onChange={(event) =>
                      setReasonById((current) => ({ ...current, [entry.id]: event.target.value }))
                    }
                    placeholder="Moderation reason"
                    rows={3}
                    className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm outline-none focus:border-[var(--comp-accent)]"
                  />
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => decide(entry, "approved")}
                      disabled={busyId === entry.id || entry.status !== "pending"}
                      className="min-h-9 rounded-lg bg-[var(--success)] px-3 py-1 text-xs font-semibold text-white transition disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      Approve
                    </button>
                    <button
                      type="button"
                      onClick={() => decide(entry, "rejected")}
                      disabled={busyId === entry.id || entry.status !== "pending"}
                      className="min-h-9 rounded-lg bg-[var(--error)] px-3 py-1 text-xs font-semibold text-white transition disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      Reject
                    </button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </SectionCard>
    </ErpPageShell>
  );
}
