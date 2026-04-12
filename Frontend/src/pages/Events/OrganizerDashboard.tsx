/**
 * OrganizerDashboard.tsx — Enhanced with SummaryStatBar, RoundStatusCard, AuditHistoryPanel,
 * and OrganizerGuard from shared components.
 */

import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ErpPageShell, SectionCard } from '../../components/erp/ErpPrimitives';
import {
  generateRoundCertificates,
  getCompetitionAnalytics,
  getCompetitionConfig,
  getCompetitionSubmissions,
  getEvent,
  sendCompetitionAnnouncement,
  updateEventCoOrganizers,
} from '../../lib/campusApi';
import { SummaryStatBar } from '../../components/competition/SummaryStatBar';
import { ErrorMessage } from '../../components/competition/ErrorMessage';
import type { EventDetail, CompetitionConfig } from '../../lib/campusApi';

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

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '8px 12px',
    border: '1px solid var(--comp-border)',
    borderRadius: 8,
    background: 'var(--comp-surface)',
    color: 'var(--comp-text-primary)',
    fontSize: '0.875rem',
    outline: 'none',
    boxSizing: 'border-box',
  };

  return (
    <ErpPageShell title="Manage Competition" source="Internal API" isLoading={loading} loadingMessage="Loading competition data...">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-lg)' }}>

        {/* Back link */}
        <Link to={`/events/${encodeURIComponent(eventId)}`} style={{ fontSize: '0.8rem', color: 'var(--comp-text-secondary)', textDecoration: 'none' }}>
          ← Back to Event
        </Link>

        <h1 className="comp-heading-xl" style={{ margin: 0 }}>Organizer Dashboard</h1>

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
            style={{
              padding: 'var(--space-sm) var(--space-md)',
              borderRadius: 8,
              background: notice.tone === 'success' ? 'var(--status-open-bg)' : 'var(--status-live-bg)',
              border: `1px solid ${notice.tone === 'success' ? 'var(--status-open-border)' : 'var(--status-live-border)'}`,
              color: notice.tone === 'success' ? 'var(--status-open-text)' : 'var(--status-live-text)',
              fontSize: '0.875rem',
              fontWeight: 500,
            }}
          >
            {notice.text}
          </div>
        )}

        {/* Stats */}
        <SummaryStatBar stats={stats} />

        {/* Analytics */}
        <SectionCard title="Round Analytics">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-sm)' }}>
            {(analytics?.rounds ?? []).map((row) => (
              <div
                key={row.roundId}
                style={{
                  background: 'var(--comp-surface)',
                  border: '1px solid var(--comp-border)',
                  borderRadius: 10,
                  padding: 'var(--space-md)',
                }}
              >
                <p className="comp-heading-md" style={{ margin: '0 0 6px' }}>{row.title}</p>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-md)' }}>
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
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-sm)' }}>
            <label className="comp-label" htmlFor="co-orgs">Add by register number, comma-separated</label>
            <input
              id="co-orgs"
              style={inputStyle}
              value={coOrganizersInput}
              onChange={(e) => setCoOrganizersInput(e.target.value)}
              placeholder="e.g. 21CS001, 21CS002"
              aria-label="Co-organizer register numbers"
            />
            <button
              className="comp-btn-ghost"
              style={{ alignSelf: 'flex-start' }}
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
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-sm)' }}>
            <input
              style={inputStyle}
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Announcement subject"
              aria-label="Announcement subject"
            />
            <textarea
              style={{ ...inputStyle, resize: 'vertical', minHeight: 80 }}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={3}
              placeholder="Message for all registered participants..."
              aria-label="Announcement message"
            />
            <button
              disabled={sending || !subject.trim() || !message.trim()}
              onClick={() => void onSendAnnouncement()}
              className="comp-btn-primary"
              style={{ alignSelf: 'flex-start' }}
              aria-label="Send announcement"
            >
              {sending ? 'Sending...' : '📢 Broadcast Announcement'}
            </button>
          </div>
        </SectionCard>

        {/* Round management */}
        <SectionCard title="Round Management">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-sm)' }}>
            {(config?.rounds ?? []).map((round) => {
              const submissions = (rowsByRound[round.roundId] ?? []) as Array<{ totalScore?: number }>;
              const evaluated = submissions.filter((s) => typeof s.totalScore === 'number').length;
              return (
                <div
                  key={round.roundId}
                  style={{
                    background: 'var(--comp-surface)',
                    border: '1px solid var(--comp-border)',
                    borderLeft: `3px solid ${round.resultsPublished ? 'var(--comp-accent)' : 'var(--status-pending-border)'}`,
                    borderRadius: 10,
                    padding: 'var(--space-md)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 'var(--space-sm)',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
                    <p className="comp-heading-md" style={{ margin: 0 }}>{round.title || round.roundId}</p>
                    <span style={{ fontSize: '0.75rem', fontWeight: 600, color: round.resultsPublished ? 'var(--comp-accent)' : 'var(--status-pending-text)' }}>
                      {round.resultsPublished ? '✓ Results Published' : 'Evaluation In Progress'}
                    </span>
                  </div>
                  <p className="comp-body" style={{ margin: 0 }}>
                    Submissions: <strong>{submissions.length}</strong> · Evaluated: <strong>{evaluated}/{submissions.length}</strong>
                  </p>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                    <Link className="comp-btn-ghost" style={{ fontSize: '0.8rem', padding: '6px 12px' }} to={`/events/${encodeURIComponent(eventId)}/manage/rounds/${encodeURIComponent(round.roundId)}/submissions`}>
                      View Submissions
                    </Link>
                    <Link className="comp-btn-ghost" style={{ fontSize: '0.8rem', padding: '6px 12px' }} to={`/events/${encodeURIComponent(eventId)}/manage/rounds/${encodeURIComponent(round.roundId)}/shortlist`}>
                      Shortlist & Publish
                    </Link>
                    <Link className="comp-btn-ghost" style={{ fontSize: '0.8rem', padding: '6px 12px' }} to={`/events/${encodeURIComponent(eventId)}/rounds/${encodeURIComponent(round.roundId)}/leaderboard`}>
                      Leaderboard
                    </Link>
                    <button
                      className="comp-btn-ghost"
                      style={{ fontSize: '0.8rem', padding: '6px 12px' }}
                      onClick={() =>
                        void generateRoundCertificates(eventId, round.roundId)
                          .then((result) => setNotice({ tone: 'success', text: `Generated ${result.generatedCount} certificate(s).` }))
                          .catch((err: unknown) => setNotice({ tone: 'warning', text: err instanceof Error ? err.message : 'Certificate generation failed.' }))
                      }
                      aria-label={`Generate certificates for ${round.title}`}
                    >
                      🎓 Generate Certificates
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </SectionCard>
      </div>
    </ErpPageShell>
  );
}
