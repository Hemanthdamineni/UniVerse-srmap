import { useEffect, useMemo, useState } from "react";
import {
  EmptyStateCard,
  ErpPageShell,
  SectionCard,
  StatusBanner,
} from "../../components/erp/ErpPrimitives";
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
        text: error instanceof Error ? error.message : "Failed to save FAQ.",
      });
    }
  }

  return (
    <ErpPageShell title="Helpdesk FAQs" source="Internal API">
      {banner ? <StatusBanner message={{ id: "faq-banner", tone: banner.tone, text: banner.text }} /> : null}

      <SectionCard title="Find Answers">
        <input
          id="faq-search"
          type="text"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search by question, answer, or category..."
          className="w-full rounded-xl border border-[var(--border)] bg-[var(--background)] px-4 py-3 text-sm outline-none focus:border-[var(--comp-accent)]"
        />
      </SectionCard>

      {adminMode && admin.unlocked ? (
        <SectionCard title={editingFaqId ? "Edit FAQ" : "Create FAQ"}>
          <form onSubmit={handleSubmit} className="grid gap-3">
            <div>
              <label htmlFor="faq-category" className="mb-1 block text-sm font-medium text-[var(--text-primary)]">
                Category
              </label>
              <select
                id="faq-category"
                value={form.category}
                onChange={(event) => setForm((prev) => ({ ...prev, category: event.target.value }))}
                className="w-full rounded-xl border border-[var(--border)] bg-[var(--background)] px-4 py-3 text-sm outline-none focus:border-[var(--comp-accent)]"
              >
                {FAQ_CATEGORIES.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="faq-question" className="mb-1 block text-sm font-medium text-[var(--text-primary)]">
                Question
              </label>
              <input
                id="faq-question"
                value={form.question}
                onChange={(event) => setForm((prev) => ({ ...prev, question: event.target.value }))}
                required
                className="w-full rounded-xl border border-[var(--border)] bg-[var(--background)] px-4 py-3 text-sm outline-none focus:border-[var(--comp-accent)]"
              />
            </div>
            <div>
              <label htmlFor="faq-answer" className="mb-1 block text-sm font-medium text-[var(--text-primary)]">
                Answer
              </label>
              <textarea
                id="faq-answer"
                value={form.answer}
                onChange={(event) => setForm((prev) => ({ ...prev, answer: event.target.value }))}
                rows={4}
                required
                className="w-full rounded-xl border border-[var(--border)] bg-[var(--background)] px-4 py-3 text-sm outline-none focus:border-[var(--comp-accent)]"
              />
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="submit"
                className="rounded-full bg-[var(--comp-accent)] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[var(--comp-accent-hover)]"
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
                  className="rounded-full border border-[var(--border)] px-5 py-2.5 text-sm font-semibold text-[var(--text-secondary)] transition hover:border-[var(--comp-accent)] hover:text-[var(--comp-text-primary)]"
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
            <div className="space-y-2">
              {items.map((item) => {
                const isOpen = openItems.has(item.id);
                return (
                  <div key={item.id} className="overflow-hidden rounded-2xl border border-[var(--border)] bg-white">
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
                      className="flex w-full items-center justify-between gap-3 px-4 py-3.5 text-left transition hover:bg-[var(--comp-surface-hover)]"
                    >
                      <span className="text-sm font-semibold text-[var(--comp-text-primary)]">{item.question}</span>
                      <span className="shrink-0 text-lg text-[var(--text-secondary)]">{isOpen ? "-" : "+"}</span>
                    </button>
                    {isOpen ? (
                      <div className="border-t border-[var(--border)] px-4 py-3">
                        <p className="text-sm leading-6 text-[var(--text-secondary)]">{item.answer}</p>
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
                              className="rounded-full border border-[color-mix(in_srgb,var(--info)_30%,transparent)] px-3 py-1.5 text-xs font-semibold text-[var(--info)] transition hover:bg-[color-mix(in_srgb,var(--info)_10%,transparent)]"
                            >
                              Edit
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                void deleteHelpdeskFaq(item.id, admin.adminHeaders)
                                  .then(() => {
                                    setBanner({ tone: "success", text: "FAQ deleted successfully." });
                                    return loadFaqs();
                                  })
                                  .catch((error) =>
                                    setBanner({
                                      tone: "warning",
                                      text:
                                        error instanceof Error ? error.message : "Failed to delete FAQ.",
                                    })
                                  )
                              }
                              className="rounded-full border border-[color-mix(in_srgb,var(--error)_30%,transparent)] px-3 py-1.5 text-xs font-semibold text-[var(--error)] transition hover:bg-[color-mix(in_srgb,var(--error)_10%,transparent)]"
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
    </ErpPageShell>
  );
}
