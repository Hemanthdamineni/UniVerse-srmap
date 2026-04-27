import { useState } from "react";
import type { LmsAnnotation } from "../../lib/lmsApi";

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
        <h3 className="text-base font-semibold text-[var(--comp-text-primary)]">Private notes</h3>
        {annotations[0] ? (
          <button
            className="text-xs font-medium text-rose-600"
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
        className="min-h-32 w-full rounded-2xl border border-[color-mix(in_srgb,var(--comp-accent)_15%,transparent)] bg-white px-4 py-3 text-sm outline-none focus:border-[var(--info)]"
        value={value}
        onChange={(event) => setValue(event.target.value)}
        placeholder="Write your personal notes here..."
      />
      <button
        className="rounded-full bg-[var(--comp-accent)] px-4 py-2 text-sm font-semibold text-white"
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
        {busy ? "Saving..." : "Save note"}
      </button>
    </section>
  );
}
