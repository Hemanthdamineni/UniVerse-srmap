import { useEffect, useMemo, useState } from "react";
import {
  EmptyStateCard,
  ErpPageShell,
  SectionCard,
  StatusBanner,
} from "../../components/erp/ErpPrimitives";
import { Markdown } from "../../components/markdown";
import { ConfirmDialog } from "../../components/dialog";
import { useAdminAccess } from "../../hooks/useAdminAccess";
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
  const [faqs, setFaqs] = useState<CampusFaq[]>([]);
  const [search, setSearch] = useState("");
  const [openItems, setOpenItems] = useState<Set<string>>(new Set());
  const [editingFaqId, setEditingFaqId] = useState("");
  const [form, setForm] = useState({
    question: "",
    answer: "",
    category: FAQ_CATEGORIES[0] as string,
  });
  const [banner, setBanner] = useState<{ tone: "success" | "warning"; text: string } | null>(null);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);

  async function handleDeleteConfirmed() {
    if (!pendingDeleteId) return;
    setBanner(null);
    setDeleteBusy(true);
    try {
      await deleteHelpdeskFaq(pendingDeleteId, admin.adminHeaders);
      setBanner({ tone: "success", text: "FAQ deleted successfully." });
      await loadFaqs();
    } catch (error) {
      setBanner({
        tone: "warning",
        text: error instanceof Error ? error.message : "Couldn't delete the FAQ. Please try again.",
      });
    } finally {
      setDeleteBusy(false);
      setPendingDeleteId(null);
    }
  }

  async function loadFaqs() {
    try {
      const data = await listHelpdeskFaqs(
        search.trim() ? { query: search.trim() } : undefined,
        adminMode && admin.unlocked ? admin.adminHeaders : undefined
      );
      setFaqs(data.items);
    } catch (error) {
      setBanner({
        tone: "warning",
        text: error instanceof Error ? error.message : "Failed to load FAQs.",
      });
    }
  }

  useEffect(() => {
    void loadFaqs();
  }, [admin.adminHeaders, admin.unlocked, adminMode, search]);

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
    setBanner(null);
    try {
      if (editingFaqId) {
        await updateHelpdeskFaq(editingFaqId, form, admin.adminHeaders);
        setBanner({ tone: "success", text: "FAQ updated successfully." });
      } else {
        await createHelpdeskFaq(form, admin.adminHeaders);
        setBanner({ tone: "success", text: "FAQ created successfully." });
      }
      setForm({ question: "", answer: "", category: FAQ_CATEGORIES[0] });
      setEditingFaqId("");
      await loadFaqs();
    } catch (error) {
      setBanner({
        tone: "warning",
        text: error instanceof Error ? error.message : "Couldn't save the FAQ. Please try again.",
      });
    }
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
        className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 min-h-11 text-sm outline-none focus:border-[var(--comp-accent)]"
      />

      {adminMode && admin.unlocked ? (
        <SectionCard title={editingFaqId ? "Edit FAQ" : "Create FAQ"}>
          <form onSubmit={handleSubmit} className="grid gap-4">
            <div>
              <label htmlFor="faq-category" className="mb-2 block text-sm font-medium text-[var(--text-primary)]">
                Category
              </label>
              <select
                id="faq-category"
                value={form.category}
                onChange={(event) => setForm((prev) => ({ ...prev, category: event.target.value }))}
                className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 min-h-11 text-sm outline-none focus:border-[var(--comp-accent)]"
              >
                {FAQ_CATEGORIES.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="faq-question" className="mb-2 block text-sm font-medium text-[var(--text-primary)]">
                Question
              </label>
              <input
                id="faq-question"
                value={form.question}
                onChange={(event) => setForm((prev) => ({ ...prev, question: event.target.value }))}
                required
                className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 min-h-11 text-sm outline-none focus:border-[var(--comp-accent)]"
              />
            </div>
            <div>
              <label htmlFor="faq-answer" className="mb-2 block text-sm font-medium text-[var(--text-primary)]">
                Answer
              </label>
              <textarea
                id="faq-answer"
                value={form.answer}
                onChange={(event) => setForm((prev) => ({ ...prev, answer: event.target.value }))}
                rows={4}
                required
                className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 min-h-11 text-sm outline-none focus:border-[var(--comp-accent)]"
              />
            </div>
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
                  className="rounded-lg border border-[var(--border)] min-h-11 px-6 py-2 text-sm font-semibold text-[var(--text-secondary)] transition hover:border-[var(--comp-accent)] hover:text-[var(--comp-text-primary)]"
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
            <div className="divide-y divide-[var(--border)]">
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
                      <span className="shrink-0 text-lg text-[var(--text-secondary)]">{isOpen ? "-" : "+"}</span>
                    </button>
                    {isOpen ? (
                      <div className="px-4 pb-3">
                        <div className="text-sm leading-6 text-[var(--text-secondary)]">
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
        busy={deleteBusy}
        onConfirm={() => void handleDeleteConfirmed()}
      />
    </ErpPageShell>
  );
}
