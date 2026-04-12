import { requestData } from "./apiClient";
import { clearStoredAdminPassword, getAdminHeaders, storeAdminPassword } from "./adminApi";

export type AdminAccessStatus = {
  registerNo: string;
  potentialAdmin: boolean;
  isAdmin: boolean;
};

export async function getAdminAccessStatus() {
  return requestData<AdminAccessStatus>("/api/admin/access/status");
}

export async function unlockAdminMode(password: string) {
  const data = await requestData<{ isAdmin: boolean }>("/api/admin/access/unlock", {
    method: "POST",
    headers: getAdminHeaders(password),
  });
  storeAdminPassword(password);
  return data;
}

export async function disableAdminMode() {
  clearStoredAdminPassword();
  return requestData<{ isAdmin: boolean }>("/api/admin/access/disable", {
    method: "POST",
  });
}
