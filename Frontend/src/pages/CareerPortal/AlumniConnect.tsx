import { useMemo, useState } from "react";
import { keepPreviousData, useQuery, useQueryClient } from "@tanstack/react-query";
import { Globe, Instagram, Linkedin, SearchX, Users } from "lucide-react";
import {
  EmptyStateCard,
  ErpPageShell,
  SectionCard,
  StatusBanner,
} from "../../components/erp/ErpPrimitives";
import { useAdminAccess } from "../../hooks/useAdminAccess";
import { useDebouncedValue } from "../../hooks/useDebouncedValue";
import { careerKeys } from "../../lib/career/queryKeys";
import {
  createAlumniProfile,
  deleteAlumniProfile,
  listAlumni,
  requestAlumniConnection,
  type AlumniProfile,
  updateAlumniProfile,
} from "../../lib/career/careerApi";
import AlumniNominationForm from "./AlumniNominationForm";
import AlumniModerationQueues from "./AlumniModerationQueues";

const FORM_INIT = {
  name: "",
  email: "",
  batch: "",
  degree: "",
  company: "",
  role: "",
  location: "",
  linkedinUrl: "",
  instagramUrl: "",
  portfolioUrl: "",
  expertise: "",
  bio: "",
  openToConnect: true,
};

export default function AlumniConnect({ adminMode = false }: { adminMode?: boolean }) {
  const admin = useAdminAccess();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search);
  const [batchFilter, setBatchFilter] = useState<string>("All");
  const [editingId, setEditingId] = useState("");
  const [banner, setBanner] = useState<{ tone: "success" | "warning"; text: string } | null>(null);
  const [form, setForm] = useState(FORM_INIT);
  const [nominationFormOpen, setNominationFormOpen] = useState(false);

  function focusNominationForm() {
    setNominationFormOpen(true);
    document.getElementById("alumni-nomination-form")?.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  const isAdminView = adminMode && admin.unlocked;
  const adminHeaders = isAdminView ? admin.adminHeaders : undefined;
  // debouncedSearch (not search) keeps typing from firing a request per keystroke.
  const alumniFilters: Record<string, string> = {
    ...(debouncedSearch.trim() ? { query: debouncedSearch.trim() } : {}),
    ...(batchFilter !== "All" ? { batch: batchFilter } : {}),
    view: isAdminView ? "admin" : "student",
  };

  /* eslint-disable @tanstack/query/exhaustive-deps -- cache is scoped by the primitive view flag + filters; the raw headers object deliberately stays out of the key */
  const alumniQuery = useQuery({
    queryKey: careerKeys.alumni(alumniFilters),
    queryFn: () => listAlumni(alumniFilters, adminHeaders),
    staleTime: 30_000,
    placeholderData: keepPreviousData,
  });
  /* eslint-enable @tanstack/query/exhaustive-deps */

  const alumni = alumniQuery.data?.items ?? [];

  async function runAction(action: () => Promise<unknown>, successText: string) {
    setBanner(null);
    try {
      await action();
      setBanner({ tone: "success", text: successText });
      await queryClient.invalidateQueries({ queryKey: careerKeys.alumni() });
    } catch (error) {
      setBanner({
        tone: "warning",
        text: error instanceof Error ? error.message : "Action failed.",
      });
    }
  }

  const batches = useMemo(() => {
    const unique = Array.from(new Set(alumni.map((item) => item.batch).filter(Boolean))).sort().reverse();
    return ["All", ...unique];
  }, [alumni]);

  const hasActiveFilters = Boolean(search.trim()) || batchFilter !== "All";

  return (
    <ErpPageShell title="Alumni Connect" source="Internal API">
      {banner ? <StatusBanner message={{ id: "alumni-banner", tone: banner.tone, text: banner.text }} /> : null}

      {adminMode && admin.unlocked ? (
        <AlumniModerationQueues adminHeaders={admin.adminHeaders} />
      ) : adminMode ? null : (
        <AlumniNominationForm open={nominationFormOpen} onOpenChange={setNominationFormOpen} />
      )}

      {adminMode && admin.unlocked ? (
        <SectionCard title={editingId ? "Edit Alumni Profile" : "Add Alumni Profile"}>
          <form
            onSubmit={(event) => {
              event.preventDefault();
              const payload = {
                name: form.name.trim(),
                email: form.email.trim(),
                batch: form.batch.trim(),
                degree: form.degree.trim(),
                company: form.company.trim(),
                role: form.role.trim(),
                location: form.location.trim(),
                linkedinUrl: form.linkedinUrl.trim(),
                instagramUrl: form.instagramUrl.trim(),
                portfolioUrl: form.portfolioUrl.trim(),
                expertise: form.expertise
                  .split(",")
                  .map((item) => item.trim())
                  .filter(Boolean),
                bio: form.bio.trim(),
                openToConnect: form.openToConnect,
              };
              if (editingId) {
                void runAction(
                  () => updateAlumniProfile(editingId, payload, admin.adminHeaders),
                  "Alumni profile updated."
                );
              } else {
                void runAction(
                  () => createAlumniProfile(payload, admin.adminHeaders),
                  "Alumni profile created."
                );
              }
              setEditingId("");
              setForm(FORM_INIT);
            }}
            className="grid gap-3 md:grid-cols-2"
          >
            <div>
              <label className="mb-1 block text-sm font-medium text-[var(--text-primary)]">Name</label>
              <input
                value={form.name}
                onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
                required
                className="w-full rounded-xl border border-[var(--border)] bg-[var(--background)] px-4 py-3 text-sm outline-none focus:border-[var(--comp-accent)]"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-[var(--text-primary)]">Email</label>
              <input
                type="email"
                value={form.email}
                onChange={(event) => setForm((prev) => ({ ...prev, email: event.target.value }))}
                className="w-full rounded-xl border border-[var(--border)] bg-[var(--background)] px-4 py-3 text-sm outline-none focus:border-[var(--comp-accent)]"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-[var(--text-primary)]">Batch</label>
              <input
                value={form.batch}
                onChange={(event) => setForm((prev) => ({ ...prev, batch: event.target.value }))}
                placeholder="2024"
                required
                className="w-full rounded-xl border border-[var(--border)] bg-[var(--background)] px-4 py-3 text-sm outline-none focus:border-[var(--comp-accent)]"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-[var(--text-primary)]">Degree</label>
              <input
                value={form.degree}
                onChange={(event) => setForm((prev) => ({ ...prev, degree: event.target.value }))}
                required
                className="w-full rounded-xl border border-[var(--border)] bg-[var(--background)] px-4 py-3 text-sm outline-none focus:border-[var(--comp-accent)]"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-[var(--text-primary)]">Company</label>
              <input
                value={form.company}
                onChange={(event) => setForm((prev) => ({ ...prev, company: event.target.value }))}
                required
                className="w-full rounded-xl border border-[var(--border)] bg-[var(--background)] px-4 py-3 text-sm outline-none focus:border-[var(--comp-accent)]"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-[var(--text-primary)]">Role</label>
              <input
                value={form.role}
                onChange={(event) => setForm((prev) => ({ ...prev, role: event.target.value }))}
                required
                className="w-full rounded-xl border border-[var(--border)] bg-[var(--background)] px-4 py-3 text-sm outline-none focus:border-[var(--comp-accent)]"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-[var(--text-primary)]">Location</label>
              <input
                value={form.location}
                onChange={(event) => setForm((prev) => ({ ...prev, location: event.target.value }))}
                required
                className="w-full rounded-xl border border-[var(--border)] bg-[var(--background)] px-4 py-3 text-sm outline-none focus:border-[var(--comp-accent)]"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-[var(--text-primary)]">LinkedIn</label>
              <input
                type="url"
                value={form.linkedinUrl}
                onChange={(event) => setForm((prev) => ({ ...prev, linkedinUrl: event.target.value }))}
                placeholder="https://linkedin.com/in/..."
                className="w-full rounded-xl border border-[var(--border)] bg-[var(--background)] px-4 py-3 text-sm outline-none focus:border-[var(--comp-accent)]"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-[var(--text-primary)]">Instagram</label>
              <input
                type="url"
                value={form.instagramUrl}
                onChange={(event) => setForm((prev) => ({ ...prev, instagramUrl: event.target.value }))}
                placeholder="https://instagram.com/..."
                className="w-full rounded-xl border border-[var(--border)] bg-[var(--background)] px-4 py-3 text-sm outline-none focus:border-[var(--comp-accent)]"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-[var(--text-primary)]">Portfolio / other link</label>
              <input
                type="url"
                value={form.portfolioUrl}
                onChange={(event) => setForm((prev) => ({ ...prev, portfolioUrl: event.target.value }))}
                placeholder="https://..."
                className="w-full rounded-xl border border-[var(--border)] bg-[var(--background)] px-4 py-3 text-sm outline-none focus:border-[var(--comp-accent)]"
              />
            </div>
            <div className="md:col-span-2">
              <label className="mb-1 block text-sm font-medium text-[var(--text-primary)]">Expertise</label>
              <input
                value={form.expertise}
                onChange={(event) => setForm((prev) => ({ ...prev, expertise: event.target.value }))}
                placeholder="React, ML, System Design"
                className="w-full rounded-xl border border-[var(--border)] bg-[var(--background)] px-4 py-3 text-sm outline-none focus:border-[var(--comp-accent)]"
              />
            </div>
            <div className="md:col-span-2">
              <label className="mb-1 block text-sm font-medium text-[var(--text-primary)]">Bio</label>
              <textarea
                value={form.bio}
                onChange={(event) => setForm((prev) => ({ ...prev, bio: event.target.value }))}
                rows={3}
                className="w-full rounded-xl border border-[var(--border)] bg-[var(--background)] px-4 py-3 text-sm outline-none focus:border-[var(--comp-accent)]"
              />
            </div>
            <div className="md:col-span-2 flex items-center gap-2">
              <input
                id="alumni-open-connect"
                type="checkbox"
                checked={form.openToConnect}
                onChange={(event) => setForm((prev) => ({ ...prev, openToConnect: event.target.checked }))}
                className="h-4 w-4 rounded border-[var(--border)]"
              />
              <label htmlFor="alumni-open-connect" className="text-sm text-[var(--text-primary)]">
                Open to student connection requests
              </label>
            </div>
            <div className="md:col-span-2 flex flex-wrap gap-2">
              <button
                type="submit"
                className="rounded-full bg-[var(--comp-accent)] px-6 py-2.5 text-sm font-semibold text-white transition hover:bg-[var(--comp-accent-hover)]"
              >
                {editingId ? "Update Alumni" : "Add Alumni"}
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

      <SectionCard title="Find Alumni">
        <div className="grid gap-3 md:grid-cols-2">
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search by name, company, role, or skill..."
            className="w-full rounded-xl border border-[var(--border)] bg-[var(--background)] px-4 py-3 text-sm outline-none focus:border-[var(--comp-accent)]"
          />
          <div className="flex flex-wrap gap-2 pt-1">
            {batches.map((batch) => (
              <button
                key={batch}
                type="button"
                onClick={() => setBatchFilter(batch)}
                className={`inline-flex min-h-11 min-w-11 items-center justify-center rounded-full border px-4 py-1.5 text-xs font-semibold transition ${
                  batchFilter === batch
                    ? "border-[var(--comp-accent)] bg-[var(--comp-accent)] text-white"
                    : "border-[var(--border)] bg-[var(--comp-surface)] text-[var(--text-secondary)] hover:border-[var(--comp-accent)] hover:text-[var(--comp-text-primary)]"
                }`}
              >
                {batch}
              </button>
            ))}
          </div>
        </div>
      </SectionCard>

      {alumni.length === 0 ? (
        hasActiveFilters ? (
          <EmptyStateCard
            title="No alumni match your search"
            message="Try a different name, company, role, or skill — or clear your filters to see the full directory."
            icon={<SearchX size={48} strokeWidth={1.5} />}
            action={
              <button
                type="button"
                onClick={() => {
                  setSearch("");
                  setBatchFilter("All");
                }}
                className="comp-btn-primary rounded-lg px-4 py-2 text-sm font-semibold"
              >
                Clear filters
              </button>
            }
          />
        ) : (
          <EmptyStateCard
            title="No alumni in the directory yet"
            icon={<Users size={48} strokeWidth={1.5} />}
            message={
              adminMode
                ? "Add the first profile using the form above."
                : "Be the first to suggest one — an admin will review it and add it to the directory."
            }
            action={
              adminMode ? undefined : (
                <button
                  type="button"
                  onClick={focusNominationForm}
                  className="comp-btn-primary rounded-lg px-4 py-2 text-sm font-semibold"
                >
                  Suggest an alumnus
                </button>
              )
            }
          />
        )
      ) : (
        <div className="grid gap-3 lg:grid-cols-2">
          {alumni.map((item) => (
            <article key={item.id} className="dashboard-card flex flex-col justify-between p-4 md:p-5">
              <div>
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h3 className="text-base font-semibold text-[var(--comp-text-primary)]">{item.name}</h3>
                    <p className="text-xs text-[var(--text-secondary)]">
                      {item.degree} · Batch {item.batch}
                    </p>
                  </div>
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[color-mix(in_srgb,var(--comp-accent)_8%,transparent)]">
                    <span className="text-sm font-bold text-[var(--comp-text-primary)]">
                      {item.name
                        .split(" ")
                        .map((value) => value[0])
                        .join("")
                        .slice(0, 2)}
                    </span>
                  </div>
                </div>
                <div className="mt-2 text-sm text-[var(--text-secondary)]">
                  <span className="font-medium text-[var(--comp-text-primary)]">{item.role}</span> at {item.company}
                </div>
                <div className="text-xs text-[var(--text-secondary)]">{item.location}</div>
                <ContactLinks item={item} />
                {item.bio ? (
                  <p className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">{item.bio}</p>
                ) : null}
                {item.expertise.length ? (
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {item.expertise.map((skill) => (
                      <span
                        key={skill}
                        className="rounded-full bg-[color-mix(in_srgb,var(--comp-accent)_8%,transparent)] px-2.5 py-0.5 text-xs font-semibold text-[var(--comp-text-primary)]"
                      >
                        {skill}
                      </span>
                    ))}
                  </div>
                ) : null}
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                {item.requested ? (
                  <span className="rounded-full border border-[color-mix(in_srgb,var(--success)_30%,transparent)] bg-[color-mix(in_srgb,var(--success)_10%,transparent)] px-4 py-2 text-sm font-semibold text-[var(--success)]">
                    Request Sent
                  </span>
                ) : item.openToConnect ? (
                  <button
                    type="button"
                    onClick={() =>
                      void runAction(
                        () =>
                          requestAlumniConnection(item.id, {
                            message: "Interested in connecting through the university portal.",
                          }),
                        `Connection request sent to ${item.name}.`
                      )
                    }
                    className="rounded-full bg-[var(--comp-accent)] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[var(--comp-accent-hover)]"
                  >
                    Request Connect
                  </button>
                ) : (
                  <span className="rounded-full border border-[var(--comp-border)] bg-[var(--comp-surface-hover)] px-4 py-2 text-sm font-semibold text-[var(--comp-text-muted)]">
                    Not Available
                  </span>
                )}
                {adminMode && admin.unlocked ? (
                  <>
                    <button
                      type="button"
                      onClick={() => {
                        setEditingId(item.id);
                        setForm({
                          name: item.name,
                          email: item.email || "",
                          batch: item.batch,
                          degree: item.degree,
                          company: item.company,
                          role: item.role,
                          location: item.location,
                          linkedinUrl: item.linkedinUrl || "",
                          instagramUrl: item.instagramUrl || "",
                          portfolioUrl: item.portfolioUrl || "",
                          expertise: item.expertise.join(", "),
                          bio: item.bio || "",
                          openToConnect: item.openToConnect,
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
                          () => deleteAlumniProfile(item.id, admin.adminHeaders),
                          "Alumni profile deleted."
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

function ContactLinks({ item }: { item: AlumniProfile }) {
  if (!item.linkedinUrl && !item.instagramUrl && !item.portfolioUrl) return null;
  return (
    <div className="mt-2 flex items-center gap-2.5">
      {item.linkedinUrl ? (
        <a
          href={item.linkedinUrl}
          target="_blank"
          rel="noreferrer noopener"
          aria-label={`${item.name} on LinkedIn`}
          className="text-[var(--comp-text-muted)] transition hover:text-[var(--comp-accent)]"
        >
          <Linkedin className="h-4 w-4" />
        </a>
      ) : null}
      {item.instagramUrl ? (
        <a
          href={item.instagramUrl}
          target="_blank"
          rel="noreferrer noopener"
          aria-label={`${item.name} on Instagram`}
          className="text-[var(--comp-text-muted)] transition hover:text-[var(--comp-accent)]"
        >
          <Instagram className="h-4 w-4" />
        </a>
      ) : null}
      {item.portfolioUrl ? (
        <a
          href={item.portfolioUrl}
          target="_blank"
          rel="noreferrer noopener"
          aria-label={`${item.name}'s portfolio`}
          className="text-[var(--comp-text-muted)] transition hover:text-[var(--comp-accent)]"
        >
          <Globe className="h-4 w-4" />
        </a>
      ) : null}
    </div>
  );
}
