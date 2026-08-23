import { isStaticPrototype, STATIC_PROTOTYPE_PROFILE } from "./prototype";

// The httpOnly `erp_session` cookie is the only credential the backend
// accepts. Nothing session-shaped is ever stored client-side; this flag is a
// non-secret UX hint so synchronous UI gating keeps working between requests.
const LOGGED_IN_KEY = "loggedIn";
const PROFILE_DATA_KEY = "profileData";
const ADMIN_PASSWORD_KEY = "erp.admin.password";
const LOGIN_REDIRECT_KEY = "login_redirect";
const SESSION_EXPIRED_FLAG_KEY = "session_expired";

type PlainRecord = Record<string, unknown>;

function hasStorage() {
  return typeof window !== "undefined" && Boolean(window.localStorage);
}

function extractErrorMessage(payload: unknown, fallback: string) {
  if (!payload || typeof payload !== "object") return fallback;

  const body = payload as Record<string, unknown>;
  if (typeof body.error === "string" && body.error.trim()) {
    return body.error;
  }

  if (body.error && typeof body.error === "object") {
    const errorObject = body.error as Record<string, unknown>;
    if (typeof errorObject.message === "string" && errorObject.message.trim()) {
      return errorObject.message;
    }
  }

  if (typeof body.message === "string" && body.message.trim()) {
    return body.message;
  }

  return fallback;
}

function extractErrorCode(payload: unknown) {
  if (!payload || typeof payload !== "object") return "";

  const body = payload as Record<string, unknown>;
  if (typeof body.code === "string" && body.code.trim()) {
    return body.code.trim().toUpperCase();
  }

  if (body.error && typeof body.error === "object") {
    const errorObject = body.error as Record<string, unknown>;
    if (typeof errorObject.code === "string" && errorObject.code.trim()) {
      return errorObject.code.trim().toUpperCase();
    }
  }

  return "";
}

export function readStoredProfileData(): PlainRecord | null {
  if (!hasStorage()) return null;

  try {
    const raw = window.localStorage.getItem(PROFILE_DATA_KEY);
    if (!raw) return null;

    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return null;
    }

    return parsed as PlainRecord;
  } catch {
    return null;
  }
}

export function storeSessionAuth({ profileData }: { profileData?: unknown }) {
  if (!hasStorage()) return;

  window.localStorage.setItem(LOGGED_IN_KEY, "1");

  if (profileData && typeof profileData === "object") {
    window.localStorage.setItem(PROFILE_DATA_KEY, JSON.stringify(profileData));
  } else {
    window.localStorage.removeItem(PROFILE_DATA_KEY);
  }
}

export function clearSessionAuth() {
  if (!hasStorage()) return;
  window.localStorage.removeItem(LOGGED_IN_KEY);
  window.localStorage.removeItem(PROFILE_DATA_KEY);
  if (typeof window !== "undefined" && window.sessionStorage) {
    window.sessionStorage.removeItem(ADMIN_PASSWORD_KEY);
  }
}

export function hasSessionAuth() {
  if (isStaticPrototype()) return true;
  if (!hasStorage()) return false;
  return window.localStorage.getItem(LOGGED_IN_KEY) === "1";
}

export function isSessionAuthFailure(status: number, payload: unknown) {
  // 401 indicates authentication is required - redirect to login regardless of specific error code
  if (Number(status) === 401) return true;
  
  const code = extractErrorCode(payload);
  return code === "SESSION_EXPIRED" || code === "UNAUTHORIZED";
}

export function redirectToLogin() {
  if (typeof window === "undefined") return;
  if (isStaticPrototype()) return;
  if (window.location.pathname === "/login") return;

  const currentPath =
    `${window.location.pathname}${window.location.search}${window.location.hash}`;
  try {
    if (currentPath && !currentPath.startsWith("/login")) {
      window.sessionStorage.setItem(LOGIN_REDIRECT_KEY, currentPath);
      window.sessionStorage.setItem(SESSION_EXPIRED_FLAG_KEY, "1");
    }
  } catch {
    // sessionStorage may be unavailable (privacy mode); redirect still works.
  }

  window.location.replace("/login");
}

export function handleSessionAuthFailure() {
  if (isStaticPrototype()) return;
  clearSessionAuth();
  redirectToLogin();
}

export function consumeLoginRedirect(): string {
  if (typeof window === "undefined" || !window.sessionStorage) return "/dashboard";
  const target = window.sessionStorage.getItem(LOGIN_REDIRECT_KEY) || "/dashboard";
  window.sessionStorage.removeItem(LOGIN_REDIRECT_KEY);
  return target;
}

export function consumeSessionExpiredFlag(): boolean {
  if (typeof window === "undefined" || !window.sessionStorage) return false;
  const flagged = window.sessionStorage.getItem(SESSION_EXPIRED_FLAG_KEY) === "1";
  window.sessionStorage.removeItem(SESSION_EXPIRED_FLAG_KEY);
  return flagged;
}

// Loads the session profile over the network. Caching/dedup lives in the
// React Query layer (['session','profile'] — see lib/core/queryKeys.ts);
// this stays a plain transport function.
export async function fetchSessionProfile(): Promise<PlainRecord | null> {
  if (isStaticPrototype()) {
    let snapshot = { ...STATIC_PROTOTYPE_PROFILE } as PlainRecord;
    try {
      const base = import.meta.env.BASE_URL || "/";
      const prefix = base.endsWith("/") ? base : `${base}/`;
      const res = await fetch(`${prefix}fixtures/session-profile.json`, { credentials: "same-origin" });
      if (res.ok) {
        const body = (await res.json()) as unknown;
        if (body && typeof body === "object" && !Array.isArray(body)) {
          const record = body as PlainRecord;
          if (record.TableContent && typeof record.TableContent === "object" && !Array.isArray(record.TableContent)) {
            snapshot = {
              ...snapshot,
              TableContent: { ...(snapshot.TableContent as PlainRecord), ...(record.TableContent as PlainRecord) },
            };
          }
        }
      }
    } catch {
      /* keep STATIC_PROTOTYPE_PROFILE */
    }
    if (hasStorage()) {
      window.localStorage.setItem(PROFILE_DATA_KEY, JSON.stringify(snapshot));
    }
    return snapshot;
  }

  if (!hasSessionAuth()) {
    if (hasStorage()) {
      window.localStorage.removeItem(PROFILE_DATA_KEY);
    }
    return null;
  }

  const response = await fetch(`/api/profile`, {
    credentials: "include",
  });

  let payload: unknown = null;
  try {
    payload = await response.json();
  } catch {
    payload = null;
  }

  if (!response.ok) {
    if (isSessionAuthFailure(response.status, payload)) {
      handleSessionAuthFailure();
    }
    throw new Error(extractErrorMessage(payload, "Failed to fetch current session profile"));
  }

  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return null;
  }

  if (hasStorage()) {
    window.localStorage.setItem(PROFILE_DATA_KEY, JSON.stringify(payload));
  }

  return payload as PlainRecord;
}

export async function logoutSession() {
  if (isStaticPrototype()) {
    clearSessionAuth();
    return;
  }
  try {
    await fetch("/api/logout", {
      method: "POST",
      credentials: "include",
    });
  } catch {
    // Clearing client auth state is still useful even if logout transport fails.
  } finally {
    clearSessionAuth();
  }
}

const HEARTBEAT_INTERVAL_MS = 60_000;

// Keeps the local session TTL fresh and detects upstream ERP expiry
// proactively (server throttles its own upstream probes), so users get a
// clean re-login prompt instead of a mid-task hard failure.
export function startSessionHeartbeat() {
  if (typeof window === "undefined" || isStaticPrototype()) return () => {};

  let stopped = false;

  async function beat() {
    if (stopped) return;
    // Signed out or tab hidden — nothing to keep alive right now.
    if (!hasSessionAuth() || document.visibilityState !== "visible") return;
    try {
      const response = await fetch("/api/auth/heartbeat", { credentials: "include" });
      if (!response.ok) {
        if (isSessionAuthFailure(response.status, null)) handleSessionAuthFailure();
        return;
      }
      const payload = (await response.json().catch(() => null)) as
        | { data?: { alive?: boolean }; alive?: boolean }
        | null;
      const alive = payload?.data?.alive ?? payload?.alive ?? true;
      if (alive === false) handleSessionAuthFailure();
    } catch {
      // Offline or transient network issue — retry on the next tick.
    }
  }

  const onVisibilityChange = () => {
    if (document.visibilityState === "visible") void beat();
  };

  document.addEventListener("visibilitychange", onVisibilityChange);
  const intervalId = window.setInterval(() => { void beat(); }, HEARTBEAT_INTERVAL_MS);
  void beat();

  return () => {
    stopped = true;
    document.removeEventListener("visibilitychange", onVisibilityChange);
    window.clearInterval(intervalId);
  };
}
