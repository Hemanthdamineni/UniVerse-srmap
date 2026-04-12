import { requestData } from "./apiClient";

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
