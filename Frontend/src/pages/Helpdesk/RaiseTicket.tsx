import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  EmptyStateCard,
  ErpPageShell,
  SectionCard,
  StatusBanner,
} from "../../components/erp/ErpPrimitives";
import { Markdown } from "../../components/markdown";
import { FormField } from "../../components/forms/FormField";
import { SkeletonCard } from "../../components/ui";
import { createHelpdeskTicket, listHelpdeskTickets } from "../../lib/campus/campusApi";
import { helpdeskKeys } from "../../lib/helpdesk/queryKeys";
import { useApiMutation } from "../../lib/core/useApiMutation";
import { toErrorMessage } from "../../lib/core/toErrorMessage";

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
  const queryClient = useQueryClient();
  const [category, setCategory] = useState<TicketCategory>("IT Support");
  const [priority, setPriority] = useState<TicketPriority>("medium");
  const [subject, setSubject] = useState("");
  const [description, setDescription] = useState("");

  const recentTicketsQuery = useQuery({
    queryKey: helpdeskKeys.tickets(),
    queryFn: () => listHelpdeskTickets(),
    staleTime: 15_000,
  });

  const tickets = useMemo(() => (recentTicketsQuery.data?.items ?? []).slice(0, 5), [recentTicketsQuery.data]);

  const createTicket = useApiMutation({
    mutationFn: (input: { category: TicketCategory; priority: TicketPriority; subject: string; description: string }) =>
      createHelpdeskTicket(input),
    successText: (created) => `Ticket submitted successfully. Reference ID: ${created.id}`,
    errorFallback: "Couldn't submit your ticket. Check your connection and try again.",
    invalidateKeys: [helpdeskKeys.tickets()],
    onSuccess: (created) => {
      // Instant feedback in the recent list; the invalidation refetch then
      // reconciles with server truth.
      queryClient.setQueryData(helpdeskKeys.tickets(), (prev: unknown) => {
        const current = (prev as { items?: unknown[] } | undefined)?.items ?? [];
        return { items: [created, ...current] };
      });
      setSubject("");
      setDescription("");
    },
  });

  const banner = createTicket.banner ?? (recentTicketsQuery.error
    ? {
        tone: "warning" as const,
        text: toErrorMessage(recentTicketsQuery.error, "Failed to load recent tickets."),
      }
    : null);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    await createTicket.mutate({
      category,
      priority,
      subject: subject.trim(),
      description: description.trim(),
    });
  }

  return (
    <ErpPageShell title="Raise a Ticket" source="Internal API">
      {banner ? <StatusBanner message={{ id: "helpdesk-banner", tone: banner.tone, text: banner.text }} /> : null}

      <SectionCard title="New Ticket">
        <form onSubmit={handleSubmit} className="grid gap-4 md:grid-cols-2">
          <FormField id="ticket-category" label="Category">
            <select
              id="ticket-category"
              value={category}
              onChange={(event) => setCategory(event.target.value as TicketCategory)}
              className="w-full rounded-lg border border-[var(--comp-border)] bg-[var(--comp-surface)] px-3 py-2 min-h-11 text-sm outline-none focus:border-[var(--comp-accent)]"
            >
              {CATEGORIES.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </FormField>
          <FormField id="ticket-priority" label="Priority">
            <select
              id="ticket-priority"
              value={priority}
              onChange={(event) => setPriority(event.target.value as TicketPriority)}
              className="w-full rounded-lg border border-[var(--comp-border)] bg-[var(--comp-surface)] px-3 py-2 min-h-11 text-sm outline-none focus:border-[var(--comp-accent)]"
            >
              {PRIORITIES.map((item) => (
                <option key={item} value={item}>
                  {item.toUpperCase()}
                </option>
              ))}
            </select>
          </FormField>
          <FormField id="ticket-subject" label="Subject" className="md:col-span-2">
            <input
              id="ticket-subject"
              value={subject}
              onChange={(event) => setSubject(event.target.value)}
              placeholder="Brief summary of the issue"
              required
              className="w-full rounded-lg border border-[var(--comp-border)] bg-[var(--comp-surface)] px-3 py-2 min-h-11 text-sm outline-none focus:border-[var(--comp-accent)]"
            />
          </FormField>
          <FormField id="ticket-description" label="Description" className="md:col-span-2">
            <textarea
              id="ticket-description"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="Explain the issue, affected page, timings, and any steps already tried."
              rows={5}
              required
              className="w-full rounded-lg border border-[var(--comp-border)] bg-[var(--comp-surface)] px-3 py-2 min-h-11 text-sm outline-none focus:border-[var(--comp-accent)]"
            />
          </FormField>
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
        {recentTicketsQuery.isPending ? (
          <SkeletonCard />
        ) : tickets.length === 0 ? (
          <EmptyStateCard message="No tickets submitted yet. Use the form above to raise your first support request." />
        ) : (
          <div className="space-y-2">
            {tickets.map((ticket) => (
              <div key={ticket.id} className="rounded-lg border border-[var(--comp-border)] bg-[var(--comp-surface)] p-3">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold text-[var(--comp-text-secondary)]">{ticket.id}</span>
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
                    <div className="max-w-2xl text-sm leading-6 text-[var(--comp-text-secondary)]">
                      <Markdown>{ticket.description}</Markdown>
                    </div>
                  </div>
                  <div className="space-y-1 text-right text-xs text-[var(--comp-text-secondary)]">
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
