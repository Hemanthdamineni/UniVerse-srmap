/**
 * EvaluationPage.tsx — Rewritten with EvaluationCriteriaTable + AuditHistoryPanel.
 * prev/next navigation from the sorted submission list.
 */

import { Check } from "lucide-react";
import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { SectionCard } from '../../components/erp/ErpPrimitives';
import { CompetitionPageShell } from '../../components/competition/CompetitionChrome';
import {
  evaluateCompetitionSubmission,
  flagCompetitionSubmission,
  getCompetitionConfig,
  getCompetitionSubmissions,
  getSubmissionEvaluations,
} from '../../lib/campus/campusApi';
import { EvaluationCriteriaTable } from '../../components/competition/EvaluationCriteriaTable';
import { AuditHistoryPanel } from '../../components/competition/CompetitionPanels';
import { ErrorMessage } from '../../components/competition/ErrorMessage';
import { track } from '../../lib/core/analytics';
import { useOptimistic } from '../../hooks/useOptimistic';
import { Input } from "../../components/input";
import { Textarea } from "../../components/textarea";
import { Select } from "../../components/select";

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
  const currentType = String(current?.type ?? '');
  const currentDescription = current?.description ? String(current.description) : '';
  const currentLinkUrl = current?.linkUrl ? String(current.linkUrl) : '';
  const currentFilePath = current?.filePath ? String(current.filePath) : '';

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

  return (
    <CompetitionPageShell
      eyebrow="Evaluation Phase"
      title="Submission Review"
      subtitle="Score the current submission, add notes, and record the final verdict."
      variant="wide"
    >
      <div className="space-y-6">

        {/* Header navigation */}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex gap-2">
            <Link
              to={`/events/${encodeURIComponent(eventId)}/manage/rounds/${encodeURIComponent(roundId)}/submissions`}
              className="comp-btn-ghost"
            >
              ← All Submissions
            </Link>
          </div>
          <div className="flex gap-2">
            {prev && (
              <Link
                className="comp-btn-ghost"
                to={`/events/${encodeURIComponent(eventId)}/manage/rounds/${encodeURIComponent(roundId)}/submissions/${encodeURIComponent(String(prev.id))}/evaluate`}
              >
                ← Prev
              </Link>
            )}
            <span className="comp-body self-center">
              {index + 1}/{rows.length}
            </span>
            {next && (
              <Link
                className="comp-btn-ghost"
                to={`/events/${encodeURIComponent(eventId)}/manage/rounds/${encodeURIComponent(roundId)}/submissions/${encodeURIComponent(String(next.id))}/evaluate`}
              >
                Next →
              </Link>
            )}
          </div>
        </div>

        {/* Status messages */}
        {successMsg && (
          <div role="status" className="rounded-xl border border-[var(--status-open-border)] bg-[var(--status-open-bg)] px-3 py-2 text-sm font-semibold text-[var(--status-open-text)]">
            <Check size={14} aria-hidden="true" /> {successMsg}
          </div>
        )}
        {error && <ErrorMessage message={error} preservedInput onRetry={() => void saveEvaluation()} />}

        {current ? (
          <>
            {/* Submission preview */}
            <SectionCard title="Submission Preview">
              <div className="space-y-2 text-sm">
                <p className="m-0">
                  <span className="comp-label">Participant:</span>{' '}
                  <strong className="text-[var(--text-primary)]">{String(current.submittedBy ?? '—')}</strong>
                </p>
                <p className="m-0">
                  <span className="comp-label">Submitted:</span>{' '}
                  {current.submittedAt ? new Date(String(current.submittedAt)).toLocaleString('en-IN') : '—'}
                </p>
                <p className="m-0">
                  <span className="comp-label">Type:</span> {String(current.type ?? '—')}
                </p>
                {currentDescription && (
                  <p className="m-0 text-[var(--text-secondary)]">{currentDescription}</p>
                )}
                {currentType === 'link' && currentLinkUrl && (
                  <a href={currentLinkUrl} target="_blank" rel="noreferrer" className="comp-btn-ghost w-fit">
                    🔗 Open Submission Link
                  </a>
                )}
                {currentType === 'file' && currentFilePath && (
                  <a href={`/files/submissions/${currentFilePath}`} target="_blank" rel="noreferrer" className="comp-btn-ghost w-fit">
                    📁 Open Submission File
                  </a>
                )}
                {Boolean(current.flagged) && (
                  <div className="rounded-lg border border-[var(--status-live-border)] bg-[var(--status-live-bg)] px-2 py-1 text-xs font-semibold text-[var(--status-live-text)]">
                    🚩 Flagged: {String(current.flagReason ?? 'No reason provided')}
                  </div>
                )}
              </div>
            </SectionCard>

            {/* Evaluation form */}
            <SectionCard title="Evaluation Form">
              <div className="space-y-4">
                {/* Criteria table — editable */}
                <EvaluationCriteriaTable
                  criteria={criteria}
                  scores={scores}
                  onChange={(label, score) => setScores((prev) => ({ ...prev, [label]: score }))}
                  readOnly={false}
                />

                {/* Remarks */}
                <div>
                  <label className="comp-label mb-1 block" htmlFor="eval-remarks">Remarks</label>
                  <Textarea
                    id="eval-remarks"
                    value={remarks}
                    onChange={(e) => setRemarks(e.target.value)}
                    rows={3}
                    placeholder="Optional feedback for the participant..."
                    aria-label="Evaluation remarks"
                    className="min-h-[80px]"
                  />
                </div>

                {/* Decision */}
                <div>
                  <label className="comp-label mb-1 block" htmlFor="eval-decision">Decision</label>
                  <Select
                    id="eval-decision"
                    value={decision}
                    onChange={(e) => setDecision(e.target.value)}
                    aria-label="Evaluation decision"
                  >
                    <option value="pending">Undecided</option>
                    <option value="selected">Selected</option>
                    <option value="rejected">Rejected</option>
                  </Select>
                </div>

                {/* Flag */}
                <label className="flex cursor-pointer items-center gap-2 text-sm text-[var(--text-secondary)]">
                  <input
                    type="checkbox"
                    checked={flagged}
                    onChange={(e) => setFlagged(e.target.checked)}
                    aria-label="Flag submission"
                  />
                  🚩 Flag this submission
                </label>
                {flagged && (
                  <Input
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
                  {busy ? 'Saving...' : <><Check size={14} aria-hidden="true" /> Save Evaluation</>}
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
            <div className="p-8 text-center">
              <p className="comp-heading-md m-0">Submission not found</p>
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
    </CompetitionPageShell>
  );
}
