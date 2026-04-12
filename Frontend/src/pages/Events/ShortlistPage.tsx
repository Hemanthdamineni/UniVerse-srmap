/**
 * ShortlistPage.tsx — Rewritten with SummaryStatBar, live preview, and publish confirmation.
 */

import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ErpPageShell, SectionCard } from '../../components/erp/ErpPrimitives';
import {
  applyCompetitionShortlist,
  getCompetitionSubmissions,
  publishCompetitionResults,
} from '../../lib/campusApi';
import { SummaryStatBar } from '../../components/competition/SummaryStatBar';
import { ErrorMessage } from '../../components/competition/ErrorMessage';
import { EmptyState } from '../../components/competition/EmptyState';
import { SkeletonTable } from '../../components/competition/Skeletons';

type SubmissionRow = {
  id: string;
  submittedBy: string;
  totalScore?: number;
  submittedAt: string;
  shortlisted?: boolean;
};

export default function ShortlistPage() {
  const { eventId = '', roundId = '' } = useParams();
  const [rows, setRows] = useState<SubmissionRow[]>([]);
  const [mode, setMode] = useState<'topN' | 'threshold'>('topN');
  const [value, setValue] = useState(10);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [confirmPublish, setConfirmPublish] = useState(false);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const data = await getCompetitionSubmissions(eventId, roundId);
      setRows(data as SubmissionRow[]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load submissions.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, [eventId, roundId]);

  const evaluated = useMemo(
    () =>
      [...rows]
        .filter((r) => typeof r.totalScore === 'number')
        .sort((a, b) => {
          if ((b.totalScore ?? 0) !== (a.totalScore ?? 0)) return (b.totalScore ?? 0) - (a.totalScore ?? 0);
          return new Date(a.submittedAt).getTime() - new Date(b.submittedAt).getTime();
        }),
    [rows]
  );

  const previewIds = useMemo(() => {
    if (mode === 'threshold') {
      return new Set(evaluated.filter((r) => (r.totalScore ?? 0) >= value).map((r) => r.id));
    }
    return new Set(evaluated.slice(0, Math.max(0, Math.floor(value))).map((r) => r.id));
  }, [evaluated, mode, value]);

  const statsData = [
    { label: 'Total submissions', value: rows.length },
    { label: 'Evaluated', value: evaluated.length },
    { label: 'Not yet evaluated', value: rows.length - evaluated.length, color: rows.length - evaluated.length > 0 ? 'var(--deadline-warn)' : undefined },
    { label: 'In shortlist preview', value: previewIds.size, color: previewIds.size > 0 ? 'var(--status-open-text)' : undefined },
  ];

  async function apply() {
    setBusy(true);
    setError(null);
    setSuccessMsg(null);
    try {
      const result = await applyCompetitionShortlist(eventId, roundId, { mode, value });
      setSuccessMsg(`Shortlist applied. ${result.shortlistedCount} selected from ${result.evaluatedCount} evaluated submissions.`);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to apply shortlist.');
    } finally {
      setBusy(false);
    }
  }

  async function publish() {
    setBusy(true);
    setError(null);
    setSuccessMsg(null);
    setConfirmPublish(false);
    try {
      await publishCompetitionResults(eventId, roundId);
      setSuccessMsg('Results published successfully. Participants have been notified.');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to publish results.');
    } finally {
      setBusy(false);
    }
  }

  const inputStyle: React.CSSProperties = {
    padding: '8px 12px',
    border: '1px solid var(--comp-border)',
    borderRadius: 8,
    background: 'var(--comp-surface)',
    color: 'var(--comp-text-primary)',
    fontSize: '0.875rem',
    outline: 'none',
  };

  return (
    <ErpPageShell title="Shortlist & Publish" source="Internal API" isLoading={false} loadingMessage="Loading...">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-lg)' }}>

        <Link
          to={`/events/${encodeURIComponent(eventId)}/manage`}
          style={{ fontSize: '0.8rem', color: 'var(--comp-text-secondary)', textDecoration: 'none' }}
        >
          ← Back to Dashboard
        </Link>

        <h1 className="comp-heading-xl" style={{ margin: 0 }}>Shortlist & Publish</h1>

        {error && <ErrorMessage message={error} onRetry={() => void load()} />}
        {successMsg && (
          <div role="status" style={{ background: 'var(--status-open-bg)', border: '1px solid var(--status-open-border)', borderRadius: 8, padding: 'var(--space-sm) var(--space-md)', color: 'var(--status-open-text)', fontWeight: 600, fontSize: '0.875rem' }}>
            ✓ {successMsg}
          </div>
        )}

        {/* Stats */}
        <SummaryStatBar stats={statsData} />

        {/* Shortlist controls */}
        <SectionCard title="Shortlist Controls">
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-sm)', alignItems: 'flex-end' }}>
            <div>
              <label className="comp-label" htmlFor="shortlist-mode" style={{ display: 'block', marginBottom: 4 }}>Mode</label>
              <select
                id="shortlist-mode"
                value={mode}
                onChange={(e) => setMode(e.target.value as 'topN' | 'threshold')}
                style={inputStyle}
                aria-label="Shortlist mode"
              >
                <option value="topN">Top N submissions</option>
                <option value="threshold">Score threshold ≥</option>
              </select>
            </div>
            <div>
              <label className="comp-label" htmlFor="shortlist-value" style={{ display: 'block', marginBottom: 4 }}>
                {mode === 'topN' ? 'N (count)' : 'Min score'}
              </label>
              <input
                id="shortlist-value"
                type="number"
                min={1}
                value={value}
                onChange={(e) => setValue(Number(e.target.value || 0))}
                style={{ ...inputStyle, width: 80 }}
                aria-label={mode === 'topN' ? 'Top N count' : 'Score threshold'}
              />
            </div>
            <button
              type="button"
              onClick={() => void apply()}
              disabled={busy || evaluated.length === 0}
              className="comp-btn-primary"
              aria-label="Apply shortlist"
            >
              {busy ? 'Applying...' : '⚡ Apply Shortlist'}
            </button>
          </div>
          <p className="comp-body" style={{ margin: 'var(--space-sm) 0 0' }}>
            {evaluated.length} evaluated · {rows.length - evaluated.length} pending · Preview: <strong>{previewIds.size}</strong> will be shortlisted
          </p>
        </SectionCard>

        {/* Ranked preview */}
        <SectionCard title="Ranked Preview">
          {loading ? (
            <SkeletonTable rows={5} columns={3} />
          ) : evaluated.length === 0 ? (
            <EmptyState icon="📋" title="No evaluated submissions" description="Submit evaluations before applying shortlist." />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {evaluated.map((row, idx) => {
                const isSelected = previewIds.has(row.id);
                return (
                  <div
                    key={row.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '8px 14px',
                      borderRadius: 8,
                      border: `1px solid ${isSelected ? 'var(--status-open-border)' : 'var(--comp-border)'}`,
                      background: isSelected ? 'var(--status-open-bg)' : 'var(--comp-surface)',
                      gap: 8,
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span style={{ fontWeight: 700, color: 'var(--comp-accent)', minWidth: 28 }}>#{idx + 1}</span>
                      <span style={{ fontSize: '0.875rem', color: 'var(--comp-text-primary)' }}>{row.submittedBy}</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span style={{ fontWeight: 700, color: 'var(--comp-text-primary)', fontSize: '0.875rem' }}>{row.totalScore}</span>
                      {isSelected && (
                        <span style={{ background: 'var(--status-open-bg)', color: 'var(--status-open-text)', borderRadius: 20, padding: '2px 8px', fontSize: '0.7rem', fontWeight: 700 }}>
                          ✓ Shortlist
                        </span>
                      )}
                      {row.shortlisted && !isSelected && (
                        <span style={{ color: 'var(--comp-text-muted)', fontSize: '0.72rem' }}>was shortlisted</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </SectionCard>

        {/* Publish results */}
        <SectionCard title="Publish Results">
          <p className="comp-body" style={{ margin: '0 0 var(--space-md)' }}>
            Publishing results sends notifications to all participants and locks further evaluation for this round. This action is irreversible.
          </p>
          {!confirmPublish ? (
            <button
              type="button"
              onClick={() => setConfirmPublish(true)}
              disabled={busy}
              className="comp-btn-primary"
              aria-label="Publish results"
            >
              📢 Publish Results
            </button>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-sm)' }}>
              <p style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--status-live-text)' }}>
                ⚠️ Confirm: Publish results for this round? This cannot be undone.
              </p>
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={() => void publish()} disabled={busy} className="comp-btn-primary" aria-label="Confirm publish">
                  {busy ? 'Publishing...' : '✓ Yes, Publish'}
                </button>
                <button onClick={() => setConfirmPublish(false)} className="comp-btn-ghost" aria-label="Cancel publish">
                  Cancel
                </button>
              </div>
            </div>
          )}
        </SectionCard>
      </div>
    </ErpPageShell>
  );
}
