/**
 * EventContext.tsx — Global event context provider.
 *
 * Wraps all /events/:eventId/* routes. Child pages use useEvent() to access
 * event, config, and userState — no repeated API calls per page.
 *
 * Data layer: React Query (docs/react-query-migration-plan.md §3.6).
 *   - detail/config/role are cached under lib/events/queryKeys eventKeys
 *     with staleTimes mirroring the old eventCache TTLs (60s/120s/60s).
 *   - Polling via refetchInterval: LIVE 10s / EVALUATION 15s / other 30s,
 *     paused automatically while the tab is hidden.
 *   - Structural sharing keeps object identities stable across ticks, which
 *     is what the former manual snapshot-diff gate achieved.
 *
 * Identity: uses readStoredProfileData() to get current user's reg no.
 * Role: calls getMyRole(eventId); platform admins get a synthetic owner role.
 */

import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { keepPreviousData, useQueries, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle } from 'lucide-react';
import { getEvent, getCompetitionConfig, type EventDetail, type CompetitionConfig, type CompetitionRound } from '../lib/campus/campusApi';
import { getEventPhase } from '../lib/events/eventPhase';
import { getEventUserState, type EventUserState } from '../lib/events/eventUserState';
import { getMyRole, getMySubmission, type MyRoleResponse, type Submission } from '../lib/events/competitionsApi';
import { eventKeys } from '../lib/events/queryKeys';
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
 * Returns a record keyed by roundId. Rounds appear in the record once their
 * query resolves; per-round failures surface as null entries.
 */
function useSubmissions(
  eventId: string,
  config: CompetitionConfig | null
): Record<string, Submission | null> {
  const rounds = useMemo(() => config?.rounds ?? [], [config]);

  const queries = useQueries({
    queries: rounds.map((r: CompetitionRound) => ({
      queryKey: [...eventKeys.submissions(eventId), r.roundId] as const,
      queryFn: () => getMySubmission(eventId, r.roundId),
      staleTime: 30_000,
      retry: false,
    })),
  });

  return useMemo(() => {
    const result: Record<string, Submission | null> = {};
    rounds.forEach((round: CompetitionRound, index: number) => {
      const query = queries[index];
      if (query?.isSuccess) result[round.roundId] = query.data ?? null;
    });
    return result;
  }, [rounds, queries.map((q) => `${q.dataUpdatedAt}:${q.status}`).join('|')]);
}

// ─── EventProvider ────────────────────────────────────────────────────────────

const FETCH_ERROR_MESSAGE = 'Failed to load event. Please try again.';

export function EventProvider({
  eventId,
  children,
}: {
  eventId: string;
  children: React.ReactNode;
}) {
  const queryClient = useQueryClient();

  const userId = getCurrentRegNo();
  const platformAdmin = isPlatformAdmin(userId);

  // Platform admins act as owners without consulting the role endpoint's verdict.
  const adminRoleOverride = useMemo<MyRoleResponse | null>(
    () =>
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
          }
        : null,
    [platformAdmin, userId]
  );

  // Latest known phase drives the shared polling cadence for all three
  // queries below. Declared first: React Query invokes refetchInterval while
  // constructing each observer, so the ref must already exist.
  const latestEventRef = useRef<EventDetail | null>(null);

  function pollInterval(): number {
    const phase = latestEventRef.current ? getEventPhase(latestEventRef.current) : null;
    if (phase === 'LIVE') return 10_000;
    if (phase === 'EVALUATION') return 15_000;
    return 30_000;
  }

  const eventQuery = useQuery({
    queryKey: eventKeys.detail(eventId),
    queryFn: () => getEvent(eventId),
    staleTime: 60_000,
    refetchInterval: pollInterval,
    placeholderData: keepPreviousData,
  });

  const configQuery = useQuery({
    queryKey: eventKeys.config(eventId),
    queryFn: () => getCompetitionConfig(eventId).catch(() => null),
    staleTime: 120_000,
    refetchInterval: pollInterval,
  });

  const roleQuery = useQuery({
    queryKey: eventKeys.role(eventId),
    queryFn: async () => {
      try {
        return await getMyRole(eventId);
      } catch {
        return null;
      }
    },
    staleTime: 60_000,
    refetchInterval: pollInterval,
  });

  // Keep the polling cadence synced to the latest event phase.
  useEffect(() => {
    latestEventRef.current = eventQuery.data ?? null;
  }, [eventQuery.data]);

  const loading = eventQuery.isPending || configQuery.isPending || roleQuery.isPending;
  const error = eventQuery.error ? FETCH_ERROR_MESSAGE : null;

  // Contract preserved from the pre-migration loader: a failed event fetch
  // yields an all-null snapshot, never a partial mix.
  const eventFailed = eventQuery.isError;
  const eventData = eventFailed ? null : eventQuery.data ?? null;
  const configData = eventFailed ? null : configQuery.data ?? null;
  const roleData = eventFailed ? null : adminRoleOverride ?? roleQuery.data ?? null;

  const submissions = useSubmissions(eventId, configData);

  const refetch = useCallback(
    (_skipCache?: boolean) => {
      void queryClient.invalidateQueries({ queryKey: eventKeys.detail(eventId) });
      void queryClient.invalidateQueries({ queryKey: eventKeys.config(eventId) });
      void queryClient.invalidateQueries({ queryKey: eventKeys.role(eventId) });
      void queryClient.invalidateQueries({ queryKey: eventKeys.submissions(eventId) });
    },
    [queryClient, eventId]
  );

  // Build permissions from myRole response
  const permissions = roleData?.permissions
    ? {
        canEdit: roleData.permissions.canEdit,
        canEvaluate: roleData.permissions.canEvaluate,
        canShortlist: roleData.permissions.canShortlist,
        canManageRoles: roleData.permissions.canManageRoles,
        canViewAllSubmissions: roleData.permissions.canViewAllSubmissions,
      }
    : (eventData as Record<string, unknown>)?.permissions as
        | { canEdit: boolean; canEvaluate: boolean; canShortlist: boolean }
        | undefined;

  const userState =
    eventData && userId
      ? getEventUserState(
          eventData,
          configData,
          userId,
          submissions,
          permissions,
          roleData,
        )
      : null;

  const value = useMemo<EventContextValue>(
    () => ({
      event: eventData,
      config: configData,
      userState,
      myRole: roleData,
      loading,
      error,
      refetch,
    }),
    [eventData, configData, userState, roleData, loading, error, refetch]
  );

  return <EventContext.Provider value={value}>{children}</EventContext.Provider>;
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
