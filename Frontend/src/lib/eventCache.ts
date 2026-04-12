/**
 * eventCache.ts — In-memory TTL cache for event data.
 *
 * Sits between EventProvider and the network. Prevents redundant fetches on
 * route transitions and between polling ticks.
 *
 * Migration path to TanStack Query:
 *   Current: const data = eventCache.get(`event:${id}`) ?? await fetchEvent(id)
 *   Future:  const { data } = useQuery({ queryKey: ['event', id], queryFn: () => fetchEvent(id), staleTime: 60_000 })
 */

interface CacheEntry<T> {
  data: T;
  fetchedAt: number; // Date.now()
  ttlMs: number;
}

class EventCache {
  private store = new Map<string, CacheEntry<unknown>>();

  get<T>(key: string): T | null {
    const entry = this.store.get(key) as CacheEntry<T> | undefined;
    if (!entry) return null;
    if (Date.now() - entry.fetchedAt > entry.ttlMs) {
      this.store.delete(key);
      return null;
    }
    return entry.data;
  }

  set<T>(key: string, data: T, ttlMs: number): void {
    this.store.set(key, { data, fetchedAt: Date.now(), ttlMs });
  }

  invalidate(key: string): void {
    this.store.delete(key);
  }

  invalidatePrefix(prefix: string): void {
    for (const key of this.store.keys()) {
      if (key.startsWith(prefix)) this.store.delete(key);
    }
  }
}

/**
 * Cache key scheme and TTLs:
 *
 * Key pattern                          TTL    Invalidated when
 * event:{eventId}                      60s    Edit event, archive, status change
 * config:{eventId}                     120s   Edit competition config
 * submissions:{eventId}:{roundId}      20s    New submission, evaluation saved
 * my-submission:{eventId}:{roundId}    30s    Submit or resubmit
 * events-list:{queryString}            30s    Create event
 */
export const eventCache = new EventCache();
