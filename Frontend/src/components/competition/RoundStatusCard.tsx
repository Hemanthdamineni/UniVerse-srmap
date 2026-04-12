/**
 * RoundStatusCard.tsx — Stateless round card.
 *
 * Reads role/state entirely from roundState prop — never computes internally.
 * This enforces the single source of truth from getEventUserState().
 */

import type { CompetitionRound } from '../../lib/campusApi';
import type { RoundUserState } from '../../lib/eventUserState';
import { DeadlineCountdown } from './DeadlineCountdown';

interface RoundStatusCardProps {
  round: CompetitionRound;
  roundIndex: number;
  roundState: RoundUserState;
  onSubmit?: () => void;
  onViewResult?: () => void;
  onViewSubmissions?: () => void;
  onEvaluate?: () => void;
  onShortlist?: () => void;
}

function getBorderColor(roundState: RoundUserState): string {
  if (roundState.isBlocked) return 'var(--comp-border)';
  switch (roundState.submissionState) {
    case 'published': return 'var(--comp-accent)';
    case 'locked': return '#b45309';
    case 'evaluated': return '#b45309';
    default: return '#15803d';
  }
}

export function RoundStatusCard({
  round,
  roundIndex,
  roundState,
  onSubmit,
  onViewResult,
  onViewSubmissions,
  onEvaluate,
  onShortlist,
}: RoundStatusCardProps) {
  const borderColor = getBorderColor(roundState);
  const criteria = round.evaluationCriteria ?? [];

  return (
    <div
      aria-label={round.title}
      style={{
        background: 'var(--comp-surface)',
        border: '1px solid var(--comp-border)',
        borderLeft: `3px solid ${borderColor}`,
        borderRadius: 10,
        padding: 'var(--space-md)',
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--space-sm)',
      }}
    >
      {/* Header row */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span
            style={{
              background: 'var(--comp-accent)',
              color: '#fff',
              borderRadius: 20,
              padding: '2px 8px',
              fontSize: '0.7rem',
              fontWeight: 700,
            }}
          >
            Round {roundIndex + 1}
          </span>
          <span className="comp-heading-md">{round.title}</span>
        </div>
        <span
          style={{
            fontSize: '0.75rem',
            fontWeight: 600,
            color: roundState.submissionState === 'published' ? 'var(--comp-accent)' : 'var(--comp-text-muted)',
          }}
        >
          {roundState.submissionState === 'published'
            ? 'Results Published'
            : roundState.submissionState === 'locked'
            ? 'Closed'
            : roundState.submissionState === 'submitted'
            ? 'Submitted'
            : roundState.submissionState === 'evaluated'
            ? 'Evaluated'
            : 'Open'}
        </span>
      </div>

      {/* Deadline */}
      {round.submissionDeadline && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span className="comp-body" style={{ color: 'var(--comp-text-muted)', fontSize: '0.78rem' }}>
            Deadline:{' '}
            {new Date(round.submissionDeadline).toLocaleDateString('en-IN', {
              weekday: 'short',
              day: 'numeric',
              month: 'short',
              hour: '2-digit',
              minute: '2-digit',
            })}
          </span>
          <DeadlineCountdown deadline={round.submissionDeadline} showIcon compact />
        </div>
      )}

      {/* Instructions (truncated) */}
      {round.instructions && (
        <p
          className="comp-body"
          style={{
            margin: 0,
            overflow: 'hidden',
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
          }}
        >
          {round.instructions}
        </p>
      )}

      {/* Evaluation criteria chips */}
      {criteria.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {criteria.map((c) => (
            <span
              key={c.label}
              style={{
                background: 'var(--comp-accent-light)',
                color: 'var(--comp-accent)',
                borderRadius: 20,
                padding: '2px 8px',
                fontSize: '0.7rem',
                fontWeight: 600,
              }}
            >
              {c.label} /{c.maxScore}
            </span>
          ))}
        </div>
      )}

      {/* Blocked state */}
      {roundState.isBlocked && roundState.blockReason && (
        <div
          style={{
            background: 'var(--status-closed-bg)',
            border: '1px solid var(--status-closed-border)',
            borderRadius: 6,
            padding: '6px 10px',
            fontSize: '0.8rem',
            color: 'var(--status-closed-text)',
            display: 'flex',
            alignItems: 'center',
            gap: 6,
          }}
        >
          🔒 {roundState.blockReason}
        </div>
      )}

      {/* Divider */}
      <div style={{ borderTop: '1px solid var(--comp-border)' }} />

      {/* CTAs */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        {roundState.canSubmit && onSubmit && (
          <button
            onClick={onSubmit}
            className="comp-btn-primary"
            aria-label={`Submit work for ${round.title}`}
            style={{ fontSize: '0.8rem', padding: '6px 14px' }}
          >
            Submit Work
          </button>
        )}
        {roundState.canViewResults && onViewResult && (
          <button
            onClick={onViewResult}
            className="comp-btn-ghost"
            aria-label={`View result for ${round.title}`}
            style={{ fontSize: '0.8rem', padding: '6px 14px' }}
          >
            View My Result
          </button>
        )}
        {onViewSubmissions && (
          <button
            onClick={onViewSubmissions}
            className="comp-btn-ghost"
            aria-label={`View submissions for ${round.title}`}
            style={{ fontSize: '0.8rem', padding: '6px 14px' }}
          >
            View Submissions
          </button>
        )}
        {onEvaluate && (
          <button
            onClick={onEvaluate}
            className="comp-btn-ghost"
            aria-label={`Evaluate submissions for ${round.title}`}
            style={{ fontSize: '0.8rem', padding: '6px 14px' }}
          >
            Evaluate
          </button>
        )}
        {onShortlist && roundState.submissionState !== 'published' && (
          <button
            onClick={onShortlist}
            className="comp-btn-ghost"
            aria-label={`Shortlist for ${round.title}`}
            style={{ fontSize: '0.8rem', padding: '6px 14px' }}
          >
            Shortlist
          </button>
        )}
      </div>
    </div>
  );
}
