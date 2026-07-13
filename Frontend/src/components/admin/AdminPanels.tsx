
// ── AdminAccessPanel ─────────────────────────────────────────────────────

import { StatusBanner } from "../erp/ErpPrimitives";

type Props = {
  unlocked: boolean;
  password: string;
  busy?: boolean;
  error?: string;
  label?: string;
  onPasswordChange: (value: string) => void;
  onUnlock: () => void;
  onLock: () => void;
};

export function AdminAccessPanel({
  unlocked,
  password,
  busy = false,
  error = "",
  label = "Admin controls",
  onPasswordChange,
  onUnlock,
  onLock,
}: Props) {
  return (
    <div className="rounded-2xl border border-[var(--border)] bg-[var(--comp-surface)] p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-[var(--comp-text-primary)]">{label}</h3>
          <p className="text-xs text-[var(--text-secondary)]">
            {unlocked
              ? "Admin controls are unlocked for this tab."
              : "Unlock once per tab to manage content and moderation actions."}
          </p>
        </div>
        {unlocked ? (
          <button
            type="button"
            onClick={onLock}
            className="rounded-full border border-[color-mix(in_srgb,var(--error)_30%,transparent)] px-4 py-2 text-xs font-semibold text-[var(--error)] transition hover:bg-[color-mix(in_srgb,var(--error)_10%,transparent)]"
          >
            Lock Admin
          </button>
        ) : null}
      </div>

      {!unlocked ? (
        <div className="mt-3 flex flex-wrap gap-2">
          <input
            type="password"
            value={password}
            onChange={(event) => onPasswordChange(event.target.value)}
            placeholder="Enter admin password"
            aria-label="Admin password"
            className="min-w-[220px] flex-1 rounded-xl border border-[var(--border)] bg-[var(--background)] px-4 py-2.5 text-sm outline-none focus:border-[var(--comp-accent)]"
          />
          <button
            type="button"
            onClick={onUnlock}
            disabled={busy || !password.trim()}
            className="rounded-full bg-[var(--comp-accent)] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[var(--comp-accent-hover)] disabled:opacity-50"
          >
            {busy ? "Unlocking..." : "Unlock Admin"}
          </button>
        </div>
      ) : null}

      {error ? <div className="mt-3"><StatusBanner message={{ id: "admin-error", tone: "warning", text: error }} /></div> : null}
    </div>
  );
}


// ── AdminAccessPrompt ─────────────────────────────────────────────────────

import * as React from "react";
import { useAdminMode } from "../../contexts/AdminModeContext";

export function AdminAccessPrompt() {
  const admin = useAdminMode();

  React.useEffect(() => {
    const main = document.getElementById("main-content");
    if (admin.showPrompt && main) {
      main.setAttribute("inert", "");
      return () => { main.removeAttribute("inert"); };
    }
  }, [admin.showPrompt]);

  if (!admin.showPrompt) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--contrast-2)]/45 px-4">
      <div className="w-full max-w-md rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-xl">
        <h3 className="text-lg font-semibold text-[var(--text-primary)]">Admin privileges available</h3>
        <p className="mt-2 text-sm text-[var(--text-secondary)]">
          Admin privileges available. Do you want to unlock admin mode?
        </p>
        <div className="mt-4">
          <label className="mb-1 block text-sm font-medium text-[var(--text-primary)]">Admin password</label>
          <input
            type="password"
            value={admin.promptPassword}
            onChange={(event) => admin.setPromptPassword(event.target.value)}
            className="w-full rounded-xl border border-[var(--border)] bg-[var(--background)] px-4 py-2.5 text-sm outline-none focus:border-[var(--comp-accent)]"
            placeholder="Enter admin password"
            aria-label="Admin password"
          />
          {admin.error ? <p className="mt-1 text-xs text-[var(--error)]">{admin.error}</p> : null}
        </div>
        <div className="mt-5 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={admin.skipPrompt}
            className="rounded-xl border border-[var(--border)] px-4 py-2 text-sm font-semibold text-[var(--text-secondary)]"
          >
            Skip
          </button>
          <button
            type="button"
            disabled={admin.busy}
            onClick={() => void admin.unlock()}
            className="rounded-xl bg-[var(--comp-accent)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
          >
            {admin.busy ? "Unlocking..." : "Unlock Admin"}
          </button>
        </div>
      </div>
    </div>
  );
}

