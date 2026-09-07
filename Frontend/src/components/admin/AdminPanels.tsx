

import * as React from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "../dialog";
import { PasswordInput } from "../ui/PasswordInput";
import { useAdminMode } from "../../contexts/AdminModeContext";

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

