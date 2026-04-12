import { useEffect, useMemo, useState } from "react";
import {
  EmptyStateCard,
  ErpPageShell,
  SectionCard,
  StatusBanner,
} from "../../components/erp/ErpPrimitives";
import { useAdminAccess } from "../../hooks/useAdminAccess";
import {
  applyToCareerOpportunity,
  createCareerOpportunity,
  deleteCareerOpportunity,
  listCareerOpportunities,
  saveCareerOpportunity,
  type CareerOpportunity,
  unsaveCareerOpportunity,
  updateCareerOpportunity,
} from "../../lib/careerApi";

const ALL_TYPES = ["Internship", "Hackathon", "Research", "Workshop", "Scholarship"] as const;

const TYPE_COLORS: Record<string, string> = {
  Internship: "border-blue-200 bg-blue-50 text-blue-800",
  Hackathon: "border-purple-200 bg-purple-50 text-purple-800",
  Research: "border-emerald-200 bg-emerald-50 text-emerald-800",
  Workshop: "border-amber-200 bg-amber-50 text-amber-800",
  Scholarship: "border-rose-200 bg-rose-50 text-rose-800",
};

export default function Opportunities({ adminMode = false }: { adminMode?: boolean }) {
  const admin = useAdminAccess();
  const [opportunities, setOpportunities] = useState<CareerOpportunity[]>([]);
  const [filterType, setFilterType] = useState<string>("All");
  const [search, setSearch] = useState("");
  const [editingId, setEditingId] = useState("");
  const [banner, setBanner] = useState<{ tone: "success" | "warning"; text: string } | null>(null);
  const [form, setForm] = useState({
    title: "",
    type: "Internship",
    organization: "",
    deadline: "",
    description: "",
    tags: "",
    link: "",
    status: "published",
    featured: false,
  });

  async function loadOpportunities() {
    try {
      const data = await listCareerOpportunities(
        {
          ...(filterType !== "All" ? { type: filterType } : {}),
          ...(search.trim() ? { query: search.trim() } : {}),
        },
        adminMode && admin.unlocked ? admin.adminHeaders : undefined
      );
      setOpportunities(data.items);
    } catch (error) {
      setBanner({
        tone: "warning",
        text: error instanceof Error ? error.message : "Failed to load opportunities.",
      });
    }
  }

  useEffect(() => {
    void loadOpportunities();
  }, [admin.adminHeaders, admin.unlocked, adminMode, filterType, search]);

  const filtered = useMemo(() => opportunities, [opportunities]);

  async function runAction(action: () => Promise<unknown>, successText: string) {
    setBanner(null);
    try {
      await action();
      setBanner({ tone: "success", text: successText });
      await loadOpportunities();
    } catch (error) {
      setBanner({
        tone: "warning",
        text: error instanceof Error ? error.message : "Action failed.",
      });
    }
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const payload = {
      title: form.title.trim(),
      type: form.type,
      organization: form.organization.trim(),
      deadline: form.deadline,
      description: form.description.trim(),
      tags: form.tags
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean),
      link: form.link.trim(),
      status: form.status,
      featured: form.featured,
    };

    if (editingId) {
      await runAction(
        () => updateCareerOpportunity(editingId, payload, admin.adminHeaders),
        "Opportunity updated successfully."
      );
    } else {
      await runAction(
        () => createCareerOpportunity(payload, admin.adminHeaders),
        "Opportunity published successfully."
      );
    }

    setEditingId("");
    setForm({
      title: "",
      type: "Internship",
      organization: "",
      deadline: "",
      description: "",
      tags: "",
      link: "",
      status: "published",
      featured: false,
    });
  }

  return (
    <ErpPageShell title="Opportunities" source="Internal API">
      {banner ? <StatusBanner message={{ id: "opp-banner", tone: banner.tone, text: banner.text }} /> : null}

      {adminMode && admin.unlocked ? (
        <SectionCard title={editingId ? "Edit Opportunity" : "Publish Opportunity"}>
          <form onSubmit={handleSubmit} className="grid gap-3 md:grid-cols-2">
            <div className="md:col-span-2">
              <label htmlFor="opp-title" className="mb-1 block text-sm font-medium text-[var(--text-primary)]">
                Title
              </label>
              <input
                id="opp-title"
                value={form.title}
                onChange={(event) => setForm((prev) => ({ ...prev, title: event.target.value }))}
                required
                className="w-full rounded-xl border border-[var(--border)] bg-[var(--background)] px-4 py-3 text-sm outline-none focus:border-[#0A3035]"
              />
            </div>
            <div>
              <label htmlFor="opp-type" className="mb-1 block text-sm font-medium text-[var(--text-primary)]">
                Type
              </label>
              <select
                id="opp-type"
                value={form.type}
                onChange={(event) => setForm((prev) => ({ ...prev, type: event.target.value }))}
                className="w-full rounded-xl border border-[var(--border)] bg-[var(--background)] px-4 py-3 text-sm outline-none focus:border-[#0A3035]"
              >
                {ALL_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="opp-status" className="mb-1 block text-sm font-medium text-[var(--text-primary)]">
                Status
              </label>
              <select
                id="opp-status"
                value={form.status}
                onChange={(event) => setForm((prev) => ({ ...prev, status: event.target.value }))}
                className="w-full rounded-xl border border-[var(--border)] bg-[var(--background)] px-4 py-3 text-sm outline-none focus:border-[#0A3035]"
              >
                <option value="published">Published</option>
                <option value="archived">Archived</option>
                <option value="draft">Draft</option>
              </select>
            </div>
            <div>
              <label htmlFor="opp-org" className="mb-1 block text-sm font-medium text-[var(--text-primary)]">
                Organization
              </label>
              <input
                id="opp-org"
                value={form.organization}
                onChange={(event) => setForm((prev) => ({ ...prev, organization: event.target.value }))}
                required
                className="w-full rounded-xl border border-[var(--border)] bg-[var(--background)] px-4 py-3 text-sm outline-none focus:border-[#0A3035]"
              />
            </div>
            <div>
              <label htmlFor="opp-deadline" className="mb-1 block text-sm font-medium text-[var(--text-primary)]">
                Deadline
              </label>
              <input
                id="opp-deadline"
                type="date"
                value={form.deadline}
                onChange={(event) => setForm((prev) => ({ ...prev, deadline: event.target.value }))}
                required
                className="w-full rounded-xl border border-[var(--border)] bg-[var(--background)] px-4 py-3 text-sm outline-none focus:border-[#0A3035]"
              />
            </div>
            <div>
              <label htmlFor="opp-link" className="mb-1 block text-sm font-medium text-[var(--text-primary)]">
                Link
              </label>
              <input
                id="opp-link"
                value={form.link}
                onChange={(event) => setForm((prev) => ({ ...prev, link: event.target.value }))}
                placeholder="https://..."
                className="w-full rounded-xl border border-[var(--border)] bg-[var(--background)] px-4 py-3 text-sm outline-none focus:border-[#0A3035]"
              />
            </div>
            <div className="md:col-span-2">
              <label htmlFor="opp-desc" className="mb-1 block text-sm font-medium text-[var(--text-primary)]">
                Description
              </label>
              <textarea
                id="opp-desc"
                value={form.description}
                onChange={(event) => setForm((prev) => ({ ...prev, description: event.target.value }))}
                rows={3}
                required
                className="w-full rounded-xl border border-[var(--border)] bg-[var(--background)] px-4 py-3 text-sm outline-none focus:border-[#0A3035]"
              />
            </div>
            <div className="md:col-span-2">
              <label htmlFor="opp-tags" className="mb-1 block text-sm font-medium text-[var(--text-primary)]">
                Tags
              </label>
              <input
                id="opp-tags"
                value={form.tags}
                onChange={(event) => setForm((prev) => ({ ...prev, tags: event.target.value }))}
                placeholder="ml, backend, internship"
                className="w-full rounded-xl border border-[var(--border)] bg-[var(--background)] px-4 py-3 text-sm outline-none focus:border-[#0A3035]"
              />
            </div>
            <div className="md:col-span-2 flex items-center gap-2">
              <input
                id="opp-featured"
                type="checkbox"
                checked={form.featured}
                onChange={(event) => setForm((prev) => ({ ...prev, featured: event.target.checked }))}
                className="h-4 w-4 rounded border-[var(--border)]"
              />
              <label htmlFor="opp-featured" className="text-sm text-[var(--text-primary)]">
                Mark as featured
              </label>
            </div>
            <div className="md:col-span-2 flex flex-wrap gap-2">
              <button
                type="submit"
                className="rounded-full bg-[#0A3035] px-6 py-2.5 text-sm font-semibold text-white transition hover:bg-[#124850]"
              >
                {editingId ? "Update Opportunity" : "Publish Opportunity"}
              </button>
              {editingId ? (
                <button
                  type="button"
                  onClick={() => {
                    setEditingId("");
                    setForm({
                      title: "",
                      type: "Internship",
                      organization: "",
                      deadline: "",
                      description: "",
                      tags: "",
                      link: "",
                      status: "published",
                      featured: false,
                    });
                  }}
                  className="rounded-full border border-[var(--border)] px-6 py-2.5 text-sm font-semibold text-[var(--text-secondary)] transition hover:border-[#0A3035] hover:text-[#0A3035]"
                >
                  Cancel Edit
                </button>
              ) : null}
            </div>
          </form>
        </SectionCard>
      ) : null}

      <SectionCard title="Browse Opportunities">
        <div className="grid gap-3 md:grid-cols-2">
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search by title, organization, or keyword..."
            className="w-full rounded-xl border border-[var(--border)] bg-[var(--background)] px-4 py-3 text-sm outline-none focus:border-[#0A3035]"
          />
          <div className="flex flex-wrap gap-2 pt-1">
            {(["All", ...ALL_TYPES] as const).map((type) => (
              <button
                key={type}
                type="button"
                onClick={() => setFilterType(type)}
                className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                  filterType === type
                    ? "border-[#0A3035] bg-[#0A3035] text-white"
                    : "border-[var(--border)] bg-white text-[var(--text-secondary)] hover:border-[#0A3035] hover:text-[#0A3035]"
                }`}
              >
                {type}
              </button>
            ))}
          </div>
        </div>
      </SectionCard>

      {filtered.length === 0 ? (
        <EmptyStateCard message="No opportunities match your current filters." />
      ) : (
        <div className="grid gap-3 lg:grid-cols-2">
          {filtered.map((opportunity) => (
            <article key={opportunity.id} className="dashboard-card flex flex-col justify-between p-4 md:p-5">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={`rounded-full border px-2.5 py-0.5 text-xs font-bold ${
                      TYPE_COLORS[opportunity.type] || "border-slate-200 bg-slate-50 text-slate-700"
                    }`}
                  >
                    {opportunity.type}
                  </span>
                  <span className="text-xs text-[var(--text-secondary)]">
                    Deadline: {opportunity.deadline}
                  </span>
                  <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-0.5 text-xs font-semibold text-slate-700">
                    {opportunity.status}
                  </span>
                  {opportunity.featured ? (
                    <span className="rounded-full border border-amber-200 bg-amber-50 px-2.5 py-0.5 text-xs font-semibold text-amber-800">
                      Featured
                    </span>
                  ) : null}
                </div>
                <h3 className="mt-2 text-base font-semibold text-[#0A3035]">{opportunity.title}</h3>
                <p className="mt-0.5 text-xs font-medium text-[var(--text-secondary)]">
                  {opportunity.organization}
                </p>
                <p className="mt-2 line-clamp-3 text-sm leading-6 text-[var(--text-secondary)]">
                  {opportunity.description}
                </p>
                {opportunity.tags.length > 0 ? (
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {opportunity.tags.map((tag) => (
                      <span
                        key={tag}
                        className="rounded-full bg-[#0A3035]/8 px-2.5 py-0.5 text-xs font-semibold text-[#0A3035]"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                ) : null}
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                {opportunity.link ? (
                  <a
                    href={opportunity.link}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-block rounded-full bg-[#0A3035] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#124850]"
                  >
                    Open Link
                  </a>
                ) : null}
                <button
                  type="button"
                  onClick={() =>
                    void runAction(
                      () =>
                        opportunity.saved
                          ? unsaveCareerOpportunity(opportunity.id)
                          : saveCareerOpportunity(opportunity.id),
                      opportunity.saved ? "Removed from saved opportunities." : "Saved opportunity."
                    )
                  }
                  className="rounded-full border border-blue-300 px-3 py-2 text-xs font-semibold text-blue-700 transition hover:bg-blue-50"
                >
                  {opportunity.saved ? "Unsave" : "Save"}
                </button>
                <button
                  type="button"
                  onClick={() =>
                    void runAction(
                      () => applyToCareerOpportunity(opportunity.id),
                      opportunity.applied ? "Application already recorded." : "Application recorded."
                    )
                  }
                  className="rounded-full border border-emerald-300 px-3 py-2 text-xs font-semibold text-emerald-700 transition hover:bg-emerald-50"
                >
                  {opportunity.applied ? "Applied" : "Apply / Track"}
                </button>
                {adminMode && admin.unlocked ? (
                  <>
                    <button
                      type="button"
                      onClick={() => {
                        setEditingId(opportunity.id);
                        setForm({
                          title: opportunity.title,
                          type: opportunity.type,
                          organization: opportunity.organization,
                          deadline: opportunity.deadline,
                          description: opportunity.description,
                          tags: opportunity.tags.join(", "),
                          link: opportunity.link,
                          status: opportunity.status,
                          featured: Boolean(opportunity.featured),
                        });
                      }}
                      className="rounded-full border border-amber-300 px-3 py-2 text-xs font-semibold text-amber-700 transition hover:bg-amber-50"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        void runAction(
                          () =>
                            updateCareerOpportunity(
                              opportunity.id,
                              {
                                status: opportunity.status === "archived" ? "published" : "archived",
                              },
                              admin.adminHeaders
                            ),
                          opportunity.status === "archived"
                            ? "Opportunity published."
                            : "Opportunity archived."
                        )
                      }
                      className="rounded-full border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
                    >
                      {opportunity.status === "archived" ? "Publish" : "Archive"}
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        void runAction(
                          () => deleteCareerOpportunity(opportunity.id, admin.adminHeaders),
                          "Opportunity deleted."
                        )
                      }
                      className="rounded-full border border-rose-300 px-3 py-2 text-xs font-semibold text-rose-700 transition hover:bg-rose-50"
                    >
                      Delete
                    </button>
                  </>
                ) : null}
              </div>
            </article>
          ))}
        </div>
      )}
    </ErpPageShell>
  );
}
