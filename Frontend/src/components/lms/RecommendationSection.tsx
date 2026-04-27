import type { LmsResource } from "../../lib/lmsApi";
import ResourceGrid from "./ResourceGrid";

export default function RecommendationSection({
  title,
  items,
}: {
  title: string;
  items: LmsResource[];
}) {
  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-[var(--comp-text-primary)]">{title}</h2>
        <span className="text-sm text-[var(--text-secondary)]">{items.length} items</span>
      </div>
      <ResourceGrid items={items} />
    </section>
  );
}
