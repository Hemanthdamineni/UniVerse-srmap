import type { LmsResource } from "../../lib/lms/index";
import ResourceCard from "./ResourceCard";

export default function ResourceGrid({ items }: { items: LmsResource[] }) {
  if (items.length === 0) {
    return (
      <div className="dashboard-card border-dashed p-8 text-center text-sm text-[var(--text-secondary)]">
        No resources found.
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 xl:grid-cols-3">
      {items.map((item) => (
        <ResourceCard key={item.id} resource={item} />
      ))}
    </div>
  );
}
