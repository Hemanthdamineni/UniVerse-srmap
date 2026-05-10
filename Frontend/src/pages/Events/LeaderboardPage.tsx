/**
 * LeaderboardPage.tsx — Rewritten with rankings, "You" highlight, and anonymize toggle.
 */

import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { CompetitionPageShell } from '../../components/competition/CompetitionChrome';
import { getCompetitionLeaderboard } from '../../lib/campusApi';
import { readStoredProfileData } from '../../lib/session';
import { EmptyState } from '../../components/competition/EmptyState';
import { ErrorMessage } from '../../components/competition/ErrorMessage';
import { SkeletonTable } from '../../components/competition/Skeletons';
import type { LeaderboardRow } from '../../lib/campusApi';
import { track } from '../../lib/analytics';

export default function LeaderboardPage() {
  const { eventId = '', roundId = '' } = useParams();
  const [rows, setRows] = useState<LeaderboardRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [anonymize, setAnonymize] = useState(false);

  const profile = readStoredProfileData();
  const userId = (profile?.registerNumber as string | undefined) ?? (profile?.id as string | undefined) ?? '';

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const data = await getCompetitionLeaderboard(eventId, roundId);
        if (!cancelled) {
          setRows(data);
          track('leaderboard_viewed', { eventId, roundId });
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load leaderboard.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => { cancelled = true; };
  }, [eventId, roundId]);

  const MEDAL: Record<number, string> = { 1: '🥇', 2: '🥈', 3: '🥉' };

  function displayName(row: LeaderboardRow): string {
    if (anonymize) return `Participant #${row.rank}`;
    return row.teamName ?? row.submittedBy;
  }

  return (
    <CompetitionPageShell
      title="Submission Leaderboard"
      subtitle="Ranked results for the selected competition round."
      variant="wide"
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-lg)' }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 'var(--space-sm)' }}>
          <div>
            <Link
              to={`/events/${encodeURIComponent(eventId)}`}
              style={{ fontSize: '0.8rem', color: 'var(--comp-text-secondary)', textDecoration: 'none' }}
            >
              ← Back to Event
            </Link>
            <h1 className="comp-heading-xl" style={{ margin: '4px 0 0' }}>Leaderboard</h1>
          </div>

          {/* Anonymize toggle */}
          <label
            style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: '0.875rem', color: 'var(--comp-text-secondary)' }}
          >
            <input
              type="checkbox"
              checked={anonymize}
              onChange={(e) => setAnonymize(e.target.checked)}
              aria-label="Anonymize participant names"
              style={{ cursor: 'pointer' }}
            />
            Anonymize names
          </label>
        </div>

        {error && <ErrorMessage message={error} onRetry={() => window.location.reload()} />}

        {loading ? (
          <SkeletonTable rows={8} columns={4} />
        ) : rows.length === 0 ? (
          <EmptyState icon="📊" title="No results published" description="Rankings will appear here once results are published." />
        ) : (
          <>
            {/* Podium for top 3 */}
            {rows.length >= 3 && (
              <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'flex-end', gap: 'var(--space-md)', marginBottom: 'var(--space-md)' }}>
                {[rows[1], rows[0], rows[2]].map((row, podiumIdx) => {
                  const heights = ['90px', '120px', '70px'];
                  const isMe = row.submittedBy === userId || row.submittedBy === (profile?.registerNumber as string | undefined);
                  return (
                    <div
                      key={row.id}
                      aria-label={`${MEDAL[row.rank]} ${displayName(row)}: ${row.totalScore ?? '—'}`}
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        gap: 8,
                        flex: 1,
                        maxWidth: 160,
                      }}
                    >
                      <span style={{ fontSize: '1.5rem' }}>{MEDAL[row.rank]}</span>
                      <p style={{ margin: 0, fontSize: '0.8rem', fontWeight: 700, color: 'var(--comp-text-primary)', textAlign: 'center' }}>
                        {displayName(row)}
                        {isMe && <span style={{ color: 'var(--comp-accent)' }}> (You)</span>}
                      </p>
                      <div
                        style={{
                          width: '100%',
                          height: heights[podiumIdx],
                          background: isMe ? 'var(--comp-accent)' : 'var(--comp-surface)',
                          border: `2px solid ${isMe ? 'var(--comp-accent)' : 'var(--comp-border)'}`,
                          borderRadius: '8px 8px 0 0',
                          display: 'flex',
                          alignItems: 'flex-start',
                          justifyContent: 'center',
                          paddingTop: 8,
                        }}
                      >
                        <span style={{ fontWeight: 800, fontSize: '1.1rem', color: isMe ? '#fff' : 'var(--comp-accent)' }}>
                          {row.totalScore ?? '—'}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Full rankings table */}
            <div style={{ border: '1px solid var(--comp-border)', borderRadius: 12, overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: 'var(--comp-accent)' }}>
                    {['Rank', 'Name', 'Score', 'Decision'].map((h) => (
                      <th key={h} style={{ padding: '10px 16px', textAlign: 'left', fontSize: '0.72rem', fontWeight: 700, color: '#fff', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, i) => {
                    const isMe = row.submittedBy === userId;
                    return (
                      <tr
                        key={row.id}
                        style={{
                          background: isMe ? 'var(--comp-accent-light)' : i % 2 === 0 ? 'var(--comp-surface)' : 'var(--comp-surface-hover)',
                          borderTop: '1px solid var(--comp-border)',
                        }}
                      >
                        <td style={{ padding: '10px 16px', fontSize: '0.875rem', fontWeight: 700, color: 'var(--comp-accent)' }}>
                          {MEDAL[row.rank] ?? `#${row.rank}`}
                        </td>
                        <td style={{ padding: '10px 16px', fontSize: '0.875rem', color: 'var(--comp-text-primary)', fontWeight: isMe ? 700 : 400 }}>
                          {displayName(row)}
                          {isMe && <span style={{ marginLeft: 6, fontSize: '0.7rem', color: 'var(--comp-accent)', fontWeight: 700 }}>(You)</span>}
                        </td>
                        <td style={{ padding: '10px 16px', fontSize: '0.875rem', color: 'var(--comp-text-primary)', fontWeight: 600 }}>
                          {row.totalScore ?? '—'}
                        </td>
                        <td style={{ padding: '10px 16px' }}>
                          {row.shortlisted ? (
                            <span style={{ background: 'var(--status-open-bg)', color: 'var(--status-open-text)', borderRadius: 20, padding: '2px 8px', fontSize: '0.72rem', fontWeight: 600 }}>
                              Shortlisted
                            </span>
                          ) : row.decision ? (
                            <span style={{ fontSize: '0.78rem', color: 'var(--comp-text-muted)' }}>
                              {String(row.decision)}
                            </span>
                          ) : (
                            <span style={{ color: 'var(--comp-text-muted)', fontSize: '0.78rem' }}>—</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <p className="comp-label" style={{ textAlign: 'right' }}>
              {rows.length} entr{rows.length !== 1 ? 'ies' : 'y'}
            </p>
          </>
        )}
      </div>
    </CompetitionPageShell>
  );
}
