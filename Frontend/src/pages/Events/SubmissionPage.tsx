/**
 * SubmissionPage.tsx — Rewritten participant submission flow.
 *
 * Uses campusApi directly (not EventProvider) because this page
 * can also be reached from the old /events/:eventId/submit/:roundId route.
 * Integrates the new FileUploadZone + SubmissionStatusBanner + EvaluationCriteriaTable components.
 */

import { Check } from "lucide-react";
import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { SectionCard } from '../../components/erp/ErpPrimitives';
import { CompetitionPageShell } from '../../components/competition/CompetitionChrome';
import {
  getCompetitionConfig,
  getMyTeam,
  getMyCompetitionSubmission,
  submitCompetitionWork,
  type CompetitionRound,
} from '../../lib/campus/campusApi';
import { SubmissionStatusBanner } from '../../components/competition/CompetitionBanners';
import { FileUploadZone } from '../../components/competition/FileUploadZone';
import { Input } from "../../components/input";
import { Textarea } from "../../components/textarea";
import { FormField } from "../../components/forms/FormField";
import { EvaluationCriteriaTable } from '../../components/competition/EvaluationCriteriaTable';
import { DeadlineCountdown } from '../../components/competition/DeadlineCountdown';
import { ErrorMessage } from '../../components/competition/ErrorMessage';
import { track } from '../../lib/core/analytics';
import { useOptimistic } from '../../hooks/useOptimistic';

export default function SubmissionPage() {
  const { eventId = '', roundId = '' } = useParams();
  const [round, setRound] = useState<CompetitionRound | null>(null);
  const { value: submission, update: updateSubmission, setOptimisticValue } = useOptimistic<Record<string, unknown> | null>(null);
  const [type, setType] = useState<'file' | 'link'>('file');
  const [file, setFile] = useState<File | null>(null);
  const [linkUrl, setLinkUrl] = useState('');
  const [description, setDescription] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successBanner, setSuccessBanner] = useState<string | null>(null);
  const [notCompetition, setNotCompetition] = useState(false);
  const [submissionScope, setSubmissionScope] = useState<'individual' | 'team'>('individual');
  const [team, setTeam] = useState<{ name: string; leaderId: string } | null>(null);
  const [fileError, setFileError] = useState<string | undefined>(undefined);
  const [isUploading, setIsUploading] = useState(false);

  async function load() {
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
    <CompetitionPageShell
      eyebrow="Autosaved just now"
      title={submission ? 'Resubmit Project' : 'Submit Project'}
      subtitle={round?.title || 'Upload project files and links for this round.'}
      variant="focus"
    >
      <div className="space-y-6">

        {/* Back link */}
        <Link
          to={`/events/${encodeURIComponent(eventId)}`}
          className="text-xs text-[var(--text-secondary)] no-underline"
        >
          ← Back to Event
        </Link>

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
          <div role="status" className="rounded-xl border border-[var(--status-open-border)] bg-[var(--status-open-bg)] px-3 py-2 text-sm font-semibold text-[var(--status-open-text)]">
            <Check size={14} aria-hidden="true" /> {successBanner}
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
          <div className="rounded-xl border border-[var(--border)] bg-[var(--dash-subcard-bg)] p-4 text-sm">
            <p className="mb-1 font-semibold text-[var(--text-primary)]">Submitting as team: {team.name}</p>
            <Link to={`/events/${encodeURIComponent(eventId)}/team`} className="text-xs text-[var(--comp-accent)]">
              Manage Team →
            </Link>
          </div>
        )}

        {/* Round details */}
        {round && (
          <SectionCard title={round.title || 'Round'}>
            <div className="space-y-2 text-sm text-[var(--text-secondary)]">
              {round.instructions && <p className="m-0">{round.instructions}</p>}
              {round.submissionDeadline && (
                <div className="flex items-center gap-2">
                  <span>Deadline:</span>
                  <span className="font-semibold text-[var(--text-primary)]">
                    {new Date(round.submissionDeadline).toLocaleString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                  </span>
                  <DeadlineCountdown deadline={round.submissionDeadline} compact />
                </div>
              )}
              <p className="m-0">Resubmissions remaining: <strong>{resubmissionsRemaining}</strong></p>
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
              className="space-y-4"
            >
              {/* Type selector */}
              <div className="flex gap-2">
                {(['file', 'link'] as const).map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setType(t)}
                    aria-pressed={type === t}
                    className={`rounded-lg border px-3 py-1 text-xs font-semibold capitalize ${
                      type === t
                        ? 'border-[var(--comp-accent)] bg-[var(--comp-accent)] text-white'
                        : 'border-[var(--border)] bg-[var(--dash-subcard-bg)] text-[var(--text-secondary)]'
                    }`}
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
                <FormField id="submission-link" label="Link URL">
                  <Input
                    id="submission-link"
                    type="url"
                    value={linkUrl}
                    onChange={(e) => setLinkUrl(e.target.value)}
                    placeholder="https://..."
                    aria-label="Submission link URL"
                  />
                </FormField>
              )}

              {/* Description */}
              <FormField id="submission-description" label="Description (optional)" hint={`${description.length}/500`}>
                <Textarea
                  id="submission-description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={3}
                  maxLength={500}
                  placeholder="Brief note about your submission (max 500 chars)"
                  aria-label="Submission description"
                  className="min-h-[96px]"
                />
              </FormField>

              {/* Inline API error */}
              {error && <ErrorMessage message={error} preservedInput onRetry={() => void onSubmit(new Event('submit') as unknown as React.FormEvent)} />}

              <button
                type="submit"
                disabled={busy || isUploading}
                className="comp-btn-primary"
                aria-label={submission ? 'Resubmit work' : 'Submit work'}
              >
                {busy ? 'Submitting...' : submission ? 'Resubmit' : <><Check size={14} aria-hidden="true" /> Submit Work</>}
              </button>
            </form>
          </SectionCard>
        )}

        {/* Locked state */}
        {deadlinePassed && (
          <ErrorMessage title="Submission closed" message="The deadline for this round has passed." />
        )}
      </div>
    </CompetitionPageShell>
  );
}
