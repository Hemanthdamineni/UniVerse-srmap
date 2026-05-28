/**
 * CompetitionEventCard.tsx — Card for the events listing page.
 * Keyboard-accessible. Hover lift. Competition cards have teal left border.
 */

import type { EventSummary } from '../../lib/campusApi';
import { StatusBadge } from './StatusBadge';
import { DeadlineCountdown } from './DeadlineCountdown';

interface CompetitionEventCardProps {
  event: EventSummary & {
    prizes?: string | null;
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
  const venueLabel =
    typeof event.location === 'string'
      ? event.location
      : event.location?.physical ?? event.venue;

  return (
    <article
      role="article"
      aria-label={event.title ?? 'Event'}
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick(); } }}
      className="competition-event-card"
    >
      {/* Top row: chips + status */}
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="flex flex-wrap gap-1.5">
          {event.category && (
            <span className="comp-chip">
              {event.category}
            </span>
          )}
          {isComp && (
            <span className="comp-chip-inverse">
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
      <div className="comp-divider" />

      {/* Metadata row */}
      <div className="comp-metadata-row">
        {event.department && <span>🏛 {event.department}</span>}
        {venueLabel && (
          <span>📍 {venueLabel}</span>
        )}
        {event.registeredCount !== undefined && (
          <span>👥 {event.registeredCount} registered</span>
        )}
      </div>

      {/* Prizes */}
      {event.prizes && (
        <p className="comp-prizes-text">
          🏅 {event.prizes}
        </p>
      )}

      {/* Bottom row: rounds count + deadline + CTA */}
      <div className="comp-bottom-row">
        <div className="flex gap-[var(--space-sm)] items-center">
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
        <span className="comp-view-details" aria-hidden="true">
          View Details →
        </span>
      </div>
    </article>
  );
}
