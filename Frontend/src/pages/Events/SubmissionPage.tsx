/**
 * SubmissionPage.tsx — Rewritten participant submission flow.
 *
 * Uses campusApi directly (not EventProvider) because this page
 * can also be reached from the old /events/:eventId/submit/:roundId route.
 * Integrates the new FileUploadZone + SubmissionStatusBanner + EvaluationCriteriaTable components.
 */

import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ErpPageShell, SectionCard } from '../../components/erp/ErpPrimitives';
import {
  getCompetitionConfig,
  getMyTeam,
  getMyCompetitionSubmission,
  submitCompetitionWork,
  type CompetitionRound,
} from '../../lib/campusApi';
import { SubmissionStatusBanner } from '../../components/competition/SubmissionStatusBanner';
import { FileUploadZone } from '../../components/competition/FileUploadZone';
import { EvaluationCriteriaTable } from '../../components/competition/EvaluationCriteriaTable';
import { DeadlineCountdown } from '../../components/competition/DeadlineCountdown';
import { ErrorMessage } from '../../components/competition/ErrorMessage';
import { track } from '../../lib/analytics';
import { useOptimistic } from '../../hooks/useOptimistic';

export default function SubmissionPage() {
  const { eventId = '', roundId = '' } = useParams();
  const [round, setRound] = useState<CompetitionRound | null>(null);
  const { value: submission, isPending: optimisticPending, update: updateSubmission, setOptimisticValue } = useOptimistic<Record<string, unknown> | null>(null);
  const [type, setType] = useState<'file' | 'link'>('file');
  const [file, setFile] = useState<File | null>(null);
  const [linkUrl, setLinkUrl] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successBanner, setSuccessBanner] = useState<string | null>(null);
  const [notCompetition, setNotCompetition] = useState(false);
  const [submissionScope, setSubmissionScope] = useState<'individual' | 'team'>('individual');
  const [team, setTeam] = useState<{ name: string; leaderId: string } | null>(null);
  const [fileError, setFileError] = useState<string | undefined>(undefined);
  const [isUploading, setIsUploading] = useState(false);

  async function load() {
    setLoading(true);
    setError(null);
    setNotCompetition(false);
    try {
      const [config, existing] = await Promise.all([
        getCompetitionConfig(eventId),
        getMyCompetitionSubmission(eventId, roundId),
      ]);
      const scope = config.submissionScope ?? 'individual';
      setSubmissionScope(scope);
      if (scope === 'team') {
        const myTeam = await getMyTeam(eventId);
        setTeam(myTeam as { name: string; leaderId: string } | null);
      }
      const nextRound = config.rounds.find((r) => r.roundId === roundId) ?? null;
      setRound(nextRound);
      setOptimisticValue(existing as Record<string, unknown> | null);
      track('submission_form_viewed', { eventId, roundId });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to load.';
      if (msg.toLowerCase().includes('competition config not found')) {
        setNotCompetition(true);
      } else {
        setError(msg);
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, [eventId, roundId]);

  const resubmissionsRemaining = useMemo(() => {
    const max = round?.maxResubmissions ?? 5;
    const used = Number((submission?.resubmissionCount as number | undefined) ?? 0) + (submission ? 1 : 0);
    return Math.max(0, max - used);
  }, [round, submission]);

  const deadlinePassed = round?.submissionDeadline
    ? new Date(round.submissionDeadline) <= new Date()
    : false;

  // Derive SubmissionStatusBanner state
  const submissionBannerState: 'not-submitted' | 'submitted' | 'locked' | 'evaluated-pending' = (() => {
    if (!submission && deadlinePassed) return 'locked';
    if (!submission) return 'not-submitted';
    if (typeof (submission.criteriaScores) === 'object' && submission.criteriaScores) return 'evaluated-pending';
    if (deadlinePassed) return 'locked';
    return 'submitted';
  })();

  async function onSubmit(ev: React.FormEvent) {
    ev.preventDefault();
    setFileError(undefined);
    if (type === 'file' && !file) { setFileError('Please select a file.'); return; }
    if (type === 'link' && !linkUrl.trim()) { setError('Please enter a link URL.'); return; }
    track('submission_started', { eventId, roundId, type });
    setIsUploading(type === 'file');
    setBusy(true);
    setError(null);
    setSuccessBanner(null);

    const optimisticPayload = {
      type,
      linkUrl: type === 'link' ? linkUrl : undefined,
      filePath: type === 'file' ? file?.name : undefined,
      description,
      submittedAt: new Date().toISOString(),
      resubmissionCount: Number((submission?.resubmissionCount as number | undefined) ?? 0) + (submission ? 1 : 0)
    };

    try {
      await updateSubmission(
        { ...submission, ...optimisticPayload },
        async () => {
          await submitCompetitionWork(eventId, roundId, { type, file, linkUrl, description });
          const fresh = await getMyCompetitionSubmission(eventId, roundId);
          return fresh as Record<string, unknown>;
        }
      );
      track('submission_completed', { eventId, roundId });
      setSuccessBanner('Submission uploaded successfully.');
      setFile(null);
      setLinkUrl('');
      setDescription('');
    } catch (err) {
      track('submission_failed', { eventId, roundId, error: String(err) });
      if (type === 'file') setFileError(err instanceof Error ? err.message : 'Upload failed.');
      else setError(err instanceof Error ? err.message : 'Submission failed.');
    } finally {
      setBusy(false);
      setIsUploading(false);
    }
  }

  const accept = round?.submissionTypes?.length
    ? round.submissionTypes.flatMap((t) => (t === 'file' ? ['.pdf', '.zip', '.docx', '.pptx'] : []))
    : ['.pdf', '.zip', '.docx', '.pptx'];

  // @ts-expect-error maxFileSizeMb is dynamic
  const maxSizeMb = round?.maxFileSizeMb ?? 10;

  return (
    <ErpPageShell
      title=""
      source="Internal API"
      isLoading={loading}
      loadingMessage="Loading round details..."
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-lg)' }}>

        {/* Back link */}
        <Link
          to={`/events/${encodeURIComponent(eventId)}`}
          style={{ fontSize: '0.8rem', color: 'var(--comp-text-secondary)', textDecoration: 'none' }}
        >
          ← Back to Event
        </Link>

        {/* Page title */}
        <h1 className="comp-heading-xl" style={{ margin: 0 }}>
          {submission ? 'Resubmit Work' : 'Submit Your Work'}
        </h1>

        {/* Guard states */}
        {notCompetition && (
          <ErrorMessage title="Not a competition" message="This event is not configured as a competition round." />
        )}
        {!notCompetition && submissionScope === 'team' && !team && (
          <ErrorMessage
            title="Team required"
            message="You must be in a team to submit for this competition."
            onRetry={() => window.location.href = `/events/${encodeURIComponent(eventId)}/team`}
          />
        )}

        {/* Success */}
        {successBanner && (
          <div
            role="status"
            style={{
              background: 'var(--status-open-bg)',
              border: '1px solid var(--status-open-border)',
              borderRadius: 8,
              padding: 'var(--space-sm) var(--space-md)',
              color: 'var(--status-open-text)',
              fontWeight: 600,
              fontSize: '0.875rem',
            }}
          >
            ✓ {successBanner}
          </div>
        )}

        {/* Submission status banner */}
        {round && (
          <SubmissionStatusBanner
            state={submissionBannerState}
            roundTitle={round.title}
            submittedAt={submission?.submittedAt as string | undefined}
            resubmissionsRemaining={resubmissionsRemaining}
          />
        )}

        {/* Team info */}
        {submissionScope === 'team' && team && (
          <div style={{ background: 'var(--comp-accent-light)', borderRadius: 10, padding: 'var(--space-md)', fontSize: '0.875rem' }}>
            <p style={{ margin: '0 0 4px', fontWeight: 600 }}>Submitting as team: {team.name}</p>
            <Link to={`/events/${encodeURIComponent(eventId)}/team`} style={{ color: 'var(--comp-accent)', fontSize: '0.8rem' }}>
              Manage Team →
            </Link>
          </div>
        )}

        {/* Round details */}
        {round && (
          <SectionCard title={round.title || 'Round'}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-sm)', fontSize: '0.875rem', color: 'var(--comp-text-secondary)' }}>
              {round.instructions && <p style={{ margin: 0 }}>{round.instructions}</p>}
              {round.submissionDeadline && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span>Deadline:</span>
                  <span style={{ fontWeight: 600, color: 'var(--comp-text-primary)' }}>
                    {new Date(round.submissionDeadline).toLocaleString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                  </span>
                  <DeadlineCountdown deadline={round.submissionDeadline} compact />
                </div>
              )}
              <p style={{ margin: 0 }}>Resubmissions remaining: <strong>{resubmissionsRemaining}</strong></p>
            </div>
          </SectionCard>
        )}

        {/* Criteria */}
        {Array.isArray(round?.evaluationCriteria) && (round?.evaluationCriteria ?? []).length > 0 && (
          <SectionCard title="Evaluation Criteria">
            <EvaluationCriteriaTable
              criteria={round!.evaluationCriteria ?? []}
              readOnly
            />
          </SectionCard>
        )}

        {/* Submission form */}
        {!deadlinePassed && !notCompetition && !(submissionScope === 'team' && !team) && (
          <SectionCard title={submission ? 'Resubmit Work' : 'Submit Work'}>
            <form
              onSubmit={(e) => void onSubmit(e)}
              style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}
            >
              {/* Type selector */}
              <div style={{ display: 'flex', gap: 8 }}>
                {(['file', 'link'] as const).map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setType(t)}
                    aria-pressed={type === t}
                    style={{
                      padding: '7px 16px',
                      border: `1.5px solid ${type === t ? 'var(--comp-accent)' : 'var(--comp-border)'}`,
                      borderRadius: 8,
                      background: type === t ? 'var(--comp-accent)' : 'var(--comp-surface)',
                      color: type === t ? '#fff' : 'var(--comp-text-secondary)',
                      fontWeight: 600,
                      fontSize: '0.8rem',
                      cursor: 'pointer',
                      textTransform: 'capitalize',
                    }}
                  >
                    {t === 'file' ? '📁 File Upload' : '🔗 Link'}
                  </button>
                ))}
              </div>

              {/* Upload zone */}
              {type === 'file' ? (
                <FileUploadZone
                  onFile={setFile}
                  accept={accept}
                  maxSizeMb={maxSizeMb}
                  error={fileError}
                  isUploading={isUploading}
                  currentFile={
                    submission?.filePath
                      ? {
                          name: (submission.filePath as string).split('/').pop() ?? 'file',
                          size: 0,
                          uploadedAt: (submission.submittedAt as string) ?? new Date().toISOString(),
                        }
                      : undefined
                  }
                />
              ) : (
                <div>
                  <label className="comp-label" htmlFor="submission-link" style={{ display: 'block', marginBottom: 4 }}>
                    Link URL
                  </label>
                  <input
                    id="submission-link"
                    type="url"
                    value={linkUrl}
                    onChange={(e) => setLinkUrl(e.target.value)}
                    placeholder="https://..."
                    aria-label="Submission link URL"
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      border: '1px solid var(--comp-border)',
                      borderRadius: 8,
                      background: 'var(--comp-surface)',
                      color: 'var(--comp-text-primary)',
                      fontSize: '0.875rem',
                      outline: 'none',
                      boxSizing: 'border-box',
                    }}
                  />
                </div>
              )}

              {/* Description */}
              <div>
                <label className="comp-label" htmlFor="submission-description" style={{ display: 'block', marginBottom: 4 }}>
                  Description (optional)
                </label>
                <textarea
                  id="submission-description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={3}
                  maxLength={500}
                  placeholder="Brief note about your submission (max 500 chars)"
                  aria-label="Submission description"
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    border: '1px solid var(--comp-border)',
                    borderRadius: 8,
                    background: 'var(--comp-surface)',
                    color: 'var(--comp-text-primary)',
                    fontSize: '0.875rem',
                    outline: 'none',
                    resize: 'vertical',
                    boxSizing: 'border-box',
                  }}
                />
                <p style={{ margin: '2px 0 0', fontSize: '0.7rem', color: 'var(--comp-text-muted)' }}>
                  {description.length}/500
                </p>
              </div>

              {/* Inline API error */}
              {error && <ErrorMessage message={error} preservedInput onRetry={() => void onSubmit(new Event('submit') as unknown as React.FormEvent)} />}

              <button
                type="submit"
                disabled={busy || isUploading}
                className="comp-btn-primary"
                aria-label={submission ? 'Resubmit work' : 'Submit work'}
              >
                {busy ? 'Submitting...' : submission ? 'Resubmit' : '✓ Submit Work'}
              </button>
            </form>
          </SectionCard>
        )}

        {/* Locked state */}
        {deadlinePassed && (
          <ErrorMessage title="Submission closed" message="The deadline for this round has passed." />
        )}
      </div>
    </ErpPageShell>
  );
}
