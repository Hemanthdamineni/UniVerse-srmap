import { requestData } from "./apiClient";
import { clearStoredAdminPassword, getAdminHeaders, storeAdminPassword } from "./adminApi";
import { isStaticPrototype } from "./prototype/staticPrototypeEnv";
import { getCurrentRegNo } from "./identity";

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
