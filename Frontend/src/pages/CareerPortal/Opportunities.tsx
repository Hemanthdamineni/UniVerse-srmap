import { useEffect, useState } from "react";
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
  listPendingSubmissions,
  listCareerOpportunities,
  reviewCareerSubmission,
  saveCareerOpportunity,
  type CareerSubmission,
  type CareerOpportunity,
  unsaveCareerOpportunity,
  updateCareerOpportunity,
} from "../../lib/career/careerApi";

const ALL_TYPES = ["internship", "hackathon", "competition", "workshop", "job", "fellowship"] as const;

const INPUT_CLASS = "min-h-[44px] w-full rounded-xl border border-[var(--border)] bg-[var(--background)] px-3.5 py-2 text-sm outline-none focus:border-[var(--comp-accent)] text-[var(--text-primary)]";

const TYPE_COLORS: Record<string, string> = {
  internship: "border-[color-mix(in_srgb,var(--info)_30%,transparent)] bg-[color-mix(in_srgb,var(--info)_10%,transparent)] text-[var(--info)]",
  hackathon: "border-purple-200 bg-purple-50 text-purple-800",
  competition: "border-[color-mix(in_srgb,var(--success)_30%,transparent)] bg-[color-mix(in_srgb,var(--success)_10%,transparent)] text-[var(--success)]",
  workshop: "border-[color-mix(in_srgb,var(--warning)_30%,transparent)] bg-[color-mix(in_srgb,var(--warning)_10%,transparent)] text-[var(--warning)]",
  job: "border-[color-mix(in_srgb,var(--comp-accent)_30%,transparent)] bg-[color-mix(in_srgb,var(--comp-accent)_10%,transparent)] text-[var(--comp-text-primary)]",
  fellowship: "border-[color-mix(in_srgb,var(--error)_30%,transparent)] bg-[color-mix(in_srgb,var(--error)_10%,transparent)] text-[var(--error)]",
};

const FORM_INIT = {
  title: "",
  type: "internship",
  organization: "",
  deadline: "",
  description: "",
  tags: "",
  link: "",
  status: "published",
  featured: false,
};

export default function Opportunities({ adminMode = false }: { adminMode?: boolean }) {
  const admin = useAdminAccess();
  const [opportunities, setOpportunities] = useState<CareerOpportunity[]>([]);
  const [filterType, setFilterType] = useState<string>("All");
  const [search, setSearch] = useState("");
  const [submissions, setSubmissions] = useState<CareerSubmission[]>([]);
  const [reviewReasons, setReviewReasons] = useState<Record<string, string>>({});
  const [editingId, setEditingId] = useState("");
  const [banner, setBanner] = useState<{ tone: "success" | "warning"; text: string } | null>(null);
  const [form, setForm] = useState(FORM_INIT);

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

  async function loadSubmissions() {
    if (!adminMode || !admin.unlocked) return;
    try {
      const data = await listPendingSubmissions(admin.adminHeaders);
      setSubmissions(data.items || []);
    } catch (error) {
      setBanner({
        tone: "warning",
        text: error instanceof Error ? error.message : "Failed to load submission queue.",
      });
    }
  }

  useEffect(() => {
    void loadOpportunities();
  }, [admin.adminHeaders, admin.unlocked, adminMode, filterType, search]);

  useEffect(() => {
    void loadSubmissions();
  }, [admin.adminHeaders, admin.unlocked, adminMode]);

  const filtered = opportunities;

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
      company: form.organization.trim(),
      organization: form.organization.trim(),
      deadline: form.deadline,
      description: form.description.trim(),
      tags: form.tags
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean),
      link: form.link.trim(),
      applyUrl: form.link.trim(),
      sourceUrl: form.link.trim(),
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
    setForm(FORM_INIT);
  }

  async function decideSubmission(submission: CareerSubmission, decision: "approve" | "reject") {
    const reason = reviewReasons[submission.id]?.trim();
    if (!reason) {
      setBanner({ tone: "warning", text: "Review reason is required before deciding a submission." });
      return;
    }
    await runAction(
      () => reviewCareerSubmission(submission.id, { decision, reason }, admin.adminHeaders),
      decision === "approve" ? "Submission approved and published." : "Submission rejected with reason."
    );
    setReviewReasons((current) => ({ ...current, [submission.id]: "" }));
    await loadSubmissions();
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
                className={INPUT_CLASS}
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
                className={INPUT_CLASS}
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
                className={INPUT_CLASS}
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
                className={INPUT_CLASS}
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
                className={INPUT_CLASS}
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
                className={INPUT_CLASS}
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
                className={INPUT_CLASS}
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
                className={INPUT_CLASS}
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
                className="rounded-full bg-[var(--comp-accent)] px-6 py-2.5 text-sm font-semibold text-white transition hover:bg-[var(--comp-accent-hover)]"
              >
                {editingId ? "Update Opportunity" : "Publish Opportunity"}
              </button>
              {editingId ? (
                <button
                  type="button"
                  onClick={() => {
                    setEditingId("");
                    setForm(FORM_INIT);
                  }}
                  className="rounded-full border border-[var(--border)] px-6 py-2.5 text-sm font-semibold text-[var(--text-secondary)] transition hover:border-[var(--comp-accent)] hover:text-[var(--comp-text-primary)]"
                >
                  Cancel Edit
                </button>
              ) : null}
            </div>
          </form>
        </SectionCard>
      ) : null}

      {adminMode && admin.unlocked ? (
        <SectionCard title="Submission Review Queue">
          {submissions.length === 0 ? (
            <p className="text-sm text-[var(--text-secondary)]">No pending submissions.</p>
          ) : (
            <div className="space-y-3">
              {submissions.map((submission) => (
                <article key={submission.id} className="rounded-lg border border-[var(--comp-border)] bg-[var(--comp-surface)] p-4">
                  <div className="grid gap-4 lg:grid-cols-[1fr_280px]">
                    <div className="space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-base font-semibold text-[var(--comp-text-primary)]">{submission.title}</h3>
                        <span className="rounded-full bg-[color-mix(in_srgb,var(--warning)_10%,transparent)] px-2 py-1 text-xs font-semibold text-[var(--warning)]">
                          {submission.status}
                        </span>
                      </div>
                      <p className="text-sm text-[var(--text-secondary)]">
                        {submission.company || submission.organizer || "Unknown organization"} • {submission.type}
                      </p>
                      <p className="text-sm text-[var(--text-secondary)]">{submission.description}</p>
                      <div className="flex flex-wrap gap-2 text-xs text-[var(--text-secondary)]">
                        <span>Submitted by {submission.submittedBy}</span>
                        <span>Deadline {submission.deadline || "Not set"}</span>
                        <a className="text-[var(--info)]" href={submission.applyUrl} target="_blank" rel="noreferrer">
                          Source
                        </a>
                      </div>
                      {submission.audit?.[0] ? (
                        <p className="text-xs text-[var(--text-secondary)]">
                          Latest audit: {submission.audit[0].action} by {submission.audit[0].actorId}
                        </p>
                      ) : null}
                    </div>
                    <div className="space-y-2">
                      <textarea
                        className="min-h-24 w-full rounded-xl border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm outline-none focus:border-[var(--comp-accent)]"
                        value={reviewReasons[submission.id] || ""}
                        onChange={(event) => setReviewReasons((current) => ({ ...current, [submission.id]: event.target.value }))}
                        placeholder="Review reason"
                        aria-label={`Review reason for ${submission.id}`}
                      />
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          className="rounded-full bg-[var(--success)] px-3 py-2 text-xs font-semibold text-white"
                          onClick={() => void decideSubmission(submission, "approve")}
                        >
                          Approve
                        </button>
                        <button
                          type="button"
                          className="rounded-full border border-[color-mix(in_srgb,var(--error)_30%,transparent)] px-3 py-2 text-xs font-semibold text-[var(--error)]"
                          onClick={() => void decideSubmission(submission, "reject")}
                        >
                          Reject
                        </button>
                      </div>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
        </SectionCard>
      ) : null}

      <SectionCard title="Browse Opportunities">
        <div className="grid gap-3 md:grid-cols-2">
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search by title, organization, or keyword..."
            aria-label="Search opportunities"
            className={INPUT_CLASS}
          />
          <div className="flex flex-wrap gap-2 pt-1">
            {(["All", ...ALL_TYPES] as const).map((type) => (
              <button
                key={type}
                type="button"
                onClick={() => setFilterType(type)}
                className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                  filterType === type
                    ? "border-[var(--comp-accent)] bg-[var(--comp-accent)] text-white"
                    : "border-[var(--border)] bg-white text-[var(--text-secondary)] hover:border-[var(--comp-accent)] hover:text-[var(--comp-text-primary)]"
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
                      TYPE_COLORS[opportunity.type] || "border-[var(--comp-border)] bg-[var(--comp-surface-hover)] text-[var(--comp-text-secondary)]"
                    }`}
                  >
                    {opportunity.type}
                  </span>
                  <span className="text-xs text-[var(--text-secondary)]">
                    Deadline: {opportunity.deadline}
                  </span>
                  <span className="rounded-full border border-[var(--comp-border)] bg-[var(--comp-surface-hover)] px-2.5 py-0.5 text-xs font-semibold text-[var(--comp-text-secondary)]">
                    {opportunity.status}
                  </span>
                  {opportunity.featured ? (
                    <span className="rounded-full border border-[color-mix(in_srgb,var(--warning)_30%,transparent)] bg-[color-mix(in_srgb,var(--warning)_10%,transparent)] px-2.5 py-0.5 text-xs font-semibold text-[var(--warning)]">
                      Featured
                    </span>
                  ) : null}
                </div>
                <h3 className="mt-2 text-base font-semibold text-[var(--comp-text-primary)]">{opportunity.title}</h3>
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
                        className="rounded-full bg-[color-mix(in_srgb,var(--comp-accent)_8%,transparent)] px-2.5 py-0.5 text-xs font-semibold text-[var(--comp-text-primary)]"
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
                    className="inline-block rounded-full bg-[var(--comp-accent)] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[var(--comp-accent-hover)]"
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
                  className="rounded-full border border-[color-mix(in_srgb,var(--info)_30%,transparent)] px-3 py-2 text-xs font-semibold text-[var(--info)] transition hover:bg-[color-mix(in_srgb,var(--info)_10%,transparent)]"
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
                  className="rounded-full border border-[color-mix(in_srgb,var(--success)_30%,transparent)] px-3 py-2 text-xs font-semibold text-[var(--success)] transition hover:bg-[color-mix(in_srgb,var(--success)_10%,transparent)]"
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
                          organization: opportunity.organization ?? "",
                          deadline: opportunity.deadline ?? "",
                          description: opportunity.description ?? "",
                          tags: opportunity.tags.join(", "),
                          link: opportunity.link ?? "",
                          status: opportunity.status ?? "published",
                          featured: Boolean(opportunity.featured),
                        });
                      }}
                      className="rounded-full border border-[color-mix(in_srgb,var(--warning)_30%,transparent)] px-3 py-2 text-xs font-semibold text-[var(--warning)] transition hover:bg-[color-mix(in_srgb,var(--warning)_10%,transparent)]"
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
                      className="rounded-full border border-[var(--comp-border)] px-3 py-2 text-xs font-semibold text-[var(--comp-text-secondary)] transition hover:bg-[var(--comp-surface-hover)]"
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
                      className="rounded-full border border-[color-mix(in_srgb,var(--error)_30%,transparent)] px-3 py-2 text-xs font-semibold text-[var(--error)] transition hover:bg-[color-mix(in_srgb,var(--error)_10%,transparent)]"
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
