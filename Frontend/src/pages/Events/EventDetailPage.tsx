import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ErpPageShell, SectionCard, StatusBanner } from "../../components/erp/ErpPrimitives";
import { getStoredAdminPassword } from "../../lib/adminApi";
import {
  cancelEventRegistration,
  deleteEvent,
  getEvent,
  registerForEvent,
  sendEventMessage,
  type EventDetail,
  updateEventApproval,
  updateEventStatus,
} from "../../lib/campusApi";
import { useAdminAccess } from "../../hooks/useAdminAccess";

function formatDate(value: string) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("en-IN", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function parseCompetitionConfig(raw: unknown) {
  if (!raw) return null;
  try {
    const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
    if (!parsed || typeof parsed !== "object" || !parsed.isCompetition) return null;
    const rounds = Array.isArray(parsed.rounds) ? parsed.rounds : [];
    return { ...parsed, rounds };
  } catch {
    return null;
  }
}

export default function EventDetailPage({ adminMode = false }: { adminMode?: boolean }) {
  const { eventId = "" } = useParams();
  const navigate = useNavigate();
  const admin = useAdminAccess();
  const [event, setEvent] = useState<EventDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [banner, setBanner] = useState<{ tone: "success" | "warning"; text: string } | null>(null);
  const [messageForm, setMessageForm] = useState({ subject: "", message: "" });

  async function load() {
    if (!eventId) return;
    setLoading(true);
    try {
      const nextEvent = await getEvent(eventId, adminMode && admin.unlocked ? admin.adminHeaders : undefined);
      setEvent(nextEvent);
    } catch (error) {
      setBanner({
        tone: "warning",
        text: error instanceof Error ? error.message : "Failed to load event details.",
      });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, [admin.adminHeaders, admin.unlocked, adminMode, eventId]);

  async function runAction(action: () => Promise<unknown>, successText: string, redirect = false) {
    setBusy(true);
    setBanner(null);
    try {
      await action();
      setBanner({ tone: "success", text: successText });
      if (redirect) {
        navigate("/events/listings");
        return;
      }
      await load();
    } catch (error) {
      setBanner({
        tone: "warning",
        text: error instanceof Error ? error.message : "Action failed.",
      });
    } finally {
      setBusy(false);
    }
  }

  const attendeeExportHref =
    adminMode && admin.unlocked && eventId
      ? `/api/events/${encodeURIComponent(eventId)}/attendees.csv?adminPassword=${encodeURIComponent(
          getStoredAdminPassword()
        )}`
      : "";
  const competitionConfig = parseCompetitionConfig((event as any)?.competitionConfig);
  const rounds = Array.isArray(competitionConfig?.rounds) ? competitionConfig.rounds : [];
  const activeRound = rounds.find((round: any) => !round.resultsPublished) || rounds[0] || null;

  return (
    <ErpPageShell
      title="Event Details"
      source="Internal API"
      isLoading={loading}
      loadingMessage="Loading event details..."
    >
      <div className="flex items-center justify-between">
        <Link
          to={adminMode ? "/admin/events-management" : "/events/listings"}
          className="rounded-full border border-[var(--border)] px-3 py-1.5 text-xs font-semibold text-[var(--text-secondary)] transition hover:border-[var(--comp-accent)] hover:text-[var(--comp-text-primary)]"
        >
          Back to Events
        </Link>
      </div>

      {banner ? <StatusBanner message={{ id: "event-banner", tone: banner.tone, text: banner.text }} /> : null}

      {event ? (
        <>
          <SectionCard title={event.title || "Untitled Event"}>
            <div className="space-y-4">
              <div className="flex flex-wrap gap-2">
                {event.category ? (
                  <span className="rounded-full bg-[color-mix(in_srgb,var(--comp-accent)_8%,transparent)] px-3 py-1 text-xs font-semibold text-[var(--comp-text-primary)]">
                    {event.category}
                  </span>
                ) : null}
                <span className="rounded-full border border-[var(--comp-border)] bg-[var(--comp-surface-hover)] px-3 py-1 text-xs font-bold text-[var(--comp-text-secondary)]">
                  {event.status}
                </span>
                {event.approvalStatus ? (
                  <span className="rounded-full border border-[color-mix(in_srgb,var(--warning)_30%,transparent)] bg-[color-mix(in_srgb,var(--warning)_10%,transparent)] px-3 py-1 text-xs font-bold text-[var(--warning)]">
                    Approval: {event.approvalStatus}
                  </span>
                ) : null}
                {event.department ? (
                  <span className="rounded-full border border-[var(--border)] px-3 py-1 text-xs font-semibold text-[var(--text-secondary)]">
                    {event.department}
                  </span>
                ) : null}
              </div>

              <p className="text-sm leading-7 text-[var(--text-secondary)]">
                {event.description || "No description provided."}
              </p>
              {String((event as any).coverImageUrl || "").trim() ? (
                <div className="overflow-hidden rounded-2xl border border-[var(--border)] bg-white">
                  <img
                    src={String((event as any).coverImageUrl)}
                    alt={`${event.title} banner`}
                    className="h-56 w-full object-cover"
                  />
                </div>
              ) : null}

              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <div className="rounded-2xl border border-[var(--border)] bg-white p-4">
                  <p className="text-xs text-[var(--text-secondary)]">Starts</p>
                  <p className="mt-1 text-sm font-semibold text-[var(--comp-text-primary)]">{formatDate(event.startAt)}</p>
                </div>
                <div className="rounded-2xl border border-[var(--border)] bg-white p-4">
                  <p className="text-xs text-[var(--text-secondary)]">Ends</p>
                  <p className="mt-1 text-sm font-semibold text-[var(--comp-text-primary)]">{formatDate(event.endAt)}</p>
                </div>
                <div className="rounded-2xl border border-[var(--border)] bg-white p-4">
                  <p className="text-xs text-[var(--text-secondary)]">Venue</p>
                  <p className="mt-1 text-sm font-semibold text-[var(--comp-text-primary)]">
                    {event.location?.physical || event.venue || "TBA"}
                  </p>
                </div>
                <div className="rounded-2xl border border-[var(--border)] bg-white p-4">
                  <p className="text-xs text-[var(--text-secondary)]">RSVPs</p>
                  <p className="mt-1 text-sm font-semibold text-[var(--comp-text-primary)]">
                    {event.registeredCount ?? event.registrations?.length ?? 0}
                  </p>
                  <p className="mt-1 text-xs text-[var(--text-secondary)]">
                    Seats left: {event.seatsAvailable ?? "N/A"}
                  </p>
                </div>
              </div>

              {Array.isArray((event as any).attachments) && (event as any).attachments.length > 0 ? (
                <div className="rounded-2xl border border-[var(--border)] bg-white p-4">
                  <h3 className="text-sm font-semibold text-[var(--comp-text-primary)]">Event Resources</h3>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {(event as any).attachments.map((attachment: any, idx: number) => {
                      const url = String(attachment?.url_or_path || attachment?.url || "").trim();
                      if (!url) return null;
                      return (
                        <a
                          key={`${url}-${idx}`}
                          href={url}
                          target="_blank"
                          rel="noreferrer"
                          className="rounded-full border border-[var(--border)] bg-[var(--comp-surface-hover)] px-3 py-1.5 text-xs font-semibold text-[var(--comp-text-primary)] hover:border-[var(--comp-accent)]"
                        >
                          Open {attachment?.title || `Resource ${idx + 1}`}
                        </a>
                      );
                    })}
                  </div>
                </div>
              ) : null}

              {!adminMode ? (
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() =>
                      void runAction(() => registerForEvent(event.id), "Registered for the event successfully.")
                    }
                    className="rounded-full bg-[var(--comp-accent)] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[var(--comp-accent-hover)] disabled:opacity-50"
                  >
                    Register for Event
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() =>
                      void runAction(
                        () => cancelEventRegistration(event.id),
                        "Registration cancelled successfully."
                      )
                    }
                    className="rounded-full border border-[var(--border)] px-5 py-2.5 text-sm font-semibold text-[var(--text-secondary)] transition hover:border-rose-300 hover:text-rose-700 disabled:opacity-50"
                  >
                    Cancel Registration
                  </button>
                  {event.calendar?.icalUrl ? (
                    <a
                      href={event.calendar.icalUrl}
                      className="rounded-full border border-[color-mix(in_srgb,var(--info)_30%,transparent)] px-5 py-2.5 text-sm font-semibold text-[var(--info)] transition hover:bg-[color-mix(in_srgb,var(--info)_10%,transparent)]"
                    >
                      Add to Calendar
                    </a>
                  ) : null}
                  {activeRound?.roundId ? (
                    <>
                      <Link
                        to={`/events/${encodeURIComponent(event.id)}/submit/${encodeURIComponent(activeRound.roundId)}`}
                        className="rounded-full border border-[color-mix(in_srgb,var(--success)_30%,transparent)] px-5 py-2.5 text-sm font-semibold text-[var(--success)] transition hover:bg-[color-mix(in_srgb,var(--success)_10%,transparent)]"
                      >
                        Submit Work ({activeRound.title || activeRound.roundId})
                      </Link>
                      <Link
                        to={`/events/${encodeURIComponent(event.id)}/my-results/${encodeURIComponent(activeRound.roundId)}`}
                        className="rounded-full border border-indigo-300 px-5 py-2.5 text-sm font-semibold text-indigo-700 transition hover:bg-indigo-50"
                      >
                        View My Results
                      </Link>
                    </>
                  ) : null}
                </div>
              ) : null}
            </div>
          </SectionCard>

          {competitionConfig ? (
            <>
              <SectionCard title="Rounds">
                {competitionConfig?.submissionScope === "team" ? (
                  <div className="mb-3 flex flex-wrap gap-2">
                    <Link
                      to={`/events/${encodeURIComponent(event.id)}/team`}
                      className="rounded-full border border-[var(--border)] px-3 py-1 text-xs font-semibold text-[var(--comp-text-primary)]"
                    >
                      My Team
                    </Link>
                    <Link
                      to={`/events/${encodeURIComponent(event.id)}/invitations`}
                      className="rounded-full border border-[var(--border)] px-3 py-1 text-xs font-semibold text-[var(--comp-text-primary)]"
                    >
                      My Invitations
                    </Link>
                  </div>
                ) : null}
                <div className="space-y-3">
                  {rounds.map((round: any) => {
                    const blockedBy = round.requiresShortlistFromRound
                      ? `Requires shortlist from ${round.requiresShortlistFromRound}`
                      : "Open to registered participants";
                    return (
                      <div key={round.roundId} className="rounded-2xl border border-[var(--border)] p-4">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <h3 className="text-sm font-semibold text-[var(--comp-text-primary)]">{round.title || round.roundId}</h3>
                          <span className="text-xs text-[var(--text-secondary)]">
                            {round.resultsPublished ? "Published" : "In Progress"}
                          </span>
                        </div>
                        <p className="mt-2 text-xs text-[var(--text-secondary)]">{blockedBy}</p>
                        <p className="mt-1 text-xs text-[var(--text-secondary)]">
                          Deadline: {round.submissionDeadline ? formatDate(round.submissionDeadline) : "N/A"}
                        </p>
                        <div className="mt-3 flex flex-wrap gap-2">
                          <Link
                            to={`/events/${encodeURIComponent(event.id)}/submit/${encodeURIComponent(round.roundId)}`}
                            className="rounded-full border border-[color-mix(in_srgb,var(--success)_30%,transparent)] px-3 py-1 text-xs font-semibold text-[var(--success)]"
                          >
                            Submit
                          </Link>
                          <Link
                            to={`/events/${encodeURIComponent(event.id)}/my-results/${encodeURIComponent(round.roundId)}`}
                            className="rounded-full border border-indigo-300 px-3 py-1 text-xs font-semibold text-indigo-700"
                          >
                            My Result
                          </Link>
                          {round.resultsPublished ? (
                            <Link
                              to={`/events/${encodeURIComponent(event.id)}/rounds/${encodeURIComponent(round.roundId)}/leaderboard`}
                              className="rounded-full border border-violet-300 px-3 py-1 text-xs font-semibold text-violet-700"
                            >
                              Leaderboard
                            </Link>
                          ) : null}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </SectionCard>

              <SectionCard title="Prizes">
                <p className="text-sm text-[var(--text-secondary)]">{String((event as any).prizes || "Not specified.")}</p>
              </SectionCard>
              <SectionCard title="Rules">
                <p className="text-sm text-[var(--text-secondary)]">{String((event as any).rules || "Not specified.")}</p>
              </SectionCard>
              <SectionCard title="Timeline">
                <ul className="space-y-1 text-sm text-[var(--text-secondary)]">
                  <li>Start: {formatDate(event.startAt)}</li>
                  <li>End: {formatDate(event.endAt)}</li>
                  {rounds.map((round: any) => (
                    <li key={`${round.roundId}-timeline`}>
                      {round.title || round.roundId}: {round.submissionDeadline ? formatDate(round.submissionDeadline) : "No deadline"}
                    </li>
                  ))}
                </ul>
              </SectionCard>
              <SectionCard title="Eligibility">
                <p className="text-sm text-[var(--text-secondary)]">{String((event as any).eligibility || "Not specified.")}</p>
              </SectionCard>
              <SectionCard title="FAQ">
                {Array.isArray((event as any).faq) && (event as any).faq.length > 0 ? (
                  <ul className="list-disc space-y-1 pl-5 text-sm text-[var(--text-secondary)]">
                    {(event as any).faq.map((item: string, idx: number) => <li key={`${item}-${idx}`}>{item}</li>)}
                  </ul>
                ) : (
                  <p className="text-sm text-[var(--text-secondary)]">No FAQs yet.</p>
                )}
              </SectionCard>
            </>
          ) : null}

          {adminMode && admin.unlocked ? (
            <SectionCard title="Moderation Actions">
              <div className="flex flex-wrap gap-2">
                {activeRound?.roundId ? (
                  <Link
                    to={`/events/${encodeURIComponent(event.id)}/manage`}
                    className="rounded-full border border-[var(--border)] px-4 py-2 text-sm font-semibold text-[var(--text-secondary)] transition hover:border-[var(--comp-accent)] hover:text-[var(--comp-text-primary)]"
                  >
                    Open Competition Dashboard
                  </Link>
                ) : null}
                {event.approvalStatus === "pending" ? (
                  <>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() =>
                        void runAction(
                          () =>
                            updateEventApproval(
                              event.id,
                              { approved: true, notes: "Approved from event detail view" },
                              admin.adminHeaders
                            ),
                          "Event approved."
                        )
                      }
                      className="rounded-full border border-[color-mix(in_srgb,var(--success)_30%,transparent)] px-4 py-2 text-sm font-semibold text-[var(--success)] transition hover:bg-[color-mix(in_srgb,var(--success)_10%,transparent)] disabled:opacity-50"
                    >
                      Approve Event
                    </button>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() =>
                        void runAction(
                          () =>
                            updateEventApproval(
                              event.id,
                              { approved: false, notes: "Rejected from event detail view" },
                              admin.adminHeaders
                            ),
                          "Event rejected."
                        )
                      }
                      className="rounded-full border border-[color-mix(in_srgb,var(--warning)_30%,transparent)] px-4 py-2 text-sm font-semibold text-[var(--warning)] transition hover:bg-[color-mix(in_srgb,var(--warning)_10%,transparent)] disabled:opacity-50"
                    >
                      Reject Event
                    </button>
                  </>
                ) : null}

                <button
                  type="button"
                  disabled={busy}
                  onClick={() =>
                    void runAction(
                      () =>
                        updateEventStatus(
                          event.id,
                          { status: event.status === "published" ? "archived" : "published" },
                          admin.adminHeaders
                        ),
                      event.status === "published" ? "Event archived." : "Event published."
                    )
                  }
                  className="rounded-full border border-[color-mix(in_srgb,var(--info)_30%,transparent)] px-4 py-2 text-sm font-semibold text-[var(--info)] transition hover:bg-[color-mix(in_srgb,var(--info)_10%,transparent)] disabled:opacity-50"
                >
                  {event.status === "published" ? "Archive Event" : "Publish Event"}
                </button>

                <button
                  type="button"
                  disabled={busy}
                  onClick={() =>
                    void runAction(() => deleteEvent(event.id, admin.adminHeaders), "Event deleted.", true)
                  }
                  className="rounded-full border border-rose-300 px-4 py-2 text-sm font-semibold text-rose-700 transition hover:bg-rose-50 disabled:opacity-50"
                >
                  Delete Event
                </button>

                {attendeeExportHref ? (
                  <a
                    href={attendeeExportHref}
                    className="rounded-full border border-[var(--comp-border)] px-4 py-2 text-sm font-semibold text-[var(--comp-text-secondary)] transition hover:bg-[var(--comp-surface-hover)]"
                  >
                    Export Attendees CSV
                  </a>
                ) : null}
              </div>

              <div className="mt-4 grid gap-3 md:grid-cols-2">
                <div className="rounded-2xl border border-[var(--border)] bg-[var(--comp-surface-hover)] p-4">
                  <h3 className="text-sm font-semibold text-[var(--comp-text-primary)]">Attendee Messaging</h3>
                  <div className="mt-3 space-y-3">
                    <input
                      value={messageForm.subject}
                      onChange={(currentEvent) =>
                        setMessageForm((prev) => ({ ...prev, subject: currentEvent.target.value }))
                      }
                      placeholder="Message subject"
                      className="w-full rounded-xl border border-[var(--border)] bg-white px-4 py-3 text-sm outline-none focus:border-[var(--comp-accent)]"
                    />
                    <textarea
                      value={messageForm.message}
                      onChange={(currentEvent) =>
                        setMessageForm((prev) => ({ ...prev, message: currentEvent.target.value }))
                      }
                      rows={4}
                      placeholder="Announcement for all registered attendees..."
                      className="w-full rounded-xl border border-[var(--border)] bg-white px-4 py-3 text-sm outline-none focus:border-[var(--comp-accent)]"
                    />
                    <button
                      type="button"
                      disabled={busy || !messageForm.subject.trim() || !messageForm.message.trim()}
                      onClick={() =>
                        void runAction(
                          () =>
                            sendEventMessage(
                              event.id,
                              {
                                subject: messageForm.subject.trim(),
                                message: messageForm.message.trim(),
                              },
                              admin.adminHeaders
                            ),
                          "Attendee message queued."
                        ).then(() => setMessageForm({ subject: "", message: "" }))
                      }
                      className="rounded-full bg-[var(--comp-accent)] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[var(--comp-accent-hover)] disabled:opacity-50"
                    >
                      Send Message
                    </button>
                  </div>
                </div>

                <div className="rounded-2xl border border-[var(--border)] bg-[var(--comp-surface-hover)] p-4">
                  <h3 className="text-sm font-semibold text-[var(--comp-text-primary)]">Event Snapshot</h3>
                  <div className="mt-3 space-y-2 text-sm text-[var(--text-secondary)]">
                    <p>Approval state: {event.approvalStatus || "not required"}</p>
                    <p>Registered attendees: {event.registrations?.length ?? event.registeredCount ?? 0}</p>
                    <p>Feedback entries: {event.feedback?.length ?? 0}</p>
                    <p>Gallery items: {event.gallery?.length ?? 0}</p>
                  </div>
                </div>
              </div>
            </SectionCard>
          ) : null}
        </>
      ) : null}
    </ErpPageShell>
  );
}
