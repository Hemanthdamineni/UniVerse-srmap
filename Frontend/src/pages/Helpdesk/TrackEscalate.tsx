import { useEffect, useMemo, useState } from "react";
import {
  EmptyStateCard,
  ErpPageShell,
  KpiGrid,
  SectionCard,
  StatusBanner,
} from "../../components/erp/ErpPrimitives";
import { useAdminAccess } from "../../hooks/useAdminAccess";
import {
  bulkUpdateHelpdeskTickets,
  escalateHelpdeskTicket,
  listHelpdeskTickets,
  replyToHelpdeskTicket,
  type CampusTicket,
  updateHelpdeskTicket,
} from "../../lib/campus/campusApi";

type QueueFilter = "all" | "new" | "in-progress" | "escalated" | "breached" | "resolved";

const STATUS_COLORS: Record<string, string> = {
  open: "border-[color-mix(in_srgb,var(--warning)_30%,transparent)] bg-[color-mix(in_srgb,var(--warning)_10%,transparent)] text-[var(--warning)]",
  "in-progress": "border-[color-mix(in_srgb,var(--info)_30%,transparent)] bg-[color-mix(in_srgb,var(--info)_10%,transparent)] text-[var(--info)]",
  escalated: "border-[color-mix(in_srgb,var(--error)_30%,transparent)] bg-[color-mix(in_srgb,var(--error)_10%,transparent)] text-[var(--error)]",
  resolved: "border-[color-mix(in_srgb,var(--success)_30%,transparent)] bg-[color-mix(in_srgb,var(--success)_10%,transparent)] text-[var(--success)]",
};

export default function TrackEscalate({ adminMode = false }: { adminMode?: boolean }) {
  const admin = useAdminAccess();
  const [tickets, setTickets] = useState<CampusTicket[]>([]);
  const [counts, setCounts] = useState({
    total: 0,
    filtered: 0,
    open: 0,
    inProgress: 0,
    escalated: 0,
    resolved: 0,
    slaBreached: 0,
    queues: {} as Record<string, number>,
  });
  const [workload, setWorkload] = useState<Array<{ assignedTeam: string; ownerName: string; open: number; breached: number; total: number }>>([]);
  const [filterQueue, setFilterQueue] = useState<QueueFilter>("all");
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [banner, setBanner] = useState<{ tone: "success" | "warning"; text: string } | null>(null);
  const [replyDrafts, setReplyDrafts] = useState<Record<string, string>>({});
  const [resolutionDrafts, setResolutionDrafts] = useState<Record<string, string>>({});
  const [assignmentDrafts, setAssignmentDrafts] = useState<Record<string, string>>({});
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  async function loadTickets() {
    setLoading(true);
    try {
      const filters: Record<string, string> = {};
      if (filterQueue !== "all") filters.queue = filterQueue;
      if (query.trim()) filters.query = query.trim();
      const data = await listHelpdeskTickets(
        filters,
        adminMode && admin.unlocked ? admin.adminHeaders : undefined
      );
      setTickets(data.items);
      setCounts({
        ...data.counts,
        filtered: data.counts.filtered || data.items.length,
        queues: data.counts.queues || {},
      });
      setWorkload(data.workload || []);
    } catch (error) {
      setBanner({
        tone: "warning",
        text: error instanceof Error ? error.message : "Failed to load helpdesk tickets.",
      });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadTickets();
  }, [admin.adminHeaders, admin.unlocked, adminMode, filterQueue]);

  const filtered = useMemo(() => tickets, [tickets]);

  async function runAction(action: () => Promise<unknown>, successText: string) {
    setBanner(null);
    try {
      await action();
      setBanner({ tone: "success", text: successText });
      await loadTickets();
    } catch (error) {
      setBanner({
        tone: "warning",
        text: error instanceof Error ? error.message : "Action failed.",
      });
    }
  }

  async function runBulkInProgress() {
    if (!selectedIds.length) {
      setBanner({ tone: "warning", text: "Select at least one ticket for bulk action." });
      return;
    }
    await runAction(
      () =>
        bulkUpdateHelpdeskTickets(
          {
            ticketIds: selectedIds,
            status: "in-progress",
            note: "Bulk triage moved selected tickets to in progress",
          },
          admin.adminHeaders
        ),
      `${selectedIds.length} selected ticket(s) moved to in progress.`
    );
    setSelectedIds([]);
  }

  return (
    <ErpPageShell
      title="Track & Escalate"
      source="Internal API"
      isLoading={loading}
      loadingMessage="Loading tickets..."
    >
      {banner ? <StatusBanner message={{ id: "ticket-banner", tone: banner.tone, text: banner.text }} /> : null}

      <KpiGrid
        items={[
          { label: "Open", value: String(counts.open) },
          { label: "In Progress", value: String(counts.inProgress) },
          { label: "Escalated", value: String(counts.escalated) },
          { label: "Breached SLA", value: String(counts.slaBreached) },
        ]}
      />

      <SectionCard title={adminMode && admin.unlocked ? "All Tickets" : "Your Tickets"}>
        <div className="mb-3 grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto]">
          <div className="flex flex-wrap gap-2">
          {(["all", "new", "in-progress", "escalated", "breached", "resolved"] as const).map((queue) => (
            <button
              key={queue}
              type="button"
              onClick={() => setFilterQueue(queue)}
              className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                filterQueue === queue
                  ? "border-[var(--comp-accent)] bg-[var(--comp-accent)] text-white"
                  : "border-[var(--border)] bg-white text-[var(--text-secondary)] hover:border-[var(--comp-accent)] hover:text-[var(--comp-text-primary)]"
              }`}
            >
              {queue} {queue !== "all" ? `(${counts.queues?.[queue] || 0})` : ""}
            </button>
          ))}
          </div>
          <form
            className="flex gap-2"
            onSubmit={(event) => {
              event.preventDefault();
              void loadTickets();
            }}
          >
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search tickets"
              className="min-h-10 min-w-0 rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 text-sm outline-none focus:border-[var(--comp-accent)]"
            />
            <button
              type="submit"
              className="min-h-10 rounded-lg bg-[var(--comp-accent)] px-4 text-sm font-semibold text-white"
            >
              Search
            </button>
          </form>
        </div>

        {adminMode && admin.unlocked ? (
          <div className="mb-4 grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto]">
            <div className="flex flex-wrap gap-2 text-xs text-[var(--text-secondary)]">
              {workload.slice(0, 4).map((item) => (
                <span key={`${item.assignedTeam}-${item.ownerName}`} className="rounded-full border border-[var(--border)] px-3 py-1.5">
                  {item.ownerName}: {item.total} active, {item.breached} breached
                </span>
              ))}
            </div>
            <button
              type="button"
              onClick={() => void runBulkInProgress()}
              disabled={!selectedIds.length}
              className="min-h-10 rounded-lg border border-[var(--border)] px-3 text-sm font-semibold text-[var(--text-primary)] disabled:cursor-not-allowed disabled:opacity-55"
            >
              Bulk: mark in progress ({selectedIds.length})
            </button>
          </div>
        ) : null}

        {filtered.length === 0 ? (
          <EmptyStateCard message="No tickets match the current filter." />
        ) : (
          <div className="space-y-3">
            {filtered.map((ticket) => (
              <div key={ticket.id} className="rounded-2xl border border-[var(--border)] bg-white p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      {adminMode && admin.unlocked ? (
                        <input
                          type="checkbox"
                          checked={selectedIds.includes(ticket.id)}
                          onChange={(event) =>
                            setSelectedIds((current) =>
                              event.target.checked
                                ? [...current, ticket.id]
                                : current.filter((id) => id !== ticket.id)
                            )
                          }
                          aria-label={`Select ticket ${ticket.id}`}
                        />
                      ) : null}
                      <span className="text-xs font-semibold text-[var(--text-secondary)]">{ticket.id}</span>
                      <span
                        className={`rounded-full border px-2.5 py-0.5 text-xs font-bold ${
                          STATUS_COLORS[ticket.status] || "border-[var(--comp-border)] bg-[var(--comp-surface-hover)] text-[var(--comp-text-secondary)]"
                        }`}
                      >
                        {ticket.status}
                      </span>
                      <span className="rounded-full bg-[color-mix(in_srgb,var(--comp-accent)_8%,transparent)] px-2.5 py-0.5 text-xs font-semibold text-[var(--comp-text-primary)]">
                        {ticket.priority}
                      </span>
                      {ticket.slaBreached ? (
                        <span className="rounded-full border border-[color-mix(in_srgb,var(--error)_30%,transparent)] bg-[color-mix(in_srgb,var(--error)_10%,transparent)] px-2.5 py-0.5 text-xs font-semibold text-[var(--error)]">
                          SLA Breached
                        </span>
                      ) : null}
                      <span className="rounded-full border border-[var(--border)] px-2.5 py-0.5 text-xs font-semibold text-[var(--text-secondary)]">
                        {ticket.queueState || "new"}
                      </span>
                    </div>
                    <h3 className="mt-1.5 text-base font-semibold text-[var(--comp-text-primary)]">{ticket.subject}</h3>
                    <p className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">{ticket.description}</p>
                    <div className="mt-2 grid gap-1 text-xs text-[var(--text-secondary)] md:grid-cols-3">
                      <div>Category: {ticket.category}</div>
                      <div>Owner: {ticket.ownerName || ticket.assignedTo}</div>
                      <div>Team: {ticket.assignedTeam || "Unassigned"}</div>
                      <div>Updated: {new Date(ticket.updatedAt).toLocaleString("en-IN")}</div>
                      <div>SLA due: {ticket.sla?.dueAt ? new Date(ticket.sla.dueAt).toLocaleString("en-IN") : "-"}</div>
                    </div>

                    {ticket.replies?.length ? (
                      <div className="mt-3 rounded-2xl border border-[var(--border)] bg-[var(--comp-surface-hover)] p-3">
                        <h4 className="text-xs font-semibold uppercase tracking-wide text-[var(--text-secondary)]">
                          Conversation
                        </h4>
                        <div className="mt-2 space-y-2">
                          {ticket.replies.slice(0, 3).map((reply) => (
                            <div key={reply.id} className="rounded-xl bg-white p-3 text-sm">
                              <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-[var(--text-secondary)]">
                                <span>
                                  {reply.authorName} · {reply.authorRole}
                                </span>
                                <span>{new Date(reply.createdAt).toLocaleString("en-IN")}</span>
                              </div>
                              <p className="mt-1 text-[var(--text-secondary)]">{reply.message}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : null}
                    {adminMode && admin.unlocked && ticket.auditTrail?.length ? (
                      <div className="mt-3 text-xs text-[var(--text-secondary)]">
                        Latest audit: {ticket.auditTrail[0].action} by {ticket.auditTrail[0].actorName} on{" "}
                        {new Date(ticket.auditTrail[0].createdAt).toLocaleString("en-IN")}
                      </div>
                    ) : null}
                  </div>

                  <div className="flex min-w-[220px] flex-col gap-2">
                    {!(adminMode && admin.unlocked) && (ticket.status === "open" || ticket.status === "in-progress") ? (
                      <button
                        type="button"
                        onClick={() =>
                          void runAction(
                            () => escalateHelpdeskTicket(ticket.id, "Escalated by requester from tracking view"),
                            `Ticket ${ticket.id} escalated.`
                          )
                        }
                        className="rounded-full border border-[color-mix(in_srgb,var(--error)_30%,transparent)] px-3 py-2 text-xs font-semibold text-[var(--error)] transition hover:bg-[color-mix(in_srgb,var(--error)_10%,transparent)]"
                      >
                        Escalate
                      </button>
                    ) : null}

                    {adminMode && admin.unlocked ? (
                      <>
                        <div className="grid gap-2">
                          {(["in-progress", "escalated"] as const).map((status) => (
                            <button
                              key={status}
                              type="button"
                              onClick={() =>
                                void runAction(
                                  () =>
                                    updateHelpdeskTicket(
                                      ticket.id,
                                      {
                                        status,
                                        note: `Status changed to ${status}`,
                                      },
                                      admin.adminHeaders
                                    ),
                                  `Ticket ${ticket.id} moved to ${status}.`
                                )
                              }
                              className="rounded-full border border-[color-mix(in_srgb,var(--info)_30%,transparent)] px-3 py-2 text-xs font-semibold text-[var(--info)] transition hover:bg-[color-mix(in_srgb,var(--info)_10%,transparent)]"
                            >
                              Mark {status}
                            </button>
                          ))}
                        </div>
                        <input
                          value={assignmentDrafts[ticket.id] || ""}
                          onChange={(event) =>
                            setAssignmentDrafts((prev) => ({ ...prev, [ticket.id]: event.target.value }))
                          }
                          placeholder="Owner or team"
                          className="rounded-xl border border-[var(--border)] bg-[var(--background)] px-4 py-2.5 text-sm outline-none focus:border-[var(--comp-accent)]"
                        />
                        <button
                          type="button"
                          disabled={!String(assignmentDrafts[ticket.id] || "").trim()}
                          onClick={() =>
                            void runAction(
                              () =>
                                updateHelpdeskTicket(
                                  ticket.id,
                                  {
                                    assignedTo: String(assignmentDrafts[ticket.id] || "").trim(),
                                    assignedTeam: String(assignmentDrafts[ticket.id] || "").trim(),
                                    ownerName: String(assignmentDrafts[ticket.id] || "").trim(),
                                    note: "Admin reassigned ticket owner/team",
                                  },
                                  admin.adminHeaders
                                ),
                              `Ticket ${ticket.id} reassigned.`
                            )
                          }
                          className="rounded-full border border-[var(--border)] px-3 py-2 text-xs font-semibold text-[var(--text-primary)] transition hover:border-[var(--comp-accent)] disabled:opacity-50"
                        >
                          Assign
                        </button>
                        <input
                          value={resolutionDrafts[ticket.id] || ""}
                          onChange={(event) =>
                            setResolutionDrafts((prev) => ({ ...prev, [ticket.id]: event.target.value }))
                          }
                          placeholder="Resolution summary"
                          className="rounded-xl border border-[var(--border)] bg-[var(--background)] px-4 py-2.5 text-sm outline-none focus:border-[var(--comp-accent)]"
                        />
                        <button
                          type="button"
                          disabled={!String(resolutionDrafts[ticket.id] || "").trim() || ticket.status === "resolved"}
                          onClick={() =>
                            void runAction(
                              () =>
                                updateHelpdeskTicket(
                                  ticket.id,
                                  {
                                    status: "resolved",
                                    resolutionSummary: String(resolutionDrafts[ticket.id] || "").trim(),
                                    note: "Ticket resolved with admin summary",
                                  },
                                  admin.adminHeaders
                                ),
                              `Ticket ${ticket.id} resolved.`
                            )
                          }
                          className="rounded-full bg-[var(--success)] px-3 py-2 text-xs font-semibold text-white transition disabled:opacity-50"
                        >
                          Resolve
                        </button>
                        <input
                          value={replyDrafts[ticket.id] || ""}
                          onChange={(event) =>
                            setReplyDrafts((prev) => ({ ...prev, [ticket.id]: event.target.value }))
                          }
                          placeholder="Add admin reply or resolution note"
                          className="rounded-xl border border-[var(--border)] bg-[var(--background)] px-4 py-2.5 text-sm outline-none focus:border-[var(--comp-accent)]"
                        />
                        <button
                          type="button"
                          disabled={!String(replyDrafts[ticket.id] || "").trim()}
                          onClick={() =>
                            void runAction(
                              () =>
                                replyToHelpdeskTicket(
                                  ticket.id,
                                  { message: String(replyDrafts[ticket.id] || "").trim() },
                                  admin.adminHeaders
                                ),
                              `Reply added to ${ticket.id}.`
                            ).then(() =>
                              setReplyDrafts((prev) => ({
                                ...prev,
                                [ticket.id]: "",
                              }))
                            )
                          }
                          className="rounded-full bg-[var(--comp-accent)] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[var(--comp-accent-hover)] disabled:opacity-50"
                        >
                          Public Reply
                        </button>
                        <button
                          type="button"
                          disabled={!String(replyDrafts[ticket.id] || "").trim()}
                          onClick={() =>
                            void runAction(
                              () =>
                                replyToHelpdeskTicket(
                                  ticket.id,
                                  { message: String(replyDrafts[ticket.id] || "").trim(), visibility: "internal" },
                                  admin.adminHeaders
                                ),
                              `Internal note added to ${ticket.id}.`
                            ).then(() =>
                              setReplyDrafts((prev) => ({
                                ...prev,
                                [ticket.id]: "",
                              }))
                            )
                          }
                          className="rounded-full border border-[var(--border)] px-4 py-2 text-sm font-semibold text-[var(--text-primary)] transition hover:border-[var(--comp-accent)] disabled:opacity-50"
                        >
                          Internal Note
                        </button>
                      </>
                    ) : null}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </SectionCard>
    </ErpPageShell>
  );
}
