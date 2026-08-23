
// ── AdminAccessPanel ─────────────────────────────────────────────────────

import * as React from "react";
import { StatusBanner } from "../erp/ErpPrimitives";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "../dialog";
import { PasswordInput } from "../ui/PasswordInput";
import { useAdminMode } from "../../contexts/AdminModeContext";

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
          <PasswordInput
            value={password}
            onChange={(event) => onPasswordChange(event.target.value)}
            placeholder="Enter admin password"
            aria-label="Admin password"
            containerClassName="flex-1 min-w-[220px]"
          />
          <button
            type="button"
            onClick={onUnlock}
            disabled={busy || !password.trim()}
            className="btn-primary"
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

export function AdminAccessPrompt() {
  const admin = useAdminMode();

  return (
    <Dialog
      open={admin.showPrompt}
      onOpenChange={(open) => {
        if (!open) admin.skipPrompt();
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Admin privileges available</DialogTitle>
          <DialogDescription>
            Enter your password to unlock admin tools for this session.
          </DialogDescription>
        </DialogHeader>
        <div className="px-6">
          <label className="mb-1 block text-sm font-medium text-[var(--text-primary)]" htmlFor="admin-prompt-password">
            Admin password
          </label>
          <PasswordInput
            id="admin-prompt-password"
            value={admin.promptPassword}
            onChange={(event) => admin.setPromptPassword(event.target.value)}
            placeholder="Enter admin password"
            aria-label="Admin password"
          />
          {admin.error ? (
            <p role="alert" className="mt-1 text-xs text-[var(--error)]">
              {admin.error}
            </p>
          ) : null}
        </div>
        <div className="flex items-center justify-end gap-2 px-6 pb-6 pt-2">
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
            className="btn-primary"
          >
            {admin.busy ? "Unlocking..." : "Unlock Admin"}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

