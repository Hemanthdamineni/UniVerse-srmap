import { useState } from "react";
import type { LmsAnnotation } from "../../lib/lms/index";

export default function AnnotationPanel({
  annotations,
  onSave,
  onDelete,
}: {
  annotations: LmsAnnotation[];
  onSave: (content: string) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}) {
  const [value, setValue] = useState(annotations[0]?.content || "");
  const [busy, setBusy] = useState(false);

  return (
    <section className="dashboard-card space-y-3 p-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-[var(--comp-text-primary)]">Private notes</h3>
        {annotations[0] ? (
          <button
            className="btn-ghost text-xs"
            style={{ color: "var(--error)" }}
            onClick={async () => {
              setBusy(true);
              try {
                await onDelete(annotations[0].id);
                setValue("");
              } finally {
                setBusy(false);
              }
            }}
            disabled={busy}
          >
            Delete
          </button>
        ) : null}
      </div>
      <textarea
        className="min-h-28 w-full rounded-lg border px-3 py-2.5 text-sm outline-none transition focus:border-[var(--info)]"
        style={{
          background: "var(--comp-surface)",
          borderColor: "var(--comp-border)",
          color: "var(--comp-text-primary)",
        }}
        value={value}
        onChange={(event) => setValue(event.target.value)}
        placeholder="Write your personal notes here..."
      />
      <button
        className="btn-primary"
        onClick={async () => {
          setBusy(true);
          try {
            await onSave(value);
          } finally {
            setBusy(false);
          }
        }}
        disabled={busy}
      >
        {busy ? "Saving…" : "Save note"}
      </button>
    </section>
  );
}
