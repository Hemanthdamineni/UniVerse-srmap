/**
 * ShortlistPage.tsx — Rewritten with SummaryStatBar, live preview, and publish confirmation.
 */

import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { SectionCard } from '../../components/erp/ErpPrimitives';
import { CompetitionPageShell } from '../../components/competition/CompetitionChrome';
import {
  applyCompetitionShortlist,
  getCompetitionSubmissions,
  publishCompetitionResults,
} from '../../lib/campus/campusApi';
import { SummaryStatBar } from '../../components/competition/SummaryStatBar';
import { ErrorMessage } from '../../components/competition/ErrorMessage';
import { EmptyState } from '../../components/competition/CompetitionEmptyState';
import { SkeletonTable } from '../../components/ui/Skeletons';
import { Input } from "../../components/input";
import { Select } from "../../components/select";

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

  return (
    <CompetitionPageShell
      title="Shortlist & Publish"
      subtitle="Apply selection rules and publish round results."
      variant="wide"
    >
      <div className="space-y-5">

        <Link
          to={`/events/${encodeURIComponent(eventId)}/manage`}
          className="text-xs text-[var(--text-secondary)] no-underline"
        >
          ← Back to Dashboard
        </Link>

        {error && <ErrorMessage message={error} onRetry={() => void load()} />}
        {successMsg && (
          <div role="status" className="rounded-xl border border-[var(--status-open-border)] bg-[var(--status-open-bg)] px-3 py-2 text-sm font-semibold text-[var(--status-open-text)]">
            ✓ {successMsg}
          </div>
        )}

        {/* Stats */}
        <SummaryStatBar stats={statsData} />

        {/* Shortlist controls */}
        <SectionCard title="Shortlist Controls">
          <div className="flex flex-wrap items-end gap-3">
            <div>
              <label className="comp-label mb-1 block" htmlFor="shortlist-mode">Mode</label>
              <Select
                id="shortlist-mode"
                value={mode}
                onChange={(e) => setMode(e.target.value as 'topN' | 'threshold')}
                aria-label="Shortlist mode"
              >
                <option value="topN">Top N submissions</option>
                <option value="threshold">Score threshold ≥</option>
              </Select>
            </div>
            <div>
              <label className="comp-label mb-1 block" htmlFor="shortlist-value">
                {mode === 'topN' ? 'N (count)' : 'Min score'}
              </label>
              <Input
                id="shortlist-value"
                type="number"
                min={1}
                value={value}
                onChange={(e) => setValue(Number(e.target.value || 0))}
                className="w-20"
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
          <p className="comp-body mt-2">
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
            <div className="space-y-1.5">
              {evaluated.map((row, idx) => {
                const isSelected = previewIds.has(row.id);
                return (
                  <div
                    key={row.id}
                    className={`flex items-center justify-between gap-2 rounded-xl border px-3.5 py-2 ${
                      isSelected
                        ? 'border-[var(--status-open-border)] bg-[var(--status-open-bg)]'
                        : 'border-[var(--border)] bg-[var(--dash-subcard-bg)]'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <span className="min-w-7 font-bold text-[var(--comp-accent)]">#{idx + 1}</span>
                      <span className="text-sm text-[var(--text-primary)]">{row.submittedBy}</span>
                    </div>
                    <div className="flex items-center gap-2.5">
                      <span className="text-sm font-bold text-[var(--text-primary)]">{row.totalScore}</span>
                      {isSelected && (
                        <span className="rounded-full bg-[var(--status-open-bg)] px-2 py-0.5 text-[11px] font-bold text-[var(--status-open-text)]">
                          ✓ Shortlist
                        </span>
                      )}
                      {row.shortlisted && !isSelected && (
                        <span className="text-xs text-[var(--text-secondary)]">was shortlisted</span>
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
          <p className="comp-body mb-4 mt-0">
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
            <div className="space-y-2">
              <p className="text-sm font-semibold text-[var(--status-live-text)]">
                ⚠️ Confirm: Publish results for this round? This cannot be undone.
              </p>
              <div className="flex gap-2">
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
    </CompetitionPageShell>
  );
}
