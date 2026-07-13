import { requestData } from "../core/apiClient";

const ADMIN_PASSWORD_KEY = "erp.admin.password";

export type AdminAccessState = {
  unlocked: boolean;
};

function hasSessionStorage() {
  return typeof window !== "undefined" && Boolean(window.sessionStorage);
}

export function getStoredAdminPassword() {
  if (!hasSessionStorage()) return "";
  return window.sessionStorage.getItem(ADMIN_PASSWORD_KEY) || "";
}

export function hasStoredAdminPassword() {
  return Boolean(getStoredAdminPassword());
}

export function storeAdminPassword(password: string) {
  if (!hasSessionStorage()) return;
  window.sessionStorage.setItem(ADMIN_PASSWORD_KEY, password);
}

export function clearStoredAdminPassword() {
  if (!hasSessionStorage()) return;
  window.sessionStorage.removeItem(ADMIN_PASSWORD_KEY);
}

export function getAdminHeaders(passwordOverride?: string): Record<string, string> {
  const password = String(passwordOverride || getStoredAdminPassword()).trim();
  return password ? { "x-admin-password": password } : {};
}

export async function verifyAdminPassword(password: string) {
  const data = await requestData<{ verified: boolean }>("/api/content/admin/verify", {
    method: "POST",
    headers: getAdminHeaders(password),
    body: JSON.stringify({ adminPassword: password }),
  });
  storeAdminPassword(password);
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
      potentialAdmin: true,
      isAdmin: true,
    };
  }
  return requestData<AdminAccessStatus>("/api/admin/access/status");
}

export async function unlockAdminMode(password: string) {
  if (isStaticPrototype()) {
    return { isAdmin: true };
  }
  const data = await requestData<{ isAdmin: boolean }>("/api/admin/access/unlock", {
    method: "POST",
    headers: getAdminHeaders(password),
  });
  storeAdminPassword(password);
  return data;
}

export async function disableAdminMode() {
  if (isStaticPrototype()) {
    return { isAdmin: true };
  }
  clearStoredAdminPassword();
  return requestData<{ isAdmin: boolean }>("/api/admin/access/disable", {
    method: "POST",
  });
}
