import { useEffect, useState } from "react";
import {
  EmptyStateCard,
  ErpPageShell,
  SectionCard,
  StatusBanner,
} from "../../components/erp/ErpPrimitives";
import { Markdown } from "../../components/markdown";
import { createHelpdeskTicket, listHelpdeskTickets, type CampusTicket } from "../../lib/campus/campusApi";

type TicketCategory = "IT Support" | "Academic" | "Hostel" | "Finance" | "Transport" | "Other";
type TicketPriority = "low" | "medium" | "high" | "urgent";

const CATEGORIES: TicketCategory[] = ["IT Support", "Academic", "Hostel", "Finance", "Transport", "Other"];
const PRIORITIES: TicketPriority[] = ["low", "medium", "high", "urgent"];

const PRIORITY_COLORS: Record<TicketPriority, string> = {
  low: "border-[color-mix(in_srgb,var(--success)_30%,transparent)] bg-[color-mix(in_srgb,var(--success)_10%,transparent)] text-[var(--success)]",
  medium: "border-[color-mix(in_srgb,var(--warning)_30%,transparent)] bg-[color-mix(in_srgb,var(--warning)_10%,transparent)] text-[var(--warning)]",
  high: "border-[color-mix(in_srgb,var(--warning)_40%,transparent)] bg-[color-mix(in_srgb,var(--warning)_14%,transparent)] text-[var(--warning)]",
  urgent: "border-[color-mix(in_srgb,var(--error)_30%,transparent)] bg-[color-mix(in_srgb,var(--error)_10%,transparent)] text-[var(--error)]",
};

export default function RaiseTicket() {
  const [category, setCategory] = useState<TicketCategory>("IT Support");
  const [priority, setPriority] = useState<TicketPriority>("medium");
  const [subject, setSubject] = useState("");
  const [description, setDescription] = useState("");
  const [tickets, setTickets] = useState<CampusTicket[]>([]);
  const [loading, setLoading] = useState(true);
  const [banner, setBanner] = useState<{ tone: "success" | "warning"; text: string } | null>(null);

  async function loadTickets() {
    setLoading(true);
    try {
      const data = await listHelpdeskTickets();
      setTickets(data.items.slice(0, 5));
    } catch (error) {
      setBanner({
        tone: "warning",
        text: error instanceof Error ? error.message : "Failed to load recent tickets.",
      });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadTickets();
  }, []);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setBanner(null);
    try {
      const created = await createHelpdeskTicket({
        category,
        priority,
        subject: subject.trim(),
        description: description.trim(),
      });
      setTickets((prev) => [created, ...prev].slice(0, 5));
      setSubject("");
      setDescription("");
      setBanner({
        tone: "success",
        text: `Ticket submitted successfully. Reference ID: ${created.id}`,
      });
    } catch (error) {
      setBanner({
        tone: "warning",
        text: error instanceof Error ? error.message : "Couldn't submit your ticket. Check your connection and try again.",
      });
    }
  }

  return (
    <ErpPageShell title="Raise a Ticket" source="Internal API" isLoading={loading} loadingMessage="Loading helpdesk...">
      {banner ? <StatusBanner message={{ id: "helpdesk-banner", tone: banner.tone, text: banner.text }} /> : null}

      <SectionCard title="New Ticket">
        <form onSubmit={handleSubmit} className="grid gap-4 md:grid-cols-2">
          <div>
            <label htmlFor="ticket-category" className="mb-2 block text-sm font-medium text-[var(--text-primary)]">
              Category
            </label>
            <select
              id="ticket-category"
              value={category}
              onChange={(event) => setCategory(event.target.value as TicketCategory)}
              className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 min-h-11 text-sm outline-none focus:border-[var(--comp-accent)]"
            >
              {CATEGORIES.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="ticket-priority" className="mb-2 block text-sm font-medium text-[var(--text-primary)]">
              Priority
            </label>
            <select
              id="ticket-priority"
              value={priority}
              onChange={(event) => setPriority(event.target.value as TicketPriority)}
              className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 min-h-11 text-sm outline-none focus:border-[var(--comp-accent)]"
            >
              {PRIORITIES.map((item) => (
                <option key={item} value={item}>
                  {item.toUpperCase()}
                </option>
              ))}
            </select>
          </div>
          <div className="md:col-span-2">
            <label htmlFor="ticket-subject" className="mb-2 block text-sm font-medium text-[var(--text-primary)]">
              Subject
            </label>
            <input
              id="ticket-subject"
              value={subject}
              onChange={(event) => setSubject(event.target.value)}
              placeholder="Brief summary of the issue"
              required
              className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 min-h-11 text-sm outline-none focus:border-[var(--comp-accent)]"
            />
          </div>
          <div className="md:col-span-2">
            <label htmlFor="ticket-description" className="mb-2 block text-sm font-medium text-[var(--text-primary)]">
              Description
            </label>
            <textarea
              id="ticket-description"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="Explain the issue, affected page, timings, and any steps already tried."
              rows={5}
              required
              className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 min-h-11 text-sm outline-none focus:border-[var(--comp-accent)]"
            />
          </div>
          <div className="md:col-span-2">
            <button
              type="submit"
              className="rounded-lg bg-[var(--comp-accent)] px-6 py-2 min-h-11 text-sm font-semibold text-white transition hover:bg-[var(--comp-accent-hover)]"
            >
              Submit Ticket
            </button>
          </div>
        </form>
      </SectionCard>

      <SectionCard title="Recent Tickets">
        {tickets.length === 0 ? (
          <EmptyStateCard message="No tickets submitted yet. Use the form above to raise your first support request." />
        ) : (
          <div className="space-y-2">
            {tickets.map((ticket) => (
              <div key={ticket.id} className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-3">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold text-[var(--text-secondary)]">{ticket.id}</span>
                      <span
                        className={`rounded-full border px-2 py-1 text-xs font-bold ${
                          PRIORITY_COLORS[(ticket.priority as TicketPriority) || "medium"]
                        }`}
                      >
                        {ticket.priority}
                      </span>
                      <span className="rounded-full border border-[var(--comp-border)] bg-[var(--comp-surface-hover)] px-2 py-1 text-xs font-bold text-[var(--comp-text-secondary)]">
                        {ticket.status}
                      </span>
                    </div>
                    <h3 className="text-base font-semibold text-[var(--comp-text-primary)]">{ticket.subject}</h3>
                    <div className="max-w-2xl text-sm leading-6 text-[var(--text-secondary)]">
                      <Markdown>{ticket.description}</Markdown>
                    </div>
                  </div>
                  <div className="space-y-1 text-right text-xs text-[var(--text-secondary)]">
                    <div>{ticket.category}</div>
                    <div>Assigned: {ticket.assignedTo}</div>
                    <div>Updated: {new Date(ticket.updatedAt).toLocaleString("en-IN")}</div>
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
