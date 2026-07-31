import type { LmsGuideSection } from "../../lib/lms/index";

export default function GuideSection({
  section,
  onMarkRead,
}: {
  section: LmsGuideSection;
  onMarkRead?: (id: string) => Promise<void>;
}) {
  return (
    <section className="dashboard-card space-y-3 p-4">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-sm font-semibold text-[var(--comp-text-primary)]">{section.title}</h3>
        {onMarkRead ? (
          <button
            className="btn-ghost text-xs"
            onClick={() => onMarkRead(section.id)}
          >
            Mark read
          </button>
        ) : null}
      </div>
      <div className="whitespace-pre-wrap text-sm leading-7 text-[var(--comp-text-secondary)]">
        {section.content}
      </div>
    </section>
  );
}
