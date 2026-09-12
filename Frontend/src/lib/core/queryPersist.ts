/**
 * queryPersist.ts — offline-first cache for the data a student needs without
 * signal (Batch B13 / T7.2.1).
 *
 * A localStorage persister replays the last successful responses for a small
 * allowlist of safe-to-be-stale reads (timetable, attendance, results, the
 * student graph). The snapshot is scoped to the authenticated student and is
 * synchronously removed on every logout/session-expiry path. Mutations, auth,
 * and session state never round-trip through disk.
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
  "academic-calendar",
]);

const STORAGE_KEY_PREFIX = "erp.query-cache.v2";
const STORAGE_SCOPE_KEY = "erp.query-cache.scope";
const AUTH_STATE_EVENT = "erp-auth-state-changed";

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

  const scope = getQueryPersistScope(storage);
  // Never write student data to a shared/anonymous cache key. The provider is
  // refreshed after authentication state changes, so a successful login gets
  // its own per-student key and a logout gets no persister at all.
  if (!scope) return null;

  const base = createSyncStoragePersister({
    storage,
    key: `${STORAGE_KEY_PREFIX}.${scope}`,
    throttleTime: 1000,
  });

  // Wrap persistClient to strip everything not on the allowlist before it hits disk.
  return {
    ...base,
    persistClient: (client: PersistedClient) => {
      const queries = client.clientState.queries.filter((q) => {
        const root = Array.isArray(q.queryKey) ? String(q.queryKey[0]) : "";
        if (!PERSIST_ROOTS.has(root)) return false;
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

function normalizeScope(value: unknown) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]/g, "")
    .slice(0, 128);
}

function getQueryPersistScope(storage = safeStorage()) {
  if (!storage) return "";
  try {
    return normalizeScope(storage.getItem(STORAGE_SCOPE_KEY));
  } catch {
    return "";
  }
}

function clearScopedEntries(storage: Storage) {
  const prefix = `${STORAGE_KEY_PREFIX}.`;
  const keys: string[] = [];
  for (let index = 0; index < storage.length; index += 1) {
    const key = storage.key(index);
    if (key?.startsWith(prefix)) keys.push(key);
  }
  for (const key of keys) storage.removeItem(key);
  // Remove the unscoped legacy cache so an upgrade can never hydrate it.
  storage.removeItem("erp.query-cache.v1");
}

/**
 * Starts a new authenticated cache scope. Switching identities clears every
 * persisted snapshot before the new scope is announced to AppProviders.
 */
export function setQueryPersistScope(identity: unknown) {
  const storage = safeStorage();
  if (!storage) return;
  const scope = normalizeScope(identity);
  if (!scope) {
    clearQueryPersistedCache();
    return;
  }
  try {
    const previous = getQueryPersistScope(storage);
    if (previous !== scope) clearScopedEntries(storage);
    storage.setItem(STORAGE_SCOPE_KEY, scope);
  } catch {
    return;
  }
  window.dispatchEvent(new CustomEvent(AUTH_STATE_EVENT, { detail: { scope } }));
}

/** Removes every student snapshot, including prior schema versions. */
export function clearQueryPersistedCache() {
  const storage = safeStorage();
  if (!storage) return;
  try {
    clearScopedEntries(storage);
    storage.removeItem(STORAGE_SCOPE_KEY);
  } catch {
    return;
  }
  window.dispatchEvent(new CustomEvent(AUTH_STATE_EVENT, { detail: { scope: "" } }));
}

export { AUTH_STATE_EVENT, getQueryPersistScope };

export const QUERY_PERSIST_MAX_AGE = 24 * 60 * 60 * 1000; // a day of offline grace
