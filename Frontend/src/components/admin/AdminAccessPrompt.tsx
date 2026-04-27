import { useAdminMode } from "../../context/AdminModeContext";

export default function AdminAccessPrompt() {
  const admin = useAdminMode();

  if (!admin.showPrompt) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 px-4">
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
