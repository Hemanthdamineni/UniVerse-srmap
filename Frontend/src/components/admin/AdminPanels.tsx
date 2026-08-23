
// ── AdminAccessPanel ─────────────────────────────────────────────────────

import * as React from "react";
import { StatusBanner } from "../erp/ErpPrimitives";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "../dialog";
import { useAdminMode } from "../../contexts/AdminModeContext";

function EyeIcon({ open }: { open: boolean }) {
  return open ? (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
      <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
      <line x1="1" y1="1" x2="23" y2="23" />
    </svg>
  ) : (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

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
  const [showPassword, setShowPassword] = React.useState(false);

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
          <div style={{ position: "relative", flex: 1, minWidth: "220px" }}>
            <input
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(event) => onPasswordChange(event.target.value)}
              placeholder="Enter admin password"
              aria-label="Admin password"
              className="min-w-[220px] flex-1 rounded-xl border border-[var(--border)] bg-[var(--background)] px-4 py-2.5 text-sm outline-none focus:border-[var(--comp-accent)] pr-12"
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              aria-label={showPassword ? "Hide password" : "Show password"}
              style={{
                position: "absolute",
                right: "10px",
                top: "50%",
                transform: "translateY(-50%)",
                background: "transparent",
                border: "none",
                cursor: "pointer",
                color: "var(--text-secondary)",
                display: "flex",
                alignItems: "center",
                padding: "2px",
                transition: "color var(--transition-fast)",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.color = "var(--comp-accent)")}
              onMouseLeave={(e) => (e.currentTarget.style.color = "var(--text-secondary)")}
            >
              <EyeIcon open={showPassword} />
            </button>
          </div>
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
  const [showPassword, setShowPassword] = React.useState(false);

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
          <div style={{ position: "relative" }}>
            <input
              id="admin-prompt-password"
              type={showPassword ? "text" : "password"}
              value={admin.promptPassword}
              onChange={(event) => admin.setPromptPassword(event.target.value)}
              className="w-full rounded-xl border border-[var(--border)] bg-[var(--background)] px-4 py-2.5 text-sm outline-none focus:border-[var(--comp-accent)] pr-12"
              placeholder="Enter admin password"
              aria-label="Admin password"
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              aria-label={showPassword ? "Hide password" : "Show password"}
              style={{
                position: "absolute",
                right: "10px",
                top: "50%",
                transform: "translateY(-50%)",
                background: "transparent",
                border: "none",
                cursor: "pointer",
                color: "var(--text-secondary)",
                display: "flex",
                alignItems: "center",
                padding: "2px",
                transition: "color var(--transition-fast)",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.color = "var(--comp-accent)")}
              onMouseLeave={(e) => (e.currentTarget.style.color = "var(--text-secondary)")}
            >
              <EyeIcon open={showPassword} />
            </button>
          </div>
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

