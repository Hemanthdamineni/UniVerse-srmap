import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  EmptyStateCard,
  ErpPageShell,
  KpiGrid,
  SectionCard,
  StatusBanner,
} from "../../components/erp/ErpPrimitives";
import { useAdminAccess } from "../../hooks/useAdminAccess";
import {
  createEvent,
  deleteEvent,
  listEvents,
  type EventSummary,
  updateEventApproval,
  updateEventStatus,
} from "../../lib/campusApi";
import { uploadResourceFile } from "../../lib/lmsApi";

const CATEGORIES = ["Technical", "Cultural", "Sports", "Workshop", "Seminar", "Club", "Social", "Other"] as const;
const DEPARTMENTS = ["Computer Science", "Electronics", "Mechanical", "Civil", "Biotechnology", "General"] as const;

function formatDate(value: string) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function eventLifecycleState(event: EventSummary) {
  const now = Date.now();
  const start = new Date(event.startAt || "").getTime();
  const end = new Date(event.endAt || "").getTime();
  if (Number.isFinite(start) && start > now) return "upcoming";
  if (Number.isFinite(end) && end < now) return "past";
  return "ongoing";
}

function parseCompetitionConfig(event: EventSummary) {
  const raw = (event as any).competitionConfig;
  if (!raw) return null;
  try {
    const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
    if (!parsed?.isCompetition) return null;
    return parsed;
  } catch {
    return null;
  }
}

function getCountdownLabel(dateLike?: string) {
  if (!dateLike) return "No deadline";
  const target = new Date(dateLike).getTime();
  if (!Number.isFinite(target)) return "No deadline";
  const diffMs = target - Date.now();
  if (diffMs <= 0) return "Deadline passed";
  const diffHours = Math.ceil(diffMs / (1000 * 60 * 60));
  if (diffHours < 24) return `${diffHours}h left`;
  const diffDays = Math.ceil(diffHours / 24);
  return `${diffDays}d left`;
}

export default function EventListPage({ adminMode = false }: { adminMode?: boolean }) {
  const [events, setEvents] = useState<EventSummary[]>([]);
  const [query, setQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("All");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [modeFilter, setModeFilter] = useState<string>("all");
  const [competitionOnly, setCompetitionOnly] = useState(false);
  const [loading, setLoading] = useState(true);
  const [libraryError, setLibraryError] = useState("");
  const [statusMessage, setStatusMessage] = useState<{ tone: "success" | "warning"; text: string } | null>(null);
  const [uploadingBanner, setUploadingBanner] = useState(false);
  const [uploadingAttachments, setUploadingAttachments] = useState(false);
  const [form, setForm] = useState({
    title: "",
    description: "",
    startAt: "",
    endAt: "",
    location: "",
    category: CATEGORIES[0] as string,
    department: DEPARTMENTS[0] as string,
    coverImageUrl: "",
    attachments: "",
    maxCapacity: 300,
  });
  const admin = useAdminAccess();

  const load = useCallback(async () => {
    setLoading(true);
    setLibraryError("");
    try {
      const items = await listEvents(undefined, adminMode && admin.unlocked ? admin.adminHeaders : undefined);
      setEvents(items);
    } catch (error) {
      setLibraryError(error instanceof Error ? error.message : "Failed to load events.");
    } finally {
      setLoading(false);
    }
  }, [admin.adminHeaders, admin.unlocked, adminMode]);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(() => {
    return events.filter((event) => {
      if (categoryFilter !== "All" && event.category !== categoryFilter) return false;
      if (statusFilter !== "all" && String(event.status) !== statusFilter) return false;
      const competition = parseCompetitionConfig(event);
      const type = competition ? "competition" : "event";
      if (modeFilter !== "all" && modeFilter !== type) return false;
      if (competitionOnly && !competition) return false;
      const haystack = [
        event.title,
        event.description,
        event.category,
        event.department,
        event.status,
        event.approvalStatus,
      ]
        .join(" ")
        .toLowerCase();
      if (query.trim() && !haystack.includes(query.trim().toLowerCase())) return false;
      return true;
    });
  }, [categoryFilter, competitionOnly, events, modeFilter, query, statusFilter]);

  const categories = useMemo(() => {
    return ["All", ...Array.from(new Set(events.map((event) => event.category).filter(Boolean))).sort()];
  }, [events]);

  const kpis = useMemo(() => {
    const upcoming = events.filter((event) => eventLifecycleState(event) === "upcoming").length;
    const pendingApproval = events.filter((event) => event.approvalStatus === "pending").length;
    const published = events.filter((event) => event.status === "published").length;
    return [
      { label: "Total Events", value: String(events.length) },
      { label: "Upcoming", value: String(upcoming) },
      { label: "Published", value: String(published) },
      { label: "Pending Approval", value: String(pendingApproval) },
    ];
  }, [events]);

  async function handleCreateEvent(event: React.FormEvent) {
    event.preventDefault();
    setStatusMessage(null);
    try {
      await createEvent(
        {
          title: form.title.trim(),
          description: form.description.trim(),
          startAt: form.startAt,
          endAt: form.endAt,
          department: form.department,
          category: form.category,
          visibility: "public",
          location: { physical: form.location.trim() },
          organizer: "Campus Events Desk",
          status: "published",
          coverImageUrl: form.coverImageUrl.trim(),
          maxCapacity: Number(form.maxCapacity || 0) || 300,
          attachments: form.attachments
            .split("\n")
            .map((item) => item.trim())
            .filter(Boolean)
            .map((url, idx) => ({
              title: `Attachment ${idx + 1}`,
              kind: "link",
              url_or_path: url,
            })),
        },
        admin.adminHeaders
      );
      setForm({
        title: "",
        description: "",
        startAt: "",
        endAt: "",
        location: "",
        category: CATEGORIES[0],
        department: DEPARTMENTS[0],
        coverImageUrl: "",
        attachments: "",
        maxCapacity: 300,
      });
      setStatusMessage({ tone: "success", text: "Event created and published." });
      await load();
    } catch (error) {
      setStatusMessage({
        tone: "warning",
        text: error instanceof Error ? error.message : "Failed to create event.",
      });
    }
  }

  async function runAdminAction(action: () => Promise<unknown>, successText: string) {
    setStatusMessage(null);
    try {
      await action();
      setStatusMessage({ tone: "success", text: successText });
      await load();
    } catch (error) {
      setStatusMessage({
        tone: "warning",
        text: error instanceof Error ? error.message : "Action failed.",
      });
    }
  }

  async function handleBannerUpload(file: File | null) {
    if (!file) return;
    setUploadingBanner(true);
    setStatusMessage(null);
    try {
      const uploaded = await uploadResourceFile(file);
      setForm((prev) => ({ ...prev, coverImageUrl: uploaded.url }));
      setStatusMessage({ tone: "success", text: `Banner uploaded: ${uploaded.fileName}` });
    } catch (error) {
      setStatusMessage({
        tone: "warning",
        text: error instanceof Error ? error.message : "Failed to upload banner.",
      });
    } finally {
      setUploadingBanner(false);
    }
  }

  async function handleAttachmentUploads(files: FileList | null) {
    if (!files?.length) return;
    setUploadingAttachments(true);
    setStatusMessage(null);
    try {
      const uploads = await Promise.all(Array.from(files).map((file) => uploadResourceFile(file)));
      const appended = uploads.map((item) => item.url).join("\n");
      setForm((prev) => ({
        ...prev,
        attachments: [prev.attachments.trim(), appended].filter(Boolean).join("\n"),
      }));
      setStatusMessage({ tone: "success", text: `${uploads.length} attachment(s) uploaded.` });
    } catch (error) {
      setStatusMessage({
        tone: "warning",
        text: error instanceof Error ? error.message : "Failed to upload attachments.",
      });
    } finally {
      setUploadingAttachments(false);
    }
  }

  return (
    <ErpPageShell
      title="Events Listings"
      source="Internal API"
      isLoading={loading}
      loadingMessage="Loading campus events..."
    >
      {libraryError ? <StatusBanner message={{ id: "events-error", tone: "warning", text: libraryError }} /> : null}
      {statusMessage ? (
        <StatusBanner
          message={{ id: "events-status", tone: statusMessage.tone, text: statusMessage.text }}
        />
      ) : null}

      <KpiGrid items={kpis} />

      {adminMode && admin.unlocked ? (
        <SectionCard title="Create Managed Event">
          <form onSubmit={handleCreateEvent} className="grid gap-3 md:grid-cols-2">
            <div className="md:col-span-2">
              <label htmlFor="evt-title" className="mb-1 block text-sm font-medium text-[var(--text-primary)]">
                Title
              </label>
              <input
                id="evt-title"
                value={form.title}
                onChange={(event) => setForm((prev) => ({ ...prev, title: event.target.value }))}
                required
                className="w-full rounded-xl border border-[var(--border)] bg-[var(--background)] px-4 py-3 text-sm outline-none focus:border-[#0A3035]"
              />
            </div>
            <div className="md:col-span-2">
              <label htmlFor="evt-description" className="mb-1 block text-sm font-medium text-[var(--text-primary)]">
                Description
              </label>
              <textarea
                id="evt-description"
                value={form.description}
                onChange={(event) => setForm((prev) => ({ ...prev, description: event.target.value }))}
                rows={3}
                required
                className="w-full rounded-xl border border-[var(--border)] bg-[var(--background)] px-4 py-3 text-sm outline-none focus:border-[#0A3035]"
              />
            </div>
            <div>
              <label htmlFor="evt-start" className="mb-1 block text-sm font-medium text-[var(--text-primary)]">
                Start
              </label>
              <input
                id="evt-start"
                type="datetime-local"
                value={form.startAt}
                onChange={(event) => setForm((prev) => ({ ...prev, startAt: event.target.value }))}
                required
                className="w-full rounded-xl border border-[var(--border)] bg-[var(--background)] px-4 py-3 text-sm outline-none focus:border-[#0A3035]"
              />
            </div>
            <div>
              <label htmlFor="evt-end" className="mb-1 block text-sm font-medium text-[var(--text-primary)]">
                End
              </label>
              <input
                id="evt-end"
                type="datetime-local"
                value={form.endAt}
                onChange={(event) => setForm((prev) => ({ ...prev, endAt: event.target.value }))}
                required
                className="w-full rounded-xl border border-[var(--border)] bg-[var(--background)] px-4 py-3 text-sm outline-none focus:border-[#0A3035]"
              />
            </div>
            <div>
              <label htmlFor="evt-category" className="mb-1 block text-sm font-medium text-[var(--text-primary)]">
                Category
              </label>
              <select
                id="evt-category"
                value={form.category}
                onChange={(event) => setForm((prev) => ({ ...prev, category: event.target.value }))}
                className="w-full rounded-xl border border-[var(--border)] bg-[var(--background)] px-4 py-3 text-sm outline-none focus:border-[#0A3035]"
              >
                {CATEGORIES.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="evt-department" className="mb-1 block text-sm font-medium text-[var(--text-primary)]">
                Department
              </label>
              <select
                id="evt-department"
                value={form.department}
                onChange={(event) => setForm((prev) => ({ ...prev, department: event.target.value }))}
                className="w-full rounded-xl border border-[var(--border)] bg-[var(--background)] px-4 py-3 text-sm outline-none focus:border-[#0A3035]"
              >
                {DEPARTMENTS.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </div>
            <div className="md:col-span-2">
              <label htmlFor="evt-location" className="mb-1 block text-sm font-medium text-[var(--text-primary)]">
                Venue
              </label>
              <input
                id="evt-location"
                value={form.location}
                onChange={(event) => setForm((prev) => ({ ...prev, location: event.target.value }))}
                required
                className="w-full rounded-xl border border-[var(--border)] bg-[var(--background)] px-4 py-3 text-sm outline-none focus:border-[#0A3035]"
              />
            </div>
            <div>
              <label htmlFor="evt-capacity" className="mb-1 block text-sm font-medium text-[var(--text-primary)]">
                Max RSVPs
              </label>
              <input
                id="evt-capacity"
                type="number"
                min={1}
                value={form.maxCapacity}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, maxCapacity: Number(event.target.value || 1) }))
                }
                className="w-full rounded-xl border border-[var(--border)] bg-[var(--background)] px-4 py-3 text-sm outline-none focus:border-[#0A3035]"
              />
            </div>
            <div>
              <label htmlFor="evt-banner" className="mb-1 block text-sm font-medium text-[var(--text-primary)]">
                Banner Image URL
              </label>
              <input
                id="evt-banner"
                value={form.coverImageUrl}
                onChange={(event) => setForm((prev) => ({ ...prev, coverImageUrl: event.target.value }))}
                placeholder="https://.../banner.jpg"
                className="w-full rounded-xl border border-[var(--border)] bg-[var(--background)] px-4 py-3 text-sm outline-none focus:border-[#0A3035]"
              />
              <label className="mt-2 block text-xs text-[var(--text-secondary)]">Or upload banner image</label>
              <input
                type="file"
                accept="image/*"
                className="mt-1 block w-full rounded-xl border border-[var(--border)] bg-[var(--background)] px-4 py-2 text-sm"
                onChange={(event) => void handleBannerUpload(event.target.files?.[0] || null)}
              />
              {uploadingBanner ? <p className="mt-1 text-xs text-[var(--text-secondary)]">Uploading...</p> : null}
            </div>
            <div className="md:col-span-2">
              <label htmlFor="evt-attachments" className="mb-1 block text-sm font-medium text-[var(--text-primary)]">
                Docs / Links (one URL per line)
              </label>
              <textarea
                id="evt-attachments"
                value={form.attachments}
                onChange={(event) => setForm((prev) => ({ ...prev, attachments: event.target.value }))}
                rows={3}
                placeholder="https://.../brochure.pdf&#10;https://.../rules.docx"
                className="w-full rounded-xl border border-[var(--border)] bg-[var(--background)] px-4 py-3 text-sm outline-none focus:border-[#0A3035]"
              />
              <label className="mt-2 block text-xs text-[var(--text-secondary)]">
                Or upload files (URLs will be auto-added)
              </label>
              <input
                type="file"
                multiple
                className="mt-1 block w-full rounded-xl border border-[var(--border)] bg-[var(--background)] px-4 py-2 text-sm"
                onChange={(event) => void handleAttachmentUploads(event.target.files)}
              />
              {uploadingAttachments ? (
                <p className="mt-1 text-xs text-[var(--text-secondary)]">Uploading attachments...</p>
              ) : null}
            </div>
            <div className="md:col-span-2">
              <button
                type="submit"
                className="rounded-full bg-[#0A3035] px-6 py-2.5 text-sm font-semibold text-white transition hover:bg-[#124850]"
              >
                Publish Event
              </button>
            </div>
          </form>
        </SectionCard>
      ) : null}

      <SectionCard title="Browse Events">
        <div className="grid gap-3 md:grid-cols-2">
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search by title, description, category, or status..."
            className="w-full rounded-xl border border-[var(--border)] bg-[var(--background)] px-4 py-3 text-sm outline-none focus:border-[#0A3035]"
          />
          <div className="flex flex-wrap gap-2">
            {categories.map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => setCategoryFilter(item)}
                className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                  categoryFilter === item
                    ? "border-[#0A3035] bg-[#0A3035] text-white"
                    : "border-[var(--border)] bg-white text-[var(--text-secondary)] hover:border-[#0A3035] hover:text-[#0A3035]"
                }`}
              >
                {item}
              </button>
            ))}
          </div>
        </div>
        <div className="mt-3 grid gap-3 md:grid-cols-3">
          <select
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value)}
            className="rounded-xl border border-[var(--border)] bg-[var(--background)] px-4 py-3 text-sm"
          >
            <option value="all">All status</option>
            <option value="draft">Draft</option>
            <option value="published">Published</option>
            <option value="archived">Archived</option>
          </select>
          <select
            value={modeFilter}
            onChange={(event) => setModeFilter(event.target.value)}
            className="rounded-xl border border-[var(--border)] bg-[var(--background)] px-4 py-3 text-sm"
          >
            <option value="all">All type</option>
            <option value="event">Regular Event</option>
            <option value="competition">Competition</option>
          </select>
          <label className="inline-flex items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--background)] px-4 py-3 text-sm">
            <input
              type="checkbox"
              checked={competitionOnly}
              onChange={(event) => setCompetitionOnly(event.target.checked)}
            />
            Competition only
          </label>
        </div>
      </SectionCard>

      {filtered.length === 0 ? (
        <EmptyStateCard message="No events match the current filters." />
      ) : (
        <div className="grid gap-3 lg:grid-cols-2">
          {filtered.map((event) => {
            const lifecycle = eventLifecycleState(event);
            const competition = parseCompetitionConfig(event);
            const rounds = Array.isArray(competition?.rounds) ? competition.rounds : [];
            const activeRound = rounds.find((round: any) => !round.resultsPublished) || rounds[0];
            return (
              <article key={event.id} className="dashboard-card flex flex-col justify-between p-4 md:p-5">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full bg-[#0A3035]/8 px-2.5 py-0.5 text-xs font-semibold text-[#0A3035]">
                      {event.category || "Event"}
                    </span>
                    <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-0.5 text-xs font-bold text-slate-700">
                      {event.status}
                    </span>
                    {event.approvalStatus ? (
                      <span className="rounded-full border border-amber-200 bg-amber-50 px-2.5 py-0.5 text-xs font-bold text-amber-800">
                        Approval: {event.approvalStatus}
                      </span>
                    ) : null}
                    <span className="rounded-full border border-blue-200 bg-blue-50 px-2.5 py-0.5 text-xs font-bold text-blue-800">
                      {lifecycle}
                    </span>
                    {competition ? (
                      <span className="rounded-full border border-violet-200 bg-violet-50 px-2.5 py-0.5 text-xs font-bold text-violet-800">
                        Competition
                      </span>
                    ) : null}
                  </div>
                  <h3 className="mt-2 text-base font-semibold text-[#0A3035]">
                    {event.title || "Untitled Event"}
                  </h3>
                  <p className="mt-1 line-clamp-3 text-sm leading-6 text-[var(--text-secondary)]">
                    {event.description || "No description provided."}
                  </p>
                  <div className="mt-3 grid gap-1 text-xs text-[var(--text-secondary)]">
                    <div>Starts: {formatDate(event.startAt)}</div>
                    <div>Venue: {event.location?.physical || event.venue || "TBA"}</div>
                    <div>Department: {event.department || "General"}</div>
                    <div>Registrations: {event.registeredCount ?? 0}</div>
                    {competition ? <div>Round deadline: {getCountdownLabel(activeRound?.submissionDeadline)}</div> : null}
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  <Link
                    to={
                      adminMode
                        ? `/admin/events-management/${encodeURIComponent(event.id)}`
                        : `/events/listings/${encodeURIComponent(event.id)}`
                    }
                    className="rounded-full bg-[#0A3035] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#124850]"
                  >
                    View Details
                  </Link>

                  {adminMode && admin.unlocked ? (
                    <>
                      {event.approvalStatus === "pending" ? (
                        <>
                          <button
                            type="button"
                            onClick={() =>
                              void runAdminAction(
                                () =>
                                  updateEventApproval(
                                    event.id,
                                    { approved: true, notes: "Approved by campus admin" },
                                    admin.adminHeaders
                                  ),
                                `Approved "${event.title}".`
                              )
                            }
                            className="rounded-full border border-emerald-300 px-3 py-2 text-xs font-semibold text-emerald-700 transition hover:bg-emerald-50"
                          >
                            Approve
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              void runAdminAction(
                                () =>
                                  updateEventApproval(
                                    event.id,
                                    { approved: false, notes: "Rejected by campus admin" },
                                    admin.adminHeaders
                                  ),
                                `Rejected "${event.title}".`
                              )
                            }
                            className="rounded-full border border-amber-300 px-3 py-2 text-xs font-semibold text-amber-700 transition hover:bg-amber-50"
                          >
                            Reject
                          </button>
                        </>
                      ) : null}

                      <button
                        type="button"
                        onClick={() =>
                          void runAdminAction(
                            () =>
                              updateEventStatus(
                                event.id,
                                { status: event.status === "published" ? "archived" : "published" },
                                admin.adminHeaders
                              ),
                            event.status === "published"
                              ? `Archived "${event.title}".`
                              : `Published "${event.title}".`
                          )
                        }
                        className="rounded-full border border-blue-300 px-3 py-2 text-xs font-semibold text-blue-700 transition hover:bg-blue-50"
                      >
                        {event.status === "published" ? "Archive" : "Publish"}
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          void runAdminAction(
                            () => deleteEvent(event.id, admin.adminHeaders),
                            `Deleted "${event.title}".`
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
            );
          })}
        </div>
      )}
    </ErpPageShell>
  );
}
