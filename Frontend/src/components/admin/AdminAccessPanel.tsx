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
