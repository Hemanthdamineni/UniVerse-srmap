import { useEffect, useMemo, useState } from "react";
import { keepPreviousData, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { ErpPageShell, SectionCard } from "../../components/erp/ErpPrimitives";
import { InlineError } from "../../components/ui/Feedback";
import { Pagination } from "../../components/ui/Pagination";
import { StatCard } from "../../components/ui/Progress";
import { useAdminMode } from "../../contexts/AdminModeContext";
import { adminKeys } from "../../lib/admin/queryKeys";
import { adminQueueOptions } from "../../lib/core/queryOptions";
import {
  getLmsResourceModerationQueue,
  moderateLmsResource,
  type LmsModerationQueueResponse,
  type LmsResource,
} from "../../lib/lms/index";

const QUEUE_FILTERS = [
  { id: "all", label: "All" },
  { id: "flagged", label: "Flagged" },
  { id: "visible", label: "Visible" },
  { id: "hidden", label: "Hidden" },
  { id: "removed", label: "Removed" },
];

function latestFlag(resource: LmsResource) {
  return resource.flags?.find((flag) => flag.status === "open") || resource.flags?.[0] || null;
}

export default function AdminLmsModerationPage() {
  const admin = useAdminMode();
  const queryClient = useQueryClient();
  const [stateFilter, setStateFilter] = useState("flagged");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [error, setError] = useState("");
  const [reasons, setReasons] = useState<Record<string, string>>({});
  const [busyId, setBusyId] = useState("");

  /* eslint-disable @tanstack/query/exhaustive-deps -- cache is scoped by the primitive filters below; the raw headers object deliberately stays out of the key */
  const queueQuery = useQuery({
    queryKey: adminKeys.lmsModerationQueue({ state: stateFilter, query, page }),
    queryFn: () =>
      getLmsResourceModerationQueue(
        { state: stateFilter, query, limit: 25, page },
        admin.adminHeaders
      ),
    staleTime: adminQueueOptions.staleTime,
    placeholderData: keepPreviousData,
  });
  /* eslint-enable @tanstack/query/exhaustive-deps */

  useEffect(() => {
    if (!queueQuery.error) return;
    setError(queueQuery.error instanceof Error ? queueQuery.error.message : "Unable to load LMS moderation queue.");
  }, [queueQuery.error]);

  const data = queueQuery.data ?? null;
  const loading = queueQuery.isPending;

  async function load() {
    await queryClient.invalidateQueries({ queryKey: adminKeys.lmsModerationQueue() });
  }

  const summary = useMemo(() => data?.counts || { total: 0, flagged: 0, hidden: 0, removed: 0, visible: 0 }, [data]);

  async function decide(resource: LmsResource, decision: "approve" | "hide" | "remove" | "restore") {
    const reason = reasons[resource.id]?.trim();
    if (!reason) {
      setError("Moderation reason is required before changing visibility.");
      return;
    }
    setBusyId(resource.id);
    setError("");
    try {
      await moderateLmsResource(resource.id, { decision, reason }, admin.adminHeaders);
      setReasons((current) => ({ ...current, [resource.id]: "" }));
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to save moderation decision.");
    } finally {
      setBusyId("");
    }
  }

  return (
    <ErpPageShell title="LMS Moderation" source="Internal API" isLoading={loading} loadingMessage="Loading LMS moderation...">
      {error ? <InlineError message={error} className="mb-4" /> : null}

      <div className="space-y-5">
        <SectionCard title="Community Health">
          <div className="grid gap-4 md:grid-cols-5">
            <StatCard label="Queue" value={String(summary.total)} />
            <StatCard label="Flagged" value={String(summary.flagged)} />
            <StatCard label="Visible" value={String(summary.visible)} />
            <StatCard label="Hidden" value={String(summary.hidden)} />
            <StatCard label="Removed" value={String(summary.removed)} />
          </div>
        </SectionCard>

        <SectionCard title="Review Queue">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap gap-2" role="group" aria-label="Moderation queue filters">
              {QUEUE_FILTERS.map((filter) => (
                <button
                  key={filter.id}
                  type="button"
                  aria-pressed={stateFilter === filter.id}
                  className={`rounded-full px-3 py-1.5 text-sm font-semibold transition ${
                    stateFilter === filter.id
                      ? "bg-[var(--comp-accent)] text-white"
                      : "border border-[var(--comp-border)] text-[var(--comp-text-primary)]"
                  }`}
                  onClick={() => {
                    setStateFilter(filter.id);
                    setPage(1);
                  }}
                >
                  {filter.label}
                </button>
              ))}
            </div>
            <input
              className="lms-input md:max-w-xs"
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                setPage(1);
              }}
              placeholder="Search title, subject, publisher"
              aria-label="Search moderation queue"
            />
          </div>

          <div className="divide-y divide-[var(--border)]">
            {(data?.items || []).map((resource) => {
              const flag = latestFlag(resource);
              return (
                <article key={resource.id} className="py-3 first:pt-0 last:pb-0">
                  <div className="grid gap-4 lg:grid-cols-[1fr_280px]">
                    <div className="space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <Link
                          to={`/resources/${resource.id}`}
                          className="text-base font-semibold text-[var(--comp-text-primary)] no-underline hover:text-[var(--info)]"
                        >
                          {resource.title}
                        </Link>
                        <span className="rounded-full bg-[color-mix(in_srgb,var(--warning)_10%,transparent)] px-2 py-1 text-xs font-semibold text-[var(--warning)]">
                          {resource.moderation?.label || "Needs review"}
                        </span>
                      </div>
                      <p className="text-sm text-[var(--text-secondary)]">
                        {resource.subjectCode} • {resource.subjectName} • {resource.unit}
                      </p>
                      <p className="text-sm text-[var(--text-secondary)]">{resource.description}</p>
                      <div className="flex flex-wrap gap-2 text-xs text-[var(--text-secondary)]">
                        <span>Publisher {resource.publisher?.displayName || resource.uploadedBy}</span>
                        <span>Trust {resource.publisher?.trustScore ?? 0}</span>
                        <span>{resource.upvotes} upvotes</span>
                        <span>{resource.bookmarkCount} saves</span>
                      </div>
                      {flag ? (
                        <p className="rounded-lg bg-[color-mix(in_srgb,var(--warning)_8%,transparent)] px-3 py-2 text-sm text-[var(--comp-text-primary)]">
                          Latest report: {flag.reason || "No reason provided"} by {flag.userId}
                        </p>
                      ) : null}
                      {resource.audit?.[0] ? (
                        <p className="text-xs text-[var(--text-secondary)]">
                          Latest audit: {resource.audit[0].action} by {resource.audit[0].actorId}
                        </p>
                      ) : null}
                    </div>

                    <div className="space-y-2">
                      <textarea
                        className="min-h-24 w-full lms-input"
                        value={reasons[resource.id] || ""}
                        onChange={(event) => setReasons((current) => ({ ...current, [resource.id]: event.target.value }))}
                        placeholder="Decision reason"
                        aria-label={`Decision reason for ${resource.id}`}
                      />
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                        <button
                          className="min-h-9 rounded-lg bg-[var(--success)] px-3 py-1 text-xs font-semibold text-white disabled:opacity-60"
                          disabled={busyId === resource.id}
                          onClick={() => void decide(resource, "approve")}
                        >
                          Approve
                        </button>
                        <button
                          className="min-h-9 rounded-lg border border-[color-mix(in_srgb,var(--warning)_35%,transparent)] px-3 py-1 text-xs font-semibold text-[var(--warning)] disabled:opacity-60"
                          disabled={busyId === resource.id}
                          onClick={() => void decide(resource, "hide")}
                        >
                          Hide
                        </button>
                        <button
                          className="min-h-9 rounded-lg border border-[color-mix(in_srgb,var(--error)_35%,transparent)] px-3 py-1 text-xs font-semibold text-[var(--error)] disabled:opacity-60"
                          disabled={busyId === resource.id}
                          onClick={() => void decide(resource, "remove")}
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  </div>
                </article>
              );
            })}
            {!loading && !data?.items?.length ? (
              <div className="rounded-lg border border-dashed border-[var(--comp-border)] p-6 text-center text-sm text-[var(--text-secondary)]">
                No resources need moderation for this filter.
              </div>
            ) : null}
          </div>

          {data?.pagination && (data.pagination.total ?? 0) > data.pagination.limit ? (
            <div className="mt-4 flex justify-center">
              <Pagination
                currentPage={data.pagination.page}
                totalPages={Math.max(
                  1,
                  Math.ceil((data.pagination.total ?? 0) / data.pagination.limit)
                )}
                onPageChange={(next) => setPage(next)}
              />
            </div>
          ) : null}
        </SectionCard>
      </div>
    </ErpPageShell>
  );
}
