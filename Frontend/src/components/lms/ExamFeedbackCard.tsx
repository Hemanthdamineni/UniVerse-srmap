import type { LmsResource } from "../../lib/lms/index";

export default function ExamFeedbackCard({
  resource,
  value,
  onChange,
}: {
  resource: LmsResource;
  value?: boolean | null;
  onChange: (next: boolean) => void;
}) {
  return (
    <article className="dashboard-card space-y-3 p-4">
      <div>
        <h3 className="text-sm font-semibold text-[var(--comp-text-primary)]">{resource.title}</h3>
        <p className="text-xs text-[var(--comp-text-muted)]">{resource.subjectCode}</p>
      </div>
      <div className="flex gap-2">
        <button
          className="rounded-lg px-3 py-1.5 text-sm font-semibold transition"
          style={{
            background: value === true
              ? "var(--success)"
              : "color-mix(in srgb, var(--success) 10%, transparent)",
            color: value === true ? "#fff" : "var(--success)",
          }}
          onClick={() => onChange(true)}
        >
          Helped
        </button>
        <button
          className="rounded-lg px-3 py-1.5 text-sm font-semibold transition"
          style={{
            background: value === false
              ? "var(--error)"
              : "color-mix(in srgb, var(--error) 10%, transparent)",
            color: value === false ? "#fff" : "var(--error)",
          }}
          onClick={() => onChange(false)}
        >
          Didn't help
        </button>
      </div>
    </article>
  );
}
