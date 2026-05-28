/**
 * OrganizerGuard.tsx — Guards organizer-only content.
 *
 * Checks backend permissions first, then falls back to local role computation.
 * Shows informative messages instead of silent redirects.
 */

import React from 'react';
import { Link } from 'react-router-dom';
import type { EventDetail } from '../../lib/campusApi';

interface OrganizerGuardProps {
  event: EventDetail;
  currentUserId: string;
  children: React.ReactNode;
}

export function OrganizerGuard({ event, currentUserId, children }: OrganizerGuardProps) {
  const permissions = (event as Record<string, unknown>).permissions as
    | { canEdit?: boolean }
    | undefined;

  const coOrgs: string[] = Array.isArray(event.coOrganizers)
    ? (event.coOrganizers as string[])
    : [];
  const createdBy =
    ((event as Record<string, unknown>).createdBy as string | undefined) ??
    (event.createdByUserId as string | undefined) ??
    '';

  const isOrganizer =
    permissions?.canEdit ??
    (createdBy === currentUserId || coOrgs.includes(currentUserId));

  const isArchived = event.status === 'archived';
  const isCompetition = Boolean((event as Record<string, unknown>).competitionConfig);

  if (isArchived) {
    return (
      <OrganizerInfoCard
        message="This competition has been archived. Organizer actions are no longer available."
        eventId={event.id}
      />
    );
  }

  if (!isCompetition) {
    return (
      <OrganizerInfoCard
        message="This event does not have competition features."
        eventId={event.id}
      />
    );
  }

  if (!isOrganizer) {
    return (
      <OrganizerInfoCard
        message="You don't have organizer access to this event."
        eventId={event.id}
      />
    );
  }

  return <>{children}</>;
}

function OrganizerInfoCard({ message, eventId }: { message: string; eventId: string }) {
  return (
    <div
      role="alert" aria-live="polite"
      style={{
        border: `2px solid var(--comp-accent)`,
        borderRadius: 12,
        padding: 'var(--space-lg)',
        background: 'var(--comp-accent-light)',
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--space-sm)',
        maxWidth: 480,
        margin: 'var(--space-xl) auto',
        textAlign: 'center',
      }}
    >
      <span style={{ fontSize: '1.5rem' }} aria-hidden="true">🔒</span>
      <p className="comp-heading-md">{message}</p>
      <Link
        to={`/events/${encodeURIComponent(eventId)}`}
        className="comp-btn-ghost"
        style={{ alignSelf: 'center' }}
      >
        ← Back to Event
      </Link>
    </div>
  );
}
