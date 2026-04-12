/**
 * CompetitionEventCard.tsx — Card for the events listing page.
 * Keyboard-accessible. Hover lift. Competition cards have teal left border.
 */

import type { EventSummary } from '../../lib/campusApi';
import { StatusBadge } from './StatusBadge';
import { DeadlineCountdown } from './DeadlineCountdown';

interface CompetitionEventCardProps {
  event: EventSummary & {
    prizes?: string;
    isCompetition?: boolean;
    competitionConfig?: unknown;
  };
  onClick: () => void;
}

export function CompetitionEventCard({ event, onClick }: CompetitionEventCardProps) {
  const isComp = Boolean(event.isCompetition ?? event.competitionConfig);
  let rounds: unknown[] = [];
  try {
    const cfg =
      typeof event.competitionConfig === 'string'
        ? JSON.parse(event.competitionConfig)
        : event.competitionConfig;
    if (cfg && Array.isArray(cfg.rounds)) rounds = cfg.rounds as unknown[];
  } catch { /* ignore */ }

  // Find earliest open deadline for countdown
  const now = Date.now();
  const nextDeadline = (rounds as Array<{ submissionDeadline?: string }>)
    .map((r) => r.submissionDeadline)
    .filter(Boolean)
    .find((d) => new Date(d!).getTime() > now);

  // Coerce status to StatusBadge type
  const statusValues = [
    'draft', 'published', 'public', 'ongoing', 'submission-closed',
    'evaluation', 'results-published', 'completed', 'archived',
    'open', 'upcoming', 'closed', 'in-progress',
  ] as const;
  type ValidStatus = typeof statusValues[number];
  const badgeStatus: ValidStatus = statusValues.includes(event.status as ValidStatus)
    ? (event.status as ValidStatus)
    : 'upcoming';

  return (
    <article
      role="article"
      aria-label={event.title ?? 'Event'}
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick(); } }}
      style={{
        background: 'var(--comp-surface)',
        border: '1px solid var(--comp-border)',
        borderLeft: isComp ? '3px solid var(--comp-accent)' : '1px solid var(--comp-border)',
        borderRadius: 12,
        padding: 'var(--space-md)',
        cursor: 'pointer',
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--space-sm)',
        transition: 'transform 0.15s ease, box-shadow 0.15s ease',
        outline: 'none',
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLElement).style.transform = 'translateY(-2px)';
        (e.currentTarget as HTMLElement).style.boxShadow = '0 6px 20px rgba(10,38,42,0.12)';
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLElement).style.transform = '';
        (e.currentTarget as HTMLElement).style.boxShadow = '';
      }}
    >
      {/* Top row: chips + status */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {event.category && (
            <span
              style={{
                background: 'var(--comp-accent-light)',
                color: 'var(--comp-accent)',
                borderRadius: 20,
                padding: '2px 8px',
                fontSize: '0.7rem',
                fontWeight: 600,
              }}
            >
              {event.category}
            </span>
          )}
          {isComp && (
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
              Competition
            </span>
          )}
        </div>
        <StatusBadge status={badgeStatus} size="sm" />
      </div>

      {/* Title */}
      <h3
        className="comp-heading-md"
        style={{
          margin: 0,
          overflow: 'hidden',
          display: '-webkit-box',
          WebkitLineClamp: 2,
          WebkitBoxOrient: 'vertical',
        }}
      >
        {event.title ?? 'Untitled Event'}
      </h3>

      {/* Description */}
      {event.description && (
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
          {event.description}
        </p>
      )}

      {/* Divider */}
      <div style={{ borderTop: '1px solid var(--comp-border)' }} />

      {/* Metadata row */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: 'var(--space-sm)',
          fontSize: '0.78rem',
          color: 'var(--comp-text-muted)',
        }}
      >
        {event.department && <span>🏛 {event.department}</span>}
        {(event.location?.physical ?? event.venue) && (
          <span>📍 {event.location?.physical ?? event.venue}</span>
        )}
        {event.registeredCount !== undefined && (
          <span>👥 {event.registeredCount} registered</span>
        )}
      </div>

      {/* Prizes */}
      {event.prizes && (
        <p style={{ margin: 0, fontSize: '0.78rem', color: 'var(--comp-text-secondary)', fontWeight: 600 }}>
          🏅 {event.prizes}
        </p>
      )}

      {/* Bottom row: rounds count + deadline + CTA */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8, marginTop: 'auto' }}>
        <div style={{ display: 'flex', gap: 'var(--space-sm)', alignItems: 'center' }}>
          {rounds.length > 0 && (
            <span
              style={{
                fontSize: '0.75rem',
                color: 'var(--comp-text-secondary)',
                fontWeight: 500,
              }}
            >
              {rounds.length} Round{rounds.length !== 1 ? 's' : ''}
            </span>
          )}
          {nextDeadline && (
            <DeadlineCountdown deadline={nextDeadline} showIcon compact />
          )}
        </div>
        <span
          style={{
            fontSize: '0.8rem',
            fontWeight: 600,
            color: 'var(--comp-accent)',
          }}
          aria-hidden="true"
        >
          View Details →
        </span>
      </div>
    </article>
  );
}
