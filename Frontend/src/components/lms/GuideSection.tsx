import type { LmsGuideSection } from "../../lib/lms/index";

export default function GuideSection({
  section,
  onMarkRead,
}: {
  section: LmsGuideSection;
  onMarkRead?: (id: string) => Promise<void>;
}) {
  return (
    <section className="dashboard-card space-y-3 p-5">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-lg font-semibold text-[var(--comp-text-primary)]">{section.title}</h3>
        {onMarkRead ? (
          <button
            className="rounded-full bg-[var(--comp-accent)] px-3 py-1.5 text-xs font-semibold text-white"
            onClick={() => onMarkRead(section.id)}
          >
            Mark read
          </button>
        ) : null}
      </div>
      <div className="whitespace-pre-wrap text-sm leading-7 text-[var(--text-secondary)]">
        {section.content}
      </div>
    </section>
  );
}
