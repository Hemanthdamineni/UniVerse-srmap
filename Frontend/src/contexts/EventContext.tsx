/**
 * EventContext.tsx — Global event context provider.
 *
 * Wraps all /events/:eventId/* routes. Child pages use useEvent() to access
 * event, config, and userState — no repeated API calls per page.
 *
 * Smart polling intervals:
 *   LIVE phase       → 10s  (submissions open)
 *   EVALUATION phase → 15s  (organizer actively evaluating)
 *   Other phases     → 30s
 *
 * Polling only fires when !document.hidden. Always cleans up on unmount.
 */

import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { getEvent, getCompetitionConfig, type EventDetail, type CompetitionConfig, type CompetitionRound } from '../lib/campusApi';
import { eventCache } from '../lib/eventCache';
import { getEventPhase } from '../lib/eventPhase';
import { getEventUserState, type EventUserState, type BackendPermissions } from '../lib/eventUserState';
import { readStoredProfileData } from '../lib/session';
import type { Submission } from '../lib/competitionsApi';
import { getMySubmission } from '../lib/competitionsApi';

// ─── Context value type ───────────────────────────────────────────────────────

interface EventContextValue {
  event: EventDetail | null;
  config: CompetitionConfig | null;
  userState: EventUserState | null;
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

// ─── Context ──────────────────────────────────────────────────────────────────

const EventContext = createContext<EventContextValue | null>(null);

// ─── useSubmissions hook ──────────────────────────────────────────────────────

/**
 * Fetches participant's own submissions for all rounds, memoized by eventId.
 * Returns a record keyed by roundId.
 */
function useSubmissions(
  eventId: string,
  config: CompetitionConfig | null
): Record<string, Submission | null> {
  const [submissions, setSubmissions] = useState<Record<string, Submission | null>>({});

  useEffect(() => {
    if (!config) return;
    Promise.all(
      config.rounds.map((r: CompetitionRound) =>
        getMySubmission(eventId, r.roundId)
          .then((sub) => [r.roundId, sub] as const)
          .catch(() => [r.roundId, null] as const)
      )
    ).then((pairs) => setSubmissions(Object.fromEntries(pairs)));
  }, [eventId, config]);

  return submissions;
}

// ─── EventProvider ────────────────────────────────────────────────────────────

export function EventProvider({
  eventId,
  children,
}: {
  eventId: string;
  children: React.ReactNode;
}) {
  const [event, setEvent] = useState<EventDetail | null>(null);
  const [config, setConfig] = useState<CompetitionConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const userId = (() => {
    const profile = readStoredProfileData();
    return (
      (profile?.registerNumber as string | undefined) ??
      (profile?.id as string | undefined) ??
      ''
    );
  })();

  const fetchData = useCallback(
    async (skipCache = false) => {
      const cacheKey = `event:${eventId}`;
      const configKey = `config:${eventId}`;

      if (!skipCache) {
        const cachedEvent = eventCache.get<EventDetail>(cacheKey);
        const cachedConfig = eventCache.get<CompetitionConfig | null>(configKey);
        if (cachedEvent) {
          setEvent(cachedEvent);
          setConfig(cachedConfig ?? null);
          setLoading(false);
          return;
        }
      }

      try {
        const [eventData, configData] = await Promise.all([
          getEvent(eventId),
          getCompetitionConfig(eventId).catch(() => null),
        ]);
        eventCache.set(cacheKey, eventData, 60_000);
        eventCache.set(configKey, configData, 120_000);
        setEvent(eventData);
        setConfig(configData as CompetitionConfig | null);
        setError(null);
      } catch {
        setError('Failed to load event. Please try again.');
      } finally {
        setLoading(false);
      }
    },
    [eventId]
  );

  // Initial fetch
  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  // Smart polling — interval adapts to event phase
  const eventRef = useRef(event);
  useEffect(() => { eventRef.current = event; }, [event]);

  useEffect(() => {
    const getInterval = () => {
      const phase = eventRef.current ? getEventPhase(eventRef.current) : null;
      if (phase === 'LIVE') return 10_000;
      if (phase === 'EVALUATION') return 15_000;
      return 30_000;
    };

    let timeout: ReturnType<typeof setTimeout>;
    const schedule = () => {
      timeout = setTimeout(() => {
        if (!document.hidden) void fetchData();
        schedule(); // reschedule after each tick (interval can change between ticks)
      }, getInterval());
    };
    schedule();
    return () => clearTimeout(timeout);
  }, [fetchData]);

  const submissions = useSubmissions(eventId, config);
  const userState =
    event && userId
      ? getEventUserState(
          event,
          config,
          userId,
          submissions,
          (event as Record<string, unknown>).permissions as BackendPermissions | undefined
        )
      : null;

  return (
    <EventContext.Provider
      value={{ event, config, userState, loading, error, refetch: () => void fetchData(true) }}
    >
      {children}
    </EventContext.Provider>
  );
}

// ─── useEvent hook ────────────────────────────────────────────────────────────

export function useEvent(): EventContextValue {
  const ctx = useContext(EventContext);
  if (!ctx) {
    throw new Error('useEvent must be used inside <EventProvider>');
  }
  return ctx;
}

// ─── GlobalLoadingBoundary ────────────────────────────────────────────────────

/** Full-page skeleton used by EventProvider while initial event data loads */
export function GlobalLoadingBoundary() {
  return (
    <div
      style={{ padding: 'var(--space-xl)' }}
      aria-busy="true"
      aria-label="Loading event"
    >
      {/* Hero skeleton */}
      <div
        className="skeleton-shimmer"
        style={{ height: 32, width: '40%', borderRadius: 6, marginBottom: 'var(--space-sm)' }}
      />
      <div
        className="skeleton-shimmer"
        style={{ height: 22, width: '70%', borderRadius: 6, marginBottom: 'var(--space-lg)' }}
      />
      {/* Stats row skeleton */}
      <div style={{ display: 'flex', gap: 'var(--space-md)', marginBottom: 'var(--space-xl)' }}>
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="skeleton-shimmer"
            style={{ height: 72, flex: 1, borderRadius: 8 }}
          />
        ))}
      </div>
      {/* Tab bar skeleton */}
      <div style={{ display: 'flex', gap: 'var(--space-md)', marginBottom: 'var(--space-lg)' }}>
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="skeleton-shimmer"
            style={{ height: 36, width: 80, borderRadius: 20 }}
          />
        ))}
      </div>
      {/* Content skeleton */}
      <div className="skeleton-shimmer" style={{ height: 160, borderRadius: 10 }} />
    </div>
  );
}

// ─── FailureRecoveryBanner ────────────────────────────────────────────────────

/** Shown when the top-level event fetch fails entirely — replaces full page content */
export function FailureRecoveryBanner({
  message,
  onRetry,
}: {
  message?: string;
  onRetry: () => void;
}) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '60vh',
        gap: 'var(--space-md)',
        padding: 'var(--space-xl)',
        textAlign: 'center',
      }}
    >
      <span style={{ fontSize: '2.5rem' }} role="img" aria-label="Warning">⚠️</span>
      <p className="comp-heading-lg">Failed to load event</p>
      <p className="comp-body">{message ?? 'Something went wrong. Please try again.'}</p>
      <div style={{ display: 'flex', gap: 'var(--space-sm)' }}>
        <button onClick={onRetry} className="comp-btn-primary" aria-label="Retry loading event">
          Retry
        </button>
        <a href="/events" className="comp-btn-ghost">
          ← Back to Events
        </a>
      </div>
    </div>
  );
}
