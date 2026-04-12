import { useAdminMode } from "../context/AdminModeContext";

export function useAdminAccess() {
  const adminMode = useAdminMode();

  return {
    unlocked: adminMode.isAdmin,
    password: adminMode.promptPassword,
    setPassword: adminMode.setPromptPassword,
    busy: adminMode.busy,
    error: adminMode.error,
    unlock: adminMode.unlock,
    lock: adminMode.disable,
    adminHeaders: adminMode.adminHeaders,
  };
}
