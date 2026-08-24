import { useMemo, useState } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import {
  EmptyStateCard,
  ErpPageShell,
  SectionCard,
  StatusBanner,
} from "../../components/erp/ErpPrimitives";
import { Markdown } from "../../components/markdown";
import { ConfirmDialog } from "../../components/dialog";
import { FormField } from "../../components/forms/FormField";
import { useAdminAccess } from "../../hooks/useAdminAccess";
import { helpdeskKeys } from "../../lib/helpdesk/queryKeys";
import { useApiMutation } from "../../lib/core/useApiMutation";
import { toErrorMessage } from "../../lib/core/toErrorMessage";
import {
  createHelpdeskFaq,
  deleteHelpdeskFaq,
  listHelpdeskFaqs,
  type CampusFaq,
  updateHelpdeskFaq,
} from "../../lib/campus/campusApi";

const FAQ_CATEGORIES = ["General", "Academic", "Finance", "Hostel & Transport", "IT & Technical"] as const;

export default function FAQs({ adminMode = false }: { adminMode?: boolean }) {
  const admin = useAdminAccess();
  const [search, setSearch] = useState("");
  const [openItems, setOpenItems] = useState<Set<string>>(new Set());
  const [editingFaqId, setEditingFaqId] = useState("");
  const [form, setForm] = useState({
    question: "",
    answer: "",
    category: FAQ_CATEGORIES[0] as string,
  });
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);

  const adminHeaders = adminMode && admin.unlocked ? admin.adminHeaders : undefined;
  const isAdminView = Boolean(adminHeaders);
  const listFilters = search.trim() ? { query: search.trim() } : undefined;

  /* eslint-disable @tanstack/query/exhaustive-deps -- cache is scoped by the primitive view flag + search text below; the raw adminHeaders object deliberately stays out of the key (unstable identity would fork/refetch entries) */
  const faqsQuery = useQuery({
    // View flag scopes admin/student entries; search text rides in the key.
    queryKey: helpdeskKeys.faqs({ ...(listFilters ?? {}), view: isAdminView ? "admin" : "student" }),
    queryFn: () => listHelpdeskFaqs(listFilters, adminHeaders),
    staleTime: 30_000,
    placeholderData: keepPreviousData,
  });
  /* eslint-enable @tanstack/query/exhaustive-deps */

  const faqs = faqsQuery.data?.items ?? [];

  const deleteFaq = useApiMutation({
    mutationFn: (faqId: string) => deleteHelpdeskFaq(faqId, adminHeaders),
    successText: "FAQ deleted successfully.",
    errorFallback: "Couldn't delete the FAQ. Please try again.",
    invalidateKeys: [helpdeskKeys.faqs()],
  });

  const saveFaq = useApiMutation({
    mutationFn: (input: { id: string | null; form: typeof form }) =>
      input.id
        ? updateHelpdeskFaq(input.id, input.form, adminHeaders)
        : createHelpdeskFaq(input.form, adminHeaders),
    successText: (data, vars) => (vars.id ? "FAQ updated successfully." : "FAQ created successfully."),
    errorFallback: "Couldn't save the FAQ. Please try again.",
    invalidateKeys: [helpdeskKeys.faqs()],
    onSuccess: () => {
      setForm({ question: "", answer: "", category: FAQ_CATEGORIES[0] });
      setEditingFaqId("");
    },
  });

  const banner =
    saveFaq.banner ??
    deleteFaq.banner ??
    (faqsQuery.error
      ? { tone: "warning" as const, text: toErrorMessage(faqsQuery.error, "Failed to load FAQs.") }
      : null);

  async function handleDeleteConfirmed() {
    if (!pendingDeleteId) return;
    await deleteFaq.mutate(pendingDeleteId);
    setPendingDeleteId(null);
  }

  const grouped = useMemo(() => {
    const map = new Map<string, CampusFaq[]>();
    for (const faq of faqs) {
      const category = faq.category || "General";
      if (!map.has(category)) map.set(category, []);
      map.get(category)?.push(faq);
    }
    return Array.from(map.entries());
  }, [faqs]);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    await saveFaq.mutate({ id: editingFaqId || null, form });
  }

  return (
    <ErpPageShell title="Helpdesk FAQs" source="Internal API">
      {banner ? <StatusBanner message={{ id: "faq-banner", tone: banner.tone, text: banner.text }} /> : null}

      <input
        id="faq-search"
        type="text"
        value={search}
        onChange={(event) => setSearch(event.target.value)}
        placeholder="Search by question, answer, or category..."
        aria-label="Search FAQs"
        className="w-full rounded-lg border border-[var(--comp-border)] bg-[var(--comp-surface)] px-3 py-2 min-h-11 text-sm outline-none focus:border-[var(--comp-accent)]"
      />

      {adminMode && admin.unlocked ? (
        <SectionCard title={editingFaqId ? "Edit FAQ" : "Create FAQ"}>
          <form onSubmit={handleSubmit} className="grid gap-4">
            <FormField id="faq-category" label="Category">
              <select
                id="faq-category"
                value={form.category}
                onChange={(event) => setForm((prev) => ({ ...prev, category: event.target.value }))}
                className="w-full rounded-lg border border-[var(--comp-border)] bg-[var(--comp-surface)] px-3 py-2 min-h-11 text-sm outline-none focus:border-[var(--comp-accent)]"
              >
                {FAQ_CATEGORIES.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </FormField>
            <FormField id="faq-question" label="Question">
              <input
                id="faq-question"
                value={form.question}
                onChange={(event) => setForm((prev) => ({ ...prev, question: event.target.value }))}
                required
                className="w-full rounded-lg border border-[var(--comp-border)] bg-[var(--comp-surface)] px-3 py-2 min-h-11 text-sm outline-none focus:border-[var(--comp-accent)]"
              />
            </FormField>
            <FormField id="faq-answer" label="Answer">
              <textarea
                id="faq-answer"
                value={form.answer}
                onChange={(event) => setForm((prev) => ({ ...prev, answer: event.target.value }))}
                rows={4}
                required
                className="w-full rounded-lg border border-[var(--comp-border)] bg-[var(--comp-surface)] px-3 py-2 min-h-11 text-sm outline-none focus:border-[var(--comp-accent)]"
              />
            </FormField>
            <div className="flex flex-wrap gap-2">
              <button
                type="submit"
                className="rounded-lg bg-[var(--comp-accent)] min-h-11 px-6 py-2 text-sm font-semibold text-white transition hover:bg-[var(--comp-accent-hover)]"
              >
                {editingFaqId ? "Update FAQ" : "Create FAQ"}
              </button>
              {editingFaqId ? (
                <button
                  type="button"
                  onClick={() => {
                    setEditingFaqId("");
                    setForm({ question: "", answer: "", category: FAQ_CATEGORIES[0] });
                  }}
                  className="rounded-lg border border-[var(--comp-border)] min-h-11 px-6 py-2 text-sm font-semibold text-[var(--comp-text-secondary)] transition hover:border-[var(--comp-accent)] hover:text-[var(--comp-text-primary)]"
                >
                  Cancel Edit
                </button>
              ) : null}
            </div>
          </form>
        </SectionCard>
      ) : null}

      {faqs.length === 0 ? (
        <EmptyStateCard message="No FAQs available right now. Try raising a ticket for direct support." />
      ) : grouped.length === 0 ? (
        <EmptyStateCard message="No FAQs match your current search." />
      ) : (
        grouped.map(([category, items]) => (
          <SectionCard key={category} title={category}>
            <div className="divide-y divide-[var(--comp-border)]">
              {items.map((item) => {
                const isOpen = openItems.has(item.id);
                return (
                  <div key={item.id}>
                    <button
                      type="button"
                      onClick={() =>
                        setOpenItems((prev) => {
                          const next = new Set(prev);
                          if (next.has(item.id)) next.delete(item.id);
                          else next.add(item.id);
                          return next;
                        })
                      }
                      className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition hover:bg-[var(--comp-surface-hover)]"
                    >
                      <span className="text-sm font-semibold text-[var(--comp-text-primary)]">{item.question}</span>
                      <span className="shrink-0 text-lg text-[var(--comp-text-secondary)]">{isOpen ? "-" : "+"}</span>
                    </button>
                    {isOpen ? (
                      <div className="px-4 pb-3">
                        <div className="text-sm leading-6 text-[var(--comp-text-secondary)]">
                          <Markdown>{item.answer}</Markdown>
                        </div>
                        {adminMode && admin.unlocked ? (
                          <div className="mt-3 flex flex-wrap gap-2">
                            <button
                              type="button"
                              onClick={() => {
                                setEditingFaqId(item.id);
                                setForm({
                                  question: item.question,
                                  answer: item.answer,
                                  category: item.category,
                                });
                              }}
                              className="rounded-full border border-[color-mix(in_srgb,var(--info)_30%,transparent)] px-3 py-1 text-xs font-semibold text-[var(--info)] transition hover:bg-[color-mix(in_srgb,var(--info)_10%,transparent)]"
                            >
                              Edit
                            </button>
                            <button
                              type="button"
                              onClick={() => setPendingDeleteId(item.id)}
                              className="rounded-full border border-[color-mix(in_srgb,var(--error)_30%,transparent)] px-3 py-1 text-xs font-semibold text-[var(--error)] transition hover:bg-[color-mix(in_srgb,var(--error)_10%,transparent)]"
                            >
                              Delete
                            </button>
                          </div>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          </SectionCard>
        ))
      )}

      <ConfirmDialog
        open={pendingDeleteId !== null}
        onOpenChange={(open) => { if (!open) setPendingDeleteId(null); }}
        title="Delete this FAQ?"
        description={`"${faqs.find((faq) => faq.id === pendingDeleteId)?.question ?? "This FAQ"}" will be removed from the helpdesk immediately. This cannot be undone.`}
        confirmLabel="Delete FAQ"
        danger
        busy={deleteFaq.isPending}
        onConfirm={() => void handleDeleteConfirmed()}
      />
    </ErpPageShell>
  );
}
