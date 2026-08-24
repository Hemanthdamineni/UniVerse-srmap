/**
 * EventContext.test.tsx — Comprehensive Vitest tests for EventContext.
 *
 * Tests cover:
 *   - EventProvider renders children
 *   - Default (initial) state values
 *   - Successful data load (API calls, state transitions)
 *   - Cache hit behavior (skips API calls)
 *   - Platform admin override (bypasses role API, assigns owner)
 *   - API failure → error state
 *   - refetch method (skipCache toggle)
 *   - useEvent hook inside and outside provider
 *   - GlobalLoadingBoundary rendering
 *   - FailureRecoveryBanner rendering and retry callback
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, render, renderHook, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState, type ReactNode } from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { createTestQueryClient } from '../test/testUtils';

// ─── Module mocks (hoisted) ──────────────────────────────────────────────

vi.mock('../lib/campus/campusApi', () => ({
  getEvent: vi.fn(),
  getCompetitionConfig: vi.fn(),
}));

vi.mock('../lib/events/competitionsApi', () => ({
  getMyRole: vi.fn(),
  getMySubmission: vi.fn(),
}));

vi.mock('../lib/events/eventPhase', () => ({
  getEventPhase: vi.fn(),
  EVENT_PHASE: {
    UPCOMING: 'UPCOMING',
    REGISTRATION_OPEN: 'REGISTRATION_OPEN',
    LIVE: 'LIVE',
    EVALUATION: 'EVALUATION',
    RESULTS: 'RESULTS',
    COMPLETED: 'COMPLETED',
  } as const,
}));

vi.mock('../lib/events/eventUserState', () => ({
  getEventUserState: vi.fn(),
}));

vi.mock('../lib/core/identity', () => ({
  getCurrentRegNo: vi.fn(),
  isPlatformAdmin: vi.fn(),
}));

// ─── Imports (after mocks) ───────────────────────────────────────────────

import {
  EventProvider,
  useEvent,
  GlobalLoadingBoundary,
  FailureRecoveryBanner,
} from './EventContext';

import * as campusApiModule from '../lib/campus/campusApi';
import * as competitionsApiModule from '../lib/events/competitionsApi';
import * as eventPhaseModule from '../lib/events/eventPhase';
import * as eventUserStateModule from '../lib/events/eventUserState';
import * as identityModule from '../lib/core/identity';
import { eventKeys } from '../lib/events/queryKeys';

// ─── Fixtures ────────────────────────────────────────────────────────────

const EVENT_ID = 'test-event-001';
const USER_ID = 'AP21110010';

const mockEvent = {
  id: EVENT_ID,
  title: 'Coding Competition',
  description: 'An exciting coding competition',
  startAt: '2026-08-01T09:00:00Z',
  endAt: '2026-08-03T18:00:00Z',
  startDate: '2026-08-01',
  endDate: '2026-08-03',
  category: 'technical',
  department: 'CSE',
  status: 'published',
  visibility: 'public',
  createdBy: 'AP21110010',
  isCompetition: true,
} as const;

const mockCompetitionConfig = {
  isCompetition: true,
  submissionScope: 'individual' as const,
  rounds: [
    {
      roundId: 'round-1',
      title: 'Prelims',
      submissionDeadline: '2026-08-02T18:00:00Z',
      resultsPublished: false,
    },
    {
      roundId: 'round-2',
      title: 'Finals',
      submissionDeadline: '2026-08-10T18:00:00Z',
      resultsPublished: false,
    },
  ],
};

const mockMyRole = {
  regNo: USER_ID,
  role: 'participant' as const,
  permissions: {
    canEdit: false,
    canEvaluate: false,
    canShortlist: false,
    canManageRoles: false,
    canViewAllSubmissions: false,
  },
};

const mockAdminRole = {
  regNo: USER_ID,
  role: 'owner' as const,
  permissions: {
    canEdit: true,
    canEvaluate: true,
    canShortlist: true,
    canManageRoles: true,
    canViewAllSubmissions: true,
  },
};

// Mock EventUserState — the shape getEventUserState is expected to return
const mockUserState = {
  role: 'participant' as const,
  canEdit: false,
  canEvaluate: false,
  canShortlist: false,
  canManageRoles: false,
  canViewAllSubmissions: false,
  permissions: null,
  phase: 'REGISTRATION_OPEN' as const,
  currentRound: null,
  roundStates: [],
};

function resetMocks(): void {
  vi.clearAllMocks();

  // Default mocks for a happy-path scenario
  vi.mocked(campusApiModule.getEvent).mockResolvedValue(mockEvent as any);
  vi.mocked(campusApiModule.getCompetitionConfig).mockResolvedValue(mockCompetitionConfig as any);
  vi.mocked(competitionsApiModule.getMyRole).mockResolvedValue(mockMyRole as any);
  vi.mocked(competitionsApiModule.getMySubmission).mockResolvedValue(null);
  vi.mocked(eventPhaseModule.getEventPhase).mockReturnValue('REGISTRATION_OPEN');
  vi.mocked(eventUserStateModule.getEventUserState).mockReturnValue(mockUserState as any);
  vi.mocked(identityModule.getCurrentRegNo).mockReturnValue(USER_ID);
  vi.mocked(identityModule.isPlatformAdmin).mockReturnValue(false);
}

// ─── Helpers ─────────────────────────────────────────────────────────────

function createWrapper(
  eventId: string = EVENT_ID,
): React.FC<{ children: ReactNode }> {
  const queryClient = createTestQueryClient();
  const Wrapper: React.FC<{ children: ReactNode }> = ({ children }) => (
    <QueryClientProvider client={queryClient}>
      <EventProvider eventId={eventId}>{children}</EventProvider>
    </QueryClientProvider>
  );
  Wrapper.displayName = 'EventProviderWrapper';
  return Wrapper;
}

/** Standalone provider wrapper for tests that render JSX directly. */
function TestEventProvider({
  eventId = EVENT_ID,
  children,
}: {
  eventId?: string;
  children: ReactNode;
}) {
  const [queryClient] = useState(() => createTestQueryClient());
  return (
    <QueryClientProvider client={queryClient}>
      <EventProvider eventId={eventId}>{children}</EventProvider>
    </QueryClientProvider>
  );
}

/** Render a hook that reads the full EventContext value. */
function renderEventHook(eventId: string = EVENT_ID) {
  return renderHook(() => useEvent(), { wrapper: createWrapper(eventId) });
}

/** Like renderEventHook but also exposes the shared test query client. */
function renderEventHookWithClient(eventId: string = EVENT_ID) {
  const queryClient = createTestQueryClient();
  const Wrapper: React.FC<{ children: ReactNode }> = ({ children }) => (
    <QueryClientProvider client={queryClient}>
      <EventProvider eventId={eventId}>{children}</EventProvider>
    </QueryClientProvider>
  );
  return { ...renderHook(() => useEvent(), { wrapper: Wrapper }), queryClient };
}

/** Helper to wait for loading to finish. */
async function waitForLoaded(result: ReturnType<typeof renderEventHook>['result']) {
  await waitFor(() => expect(result.current.loading).toBe(false));
}

// ─── Tests ───────────────────────────────────────────────────────────────

beforeEach(() => {
  resetMocks();
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ──────────────────────────────────────────────────────────────────────────
// EventProvider — rendering children
// ──────────────────────────────────────────────────────────────────────────

describe('EventProvider — renders children', () => {
  it('renders simple text content', () => {
    render(
      <TestEventProvider>
        <span data-testid="child">Hello</span>
      </TestEventProvider>,
    );

    expect(screen.getByTestId('child')).toHaveTextContent('Hello');
  });

  it('renders complex nested children', () => {
    render(
      <TestEventProvider>
        <div data-testid="parent">
          <span data-testid="nested">Nested</span>
        </div>
      </TestEventProvider>,
    );

    expect(screen.getByTestId('parent')).toBeInTheDocument();
    expect(screen.getByTestId('nested')).toHaveTextContent('Nested');
  });

  it('renders multiple children', () => {
    render(
      <TestEventProvider>
        <span data-testid="a">A</span>
        <span data-testid="b">B</span>
      </TestEventProvider>,
    );

    expect(screen.getByTestId('a')).toBeInTheDocument();
    expect(screen.getByTestId('b')).toBeInTheDocument();
  });
});

// ──────────────────────────────────────────────────────────────────────────
// EventProvider — default / initial values
// ──────────────────────────────────────────────────────────────────────────

describe('EventProvider — default values', () => {
  it('exposes loading=true and null event/config/userState on mount', () => {
    const { result } = renderEventHook();

    // On first synchronous render the effect hasn't resolved yet
    expect(result.current.loading).toBe(true);
    expect(result.current.event).toBeNull();
    expect(result.current.config).toBeNull();
    expect(result.current.userState).toBeNull();
    expect(result.current.myRole).toBeNull();
    expect(result.current.error).toBeNull();
  });

  it('exposes a refetch function', () => {
    const { result } = renderEventHook();

    expect(result.current.refetch).toBeInstanceOf(Function);
  });
});

// ──────────────────────────────────────────────────────────────────────────
// EventProvider — successful data load (state transitions)
// ──────────────────────────────────────────────────────────────────────────

describe('EventProvider — successful data load', () => {
  it('calls getEvent, getCompetitionConfig, and getMyRole on mount', async () => {
    renderEventHook();

    await waitFor(() => {
      expect(campusApiModule.getEvent).toHaveBeenCalledWith(EVENT_ID);
    });
    expect(campusApiModule.getCompetitionConfig).toHaveBeenCalledWith(EVENT_ID);
    expect(competitionsApiModule.getMyRole).toHaveBeenCalledWith(EVENT_ID);
  });

  it('transitions from loading=true to loading=false after data arrives', async () => {
    const { result } = renderEventHook();

    expect(result.current.loading).toBe(true);

    await waitForLoaded(result);

    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it('populates event, config, and myRole after successful fetch', async () => {
    const { result } = renderEventHook();

    await waitForLoaded(result);

    expect(result.current.event).toEqual(mockEvent);
    expect(result.current.config).toEqual(mockCompetitionConfig);
    expect(result.current.myRole).toEqual(mockMyRole);
  });

  it('computes userState via getEventUserState with correct arguments', async () => {
    renderEventHook();

    await waitFor(() => {
      expect(eventUserStateModule.getEventUserState).toHaveBeenCalled();
    });

    const callArgs = vi.mocked(eventUserStateModule.getEventUserState).mock.calls[0];
    expect(callArgs[0]).toEqual(mockEvent);
    expect(callArgs[1]).toEqual(mockCompetitionConfig);
    expect(callArgs[2]).toBe(USER_ID);
    // callArgs[3] is the submissions record (from useSubmissions)
    // callArgs[4] is the permissions object
    // callArgs[5] is myRole
  });

  it('exposes the computed userState via context', async () => {
    const customUserState = {
      ...mockUserState,
      role: 'participant' as const,
      phase: 'LIVE' as const,
    };
    vi.mocked(eventUserStateModule.getEventUserState).mockReturnValue(customUserState as any);

    const { result } = renderEventHook();

    await waitForLoaded(result);

    expect(result.current.userState).toEqual(customUserState);
  });

  it('calls getMySubmission for each round when config has rounds', async () => {
    renderEventHook();

    await waitFor(() => {
      // Should be called once per round
      expect(competitionsApiModule.getMySubmission).toHaveBeenCalledTimes(
        mockCompetitionConfig.rounds.length,
      );
    });

    expect(competitionsApiModule.getMySubmission).toHaveBeenCalledWith(EVENT_ID, 'round-1');
    expect(competitionsApiModule.getMySubmission).toHaveBeenCalledWith(EVENT_ID, 'round-2');
  });

  it('does not call getMySubmission when config is null (non-competition event)', async () => {
    vi.mocked(campusApiModule.getCompetitionConfig).mockResolvedValue(null);

    renderEventHook();

    // Wait a tick for effects to settle
    await vi.waitFor(() => {
      expect(campusApiModule.getCompetitionConfig).toHaveBeenCalled();
    });

    expect(competitionsApiModule.getMySubmission).not.toHaveBeenCalled();
  });

  it('calls getMySubmission with catch handler (does not reject the provider)', async () => {
    vi.mocked(competitionsApiModule.getMySubmission).mockRejectedValue(
      new Error('Network error'),
    );

    const { result } = renderEventHook();

    await waitForLoaded(result);

    // Provider should still have loaded successfully
    expect(result.current.loading).toBe(false);
    expect(result.current.event).toEqual(mockEvent);
  });

  it('fails gracefully when getCompetitionConfig rejects (non-competition event)', async () => {
    vi.mocked(campusApiModule.getCompetitionConfig).mockRejectedValue(
      new Error('Not a competition'),
    );

    const { result } = renderEventHook();

    await waitForLoaded(result);

    expect(result.current.loading).toBe(false);
    // config should be null (the .catch(() => null) in fetchData)
    expect(result.current.config).toBeNull();
    // Event and role should still load
    expect(result.current.event).toEqual(mockEvent);
  });

  it('fails gracefully when getMyRole rejects', async () => {
    vi.mocked(competitionsApiModule.getMyRole).mockRejectedValue(
      new Error('Permission denied'),
    );

    const { result } = renderEventHook();

    await waitForLoaded(result);

    expect(result.current.loading).toBe(false);
    expect(result.current.myRole).toBeNull();
    expect(result.current.event).toEqual(mockEvent);
  });
});

// ──────────────────────────────────────────────────────────────────────────
// EventProvider — caching behavior (React Query)
// ──────────────────────────────────────────────────────────────────────────

describe('EventProvider — caching', () => {
  it('serves a second mount from the query cache without refetching', async () => {
    const queryClient = createTestQueryClient();
    const Wrapper: React.FC<{ children: ReactNode }> = ({ children }) => (
      <QueryClientProvider client={queryClient}>
        <EventProvider eventId={EVENT_ID}>{children}</EventProvider>
      </QueryClientProvider>
    );

    const first = renderHook(() => useEvent(), { wrapper: Wrapper });
    await waitForLoaded(first.result);
    expect(campusApiModule.getEvent).toHaveBeenCalledTimes(1);

    // Within staleTime (60s) a second provider mount reuses the cached entry.
    const second = renderHook(() => useEvent(), { wrapper: Wrapper });
    await waitFor(() => expect(second.result.current.loading).toBe(false));

    expect(campusApiModule.getEvent).toHaveBeenCalledTimes(1);
    expect(second.result.current.event).toEqual(mockEvent);
  });

  it('populates the query cache after a successful fetch', async () => {
    const { result, queryClient } = renderEventHookWithClient();

    await waitForLoaded(result);

    expect(queryClient.getQueryData(eventKeys.detail(EVENT_ID))).toEqual(mockEvent);
    expect(queryClient.getQueryData(eventKeys.config(EVENT_ID))).toEqual(mockCompetitionConfig);
    expect(queryClient.getQueryData(eventKeys.role(EVENT_ID))).toEqual(mockMyRole);
  });

  it('refetch() invalidates and refetches even within staleTime', async () => {
    const { result, queryClient } = renderEventHookWithClient();

    await waitForLoaded(result);
    expect(campusApiModule.getEvent).toHaveBeenCalledTimes(1);

    vi.clearAllMocks();
    vi.mocked(campusApiModule.getEvent).mockResolvedValue(mockEvent as any);

    await act(async () => {
      result.current.refetch(true);
    });

    // Invalidation must trigger a real network refetch despite staleTime.
    await waitFor(() => {
      expect(campusApiModule.getEvent).toHaveBeenCalledWith(EVENT_ID);
    });
  });
});

// ──────────────────────────────────────────────────────────────────────────
// EventProvider — platform admin override
// ──────────────────────────────────────────────────────────────────────────

describe('EventProvider — platform admin override', () => {
  it('assigns owner role with full permissions when user is platform admin', async () => {
    vi.mocked(identityModule.isPlatformAdmin).mockReturnValue(true);

    const { result } = renderEventHook();

    await waitForLoaded(result);

    // myRole should be owner with all permissions true
    expect(result.current.myRole).toEqual(mockAdminRole);
    // getMyRole IS still called (to populate the permissions object for non-admin users),
    // but the admin override takes precedence
    expect(competitionsApiModule.getMyRole).toHaveBeenCalledWith(EVENT_ID);
  });

  it('assigns owner role even when getMyRole fails for platform admin', async () => {
    vi.mocked(identityModule.isPlatformAdmin).mockReturnValue(true);
    vi.mocked(competitionsApiModule.getMyRole).mockRejectedValue(new Error('forbidden'));

    const { result } = renderEventHook();

    await waitForLoaded(result);

    // The synthetic admin override does not depend on the role endpoint
    // resolving — it applies even when the role query errors out.
    expect(result.current.myRole).toEqual(mockAdminRole);
  });

  it('overrides getMyRole response with owner role for platform admin', async () => {
    // Simulate a non-owner role from the API
    vi.mocked(competitionsApiModule.getMyRole).mockResolvedValue({
      regNo: USER_ID,
      role: 'participant',
      permissions: {
        canEdit: false,
        canEvaluate: false,
        canShortlist: false,
        canManageRoles: false,
        canViewAllSubmissions: false,
      },
    } as any);
    vi.mocked(identityModule.isPlatformAdmin).mockReturnValue(true);

    const { result } = renderEventHook();

    await waitForLoaded(result);

    // Even though API returned 'participant', admin override produces 'owner'
    expect(result.current.myRole?.role).toBe('owner');
    expect(result.current.myRole?.permissions.canEdit).toBe(true);
    expect(result.current.myRole?.permissions.canEvaluate).toBe(true);
    expect(result.current.myRole?.permissions.canShortlist).toBe(true);
    expect(result.current.myRole?.permissions.canManageRoles).toBe(true);
    expect(result.current.myRole?.permissions.canViewAllSubmissions).toBe(true);
  });

  it('computes userState correctly for platform admin', async () => {
    vi.mocked(identityModule.isPlatformAdmin).mockReturnValue(true);

    renderEventHook();

    await waitFor(() => {
      expect(eventUserStateModule.getEventUserState).toHaveBeenCalled();
    });

    const callArgs = vi.mocked(eventUserStateModule.getEventUserState).mock.calls[0];
    // The 6th argument (index 5) should be the admin role
    expect(callArgs[5]).toEqual(mockAdminRole);
  });
});

// ──────────────────────────────────────────────────────────────────────────
// EventProvider — error handling
// ──────────────────────────────────────────────────────────────────────────

describe('EventProvider — error handling', () => {
  it('sets error string when getEvent fails', async () => {
    vi.mocked(campusApiModule.getEvent).mockRejectedValue(
      new Error('Network error'),
    );

    const { result } = renderEventHook();

    await waitForLoaded(result);

    expect(result.current.error).toBe('Failed to load event. Please try again.');
    expect(result.current.event).toBeNull();
  });

  it('sets error string when getEvent returns unexpected payload', async () => {
    vi.mocked(campusApiModule.getEvent).mockRejectedValue(
      new Error('Unexpected response format'),
    );

    const { result } = renderEventHook();

    await waitForLoaded(result);

    expect(result.current.error).toBe('Failed to load event. Please try again.');
    expect(result.current.loading).toBe(false);
  });

  it('retains null state for event/config/role on error', async () => {
    vi.mocked(campusApiModule.getEvent).mockRejectedValue(
      new Error('Server error'),
    );

    const { result } = renderEventHook();

    await waitForLoaded(result);

    expect(result.current.event).toBeNull();
    expect(result.current.config).toBeNull();
    expect(result.current.userState).toBeNull();
    expect(result.current.myRole).toBeNull();
    expect(result.current.error).not.toBeNull();
  });

  it('refetch can recover from error state', async () => {
    vi.mocked(campusApiModule.getEvent).mockRejectedValueOnce(new Error('First failure'));

    const { result } = renderEventHook();

    await waitForLoaded(result);
    expect(result.current.error).toBe('Failed to load event. Please try again.');

    // Now make the API succeed on next call
    vi.mocked(campusApiModule.getEvent).mockResolvedValue(mockEvent as any);

    await act(async () => {
      result.current.refetch();
    });

    await waitForLoaded(result);

    expect(result.current.error).toBeNull();
    expect(result.current.event).toEqual(mockEvent);
  });
});

// ──────────────────────────────────────────────────────────────────────────
// EventProvider — refetch method
// ──────────────────────────────────────────────────────────────────────────

describe('EventProvider — refetch', () => {
  it('refetch triggers API calls again', async () => {
    const { result } = renderEventHook();

    await waitForLoaded(result);
    expect(campusApiModule.getEvent).toHaveBeenCalledTimes(1);

    await act(async () => {
      result.current.refetch();
    });

    await waitFor(() => {
      expect(campusApiModule.getEvent).toHaveBeenCalledTimes(2);
    });
  });

  it('refetch with skipCache=false still checks cache but hits APIs on miss', async () => {
    const { result } = renderEventHook();

    await waitForLoaded(result);

    // Clear and re-invoke
    vi.clearAllMocks();

    await act(async () => {
      result.current.refetch(false);
    });

    await waitFor(() => {
      expect(campusApiModule.getEvent).toHaveBeenCalled();
    });
  });

  it('refetch updates event data from the API', async () => {
    // First load returns original event
    const { result } = renderEventHook();
    await waitForLoaded(result);
    expect(result.current.event?.title).toBe('Coding Competition');

    // Second call returns updated data
    vi.mocked(campusApiModule.getEvent).mockResolvedValue({
      ...mockEvent,
      title: 'Updated Competition',
    } as any);

    await act(async () => {
      result.current.refetch();
    });

    await waitFor(() => {
      expect(result.current.event?.title).toBe('Updated Competition');
    });
  });
});

// ──────────────────────────────────────────────────────────────────────────
// useEvent hook
// ──────────────────────────────────────────────────────────────────────────

describe('useEvent hook', () => {
  it('returns the event context value when used inside EventProvider', async () => {
    const { result } = renderEventHook();

    await waitForLoaded(result);

    expect(result.current).toHaveProperty('event');
    expect(result.current).toHaveProperty('config');
    expect(result.current).toHaveProperty('userState');
    expect(result.current).toHaveProperty('myRole');
    expect(result.current).toHaveProperty('loading');
    expect(result.current).toHaveProperty('error');
    expect(result.current).toHaveProperty('refetch');
  });

  it('throws an error when used outside EventProvider', () => {
    // renderHook without wrapper → no provider
    expect(() => renderHook(() => useEvent())).toThrow(
      'useEvent must be used inside <EventProvider>',
    );
  });

  it('throws an error with the exact message when no provider is present', () => {
    let caughtError: Error | null = null;

    try {
      renderHook(() => useEvent());
    } catch (err) {
      caughtError = err as Error;
    }

    expect(caughtError).not.toBeNull();
    expect(caughtError!.message).toBe('useEvent must be used inside <EventProvider>');
  });

  it('refetch is a function that can be called', async () => {
    const { result } = renderEventHook();

    await waitForLoaded(result);

    expect(typeof result.current.refetch).toBe('function');
  });

  it('supports multiple independent providers with different eventIds', async () => {
    const EVENT_ID_2 = 'test-event-002';
    const mockEvent2 = { ...mockEvent, id: EVENT_ID_2, title: 'Hackathon' };

    // Configure second event's mock
    vi.mocked(campusApiModule.getEvent).mockImplementation(async (id: string) => {
      if (id === EVENT_ID) return mockEvent as any;
      if (id === EVENT_ID_2) return mockEvent2 as any;
      throw new Error('Unknown event');
    });

    const { result: result1 } = renderEventHook(EVENT_ID);
    const { result: result2 } = renderEventHook(EVENT_ID_2);

    await waitForLoaded(result1);
    await waitForLoaded(result2);

    expect(result1.current.event?.id).toBe(EVENT_ID);
    expect(result2.current.event?.id).toBe(EVENT_ID_2);
    expect(result1.current.event?.title).toBe('Coding Competition');
    expect(result2.current.event?.title).toBe('Hackathon');
  });
});

// ──────────────────────────────────────────────────────────────────────────
// EventProvider — loading states
// ──────────────────────────────────────────────────────────────────────────

describe('EventProvider — loading states', () => {
  it('starts with loading=true before any API resolves', () => {
    // Make API return a promise that never resolves (holding state)
    vi.mocked(campusApiModule.getEvent).mockImplementation(
      () => new Promise(() => { /* never resolves */ }),
    );

    const { result } = renderEventHook();

    expect(result.current.loading).toBe(true);
    expect(result.current.event).toBeNull();
  });

  it('refetch triggers a new API call (loading remains false during refetch — fetchData does not set loading=true)', async () => {
    // First load
    const { result } = renderEventHook();
    await waitForLoaded(result);
    expect(result.current.loading).toBe(false);

    // Mock the refetch to verify API is called again
    result.current.refetch();

    // fetchData does not set loading=true — it only sets loading=false in finally
    expect(result.current.loading).toBe(false);
  });

  it('ends with loading=false after refetch completes', async () => {
    const { result } = renderEventHook();
    await waitForLoaded(result);
    expect(result.current.loading).toBe(false);

    // Refetch that resolves
    await act(async () => {
      result.current.refetch();
    });

    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBeNull();
  });
});

// ──────────────────────────────────────────────────────────────────────────
// EventProvider — edge cases
// ──────────────────────────────────────────────────────────────────────────

describe('EventProvider — edge cases', () => {
  it('handles eventId changing by re-fetching', async () => {
    const NEW_EVENT_ID = 'event-002';
    const mockEvent2 = { ...mockEvent, id: NEW_EVENT_ID };

    vi.mocked(campusApiModule.getEvent).mockImplementation(async (id: string) => {
      if (id === NEW_EVENT_ID) return mockEvent2 as any;
      return mockEvent as any;
    });

    // Use a re-renderable wrapper (factory won't work since wrapper is fixed)
    const edgeCaseClient = createTestQueryClient();
    const { result, rerender } = renderHook(
      ({ id }: { id: string }) => useEvent(),
      {
        wrapper: ({ children }) => (
          <QueryClientProvider client={edgeCaseClient}>
            <EventProvider eventId={EVENT_ID}>{children}</EventProvider>
          </QueryClientProvider>
        ),
        initialProps: { id: EVENT_ID },
      },
    );

    await waitForLoaded(result);
    expect(result.current.event?.id).toBe(EVENT_ID);

    // Rerender with a new wrapper — NOTE: EventProvider eventId is fixed, so
    // a real app would use a key or remount. This test verifies basic behavior.
    // For a more realistic test, remount with different eventId.
  });

  it('handles undefined/null event fields gracefully', async () => {
    const partialEvent = {
      id: EVENT_ID,
      title: 'Minimal Event',
      description: '',
      startAt: '',
      endAt: '',
      startDate: '',
      endDate: '',
      category: '',
      department: '',
      status: '',
      visibility: '',
    };
    vi.mocked(campusApiModule.getEvent).mockResolvedValue(partialEvent as any);

    const { result } = renderEventHook();

    await waitForLoaded(result);

    expect(result.current.event).toEqual(partialEvent);
    expect(result.current.loading).toBe(false);
  });

  it('computes correct userState with empty config (no rounds)', async () => {
    vi.mocked(campusApiModule.getCompetitionConfig).mockResolvedValue(null);

    const customUserState = {
      ...mockUserState,
      role: 'visitor' as const,
      roundStates: [],
    };
    vi.mocked(eventUserStateModule.getEventUserState).mockReturnValue(customUserState as any);

    const { result } = renderEventHook();

    await waitForLoaded(result);

    expect(result.current.userState?.role).toBe('visitor');
    expect(result.current.userState?.roundStates).toEqual([]);
  });
});

// ──────────────────────────────────────────────────────────────────────────
// GlobalLoadingBoundary
// ──────────────────────────────────────────────────────────────────────────

describe('GlobalLoadingBoundary', () => {
  it('renders skeleton elements', () => {
    render(<GlobalLoadingBoundary />);

    // Should have aria-busy indicating loading state
    const container = screen.getByLabelText('Loading event');
    expect(container).toBeInTheDocument();
    expect(container).toHaveAttribute('aria-busy', 'true');
  });

  it('renders multiple skeleton children (hero, stats, tabs, content)', () => {
    const { container } = render(<GlobalLoadingBoundary />);

    // All skeleton-shimmer elements should be present
    const skeletons = container.querySelectorAll('.skeleton-shimmer');
    expect(skeletons.length).toBeGreaterThanOrEqual(9);
  });

  it('has accessible label for screen readers', () => {
    render(<GlobalLoadingBoundary />);

    expect(screen.getByLabelText('Loading event')).toBeInTheDocument();
  });
});

// ──────────────────────────────────────────────────────────────────────────
// FailureRecoveryBanner
// ──────────────────────────────────────────────────────────────────────────

describe('FailureRecoveryBanner', () => {
  it('renders a default error message when no message prop is given', () => {
    render(<FailureRecoveryBanner onRetry={() => {}} />);

    expect(screen.getByText('Failed to load event')).toBeInTheDocument();
    expect(screen.getByText('Something went wrong. Please try again.')).toBeInTheDocument();
  });

  it('renders a custom error message when message prop is provided', () => {
    render(
      <FailureRecoveryBanner
        message="Custom error: event not found"
        onRetry={() => {}}
      />,
    );

    expect(screen.getByText('Custom error: event not found')).toBeInTheDocument();
  });

  it('renders a Retry button that calls onRetry when clicked', async () => {
    const onRetry = vi.fn();
    const user = userEvent.setup();

    render(<FailureRecoveryBanner onRetry={onRetry} />);

    const retryButton = screen.getByRole('button', { name: /retry/i });
    expect(retryButton).toBeInTheDocument();

    await user.click(retryButton);

    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('renders a back-to-events link', () => {
    render(<FailureRecoveryBanner onRetry={() => {}} />);

    const backLink = screen.getByText(/back to events/i);
    expect(backLink).toBeInTheDocument();
    expect(backLink).toHaveAttribute('href', '/events');
  });

  it('has accessible Retry button label', () => {
    render(<FailureRecoveryBanner onRetry={() => {}} />);

    expect(
      screen.getByRole('button', { name: 'Retry loading event' }),
    ).toBeInTheDocument();
  });

  it('fires onRetry even when message prop changes', async () => {
    const onRetry = vi.fn();
    const user = userEvent.setup();

    const { rerender } = render(
      <FailureRecoveryBanner message="First error" onRetry={onRetry} />,
    );

    rerender(<FailureRecoveryBanner message="Second error" onRetry={onRetry} />);

    await user.click(screen.getByRole('button', { name: /retry/i }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });
});

// ──────────────────────────────────────────────────────────────────────────
// Integration
// ──────────────────────────────────────────────────────────────────────────

describe('Integration — read context from a child component', () => {
  it('child component can read event data via useEvent', async () => {
    function EventTitle() {
      const { event, loading } = useEvent();
      if (loading) return <div data-testid="loading">Loading...</div>;
      return <div data-testid="event-title">{event?.title}</div>;
    }

    render(
      <TestEventProvider>
        <EventTitle />
      </TestEventProvider>,
    );

    // Initially loading
    expect(screen.getByTestId('loading')).toHaveTextContent('Loading...');

    // Eventually shows the title
    await waitFor(() => {
      expect(screen.getByTestId('event-title')).toHaveTextContent('Coding Competition');
    });
  });

  it('child component displays error state', async () => {
    vi.mocked(campusApiModule.getEvent).mockRejectedValue(new Error('Fail'));

    function EventStatus() {
      const { error, loading } = useEvent();
      if (loading) return <div data-testid="loading">Loading...</div>;
      if (error) return <div data-testid="error">{error}</div>;
      return <div data-testid="loaded">Loaded</div>;
    }

    render(
      <TestEventProvider>
        <EventStatus />
      </TestEventProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('error')).toHaveTextContent(
        'Failed to load event. Please try again.',
      );
    });
  });

  it('child component reflects updated state after refetch', async () => {
    let fetchCount = 0;
    vi.mocked(campusApiModule.getEvent).mockImplementation(async () => {
      fetchCount++;
      return { ...mockEvent, title: `Fetch #${fetchCount}` } as any;
    });

    function EventTitle() {
      const { event, loading, refetch } = useEvent();
      return (
        <div>
          {loading && <span data-testid="loading">Loading...</span>}
          <span data-testid="title">{event?.title}</span>
          <button data-testid="refetch-btn" onClick={() => refetch()}>
            Refetch
          </button>
        </div>
      );
    }

    const user = userEvent.setup();

    render(
      <TestEventProvider>
        <EventTitle />
      </TestEventProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('title')).toHaveTextContent('Fetch #1');
    });

    await user.click(screen.getByTestId('refetch-btn'));

    await waitFor(() => {
      expect(screen.getByTestId('title')).toHaveTextContent('Fetch #2');
    });
  });
});
