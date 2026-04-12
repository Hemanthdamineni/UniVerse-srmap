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
  escalateHelpdeskTicket,
  listHelpdeskTickets,
  replyToHelpdeskTicket,
  type CampusTicket,
  updateHelpdeskTicket,
} from "../../lib/campusApi";

type TicketStatus = "all" | "open" | "in-progress" | "escalated" | "resolved";

const STATUS_COLORS: Record<string, string> = {
  open: "border-amber-200 bg-amber-50 text-amber-800",
  "in-progress": "border-blue-200 bg-blue-50 text-blue-800",
  escalated: "border-rose-200 bg-rose-50 text-rose-800",
  resolved: "border-emerald-200 bg-emerald-50 text-emerald-800",
};

export default function TrackEscalate({ adminMode = false }: { adminMode?: boolean }) {
  const admin = useAdminAccess();
  const [tickets, setTickets] = useState<CampusTicket[]>([]);
  const [counts, setCounts] = useState({
    total: 0,
    open: 0,
    inProgress: 0,
    escalated: 0,
    resolved: 0,
    slaBreached: 0,
  });
  const [filterStatus, setFilterStatus] = useState<TicketStatus>("all");
  const [loading, setLoading] = useState(true);
  const [banner, setBanner] = useState<{ tone: "success" | "warning"; text: string } | null>(null);
  const [replyDrafts, setReplyDrafts] = useState<Record<string, string>>({});

  async function loadTickets() {
    setLoading(true);
    try {
      const data = await listHelpdeskTickets(
        filterStatus === "all" ? undefined : { status: filterStatus },
        adminMode && admin.unlocked ? admin.adminHeaders : undefined
      );
      setTickets(data.items);
      setCounts(data.counts);
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
  }, [admin.adminHeaders, admin.unlocked, adminMode, filterStatus]);

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
          { label: "Resolved", value: String(counts.resolved) },
        ]}
      />

      <SectionCard title={adminMode && admin.unlocked ? "All Tickets" : "Your Tickets"}>
        <div className="mb-3 flex flex-wrap gap-2">
          {(["all", "open", "in-progress", "escalated", "resolved"] as const).map((status) => (
            <button
              key={status}
              type="button"
              onClick={() => setFilterStatus(status)}
              className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                filterStatus === status
                  ? "border-[#0A3035] bg-[#0A3035] text-white"
                  : "border-[var(--border)] bg-white text-[var(--text-secondary)] hover:border-[#0A3035] hover:text-[#0A3035]"
              }`}
            >
              {status}
            </button>
          ))}
        </div>

        {filtered.length === 0 ? (
          <EmptyStateCard message="No tickets match the current filter." />
        ) : (
          <div className="space-y-3">
            {filtered.map((ticket) => (
              <div key={ticket.id} className="rounded-2xl border border-[var(--border)] bg-white p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-xs font-semibold text-[var(--text-secondary)]">{ticket.id}</span>
                      <span
                        className={`rounded-full border px-2.5 py-0.5 text-xs font-bold ${
                          STATUS_COLORS[ticket.status] || "border-slate-200 bg-slate-50 text-slate-700"
                        }`}
                      >
                        {ticket.status}
                      </span>
                      <span className="rounded-full bg-[#0A3035]/8 px-2.5 py-0.5 text-xs font-semibold text-[#0A3035]">
                        {ticket.priority}
                      </span>
                      {ticket.slaBreached ? (
                        <span className="rounded-full border border-rose-200 bg-rose-50 px-2.5 py-0.5 text-xs font-semibold text-rose-700">
                          SLA Breached
                        </span>
                      ) : null}
                    </div>
                    <h3 className="mt-1.5 text-base font-semibold text-[#0A3035]">{ticket.subject}</h3>
                    <p className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">{ticket.description}</p>
                    <div className="mt-2 grid gap-1 text-xs text-[var(--text-secondary)] md:grid-cols-3">
                      <div>Category: {ticket.category}</div>
                      <div>Assigned: {ticket.assignedTo}</div>
                      <div>Updated: {new Date(ticket.updatedAt).toLocaleString("en-IN")}</div>
                    </div>

                    {ticket.replies?.length ? (
                      <div className="mt-3 rounded-2xl border border-[var(--border)] bg-slate-50 p-3">
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
                        className="rounded-full border border-rose-300 px-3 py-2 text-xs font-semibold text-rose-700 transition hover:bg-rose-50"
                      >
                        Escalate
                      </button>
                    ) : null}

                    {adminMode && admin.unlocked ? (
                      <>
                        <div className="grid gap-2">
                          {(["in-progress", "resolved", "escalated"] as const).map((status) => (
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
                              className="rounded-full border border-blue-300 px-3 py-2 text-xs font-semibold text-blue-700 transition hover:bg-blue-50"
                            >
                              Mark {status}
                            </button>
                          ))}
                        </div>
                        <input
                          value={replyDrafts[ticket.id] || ""}
                          onChange={(event) =>
                            setReplyDrafts((prev) => ({ ...prev, [ticket.id]: event.target.value }))
                          }
                          placeholder="Add admin reply or resolution note"
                          className="rounded-xl border border-[var(--border)] bg-[var(--background)] px-4 py-2.5 text-sm outline-none focus:border-[#0A3035]"
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
                          className="rounded-full bg-[#0A3035] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#124850] disabled:opacity-50"
                        >
                          Send Reply
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
