import { requestData } from "../core/apiClient";

export type AdminAccessState = {
  unlocked: boolean;
};

/**
 * Return admin headers for a single request.
 * The password is never persisted — it lives in-memory only for the duration
 * of the unlock call, then discarded. Server-side session elevation handles
 * subsequent authentication.
 */
function getAdminHeaders(password: string): Record<string, string> {
  const trimmed = String(password).trim();
  return trimmed ? { "x-admin-password": trimmed } : {};
}

export async function verifyAdminPassword(password: string) {
  const data = await requestData<{ verified: boolean }>("/api/content/admin/verify", {
    method: "POST",
    headers: getAdminHeaders(password),
    body: JSON.stringify({ adminPassword: password }),
  });
  return data;
}

// ── adminModeApi ──────────────────────────────────────────
import { isStaticPrototype } from "../core/prototype";
import { getCurrentRegNo } from "../core/identity";

export type AdminAccessStatus = {
  registerNo: string;
  potentialAdmin: boolean;
  isAdmin: boolean;
};

export async function getAdminAccessStatus() {
  if (isStaticPrototype()) {
    return {
      registerNo: getCurrentRegNo() || "AP23110010419",
      // Static hosting is a student-facing demo. Never expose privileged
      // navigation or imply that administrative actions are available there.
      potentialAdmin: false,
      isAdmin: false,
    };
  }
  return requestData<AdminAccessStatus>("/api/admin/access/status");
}

export async function unlockAdminMode(password: string) {
  if (isStaticPrototype()) {
    throw new Error("Admin mode is not available in the static prototype.");
  }
  const data = await requestData<{ isAdmin: boolean }>("/api/admin/access/unlock", {
    method: "POST",
    headers: getAdminHeaders(password),
  });
  return data;
}

export async function disableAdminMode() {
  if (isStaticPrototype()) {
    return { isAdmin: false };
  }
  return requestData<{ isAdmin: boolean }>("/api/admin/access/disable", {
    method: "POST",
  });
}
