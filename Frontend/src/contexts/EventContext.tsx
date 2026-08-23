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
 *
 * Identity: uses readStoredProfileData() to get current user's reg no.
 * Role: calls getMyRole(eventId) and merges result into userState.
 */

import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { getEvent, getCompetitionConfig, type EventDetail, type CompetitionConfig, type CompetitionRound } from '../lib/campus/campusApi';
import { eventCache } from '../lib/events/eventCache';
import { getEventPhase } from '../lib/events/eventPhase';
import { getEventUserState, type EventUserState } from '../lib/events/eventUserState';
import { getMyRole, getMySubmission, type MyRoleResponse, type Submission } from '../lib/events/competitionsApi';
import { getCurrentRegNo, isPlatformAdmin } from '../lib/core/identity';

// ─── Context value type ───────────────────────────────────────────────────────

interface EventContextValue {
  event: EventDetail | null;
  config: CompetitionConfig | null;
  userState: EventUserState | null;
  myRole: MyRoleResponse | null;
  loading: boolean;
  error: string | null;
  refetch: (skipCache?: boolean) => void;
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
  const [roleData, setRoleData] = useState<MyRoleResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const userId = getCurrentRegNo();
  const platformAdmin = isPlatformAdmin(userId);

  // Polling refetches on a fixed cadence; without this gate each tick hands
  // consumers fresh object identities and re-renders the whole event tree
  // even when nothing changed.
  const lastSnapshotRef = useRef<{ key: string; event: string; config: string; role: string } | null>(null);

  const applyFetched = useCallback(
    (nextEvent: EventDetail, nextConfig: CompetitionConfig | null, nextRole: MyRoleResponse | null) => {
      const next = {
        key: eventId,
        event: JSON.stringify(nextEvent),
        config: JSON.stringify(nextConfig),
        role: JSON.stringify(nextRole),
      };
      const prev = lastSnapshotRef.current;
      const isNewEvent = prev?.key !== next.key;
      if (isNewEvent || prev?.event !== next.event) setEvent(nextEvent);
      if (isNewEvent || prev?.config !== next.config) setConfig(nextConfig);
      if (isNewEvent || prev?.role !== next.role) setRoleData(nextRole);
      lastSnapshotRef.current = next;
    },
    [eventId]
  );

  const fetchData = useCallback(
    async (skipCache = false) => {
      const cacheKey = `event:${eventId}`;
      const configKey = `config:${eventId}`;
      const roleKey = `role:${eventId}`;

      if (!skipCache) {
        const cachedEvent = eventCache.get<EventDetail>(cacheKey);
        const cachedConfig = eventCache.get<CompetitionConfig | null>(configKey);
        const cachedRole = eventCache.get<MyRoleResponse | null>(roleKey);
        if (cachedEvent) {
          const resolvedCachedRole =
            platformAdmin
              ? {
                  regNo: userId,
                  role: 'owner',
                  permissions: {
                    canEdit: true,
                    canEvaluate: true,
                    canShortlist: true,
                    canManageRoles: true,
                    canViewAllSubmissions: true,
                  },
                } satisfies MyRoleResponse
              : cachedRole ?? null;
          setEvent(cachedEvent);
          setConfig(cachedConfig ?? null);
          setRoleData(resolvedCachedRole);
          lastSnapshotRef.current = {
            key: eventId,
            event: JSON.stringify(cachedEvent),
            config: JSON.stringify(cachedConfig ?? null),
            role: JSON.stringify(resolvedCachedRole),
          };
          setLoading(false);
          return;
        }
      }

      try {
        const [eventData, configData, myRoleData] = await Promise.all([
          getEvent(eventId),
          getCompetitionConfig(eventId).catch(() => null),
          getMyRole(eventId).catch(() => null),
        ]);
        const resolvedRoleData =
          platformAdmin
            ? {
                regNo: userId,
                role: 'owner',
                permissions: {
                  canEdit: true,
                  canEvaluate: true,
                  canShortlist: true,
                  canManageRoles: true,
                  canViewAllSubmissions: true,
                },
              } satisfies MyRoleResponse
            : myRoleData;
        eventCache.set(cacheKey, eventData, 60_000);
        eventCache.set(configKey, configData, 120_000);
        if (resolvedRoleData) eventCache.set(roleKey, resolvedRoleData, 60_000);
        applyFetched(eventData, configData as CompetitionConfig | null, resolvedRoleData);
        setError(null);
      } catch {
        setError('Failed to load event. Please try again.');
      } finally {
        setLoading(false);
      }
    },
    [applyFetched, eventId, platformAdmin, userId]
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

  // Build permissions from myRole response
  const permissions = roleData?.permissions
    ? {
        canEdit: roleData.permissions.canEdit,
        canEvaluate: roleData.permissions.canEvaluate,
        canShortlist: roleData.permissions.canShortlist,
        canManageRoles: roleData.permissions.canManageRoles,
        canViewAllSubmissions: roleData.permissions.canViewAllSubmissions,
      }
    : (event as Record<string, unknown>)?.permissions as
        | { canEdit: boolean; canEvaluate: boolean; canShortlist: boolean }
        | undefined;

  const userState =
    event && userId
      ? getEventUserState(
          event,
          config,
          userId,
          submissions,
          permissions,
          roleData,
        )
      : null;

  return (
    <EventContext.Provider
      value={{
        event,
        config,
        userState,
        myRole: roleData,
        loading,
        error,
        refetch: (skipCache = true) => void fetchData(skipCache),
      }}
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
      <AlertTriangle size={40} strokeWidth={1.5} style={{ color: 'var(--warning)' }} aria-hidden="true" />
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
