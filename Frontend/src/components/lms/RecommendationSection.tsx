import { Link } from "react-router-dom";
import type { LmsResource } from "../../lib/lms/index";
import ResourceGrid from "./ResourceGrid";

export default function RecommendationSection({
  title,
  items,
}: {
  title: string;
  items: LmsResource[];
}) {
  return (
    <section className="space-y-3">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-sm font-semibold text-[var(--comp-text-primary)]">
          {title}
        </h2>
        {items.length > 0 && (
          <Link
            to="/learn/discover"
            className="text-xs font-medium text-[var(--comp-text-muted)] no-underline hover:text-[var(--comp-text-primary)]"
          >
            View all
          </Link>
        )}
      </div>

      {items.length === 0 ? (
        <div className="flex min-h-20 items-center justify-center rounded-xl border-[1.5px] border-dashed border-[var(--comp-border)] bg-[var(--comp-surface)] px-6">
          <p className="text-sm text-[var(--comp-text-muted)]">
            No {title.toLowerCase()} yet
          </p>
        </div>
      ) : (
        <ResourceGrid items={items} />
      )}
    </section>
  );
}
