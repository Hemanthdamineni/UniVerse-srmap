/**
 * MyResultsPage.tsx — Rewritten with SubmissionStatusBanner and EvaluationCriteriaTable.
 * Shows locked/published states, animated score reveal, and certificate download.
 */

import { GraduationCap } from "lucide-react";
import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { CompetitionPageShell } from '../../components/competition/CompetitionChrome';
import { getMyCompetitionResult, getMyRoundCertificate, getCompetitionConfig } from '../../lib/campus/campusApi';
import { SubmissionStatusBanner } from '../../components/competition/CompetitionBanners';
import { EvaluationCriteriaTable } from '../../components/competition/EvaluationCriteriaTable';
import { EmptyState } from '../../components/competition/CompetitionEmptyState';
import { ErrorMessage } from '../../components/competition/ErrorMessage';

type ResultData = {
  submittedAt: string;
  totalScore?: number;
  criteriaScores?: Record<string, number>;
  remarks?: string;
  decision?: string;
  shortlisted?: boolean;
  teamId?: string;
  teamName?: string;
};

type Criterion = { label: string; maxScore: number };

export default function MyResultsPage() {
  const { eventId = '', roundId = '' } = useParams();
  const [result, setResult] = useState<ResultData | null>(null);
  const [criteria, setCriteria] = useState<Criterion[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [certificatePath, setCertificatePath] = useState('');
  const [resultsPublished, setResultsPublished] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const [data, config] = await Promise.all([
          getMyCompetitionResult(eventId, roundId),
          getCompetitionConfig(eventId).catch(() => null),
        ]);
        if (!cancelled) {
          setResult(data as ResultData | null);
          const round = config?.rounds.find((r) => r.roundId === roundId);
          setCriteria(round?.evaluationCriteria ?? []);
          setResultsPublished(round?.resultsPublished ?? false);
          try {
            const cert = await getMyRoundCertificate(eventId, roundId);
            if (!cancelled) setCertificatePath(`/files/${cert.filePath}`);
          } catch {
            if (!cancelled) setCertificatePath('');
          }
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load results.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => { cancelled = true; };
  }, [eventId, roundId]);

  // Derive status state
  const submissionBannerState: 'submitted' | 'locked' | 'evaluated-pending' | 'shortlisted' | 'not-evaluated' | 'not-selected' = (() => {
    if (!result) return 'locked';
    if (result.shortlisted) return 'shortlisted';
    if (resultsPublished && result.decision === 'rejected') return 'not-selected';
    if (resultsPublished && !result.criteriaScores) return 'not-evaluated';
    if (result.criteriaScores) return 'evaluated-pending';
    return 'submitted';
  })();

  return (
    <CompetitionPageShell
      title="Round Results"
      subtitle="Detailed breakdown of your performance in this round."
      variant="wide"
    >
      <div className="flex flex-col gap-6">

        <Link
          to={`/events/${encodeURIComponent(eventId)}`}
          className="text-[0.8rem] no-underline text-[var(--comp-text-secondary)]"
        >
          ← Back to Event
        </Link>

        {error && <ErrorMessage message={error} />}

        {!result && !error && !loading && (
          <EmptyState
            icon="📋"
            title="No submission found"
            description="You didn't submit work for this round."
          />
        )}

        {result && (
          <>
            <SubmissionStatusBanner
              state={submissionBannerState}
              roundTitle="This Round"
              submittedAt={result.submittedAt}
            />

            {/* Score card — animated reveal */}
            {typeof result.totalScore === 'number' && (
              <div className="flex flex-col items-center gap-2 rounded-2xl border-2 border-[var(--comp-accent)] bg-[var(--comp-surface)] p-10">
                <p className="comp-label">Your Score</p>
                <p
                  className="m-0 text-[clamp(2.5rem,6vw,4rem)] font-extrabold leading-none text-[var(--comp-accent)]"
                  aria-label={`Score: ${result.totalScore}`}
                >
                  {result.totalScore}
                </p>
                {criteria.length > 0 && (
                  <p className="comp-body">
                    out of {criteria.reduce((acc, c) => acc + c.maxScore, 0)}
                  </p>
                )}
              </div>
            )}

            {/* Criteria breakdown */}
            {criteria.length > 0 && result.criteriaScores && (
              <div>
                <p className="comp-heading-md m-0 mb-2">Criteria Breakdown</p>
                <EvaluationCriteriaTable
                  criteria={criteria}
                  scores={result.criteriaScores}
                  readOnly
                />
              </div>
            )}

            {/* Remarks */}
            {result.remarks && (
              <div className="rounded-lg bg-[var(--comp-accent-light)] p-4">
                <p className="comp-label m-0 mb-1">Evaluator Remarks</p>
                <p className="comp-body m-0">{result.remarks}</p>
              </div>
            )}

            {/* Team */}
            {result.teamId && (
              <p className="comp-body">Submitted as team: <strong>{result.teamName ?? result.teamId}</strong></p>
            )}

            {/* Certificate */}
            {certificatePath && (
              <a
                href={certificatePath}
                target="_blank"
                rel="noreferrer"
                className="comp-btn-primary self-start"
                aria-label="Download certificate"
              >
                <GraduationCap size={14} aria-hidden="true" /> Download Certificate
              </a>
            )}
          </>
        )}

        <div className="mt-auto flex gap-2 pt-2">
          <Link
            to={`/events/${encodeURIComponent(eventId)}/leaderboard/${encodeURIComponent(roundId)}`}
            className="comp-btn-ghost"
          >
            View Leaderboard
          </Link>
        </div>
      </div>
    </CompetitionPageShell>
  );
}
