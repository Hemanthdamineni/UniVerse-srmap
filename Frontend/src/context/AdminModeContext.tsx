import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { hasSessionAuth } from "../lib/session";
import { disableAdminMode, getAdminAccessStatus, unlockAdminMode } from "../lib/adminModeApi";
import { getAdminHeaders } from "../lib/adminApi";
import { getCurrentRegNo, isPlatformAdmin } from "../lib/identity";

type AdminModeState = {
  potentialAdmin: boolean;
  isAdmin: boolean;
  registerNo: string;
  showPrompt: boolean;
  busy: boolean;
  error: string;
  promptPassword: string;
  setPromptPassword: (value: string) => void;
  skipPrompt: () => void;
  openPrompt: () => void;
  unlock: () => Promise<void>;
  disable: () => Promise<void>;
  adminHeaders: HeadersInit;
};

const PROMPT_DISMISSED_KEY = "erp.admin.prompt.dismissed";

const AdminModeContext = createContext<AdminModeState | null>(null);

function hasSessionStorage() {
  return typeof window !== "undefined" && Boolean(window.sessionStorage);
}

export function AdminModeProvider({ children }: { children: React.ReactNode }) {
  const [potentialAdmin, setPotentialAdmin] = useState(() => isPlatformAdmin());
  const [isAdmin, setIsAdmin] = useState(() => isPlatformAdmin());
  const [registerNo, setRegisterNo] = useState(() => getCurrentRegNo());
  const [showPrompt, setShowPrompt] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [promptPassword, setPromptPassword] = useState("");

  useEffect(() => {
    if (!hasSessionAuth()) {
      setPotentialAdmin(false);
      setIsAdmin(false);
      setShowPrompt(false);
      return;
    }
    let active = true;
    getAdminAccessStatus()
      .then((status) => {
        if (!active) return;
        setPotentialAdmin(Boolean(status.potentialAdmin));
        setIsAdmin(Boolean(status.isAdmin));
        setRegisterNo(status.registerNo || "");
        const dismissed =
          hasSessionStorage() && window.sessionStorage.getItem(PROMPT_DISMISSED_KEY) === "1";
        setShowPrompt(Boolean(status.potentialAdmin) && !status.isAdmin && !dismissed);
      })
      .catch(() => {
        if (!active) return;
        setPotentialAdmin(false);
        setIsAdmin(false);
        setShowPrompt(false);
      });
    return () => {
      active = false;
    };
  }, []);

  async function unlock() {
    setBusy(true);
    setError("");
    try {
      await unlockAdminMode(promptPassword);
      setIsAdmin(true);
      setShowPrompt(false);
      setPromptPassword("");
      if (hasSessionStorage()) window.sessionStorage.setItem(PROMPT_DISMISSED_KEY, "1");
    } catch (unlockError) {
      setError(unlockError instanceof Error ? unlockError.message : "Invalid admin password.");
    } finally {
      setBusy(false);
    }
  }

  function skipPrompt() {
    setShowPrompt(false);
    if (hasSessionStorage()) window.sessionStorage.setItem(PROMPT_DISMISSED_KEY, "1");
  }

  function openPrompt() {
    if (!potentialAdmin || isAdmin) return;
    setShowPrompt(true);
    setError("");
  }

  async function disable() {
    setBusy(true);
    setError("");
    try {
      await disableAdminMode();
      setIsAdmin(false);
      if (hasSessionStorage()) window.sessionStorage.setItem(PROMPT_DISMISSED_KEY, "1");
    } catch (disableError) {
      setError(disableError instanceof Error ? disableError.message : "Failed to disable admin mode.");
    } finally {
      setBusy(false);
    }
  }

  const value = useMemo<AdminModeState>(
    () => ({
      potentialAdmin,
      isAdmin,
      registerNo,
      showPrompt,
      busy,
      error,
      promptPassword,
      setPromptPassword,
      skipPrompt,
      openPrompt,
      unlock,
      disable,
      adminHeaders: getAdminHeaders(),
    }),
    [potentialAdmin, isAdmin, registerNo, showPrompt, busy, error, promptPassword]
  );

  return <AdminModeContext.Provider value={value}>{children}</AdminModeContext.Provider>;
}

export function useAdminMode() {
  const value = useContext(AdminModeContext);
  if (!value) {
    throw new Error("useAdminMode must be used within AdminModeProvider");
  }
  return value;
}
