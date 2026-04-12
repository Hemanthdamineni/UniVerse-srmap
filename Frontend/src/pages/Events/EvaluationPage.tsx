/**
 * EvaluationPage.tsx — Rewritten with EvaluationCriteriaTable + AuditHistoryPanel.
 * prev/next navigation from the sorted submission list.
 */

import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ErpPageShell, SectionCard } from '../../components/erp/ErpPrimitives';
import {
  evaluateCompetitionSubmission,
  flagCompetitionSubmission,
  getCompetitionConfig,
  getCompetitionSubmissions,
  getSubmissionEvaluations,
} from '../../lib/campusApi';
import { EvaluationCriteriaTable } from '../../components/competition/EvaluationCriteriaTable';
import { AuditHistoryPanel } from '../../components/competition/AuditHistoryPanel';
import { ErrorMessage } from '../../components/competition/ErrorMessage';
import { track } from '../../lib/analytics';
import { useOptimistic } from '../../hooks/useOptimistic';

type AuditItem = { label: string; actor?: string; at: string };

export default function EvaluationPage() {
  const { eventId = '', roundId = '', submissionId = '' } = useParams();

  const [criteria, setCriteria] = useState<Array<{ label: string; maxScore: number }>>([]);
  const [scores, setScores] = useState<Record<string, number>>({});
  const [remarks, setRemarks] = useState('');
  const [decision, setDecision] = useState('pending');
  const [flagged, setFlagged] = useState(false);
  const [flagReason, setFlagReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const { value: auditEvents, update: updateAuditEvents, setOptimisticValue: setAuditEvents } = useOptimistic<AuditItem[]>([]);
  const { value: rows, update: updateRows, setOptimisticValue: setRows } = useOptimistic<Array<Record<string, unknown>>>([]);

  const current = useMemo(() => rows.find((r) => r.id === submissionId) ?? null, [rows, submissionId]);
  const index = useMemo(() => rows.findIndex((r) => r.id === submissionId), [rows, submissionId]);
  const prev = index > 0 ? rows[index - 1] : null;
  const next = index >= 0 && index + 1 < rows.length ? rows[index + 1] : null;

  async function load() {
    setLoading(true);
    setError(null);
    setSuccessMsg(null);
    try {
      const [config, submissions] = await Promise.all([
        getCompetitionConfig(eventId),
        getCompetitionSubmissions(eventId, roundId),
      ]);
      setRows(submissions as Array<Record<string, unknown>>);
      const round = config.rounds.find((r) => r.roundId === roundId);
      setCriteria(round?.evaluationCriteria ?? []);
      const selected = (submissions as Array<Record<string, unknown>>).find((r) => r.id === submissionId);
      setScores((selected?.criteriaScores ?? {}) as Record<string, number>);
      setRemarks(String(selected?.remarks ?? ''));
      setDecision(String(selected?.decision ?? 'pending'));
      setFlagged(Boolean(selected?.flagged));
      setFlagReason(String(selected?.flagReason ?? ''));

      if (selected?.id) {
        const evalData = await getSubmissionEvaluations(eventId, roundId, String(selected.id));
        const evaluations = (evalData.evaluations ?? []) as Array<{ evaluatorId: string; totalScore: number; decision: string; updatedAt: string }>;
        setAuditEvents(
          evaluations.map((e) => ({
            label: 'Evaluated by',
            actor: e.evaluatorId,
            at: e.updatedAt,
          }))
        );
      }
      track('evaluation_opened', { eventId, roundId, submissionId });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load evaluation panel.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, [eventId, roundId, submissionId]);

  const totalScore = useMemo(
    () => Object.values(scores).reduce((sum, v) => sum + Number(v || 0), 0),
    [scores]
  );

  async function saveEvaluation() {
    setBusy(true);
    setError(null);
    setSuccessMsg(null);

    const optimisticEvent: AuditItem[] = [
      { label: 'Evaluated by', actor: 'You', at: new Date().toISOString() },
      ...auditEvents,
    ];

    try {
      void updateAuditEvents(optimisticEvent, async () => {
        return optimisticEvent; // Keep local sync until real refetch
      });

      await updateRows(
        rows.map(r => r.id === submissionId ? { ...r, criteriaScores: scores, remarks, decision, flagged, flagReason } : r),
        async () => {
          await evaluateCompetitionSubmission(eventId, roundId, submissionId, {
            criteriaScores: scores,
            remarks,
            decision,
          });
          await flagCompetitionSubmission(eventId, roundId, submissionId, { flagged, flagReason });
          const newSubmissions = await getCompetitionSubmissions(eventId, roundId);
          return newSubmissions as Array<Record<string, unknown>>;
        }
      );

      track('evaluation_saved', { eventId, roundId, submissionId, totalScore });
      setSuccessMsg('Evaluation saved.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save evaluation.');
    } finally {
      setBusy(false);
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
    <ErpPageShell title="Evaluate Submission" source="Internal API" isLoading={loading} loadingMessage="Loading submission...">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-lg)' }}>

        {/* Header navigation */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
          <div style={{ display: 'flex', gap: 8 }}>
            <Link
              to={`/events/${encodeURIComponent(eventId)}/manage/rounds/${encodeURIComponent(roundId)}/submissions`}
              className="comp-btn-ghost"
              style={{ fontSize: '0.8rem', padding: '6px 12px' }}
            >
              ← All Submissions
            </Link>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            {prev && (
              <Link
                className="comp-btn-ghost"
                style={{ fontSize: '0.8rem', padding: '6px 12px' }}
                to={`/events/${encodeURIComponent(eventId)}/manage/rounds/${encodeURIComponent(roundId)}/submissions/${encodeURIComponent(String(prev.id))}/evaluate`}
              >
                ← Prev
              </Link>
            )}
            <span className="comp-body" style={{ alignSelf: 'center' }}>
              {index + 1}/{rows.length}
            </span>
            {next && (
              <Link
                className="comp-btn-ghost"
                style={{ fontSize: '0.8rem', padding: '6px 12px' }}
                to={`/events/${encodeURIComponent(eventId)}/manage/rounds/${encodeURIComponent(roundId)}/submissions/${encodeURIComponent(String(next.id))}/evaluate`}
              >
                Next →
              </Link>
            )}
          </div>
        </div>

        {/* Status messages */}
        {successMsg && (
          <div role="status" style={{ background: 'var(--status-open-bg)', border: '1px solid var(--status-open-border)', borderRadius: 8, padding: 'var(--space-sm) var(--space-md)', color: 'var(--status-open-text)', fontWeight: 600, fontSize: '0.875rem' }}>
            ✓ {successMsg}
          </div>
        )}
        {error && <ErrorMessage message={error} preservedInput onRetry={() => void saveEvaluation()} />}

        {current ? (
          <>
            {/* Submission preview */}
            <SectionCard title="Submission Preview">
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-sm)', fontSize: '0.875rem' }}>
                <p style={{ margin: 0 }}>
                  <span className="comp-label">Participant:</span>{' '}
                  <strong style={{ color: 'var(--comp-text-primary)' }}>{String(current.submittedBy ?? '—')}</strong>
                </p>
                <p style={{ margin: 0 }}>
                  <span className="comp-label">Submitted:</span>{' '}
                  {current.submittedAt ? new Date(String(current.submittedAt)).toLocaleString('en-IN') : '—'}
                </p>
                <p style={{ margin: 0 }}>
                  <span className="comp-label">Type:</span> {String(current.type ?? '—')}
                </p>
                {current.description && (
                  <p style={{ margin: 0, color: 'var(--comp-text-secondary)' }}>{String(current.description)}</p>
                )}
                {current.type === 'link' && current.linkUrl && (
                  <a href={String(current.linkUrl)} target="_blank" rel="noreferrer" className="comp-btn-ghost" style={{ alignSelf: 'flex-start', fontSize: '0.8rem' }}>
                    🔗 Open Submission Link
                  </a>
                )}
                {current.type === 'file' && current.filePath && (
                  <a href={`/files/submissions/${String(current.filePath)}`} target="_blank" rel="noreferrer" className="comp-btn-ghost" style={{ alignSelf: 'flex-start', fontSize: '0.8rem' }}>
                    📁 Open Submission File
                  </a>
                )}
                {current.flagged && (
                  <div style={{ background: 'var(--status-live-bg)', border: '1px solid var(--status-live-border)', borderRadius: 6, padding: '6px 10px', color: 'var(--status-live-text)', fontSize: '0.8rem', fontWeight: 600 }}>
                    🚩 Flagged: {String(current.flagReason ?? 'No reason provided')}
                  </div>
                )}
              </div>
            </SectionCard>

            {/* Evaluation form */}
            <SectionCard title="Evaluation Form">
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
                {/* Criteria table — editable */}
                <EvaluationCriteriaTable
                  criteria={criteria}
                  scores={scores}
                  onChange={(label, score) => setScores((prev) => ({ ...prev, [label]: score }))}
                  readOnly={false}
                />

                {/* Remarks */}
                <div>
                  <label className="comp-label" htmlFor="eval-remarks" style={{ display: 'block', marginBottom: 4 }}>Remarks</label>
                  <textarea
                    id="eval-remarks"
                    value={remarks}
                    onChange={(e) => setRemarks(e.target.value)}
                    rows={3}
                    placeholder="Optional feedback for the participant..."
                    style={{ ...inputStyle, resize: 'vertical', minHeight: 80 }}
                    aria-label="Evaluation remarks"
                  />
                </div>

                {/* Decision */}
                <div>
                  <label className="comp-label" htmlFor="eval-decision" style={{ display: 'block', marginBottom: 4 }}>Decision</label>
                  <select
                    id="eval-decision"
                    value={decision}
                    onChange={(e) => setDecision(e.target.value)}
                    style={inputStyle}
                    aria-label="Evaluation decision"
                  >
                    <option value="pending">Undecided</option>
                    <option value="selected">Selected</option>
                    <option value="rejected">Rejected</option>
                  </select>
                </div>

                {/* Flag */}
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: '0.875rem', color: 'var(--comp-text-secondary)' }}>
                  <input
                    type="checkbox"
                    checked={flagged}
                    onChange={(e) => setFlagged(e.target.checked)}
                    aria-label="Flag submission"
                  />
                  🚩 Flag this submission
                </label>
                {flagged && (
                  <input
                    style={inputStyle}
                    value={flagReason}
                    onChange={(e) => setFlagReason(e.target.value)}
                    placeholder="Reason for flagging..."
                    aria-label="Flag reason"
                  />
                )}

                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void saveEvaluation()}
                  className="comp-btn-primary"
                  aria-label="Save evaluation"
                >
                  {busy ? 'Saving...' : '✓ Save Evaluation'}
                </button>
              </div>
            </SectionCard>

            {/* Audit history panel */}
            {auditEvents.length > 0 && (
              <SectionCard title="Panel Snapshot">
                <AuditHistoryPanel events={auditEvents} />
              </SectionCard>
            )}
          </>
        ) : (
          !loading && (
            <div style={{ textAlign: 'center', padding: 'var(--space-xl)' }}>
              <p className="comp-heading-md">Submission not found</p>
              <Link
                to={`/events/${encodeURIComponent(eventId)}/manage/rounds/${encodeURIComponent(roundId)}/submissions`}
                className="comp-btn-ghost"
              >
                ← Back to Submissions
              </Link>
            </div>
          )
        )}
      </div>
    </ErpPageShell>
  );
}
