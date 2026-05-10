/**
 * MyResultsPage.tsx — Rewritten with SubmissionStatusBanner and EvaluationCriteriaTable.
 * Shows locked/published states, animated score reveal, and certificate download.
 */

import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { CompetitionPageShell } from '../../components/competition/CompetitionChrome';
import { getMyCompetitionResult, getMyRoundCertificate, getCompetitionConfig } from '../../lib/campusApi';
import { SubmissionStatusBanner } from '../../components/competition/SubmissionStatusBanner';
import { EvaluationCriteriaTable } from '../../components/competition/EvaluationCriteriaTable';
import { EmptyState } from '../../components/competition/EmptyState';
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
      title="Your Performance"
      subtitle="Detailed breakdown of your event results."
      variant="wide"
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-lg)' }}>

        <Link
          to={`/events/${encodeURIComponent(eventId)}`}
          style={{ fontSize: '0.8rem', color: 'var(--comp-text-secondary)', textDecoration: 'none' }}
        >
          ← Back to Event
        </Link>

        <h1 className="comp-heading-xl" style={{ margin: 0 }}>Round Results</h1>

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
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 8,
                  background: 'var(--comp-surface)',
                  border: '2px solid var(--comp-accent)',
                  borderRadius: 16,
                  padding: 'var(--space-xl)',
                }}
              >
                <p className="comp-label">Your Score</p>
                <p
                  style={{
                    fontSize: 'clamp(2.5rem, 6vw, 4rem)',
                    fontWeight: 800,
                    color: 'var(--comp-accent)',
                    lineHeight: 1,
                    margin: 0,
                  }}
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
                <p className="comp-heading-md" style={{ margin: '0 0 8px' }}>Criteria Breakdown</p>
                <EvaluationCriteriaTable
                  criteria={criteria}
                  scores={result.criteriaScores}
                  readOnly
                />
              </div>
            )}

            {/* Remarks */}
            {result.remarks && (
              <div style={{ background: 'var(--comp-accent-light)', borderRadius: 10, padding: 'var(--space-md)' }}>
                <p className="comp-label" style={{ margin: '0 0 4px' }}>Evaluator Remarks</p>
                <p className="comp-body" style={{ margin: 0 }}>{result.remarks}</p>
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
                className="comp-btn-primary"
                style={{ alignSelf: 'flex-start' }}
                aria-label="Download certificate"
              >
                🎓 Download Certificate
              </a>
            )}
          </>
        )}

        <div style={{ display: 'flex', gap: 'var(--space-sm)', marginTop: 'auto', paddingTop: 'var(--space-sm)' }}>
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
