/**
 * OrganizerDashboard.tsx — Enhanced with SummaryStatBar, RoundStatusCard, AuditHistoryPanel,
 * and OrganizerGuard from shared components.
 */

import { GraduationCap } from "lucide-react";
import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { SectionCard } from '../../components/erp/ErpPrimitives';
import { CompetitionPageShell } from '../../components/competition/CompetitionChrome';
import {
  generateRoundCertificates,
  getCompetitionAnalytics,
  getCompetitionConfig,
  getCompetitionSubmissions,
  getEvent,
  sendCompetitionAnnouncement,
  updateEventCoOrganizers,
} from '../../lib/campus/campusApi';
import { SummaryStatBar } from '../../components/competition/SummaryStatBar';
import { ErrorMessage } from '../../components/competition/ErrorMessage';
import type { EventDetail, CompetitionConfig } from '../../lib/campus/campusApi';
import { Input } from '../../components/input';
import { Textarea } from '../../components/textarea';

export default function OrganizerDashboard() {
  const { eventId = '' } = useParams();
  const [event, setEvent] = useState<EventDetail | null>(null);
  const [config, setConfig] = useState<CompetitionConfig | null>(null);
  const [rowsByRound, setRowsByRound] = useState<Record<string, unknown[]>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notCompetition, setNotCompetition] = useState(false);
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [notice, setNotice] = useState<{ tone: 'success' | 'warning'; text: string } | null>(null);
  const [analytics, setAnalytics] = useState<{ registrations: number; rounds: Array<{ roundId: string; title: string; submissions: number; submissionRate: number; evaluationCompletion: number; averageTimeToEvaluateMs: number | null }> } | null>(null);
  const [coOrganizersInput, setCoOrganizersInput] = useState('');
  const teamScoped = config?.submissionScope === 'team';

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError('');
      setNotCompetition(false);
      setNotice(null);
      try {
        const [eventData, configData] = await Promise.all([
          getEvent(eventId),
          getCompetitionConfig(eventId),
        ]);
        const analyticsData = await getCompetitionAnalytics(eventId);
        const roundRows = await Promise.all(
          (configData.rounds || []).map(async (round) => {
            const rows = await getCompetitionSubmissions(eventId, round.roundId);
            return [round.roundId, rows] as const;
          })
        );
        if (!cancelled) {
          setEvent(eventData);
          setConfig(configData);
          setRowsByRound(Object.fromEntries(roundRows));
          setAnalytics(analyticsData);
          const coOrgs = (eventData as Record<string, unknown>).coOrganizers;
          setCoOrganizersInput(Array.isArray(coOrgs) ? (coOrgs as string[]).join(', ') : '');
        }
      } catch (err) {
        if (!cancelled) {
          const msg = err instanceof Error ? err.message : 'Failed to load dashboard.';
          if (msg.toLowerCase().includes('competition config not found')) {
            setNotCompetition(true);
          } else {
            setError(msg);
          }
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => { cancelled = true; };
  }, [eventId]);

  const stats = useMemo(() => {
    const registrations = Number(event?.registeredCount ?? (event?.registrations as unknown[])?.length ?? 0);
    const allRows = Object.values(rowsByRound).flat();
    const submissions = allRows.length;
    const evaluated = (allRows as Array<{ totalScore?: number }>).filter((row) => typeof row.totalScore === 'number').length;
    const published = (config?.rounds ?? []).filter((r) => r.resultsPublished).length;
    return [
      { label: 'Registrations', value: registrations },
      { label: teamScoped ? 'Teams submitted' : 'Submissions', value: submissions, color: submissions > 0 ? 'var(--comp-accent)' : undefined },
      { label: 'Evaluations done', value: evaluated, color: evaluated >= submissions && submissions > 0 ? 'var(--status-open-text)' : undefined },
      { label: 'Rounds published', value: published },
    ];
  }, [config?.rounds, event, rowsByRound, teamScoped]);

  async function onSendAnnouncement() {
    if (!subject.trim() || !message.trim()) return;
    setSending(true);
    setNotice(null);
    try {
      const result = await sendCompetitionAnnouncement(eventId, { subject: subject.trim(), message: message.trim() });
      setNotice({ tone: 'success', text: `Announcement sent to ${result.sentCount} participant(s).` });
      setSubject('');
      setMessage('');
    } catch (err) {
      setNotice({ tone: 'warning', text: err instanceof Error ? err.message : 'Failed to send announcement.' });
    } finally {
      setSending(false);
    }
  }

  return (
    <CompetitionPageShell
      title="Organizer Dashboard"
      subtitle="Monitor registrations, submissions, announcements, and publishing readiness."
      actions={<Link className="comp-btn-primary" to="/events/create">Create New Event</Link>}
      variant="wide"
    >
      <div className="space-y-6">

        {/* Back link */}
        <Link to={`/events/${encodeURIComponent(eventId)}`} className="text-xs text-[var(--text-secondary)] no-underline">
          ← Back to Event
        </Link>

        {error && <ErrorMessage title="Error" message={error} />}
        {notCompetition && (
          <ErrorMessage
            title="Not a competition"
            message="This event is not configured as a competition. Use the event creation flow to add competition settings."
          />
        )}
        {notice && (
          <div
            role="status"
            className={`rounded-xl border px-3 py-2 text-sm font-medium ${
              notice.tone === 'success'
                ? 'border-[var(--status-open-border)] bg-[var(--status-open-bg)] text-[var(--status-open-text)]'
                : 'border-[var(--status-live-border)] bg-[var(--status-live-bg)] text-[var(--status-live-text)]'
            }`}
          >
            {notice.text}
          </div>
        )}

        {/* Stats */}
        <SummaryStatBar stats={stats} />

        {/* Analytics */}
        <SectionCard title="Round Analytics">
          <div className="space-y-2">
            {(analytics?.rounds ?? []).map((row) => (
              <div key={row.roundId} className="rounded-xl border border-[var(--border)] bg-[var(--dash-subcard-bg)] p-4">
                <p className="comp-heading-md mb-1 mt-0">{row.title}</p>
                <div className="flex flex-wrap gap-4">
                  <span className="comp-body">Submission rate: <strong>{row.submissionRate}%</strong></span>
                  <span className="comp-body">Evaluation: <strong>{row.evaluationCompletion}%</strong></span>
                  <span className="comp-body">
                    Avg eval time: <strong>
                      {typeof row.averageTimeToEvaluateMs === 'number' ? `${Math.round(row.averageTimeToEvaluateMs / 60000)} min` : 'N/A'}
                    </strong>
                  </span>
                </div>
              </div>
            ))}
          </div>
        </SectionCard>

        {/* Co-organizers */}
        <SectionCard title="Co-organizers">
          <div className="space-y-2">
            <label className="comp-label" htmlFor="co-orgs">Add by register number, comma-separated</label>
            <Input
              id="co-orgs"
              value={coOrganizersInput}
              onChange={(e) => setCoOrganizersInput(e.target.value)}
              placeholder="e.g. 21CS001, 21CS002"
              aria-label="Co-organizer register numbers"
            />
            <button
              className="comp-btn-ghost w-fit"
              onClick={() =>
                void updateEventCoOrganizers(
                  eventId,
                  coOrganizersInput.split(',').map((s) => s.trim()).filter(Boolean)
                )
                  .then(() => setNotice({ tone: 'success', text: 'Co-organizers updated.' }))
                  .catch((err: unknown) =>
                    setNotice({ tone: 'warning', text: err instanceof Error ? err.message : 'Failed to update co-organizers.' })
                  )
              }
              aria-label="Save co-organizers"
            >
              Save Co-organizers
            </button>
          </div>
        </SectionCard>

        {/* Announcement */}
        <SectionCard title="Broadcast Announcement">
          <div className="space-y-2">
            <Input
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Announcement subject"
              aria-label="Announcement subject"
            />
            <Textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={3}
              placeholder="Message for all registered participants..."
              aria-label="Announcement message"
              className="min-h-[80px]"
            />
            <button
              disabled={sending || !subject.trim() || !message.trim()}
              onClick={() => void onSendAnnouncement()}
              className="comp-btn-primary w-fit"
              aria-label="Send announcement"
            >
              {sending ? 'Sending...' : '📢 Broadcast Announcement'}
            </button>
          </div>
        </SectionCard>

        {/* 2-column layout: Rounds | Tasks & Milestones */}
        <div className="grid items-start gap-4 xl:grid-cols-[1fr_320px]">

          {/* Round management */}
          <SectionCard title="Round Management">
            <div className="space-y-2">
              {(config?.rounds ?? []).map((round) => {
                const submissions = (rowsByRound[round.roundId] ?? []) as Array<{ totalScore?: number }>;
                const evaluated = submissions.filter((s) => typeof s.totalScore === 'number').length;
                return (
                  <div
                    key={round.roundId}
                    className="space-y-2 rounded-xl border border-[var(--border)] bg-[var(--dash-subcard-bg)] p-4"
                    style={{ borderLeft: `1px solid ${round.resultsPublished ? 'var(--comp-accent)' : 'var(--status-pending-border)'}` }}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="comp-heading-md m-0">{round.title || round.roundId}</p>
                      <span className="text-xs font-semibold" style={{ color: round.resultsPublished ? 'var(--comp-accent)' : 'var(--status-pending-text)' }}>
                        {round.resultsPublished ? '✓ Results Published' : 'Evaluation In Progress'}
                      </span>
                    </div>
                    {/* Progress bar */}
                    <div className="flex items-center gap-2">
                      <div className="h-1.5 flex-1 overflow-hidden rounded bg-[var(--comp-border)]">
                        <div style={{
                          width: submissions.length > 0 ? `${Math.round((evaluated / submissions.length) * 100)}%` : '0%',
                          height: '100%', borderRadius: 3,
                          background: evaluated >= submissions.length && submissions.length > 0 ? 'var(--status-open-text)' : 'var(--comp-accent)',
                          transition: 'width var(--transition-base)',
                        }} />
                      </div>
                      <span className="text-xs font-semibold text-[var(--text-secondary)]">
                        {evaluated}/{submissions.length}
                      </span>
                    </div>
                    <p className="comp-body m-0">
                      Submissions: <strong>{submissions.length}</strong> · Evaluated: <strong>{evaluated}/{submissions.length}</strong>
                    </p>
                    <div className="flex flex-wrap gap-2">
                      <Link className="comp-btn-ghost" to={`/events/${encodeURIComponent(eventId)}/manage/rounds/${encodeURIComponent(round.roundId)}/submissions`}>
                        View Submissions
                      </Link>
                      <Link className="comp-btn-ghost" to={`/events/${encodeURIComponent(eventId)}/manage/rounds/${encodeURIComponent(round.roundId)}/shortlist`}>
                        Shortlist & Publish
                      </Link>
                      <Link className="comp-btn-ghost" to={`/events/${encodeURIComponent(eventId)}/leaderboard/${encodeURIComponent(round.roundId)}`}>
                        Leaderboard
                      </Link>
                      <button
                        className="comp-btn-ghost"
                        onClick={() =>
                          void generateRoundCertificates(eventId, round.roundId)
                            .then((result) => setNotice({ tone: 'success', text: `Generated ${result.generatedCount} certificate(s).` }))
                            .catch((err: unknown) => setNotice({ tone: 'warning', text: err instanceof Error ? err.message : 'Certificate generation failed.' }))
                        }
                        aria-label={`Generate certificates for ${round.title}`}
                      >
                        <GraduationCap size={14} aria-hidden="true" /> Generate Certificates
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </SectionCard>

          {/* Right sidebar: Quick actions & Event milestones */}
          <div className="space-y-3">
            {/* Quick actions */}
            <div className="space-y-2">
              <Link
                to={`/events/${encodeURIComponent(eventId)}/manage/roles`}
                className="comp-btn-ghost justify-start gap-1 text-sm no-underline"
              >
                👩‍⚖️ Manage Judges
              </Link>
              <Link
                to="/events/attendance"
                className="comp-btn-ghost justify-start gap-1 text-sm no-underline"
              >
                📷 Check-In Console
              </Link>
            </div>

            {/* Auto-generated checklist from rounds */}
            {(config?.rounds ?? []).length > 0 && (
              <div className="space-y-2 rounded-xl border border-[var(--border)] bg-[var(--dash-subcard-bg)] p-4">
                <div className="flex items-center justify-between">
                  <h3 className="comp-heading-md m-0">Round Checklist</h3>
                  <span className="rounded-full bg-[var(--comp-accent-light)] px-2 py-1 text-[11px] font-bold text-[var(--comp-accent)]">
                    {(config?.rounds ?? []).filter((r) => !r.resultsPublished).length} Pending
                  </span>
                </div>
                {(config?.rounds ?? []).map((round) => (
                  <label key={round.roundId} className="flex cursor-default items-start gap-2 py-1">
                    <input type="checkbox" readOnly checked={Boolean(round.resultsPublished)} />
                    <div>
                      <p className="m-0 text-sm font-medium text-[var(--text-primary)]">{round.title}</p>
                      <span
                        className="text-xs font-semibold"
                        style={{ color: round.resultsPublished ? 'var(--status-open-text)' : 'var(--comp-text-muted)' }}
                      >
                        {round.resultsPublished ? 'Results published' : 'Evaluation pending'}
                      </span>
                    </div>
                  </label>
                ))}
              </div>
            )}

            {/* Milestone timeline from round deadlines */}
            {(config?.rounds ?? []).some((r) => r.submissionDeadline) && (
              <div className="space-y-2 rounded-xl border border-[var(--border)] bg-[var(--dash-subcard-bg)] p-4">
                <h3 className="comp-heading-md m-0">Upcoming Deadlines</h3>
                {(config?.rounds ?? [])
                  .filter((r) => r.submissionDeadline)
                  .sort((a, b) => new Date(a.submissionDeadline!).getTime() - new Date(b.submissionDeadline!).getTime())
                  .map((round) => {
                    const dl = new Date(round.submissionDeadline!);
                    const isPast = dl <= new Date();
                    const isNear = !isPast && dl.getTime() - Date.now() < 48 * 3_600_000;
                    return (
                      <div key={round.roundId} className="relative flex gap-2">
                        <div className="flex flex-col items-center gap-1">
                          <div style={{
                            width: 10, height: 10, borderRadius: '50%', flexShrink: 0,
                            background: isPast ? 'var(--comp-border-strong)' : isNear ? 'var(--status-live-text)' : 'var(--comp-accent)',
                          }} />
                          <div className="w-0.5 flex-1 bg-[var(--comp-border)]" />
                        </div>
                        <div className="pb-2">
                          <span className="text-[11px] font-bold tracking-[0.06em]" style={{ color: isPast ? 'var(--comp-text-muted)' : isNear ? 'var(--status-live-text)' : 'var(--comp-accent)' }}>
                            {isPast ? 'PASSED' : isNear ? 'SOON' : dl.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                          </span>
                          <p className="m-0 text-sm font-semibold text-[var(--text-primary)]">{round.title} deadline</p>
                          <p className="comp-body m-0 text-xs">
                            {dl.toLocaleString('en-IN', { weekday: 'short', hour: '2-digit', minute: '2-digit' })}
                          </p>
                        </div>
                      </div>
                    );
                  })}
              </div>
            )}
          </div>
        </div>
      </div>
    </CompetitionPageShell>
  );
}

