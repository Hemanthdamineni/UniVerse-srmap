const SESSION_ID_KEY = "sessionId";
const PROFILE_DATA_KEY = "profileData";
const ADMIN_PASSWORD_KEY = "erp.admin.password";

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

export function getSessionId() {
  if (!hasStorage()) return "";
  return window.localStorage.getItem(SESSION_ID_KEY) || "";
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

export function storeSessionAuth({
  sessionId,
  profileData,
}: {
  sessionId: string;
  profileData?: unknown;
}) {
  if (!hasStorage()) return;

  window.localStorage.setItem(SESSION_ID_KEY, String(sessionId || ""));

  if (profileData && typeof profileData === "object") {
    window.localStorage.setItem(PROFILE_DATA_KEY, JSON.stringify(profileData));
  } else {
    window.localStorage.removeItem(PROFILE_DATA_KEY);
  }
}

export function clearSessionAuth() {
  if (!hasStorage()) return;
  window.localStorage.removeItem(SESSION_ID_KEY);
  window.localStorage.removeItem(PROFILE_DATA_KEY);
  if (typeof window !== "undefined" && window.sessionStorage) {
    window.sessionStorage.removeItem(ADMIN_PASSWORD_KEY);
  }
}

export function hasSessionAuth() {
  return Boolean(getSessionId());
}

export function isSessionAuthFailure(status: number, payload: unknown) {
  // 401 indicates authentication is required - redirect to login regardless of specific error code
  if (Number(status) === 401) return true;
  
  const code = extractErrorCode(payload);
  return code === "SESSION_EXPIRED" || code === "UNAUTHORIZED";
}

export function redirectToLogin() {
  if (typeof window === "undefined") return;
  if (window.location.pathname === "/login") return;
  window.location.replace("/login");
}

export function handleSessionAuthFailure() {
  clearSessionAuth();
  redirectToLogin();
}

export async function fetchSessionProfile(): Promise<PlainRecord | null> {
  const sessionId = getSessionId();
  if (!sessionId) {
    if (hasStorage()) {
      window.localStorage.removeItem(PROFILE_DATA_KEY);
    }
    return null;
  }

  const response = await fetch(`/api/profile?sessionId=${encodeURIComponent(sessionId)}`, {
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
