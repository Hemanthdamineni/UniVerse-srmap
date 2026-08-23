/**
 * LeaderboardPage.tsx — Rewritten with rankings, "You" highlight, and anonymize toggle.
 */

import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { CompetitionPageShell } from '../../components/competition/CompetitionChrome';
import { getCompetitionLeaderboard } from '../../lib/campus/campusApi';
import { readStoredProfileData } from '../../lib/core/session';
import { EmptyState } from '../../components/competition/CompetitionEmptyState';
import { ErrorMessage } from '../../components/competition/ErrorMessage';
import { SkeletonTable } from '../../components/ui/Skeletons';
import type { LeaderboardRow } from '../../lib/campus/campusApi';
import { track } from '../../lib/core/analytics';

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
      <div className="flex flex-col gap-6">

        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Link
            to={`/events/${encodeURIComponent(eventId)}`}
            className="text-sm no-underline text-[var(--comp-text-secondary)]"
          >
            ← Back to Event
          </Link>

          {/* Anonymize toggle */}
          <label className="flex cursor-pointer items-center gap-2 text-sm text-[var(--comp-text-secondary)]">
            <input
              type="checkbox"
              checked={anonymize}
              onChange={(e) => setAnonymize(e.target.checked)}
              aria-label="Anonymize participant names"
              className="cursor-pointer"
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
              <div className="mb-4 flex items-end justify-center gap-4">
                {[rows[1], rows[0], rows[2]].map((row, podiumIdx) => {
                  const podiumHeights = ['h-[90px]', 'h-[120px]', 'h-[70px]'];
                  const isMe = row.submittedBy === userId || row.submittedBy === (profile?.registerNumber as string | undefined);
                  return (
                    <div
                      key={row.id}
                      aria-label={`${MEDAL[row.rank]} ${displayName(row)}: ${row.totalScore ?? '—'}`}
                      className="flex max-w-[160px] flex-1 flex-col items-center gap-2"
                    >
                      <span className="text-xl" aria-hidden="true">{MEDAL[row.rank]}</span>
                      <p className="m-0 text-center text-sm font-bold text-[var(--comp-text-primary)]">
                        {displayName(row)}
                        {isMe && <span className="text-[var(--comp-accent)]"> (You)</span>}
                      </p>
                      <div
                        className={`flex w-full items-start justify-center rounded-t-lg border-2 pt-2 ${podiumHeights[podiumIdx]} ${
                          isMe
                            ? 'border-[var(--comp-accent)] bg-[var(--comp-accent)]'
                            : 'border-[var(--comp-border)] bg-[var(--comp-surface)]'
                        }`}
                      >
                        <span className={`leaderboard-score ${isMe ? 'text-[var(--background)]' : 'text-[var(--comp-accent)]'}`}>
                          {row.totalScore ?? '—'}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Full rankings table */}
            <div className="overflow-x-auto rounded-xl border border-[var(--comp-border)]">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="bg-[var(--comp-accent)]">
                    {['Rank', 'Name', 'Score', 'Decision'].map((h) => (
                      <th key={h} className="leaderboard-header-cell">
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
                        className={`border-t border-[var(--comp-border)] ${
                          isMe
                            ? 'bg-[var(--comp-accent-light)]'
                            : i % 2 === 0
                              ? 'bg-[var(--comp-surface)]'
                              : 'bg-[var(--comp-surface-hover)]'
                        }`}
                      >
                        <td className="px-4 py-2 text-sm font-bold text-[var(--comp-accent)]">
                          {MEDAL[row.rank] ?? `#${row.rank}`}
                        </td>
                        <td className={`px-4 py-2 text-sm text-[var(--comp-text-primary)] ${isMe ? 'font-bold' : 'font-normal'}`}>
                          {displayName(row)}
                          {isMe && <span className="ml-1 text-xs font-bold text-[var(--comp-accent)]">(You)</span>}
                        </td>
                        <td className="px-4 py-2 text-sm font-semibold text-[var(--comp-text-primary)]">
                          {row.totalScore ?? '—'}
                        </td>
                        <td className="px-4 py-2">
                          {row.shortlisted ? (
                            <span className="rounded-full bg-[var(--status-open-bg)] px-2 py-1 text-xs font-semibold text-[var(--status-open-text)]">
                              Shortlisted
                            </span>
                          ) : row.decision ? (
                            <span className="text-sm text-[var(--comp-text-muted)]">
                              {String(row.decision)}
                            </span>
                          ) : (
                            <span className="text-sm text-[var(--comp-text-muted)]">—</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <p className="comp-label text-right">
              {rows.length} entr{rows.length !== 1 ? 'ies' : 'y'}
            </p>
          </>
        )}
      </div>
    </CompetitionPageShell>
  );
}
