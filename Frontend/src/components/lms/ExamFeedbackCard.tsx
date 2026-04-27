import type { LmsResource } from "../../lib/lmsApi";

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
        <h3 className="text-base font-semibold text-[var(--comp-text-primary)]">{resource.title}</h3>
        <p className="text-sm text-[var(--text-secondary)]">{resource.subjectCode}</p>
      </div>
      <div className="flex gap-2">
        <button
          className={`rounded-full px-4 py-2 text-sm font-semibold ${
            value === true ? "bg-emerald-600 text-white" : "bg-emerald-100 text-[var(--success)]"
          }`}
          onClick={() => onChange(true)}
        >
          Helped
        </button>
        <button
          className={`rounded-full px-4 py-2 text-sm font-semibold ${
            value === false ? "bg-rose-600 text-white" : "bg-rose-100 text-rose-700"
          }`}
          onClick={() => onChange(false)}
        >
          Didn't help
        </button>
      </div>
    </article>
  );
}
