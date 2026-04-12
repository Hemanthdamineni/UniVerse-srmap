/**
 * EventDetailPageNew.tsx — Rewritten event detail at /events/:eventId
 *
 * Uses EventProvider context (no local fetch).
 * Features:
 * - Cover image + hero section
 * - Tab navigation: Overview | Rounds | Timeline | Prizes & Rules | FAQ
 * - Sticky action bar based on userState
 * - Admin inline moderation
 * - GlobalLoadingBoundary / FailureRecoveryBanner
 */

import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ErpPageShell } from '../../components/erp/ErpPrimitives';
import { useEvent, GlobalLoadingBoundary, FailureRecoveryBanner } from '../../contexts/EventContext';
import { StatusBadge } from '../../components/competition/StatusBadge';
import { DeadlineCountdown } from '../../components/competition/DeadlineCountdown';
import { RoundStatusCard } from '../../components/competition/RoundStatusCard';
import type { CompetitionRound } from '../../lib/campusApi';
import type { RoundUserState } from '../../lib/eventUserState';
import { registerForEvent, cancelEventRegistration } from '../../lib/campusApi';

const TABS = ['Overview', 'Rounds', 'Timeline', 'Rules & Prizes', 'FAQ'] as const;
type Tab = typeof TABS[number];

function formatDate(iso: string) {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('en-IN', {
    weekday: 'short', day: 'numeric', month: 'long', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

export default function EventDetailPageNew() {
  const { event, config, userState, loading, error, refetch } = useEvent();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<Tab>('Overview');
  const [busy, setBusy] = useState(false);
  const [banner, setBanner] = useState<{ tone: 'success' | 'warning'; text: string } | null>(null);

  if (loading) return <GlobalLoadingBoundary />;
  if (error || !event) {
    return (
      <FailureRecoveryBanner
        message={error ?? 'Event not found.'}
        onRetry={refetch}
      />
    );
  }

  const rounds: CompetitionRound[] = config?.rounds ?? [];
  const prizes = (event as Record<string, unknown>).prizes as string | undefined;
  const rules = (event as Record<string, unknown>).rules as string | undefined;
  const eligibility = (event as Record<string, unknown>).eligibility as string | undefined;
  const faq = (event as Record<string, unknown>).faq;
  const coverImageUrl = (event as Record<string, unknown>).coverImageUrl as string | undefined;

  // Coerce status
  const validStatuses = ['draft', 'published', 'public', 'ongoing', 'submission-closed', 'evaluation', 'results-published', 'completed', 'archived', 'open', 'upcoming', 'closed', 'in-progress'] as const;
  type ValidStatus = typeof validStatuses[number];
  const badgeStatus: ValidStatus = validStatuses.includes(event.status as ValidStatus) ? (event.status as ValidStatus) : 'upcoming';

  async function runAction(fn: () => Promise<unknown>, successText: string, redirectBack = false) {
    setBusy(true);
    setBanner(null);
    try {
      await fn();
      setBanner({ tone: 'success', text: successText });
      if (redirectBack) { navigate('/events'); return; }
      refetch();
    } catch (e) {
      setBanner({ tone: 'warning', text: e instanceof Error ? e.message : 'Action failed.' });
    } finally {
      setBusy(false);
    }
  }

  function getRoundState(round: CompetitionRound): RoundUserState {
    return userState?.roundStates.find((rs) => rs.roundId === round.roundId) ?? {
      roundId: round.roundId,
      roundTitle: round.title,
      canSubmit: false,
      canViewResults: Boolean(round.resultsPublished),
      submissionState: 'none',
      isShortlisted: false,
      isBlocked: false,
    };
  }

  return (
    <ErpPageShell title="" source="Internal API" isLoading={false}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-lg)' }}>

        {/* Back link */}
        <Link
          to="/events"
          style={{ fontSize: '0.8rem', color: 'var(--comp-text-secondary)', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 4 }}
        >
          ← Back to Events
        </Link>

        {/* Banner */}
        {banner && (
          <div
            role="alert"
            style={{
              padding: 'var(--space-sm) var(--space-md)',
              borderRadius: 8,
              background: banner.tone === 'success' ? 'var(--status-open-bg)' : 'var(--status-live-bg)',
              border: `1px solid ${banner.tone === 'success' ? 'var(--status-open-border)' : 'var(--status-live-border)'}`,
              color: banner.tone === 'success' ? 'var(--status-open-text)' : 'var(--status-live-text)',
              fontSize: '0.875rem',
              fontWeight: 500,
            }}
          >
            {banner.text}
          </div>
        )}

        {/* Cover image */}
        {String(coverImageUrl ?? '').trim() && (
          <div style={{ borderRadius: 12, overflow: 'hidden', maxHeight: 260 }}>
            <img
              src={String(coverImageUrl)}
              alt={`${event.title ?? 'Event'} banner`}
              style={{ width: '100%', height: 260, objectFit: 'cover' }}
            />
          </div>
        )}

        {/* Hero section */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-sm)' }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
            <StatusBadge status={badgeStatus} />
            {event.category && (
              <span style={{ background: 'var(--comp-accent-light)', color: 'var(--comp-accent)', borderRadius: 20, padding: '3px 10px', fontSize: '0.75rem', fontWeight: 600 }}>
                {event.category}
              </span>
            )}
            {config && (
              <span style={{ background: 'var(--comp-accent)', color: '#fff', borderRadius: 20, padding: '3px 10px', fontSize: '0.75rem', fontWeight: 700 }}>
                Competition
              </span>
            )}
            {event.department && (
              <span style={{ fontSize: '0.78rem', color: 'var(--comp-text-muted)' }}>🏛 {event.department}</span>
            )}
          </div>

          <h1 className="comp-heading-xl" style={{ margin: 0 }}>
            {event.title ?? 'Untitled Event'}
          </h1>

          <p className="comp-body" style={{ margin: 0 }}>
            {event.description ?? 'No description provided.'}
          </p>
        </div>

        {/* Stats strip */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-md)' }}>
          {[
            { label: 'Starts', value: formatDate(event.startAt) },
            { label: 'Ends', value: formatDate(event.endAt) },
            { label: 'Venue', value: event.location?.physical ?? event.venue ?? 'TBA' },
            { label: 'RSVP', value: `${event.registeredCount ?? 0} registered` },
          ].map((stat) => (
            <div
              key={stat.label}
              style={{
                flex: '1 1 140px',
                background: 'var(--comp-surface)',
                border: '1px solid var(--comp-border)',
                borderRadius: 10,
                padding: 'var(--space-md)',
              }}
            >
              <p className="comp-label" style={{ margin: 0 }}>{stat.label}</p>
              <p className="comp-heading-md" style={{ margin: '4px 0 0', fontSize: '0.875rem' }}>{stat.value}</p>
            </div>
          ))}
        </div>

        {/* Sticky action bar — participant actions */}
        {userState && userState.role !== 'organizer' && (
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: 'var(--space-sm)',
              padding: 'var(--space-sm) var(--space-md)',
              background: 'var(--comp-surface)',
              border: '1px solid var(--comp-border)',
              borderRadius: 10,
            }}
          >
            {userState.role === 'visitor' && (
              <button
                onClick={() => void runAction(() => registerForEvent(event.id), 'Registered successfully!')}
                disabled={busy}
                className="comp-btn-primary"
              >
                Register for Event
              </button>
            )}
            {userState.role === 'participant' && (
              <button
                onClick={() => void runAction(() => cancelEventRegistration(event.id), 'Registration cancelled.')}
                disabled={busy}
                className="comp-btn-ghost"
                style={{ borderColor: 'var(--status-live-border)', color: 'var(--status-live-text)' }}
              >
                Cancel Registration
              </button>
            )}
            {event.calendar?.icalUrl && (
              <a href={event.calendar.icalUrl} className="comp-btn-ghost" aria-label="Add to calendar">
                📅 Add to Calendar
              </a>
            )}
            {(userState.role as string) === 'organizer' && (
              <Link
                to={`/events/${encodeURIComponent(event.id)}/manage`}
                className="comp-btn-primary"
              >
                Open Organizer Dashboard →
              </Link>
            )}
          </div>
        )}

        {/* Tab bar */}
        <div style={{ display: 'flex', gap: 4, borderBottom: '1px solid var(--comp-border)' }}>
          {TABS.map((tab) => {
            if (tab === 'Rounds' && !config) return null;
            if (tab === 'FAQ' && !(Array.isArray(faq) && (faq as unknown[]).length > 0)) return null;
            return (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                role="tab"
                aria-selected={activeTab === tab}
                style={{
                  padding: '8px 16px',
                  border: 'none',
                  background: 'none',
                  color: activeTab === tab ? 'var(--comp-accent)' : 'var(--comp-text-secondary)',
                  fontWeight: activeTab === tab ? 700 : 400,
                  fontSize: '0.875rem',
                  cursor: 'pointer',
                  borderBottom: `2px solid ${activeTab === tab ? 'var(--comp-accent)' : 'transparent'}`,
                  transition: 'all 0.15s',
                  whiteSpace: 'nowrap',
                }}
              >
                {tab}
              </button>
            );
          })}
        </div>

        {/* Tab content */}
        {activeTab === 'Overview' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
            {config?.submissionScope === 'team' && userState?.role === 'participant' && (
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <Link to={`/events/${encodeURIComponent(event.id)}/team`} className="comp-btn-ghost" style={{ fontSize: '0.8rem' }}>
                  My Team
                </Link>
                <Link to={`/events/${encodeURIComponent(event.id)}/invitations`} className="comp-btn-ghost" style={{ fontSize: '0.8rem' }}>
                  Invitations
                </Link>
              </div>
            )}
          </div>
        )}

        {activeTab === 'Rounds' && config && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
            {rounds.map((round, idx) => (
              <RoundStatusCard
                key={round.roundId}
                round={round}
                roundIndex={idx}
                roundState={getRoundState(round)}
                onSubmit={getRoundState(round).canSubmit
                  ? () => navigate(`/events/${encodeURIComponent(event.id)}/submit/${encodeURIComponent(round.roundId)}`)
                  : undefined}
                onViewResult={round.resultsPublished
                  ? () => navigate(`/events/${encodeURIComponent(event.id)}/my-results/${encodeURIComponent(round.roundId)}`)
                  : undefined}
                onViewSubmissions={userState?.role === 'organizer'
                  ? () => navigate(`/events/${encodeURIComponent(event.id)}/manage/rounds/${encodeURIComponent(round.roundId)}/submissions`)
                  : undefined}
                onEvaluate={userState?.canEvaluate
                  ? () => navigate(`/events/${encodeURIComponent(event.id)}/manage/rounds/${encodeURIComponent(round.roundId)}/submissions`)
                  : undefined}
                onShortlist={userState?.canShortlist && !round.resultsPublished
                  ? () => navigate(`/events/${encodeURIComponent(event.id)}/manage/rounds/${encodeURIComponent(round.roundId)}/shortlist`)
                  : undefined}
              />
            ))}
          </div>
        )}

        {activeTab === 'Timeline' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-sm)' }}>
            {[
              { label: 'Event Starts', date: event.startAt },
              ...rounds.map((r) => ({ label: `${r.title} Deadline`, date: r.submissionDeadline ?? '' })),
              { label: 'Event Ends', date: event.endAt },
            ].filter((t) => t.date).map((item, i) => (
              <div
                key={i}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 'var(--space-md)',
                  padding: 'var(--space-sm) var(--space-md)',
                  background: 'var(--comp-surface)',
                  border: '1px solid var(--comp-border)',
                  borderRadius: 8,
                }}
              >
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--comp-accent)', flexShrink: 0 }} />
                <div style={{ flex: 1 }}>
                  <p style={{ margin: 0, fontWeight: 600, fontSize: '0.875rem', color: 'var(--comp-text-primary)' }}>{item.label}</p>
                  <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--comp-text-secondary)' }}>{formatDate(item.date)}</p>
                </div>
                <DeadlineCountdown deadline={item.date} showIcon compact />
              </div>
            ))}
          </div>
        )}

        {activeTab === 'Rules & Prizes' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
            {prizes && (
              <div style={{ background: 'var(--comp-surface)', border: '1px solid var(--comp-border)', borderRadius: 10, padding: 'var(--space-md)' }}>
                <p className="comp-heading-md" style={{ margin: '0 0 8px' }}>🏅 Prizes</p>
                <p className="comp-body" style={{ margin: 0 }}>{prizes}</p>
              </div>
            )}
            {rules && (
              <div style={{ background: 'var(--comp-surface)', border: '1px solid var(--comp-border)', borderRadius: 10, padding: 'var(--space-md)' }}>
                <p className="comp-heading-md" style={{ margin: '0 0 8px' }}>📋 Rules</p>
                <p className="comp-body" style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{rules}</p>
              </div>
            )}
            {eligibility && (
              <div style={{ background: 'var(--comp-surface)', border: '1px solid var(--comp-border)', borderRadius: 10, padding: 'var(--space-md)' }}>
                <p className="comp-heading-md" style={{ margin: '0 0 8px' }}>✅ Eligibility</p>
                <p className="comp-body" style={{ margin: 0 }}>{eligibility}</p>
              </div>
            )}
          </div>
        )}

        {activeTab === 'FAQ' && Array.isArray(faq) && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-sm)' }}>
            {(faq as string[]).map((item, i) => (
              <div
                key={i}
                style={{
                  background: 'var(--comp-surface)',
                  border: '1px solid var(--comp-border)',
                  borderRadius: 8,
                  padding: 'var(--space-md)',
                  fontSize: '0.875rem',
                  color: 'var(--comp-text-secondary)',
                }}
              >
                {item}
              </div>
            ))}
          </div>
        )}
      </div>
    </ErpPageShell>
  );
}
