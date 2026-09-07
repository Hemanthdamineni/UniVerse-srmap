/**
 * queryPersist.ts — offline-first cache for the data a student needs without
 * signal (Batch B13 / T7.2.1).
 *
 * A localStorage persister replays the last successful responses for a small
 * allowlist of safe-to-be-stale reads (timetable, attendance, results, the
 * student graph). Everything else is dropped from the persisted snapshot, so
 * mutations, auth, and session state never round-trip through disk.
 *
 * Honesty is handled elsewhere: `useOnlineStatus` + the offline banner tell the
 * user when they're looking at cached data, and every query keeps its real
 * `dataUpdatedAt`.
 */

import { createSyncStoragePersister } from "@tanstack/query-sync-storage-persister";
import type { PersistedClient, Persister } from "@tanstack/react-query-persist-client";

// query keys whose first segment is in here get persisted
const PERSIST_ROOTS = new Set([
  "erp", // erpKeys.batch(...) etc.
  "student-graph",
  "deadlines",
  "academic-calendar",
  "session", // profile only (see filter below)
]);

const STORAGE_KEY = "erp.query-cache.v1";

function safeStorage(): Storage | null {
  try {
    const probe = "__erp_probe__";
    window.localStorage.setItem(probe, "1");
    window.localStorage.removeItem(probe);
    return window.localStorage;
  } catch {
    return null;
  }
}

/** null when storage is unavailable (private window, blocked) — persistence just no-ops. */
export function createQueryPersister(): Persister | null {
  const storage = safeStorage();
  if (!storage) return null;

  const base = createSyncStoragePersister({
    storage,
    key: STORAGE_KEY,
    throttleTime: 1000,
  });

  // Wrap persistClient to strip everything not on the allowlist before it hits disk.
  return {
    ...base,
    persistClient: (client: PersistedClient) => {
      const queries = client.clientState.queries.filter((q) => {
        const root = Array.isArray(q.queryKey) ? String(q.queryKey[0]) : "";
        if (!PERSIST_ROOTS.has(root)) return false;
        // only the profile slice of the session domain
        if (root === "session" && q.queryKey[1] !== "profile") return false;
        // never persist an errored / empty query
        return q.state.status === "success" && q.state.data != null;
      });
      return base.persistClient({
        ...client,
        clientState: { ...client.clientState, queries, mutations: [] },
      });
    },
  };
}

export const QUERY_PERSIST_MAX_AGE = 24 * 60 * 60 * 1000; // a day of offline grace
